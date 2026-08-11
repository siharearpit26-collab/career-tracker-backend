import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { sourceRegistryService } from './sourceRegistry.service';
import { FetchResult } from '../types';

// ─── Domain Rate Limiter ──────────────────────────────────────────────────────

const domainLastRequest: Map<string, number> = new Map();
const domainRequestCount: Map<string, number> = new Map(); // per day
const domainCountReset: Map<string, number> = new Map();

function canFetchDomain(domain: string, maxPerMinute: number, dailyBudget: number): boolean {
  const now = Date.now();

  // Rate limit check
  const lastReq = domainLastRequest.get(domain) ?? 0;
  const minInterval = (60 * 1000) / maxPerMinute;
  if (now - lastReq < minInterval) return false;

  // Daily budget check
  const resetTime = domainCountReset.get(domain) ?? 0;
  if (now - resetTime > 24 * 60 * 60 * 1000) {
    domainRequestCount.set(domain, 0);
    domainCountReset.set(domain, now);
  }
  const count = domainRequestCount.get(domain) ?? 0;
  if (count >= dailyBudget) return false;

  return true;
}

function recordDomainRequest(domain: string): void {
  domainLastRequest.set(domain, Date.now());
  domainRequestCount.set(domain, (domainRequestCount.get(domain) ?? 0) + 1);
}

// ─── Robots.txt Parser ────────────────────────────────────────────────────────

const robotsCache: Map<string, { rules: string[]; fetchedAt: number }> = new Map();
const ROBOTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchRobotsTxt(domain: string): Promise<string[]> {
  const cached = robotsCache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_CACHE_TTL) {
    return cached.rules;
  }

  try {
    const response = await fetch(`https://${domain}/robots.txt`, {
      headers: { 'User-Agent': 'CareerTrackerBot/1.0 (+https://careertracker.app/bot)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // No robots.txt = everything allowed
      robotsCache.set(domain, { rules: [], fetchedAt: Date.now() });
      return [];
    }

    const text = await response.text();
    const disallowRules: string[] = [];
    let isRelevantAgent = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.replace('user-agent:', '').trim();
        isRelevantAgent = agent === '*' || agent.includes('careertracker');
      } else if (isRelevantAgent && trimmed.startsWith('disallow:')) {
        const path = trimmed.replace('disallow:', '').trim();
        if (path) disallowRules.push(path);
      }
    }

    robotsCache.set(domain, { rules: disallowRules, fetchedAt: Date.now() });
    return disallowRules;
  } catch {
    // Can't fetch robots.txt — assume allowed
    robotsCache.set(domain, { rules: [], fetchedAt: Date.now() });
    return [];
  }
}

function isPathAllowed(path: string, disallowRules: string[]): boolean {
  for (const rule of disallowRules) {
    if (rule === '/') return false; // Everything disallowed
    if (path.startsWith(rule)) return false;
  }
  return true;
}

// ─── Blocked Content Detection ────────────────────────────────────────────────

function isBlockedContent(html: string): boolean {
  const blockers = [
    /captcha/i,
    /please verify you are (a human|not a robot)/i,
    /access denied/i,
    /403 forbidden/i,
    /login required/i,
    /sign in to continue/i,
    /subscribe to view/i,
    /paywall/i,
  ];
  return blockers.some((p) => p.test(html.slice(0, 2000)));
}

// ─── Main Fetcher Service ─────────────────────────────────────────────────────

export class FetcherService {
  private readonly userAgent = 'CareerTrackerBot/1.0 (+https://careertracker.app/bot)';
  private readonly timeout = 15000; // 15 seconds

  /**
   * Safely fetch a URL with all compliance checks.
   */
  async fetch(url: string, domain: string): Promise<FetchResult | null> {
    const start = Date.now();

    try {
      // 1. Get source crawl policy
      const source = await sourceRegistryService.getByDomain(domain);
      const policy = source?.crawlPolicy ?? {
        maxRequestsPerMinute: 20,
        crawlBudgetPerDay: 500,
        respectRobots: true,
        requiresBrowserRendering: false,
        scheduleHours: 24,
        concurrency: 2,
      };

      // 2. Check if source is active
      if (source && (source.status === 'disabled' || source.status === 'temporarily_disabled')) {
        logger.warn(`Skipping disabled source: ${domain}`);
        return null;
      }

      // 3. Rate limit check
      if (!canFetchDomain(domain, policy.maxRequestsPerMinute, policy.crawlBudgetPerDay)) {
        logger.info(`Rate limited: ${domain}`);
        return null;
      }

      // 4. Robots.txt check
      if (policy.respectRobots) {
        const parsed = new URL(url);
        const disallowRules = await fetchRobotsTxt(domain);
        if (!isPathAllowed(parsed.pathname, disallowRules)) {
          logger.info(`Blocked by robots.txt: ${url}`);
          if (source) {
            source.robotsStatus = 'restricted';
            await source.save();
          }
          return null;
        }
        if (source && source.robotsStatus === 'unknown') {
          source.robotsStatus = 'allowed';
          await source.save();
        }
      }

      // 5. Fetch the page
      recordDomainRequest(domain);

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(this.timeout),
      });

      const responseTime = Date.now() - start;

      // 6. Handle HTTP errors
      if (!response.ok) {
        if (response.status === 429 || response.status === 503) {
          logger.warn(`Rate limited by server: ${url} (${response.status})`);
          await sourceRegistryService.recordFailure(domain, `HTTP ${response.status}`);
        }

        return {
          url,
          httpStatus: response.status,
          contentHash: '',
          fetchedAt: new Date(),
          responseTime,
        };
      }

      const contentType = response.headers.get('content-type') ?? '';

      // 7. Only process HTML
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        return {
          url,
          httpStatus: response.status,
          contentType,
          contentHash: '',
          fetchedAt: new Date(),
          responseTime,
        };
      }

      const html = await response.text();

      // 8. Check for blocked content (CAPTCHA, login, paywall)
      if (isBlockedContent(html)) {
        logger.info(`Blocked content detected: ${url}`);
        return null;
      }

      // 9. Compute content hash for change detection
      const contentHash = crypto
        .createHash('sha256')
        .update(html.slice(0, 50000)) // Hash first 50KB for performance
        .digest('hex');

      // 10. Record success
      await sourceRegistryService.recordSuccess(domain);

      return {
        url,
        httpStatus: response.status,
        contentType,
        html,
        contentHash,
        fetchedAt: new Date(),
        responseTime,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      if (errMsg.includes('timeout') || errMsg.includes('abort')) {
        logger.warn(`Fetch timeout: ${url}`);
      } else {
        logger.error(`Fetch failed: ${url} — ${errMsg}`);
      }

      await sourceRegistryService.recordFailure(domain, errMsg);
      return null;
    }
  }

  /**
   * Check if a URL can be fetched right now (rate limit + robots).
   */
  async canFetch(_url: string, domain: string): Promise<boolean> {
    const source = await sourceRegistryService.getByDomain(domain);
    if (source?.status === 'disabled' || source?.status === 'temporarily_disabled') return false;

    const policy = source?.crawlPolicy ?? { maxRequestsPerMinute: 20, crawlBudgetPerDay: 500 };
    return canFetchDomain(domain, policy.maxRequestsPerMinute, policy.crawlBudgetPerDay);
  }

  /**
   * Get fetcher stats.
   */
  getStats(): { domainsTracked: number; totalRequestsToday: number } {
    let total = 0;
    domainRequestCount.forEach((count) => { total += count; });
    return {
      domainsTracked: domainLastRequest.size,
      totalRequestsToday: total,
    };
  }
}

export const fetcherService = new FetcherService();
