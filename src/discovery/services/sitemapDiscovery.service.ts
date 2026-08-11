import { sourceRegistryService } from './sourceRegistry.service';
import { urlDiscoveryService } from './urlDiscovery.service';
import { logger } from '../../utils/logger';

// ─── Sitemap Parser ───────────────────────────────────────────────────────────

interface SitemapEntry {
  url: string;
  lastmod?: string;
}

async function fetchSitemap(domain: string): Promise<SitemapEntry[]> {
  const urls: SitemapEntry[] = [];

  try {
    // Try /sitemap.xml
    const response = await fetch(`https://${domain}/sitemap.xml`, {
      headers: { 'User-Agent': 'CareerTrackerBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const xml = await response.text();

    // Check if it's a sitemap index
    if (xml.includes('<sitemapindex')) {
      const sitemapUrls = extractUrls(xml, 'sitemap');
      // Fetch child sitemaps (limit to 3)
      for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
        const childEntries = await fetchChildSitemap(sitemapUrl);
        urls.push(...childEntries);
      }
    } else {
      // Direct sitemap
      const entries = parseSitemap(xml);
      urls.push(...entries);
    }
  } catch (error) {
    logger.warn(`Sitemap fetch failed for ${domain}: ${(error as Error).message}`);
  }

  return urls;
}

async function fetchChildSitemap(url: string): Promise<SitemapEntry[]> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'CareerTrackerBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const xml = await response.text();
    return parseSitemap(xml);
  } catch {
    return [];
  }
}

function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const urlRegex = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/gi;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(xml)) !== null) {
    if (match[1]) {
      entries.push({ url: match[1].trim(), lastmod: match[2]?.trim() });
    }
  }

  return entries;
}

function extractUrls(xml: string, tag: string): string[] {
  const urls: string[] = [];
  const regex = new RegExp(`<${tag}>\\s*<loc>([^<]+)<\\/loc>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) urls.push(match[1].trim());
  }
  return urls;
}

// ─── Job URL Patterns ─────────────────────────────────────────────────────────

const JOB_URL_PATTERNS = [
  /\/jobs?\//i,
  /\/careers?\//i,
  /\/positions?\//i,
  /\/openings?\//i,
  /\/vacancies?\//i,
  /\/apply\//i,
  /\/job-/i,
  /\/career-/i,
];

function isLikelyJobUrl(url: string): boolean {
  return JOB_URL_PATTERNS.some((p) => p.test(url));
}

// ─── Main Discovery Service ──────────────────────────────────────────────────

export class SitemapDiscoveryService {
  /**
   * Discover job URLs from a domain's sitemap.
   */
  async discoverFromSitemap(domain: string, sourceId: string): Promise<{ discovered: number; total: number }> {
    logger.info(`Discovering jobs from sitemap: ${domain}`);

    const entries = await fetchSitemap(domain);

    if (entries.length === 0) {
      logger.info(`No sitemap entries found for ${domain}`);
      return { discovered: 0, total: 0 };
    }

    // Filter to likely job URLs
    const jobUrls = entries.filter((e) => isLikelyJobUrl(e.url));

    if (jobUrls.length === 0) {
      logger.info(`No job URLs found in sitemap for ${domain} (${entries.length} total URLs)`);
      return { discovered: 0, total: entries.length };
    }

    // Submit to URL queue
    const result = await urlDiscoveryService.submitBatch(
      jobUrls.slice(0, 500).map((entry) => ({  // Cap at 500 per domain per run
        url: entry.url,
        domain,
        sourceId,
        discoveryMethod: 'sitemap' as const,
      }))
    );

    logger.info(`Sitemap discovery for ${domain}: ${result.added} new URLs from ${jobUrls.length} job URLs (${entries.length} total sitemap entries)`);

    return { discovered: result.added, total: entries.length };
  }

  /**
   * Run discovery for all active sources that use sitemap access method.
   */
  async runFullDiscovery(): Promise<{ sourcesProcessed: number; totalDiscovered: number }> {
    const sources = await sourceRegistryService.getActiveSources();
    const sitemapSources = sources.filter(
      (s) => s.accessMethod === 'sitemap' || s.sourceType === 'website'
    );

    let totalDiscovered = 0;

    for (const source of sitemapSources.slice(0, 20)) { // Process max 20 per run
      try {
        const result = await this.discoverFromSitemap(source.domain, source._id.toString());
        totalDiscovered += result.discovered;
      } catch (error) {
        logger.error(`Sitemap discovery failed for ${source.domain}:`, error);
        await sourceRegistryService.recordFailure(source.domain, (error as Error).message);
      }
    }

    return { sourcesProcessed: sitemapSources.length, totalDiscovered };
  }

  /**
   * Discover from a single known job board / ATS.
   */
  async discoverFromKnownSource(boardUrl: string, domain: string, sourceId: string): Promise<number> {
    try {
      const response = await fetch(boardUrl, {
        headers: { 'User-Agent': 'CareerTrackerBot/1.0' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) return 0;

      const html = await response.text();

      // Extract job links from the page
      const links: string[] = [];
      const hrefRegex = /href=["']([^"']+)["']/gi;
      let match: RegExpExecArray | null;

      while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1];
        if (!href) continue;
        if (isLikelyJobUrl(href)) {
          try {
            const absolute = href.startsWith('http') ? href : new URL(href, boardUrl).toString();
            links.push(absolute);
          } catch { /* skip invalid URLs */ }
        }
      }

      if (links.length === 0) return 0;

      const unique = [...new Set(links)];
      const result = await urlDiscoveryService.submitBatch(
        unique.slice(0, 200).map((url) => ({
          url,
          domain,
          sourceId,
          discoveryMethod: 'listing_page' as const,
        }))
      );

      logger.info(`Known source discovery (${domain}): ${result.added} new URLs from ${unique.length} links`);
      return result.added;
    } catch (error) {
      logger.warn(`Known source discovery failed for ${boardUrl}:`, error);
      return 0;
    }
  }
}

export const sitemapDiscoveryService = new SitemapDiscoveryService();
