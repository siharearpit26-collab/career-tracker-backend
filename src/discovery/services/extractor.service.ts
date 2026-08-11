import { ExtractionResult } from '../types';
import { logger } from '../../utils/logger';

// ─── JSON-LD Extractor (Highest Priority) ─────────────────────────────────────

function extractJsonLd(html: string, sourceUrl: string): ExtractionResult | null {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]!) as Record<string, unknown>;
      const jobData = data['@type'] === 'JobPosting'
        ? data
        : Array.isArray(data['@graph'])
          ? (data['@graph'] as Record<string, unknown>[]).find((g) => g['@type'] === 'JobPosting')
          : null;

      if (!jobData) continue;

      const org = jobData['hiringOrganization'] as Record<string, unknown> | undefined;
      const location = jobData['jobLocation'] as Record<string, unknown> | Record<string, unknown>[] | undefined;
      const salary = jobData['baseSalary'] as Record<string, unknown> | undefined;
      const salaryValue = salary?.['value'] as Record<string, unknown> | undefined;

      const title = String(jobData['title'] ?? jobData['name'] ?? '');
      const company = String(org?.['name'] ?? '');

      if (!title || !company) continue;

      return {
        method: 'json_ld',
        confidence: 98,
        data: {
          rawTitle: title,
          rawCompany: company,
          title,
          company,
          companyNormalized: company.toLowerCase().trim(),
          description: String(jobData['description'] ?? '').replace(/<[^>]+>/g, ' ').slice(0, 10000),
          rawDescription: String(jobData['description'] ?? '').slice(0, 10000),
          employmentType: mapEmploymentType(String(jobData['employmentType'] ?? '')),
          sourceUrl,
          applicationUrl: String(jobData['url'] ?? jobData['directApply'] ?? sourceUrl),
          sourcePostedAt: jobData['datePosted'] ? new Date(String(jobData['datePosted'])) : undefined,
          rawLocation: extractLocationString(location),
          salary: {
            min: salaryValue?.['minValue'] ? Number(salaryValue['minValue']) : undefined,
            max: salaryValue?.['maxValue'] ? Number(salaryValue['maxValue']) : undefined,
            currency: String(salary?.['currency'] ?? salaryValue?.['currency'] ?? ''),
            period: mapSalaryPeriod(String(salary?.['unitText'] ?? '')),
          },
          skills: extractSkillsFromDescription(String(jobData['description'] ?? '')),
        },
      };
    } catch {
      continue;
    }
  }

  return null;
}

// ─── HTML Semantic Extractor ──────────────────────────────────────────────────

function extractFromHtml(html: string, sourceUrl: string): ExtractionResult | null {
  // Extract title
  const titlePatterns = [
    /<h1[^>]*>(.*?)<\/h1>/is,
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
    /<title>(.*?)<\/title>/i,
  ];

  let title = '';
  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      title = match[1].replace(/<[^>]+>/g, '').trim();
      if (title.length > 3 && title.length < 200) break;
    }
  }

  if (!title) return null;

  // Extract company
  const companyPatterns = [
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
    /company['":\s]*["']?([A-Z][^"'<\n]{2,50})["']?/i,
    /hiring.?organization['":\s]*["']?([^"'<\n]{2,50})["']?/i,
  ];

  let company = '';
  for (const pattern of companyPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      company = match[1].replace(/<[^>]+>/g, '').trim();
      if (company.length > 1 && company.length < 100) break;
    }
  }

  // Try to get company from domain
  if (!company) {
    try {
      const domain = new URL(sourceUrl).hostname.replace('www.', '').split('.')[0] ?? '';
      company = domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return null;
    }
  }

  // Extract description
  const descPatterns = [
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  ];

  let description = '';
  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      description = match[1].trim();
      break;
    }
  }

  // If no meta description, try to extract from body
  if (!description) {
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    description = bodyText.slice(0, 2000);
  }

  const confidence = title && company ? 65 : 40;

  return {
    method: 'html_semantic',
    confidence,
    data: {
      rawTitle: title,
      rawCompany: company,
      title: cleanTitle(title),
      company,
      companyNormalized: company.toLowerCase().trim(),
      description: description.slice(0, 10000),
      rawDescription: description.slice(0, 10000),
      sourceUrl,
      applicationUrl: sourceUrl,
      skills: extractSkillsFromDescription(description),
    },
  };
}

// ─── OpenGraph Extractor ──────────────────────────────────────────────────────

function extractOpenGraph(html: string, sourceUrl: string): ExtractionResult | null {
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const ogSiteName = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1];

  if (!ogTitle) return null;

  return {
    method: 'opengraph',
    confidence: 55,
    data: {
      rawTitle: ogTitle,
      rawCompany: ogSiteName ?? '',
      title: cleanTitle(ogTitle),
      company: ogSiteName ?? '',
      companyNormalized: (ogSiteName ?? '').toLowerCase().trim(),
      description: ogDesc ?? '',
      sourceUrl,
      applicationUrl: sourceUrl,
    },
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function cleanTitle(title: string): string {
  // Remove common suffixes like "- Company Name", "| Company", "at Company"
  return title
    .replace(/\s*[-|–]\s*.*$/g, '')
    .replace(/\s+at\s+\w.*$/gi, '')
    .trim();
}

function mapEmploymentType(type: string): 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE' | 'OTHER' {
  const t = type.toUpperCase().replace(/[^A-Z]/g, '');
  if (t.includes('FULL')) return 'FULL_TIME';
  if (t.includes('PART')) return 'PART_TIME';
  if (t.includes('CONTRACT') || t.includes('TEMPORARY')) return 'CONTRACT';
  if (t.includes('INTERN')) return 'INTERNSHIP';
  if (t.includes('FREELANCE')) return 'FREELANCE';
  return 'OTHER';
}

function mapSalaryPeriod(unit: string): 'hourly' | 'monthly' | 'annual' | undefined {
  const u = unit.toLowerCase();
  if (u.includes('hour')) return 'hourly';
  if (u.includes('month')) return 'monthly';
  if (u.includes('year') || u.includes('annual')) return 'annual';
  return undefined;
}

function extractLocationString(location: unknown): string {
  if (!location) return '';
  if (typeof location === 'string') return location;
  if (Array.isArray(location)) {
    return location.map((l) => {
      const addr = (l as Record<string, unknown>)['address'] as Record<string, unknown> | undefined;
      return addr
        ? [addr['addressLocality'], addr['addressRegion'], addr['addressCountry']].filter(Boolean).join(', ')
        : String(l);
    }).join('; ');
  }
  const loc = location as Record<string, unknown>;
  const addr = loc['address'] as Record<string, unknown> | undefined;
  if (addr) {
    return [addr['addressLocality'], addr['addressRegion'], addr['addressCountry']].filter(Boolean).join(', ');
  }
  return '';
}

const COMMON_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
  'react', 'angular', 'vue', 'next.js', 'node.js', 'express', 'django', 'flask', 'spring', 'rails',
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'dynamodb', 'firebase',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd',
  'rest api', 'graphql', 'microservices', 'machine learning', 'deep learning', 'ai',
  'html', 'css', 'tailwind', 'sass', 'webpack', 'git', 'linux', 'sql', 'nosql',
  'agile', 'scrum', 'jira', 'figma', 'data structures', 'algorithms',
];

function extractSkillsFromDescription(description: string): string[] {
  const text = description.toLowerCase();
  return COMMON_SKILLS.filter((skill) => text.includes(skill));
}

// ─── Main Extractor Service ───────────────────────────────────────────────────

export class ExtractorService {
  /**
   * Extract job data from HTML using priority chain:
   * 1. JSON-LD  2. OpenGraph  3. HTML semantic  4. (AI — handled separately)
   */
  extract(html: string, sourceUrl: string): ExtractionResult | null {
    // Priority 1: JSON-LD JobPosting
    const jsonLdResult = extractJsonLd(html, sourceUrl);
    if (jsonLdResult && jsonLdResult.data.title && jsonLdResult.data.company) {
      logger.info(`Extracted via JSON-LD: "${jsonLdResult.data.title}" at "${jsonLdResult.data.company}"`);
      return jsonLdResult;
    }

    // Priority 2: OpenGraph metadata
    const ogResult = extractOpenGraph(html, sourceUrl);
    if (ogResult && ogResult.confidence >= 55) {
      logger.info(`Extracted via OpenGraph: "${ogResult.data.title}"`);
      return ogResult;
    }

    // Priority 3: HTML semantic extraction
    const htmlResult = extractFromHtml(html, sourceUrl);
    if (htmlResult && htmlResult.data.title) {
      logger.info(`Extracted via HTML: "${htmlResult.data.title}"`);
      return htmlResult;
    }

    // Insufficient data for extraction
    return null;
  }
}

export const extractorService = new ExtractorService();
