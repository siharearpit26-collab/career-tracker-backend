import { logger } from '../../utils/logger';

export interface AdzunaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  city: string;
  description: string;
  salaryMin?: number;
  salaryMax?: number;
  contractType?: string;
  category?: string;
  applyUrl: string;
  postedAt?: Date;
}

interface AdzunaApiResult {
  id: string;
  title: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  description?: string;
  salary_min?: number;
  salary_max?: number;
  contract_time?: string;
  contract_type?: string;
  category?: { label?: string };
  redirect_url: string;
  created?: string;
}

interface AdzunaApiResponse {
  results: AdzunaApiResult[];
  count: number;
}

const APP_ID = process.env['ADZUNA_APP_ID'] ?? '';
const APP_KEY = process.env['ADZUNA_APP_KEY'] ?? '';
const COUNTRY = process.env['ADZUNA_COUNTRY'] ?? 'in'; // India by default

function cleanHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export class AdzunaService {
  isConfigured(): boolean {
    return !!APP_ID && !!APP_KEY;
  }

  /**
   * Search real jobs from Adzuna.
   */
  async search(params: {
    what?: string;       // keywords
    where?: string;      // location
    resultsPerPage?: number;
    page?: number;
    salaryMin?: number;
    maxDaysOld?: number;
  }): Promise<{ jobs: AdzunaJob[]; total: number }> {
    if (!this.isConfigured()) {
      logger.warn('Adzuna API not configured (ADZUNA_APP_ID / ADZUNA_APP_KEY missing)');
      return { jobs: [], total: 0 };
    }

    const page = params.page ?? 1;
    const perPage = Math.min(params.resultsPerPage ?? 20, 50);

    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}`);
    url.searchParams.set('app_id', APP_ID);
    url.searchParams.set('app_key', APP_KEY);
    url.searchParams.set('results_per_page', perPage.toString());
    url.searchParams.set('content-type', 'application/json');
    if (params.what) url.searchParams.set('what', params.what);
    if (params.where) url.searchParams.set('where', params.where);
    if (params.salaryMin) url.searchParams.set('salary_min', params.salaryMin.toString());
    if (params.maxDaysOld) url.searchParams.set('max_days_old', params.maxDaysOld.toString());
    url.searchParams.set('sort_by', 'date');

    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error(`Adzuna API error ${response.status}: ${body.slice(0, 200)}`);
        return { jobs: [], total: 0 };
      }

      const data = (await response.json()) as AdzunaApiResponse;

      const jobs: AdzunaJob[] = data.results.map((r) => ({
        id: r.id,
        title: r.title ? cleanHtml(r.title) : 'Untitled',
        company: r.company?.display_name ?? 'Company',
        location: r.location?.display_name ?? 'India',
        city: r.location?.area?.slice(-1)[0] ?? r.location?.display_name ?? 'India',
        description: r.description ? cleanHtml(r.description) : '',
        salaryMin: r.salary_min,
        salaryMax: r.salary_max,
        contractType: r.contract_time ?? r.contract_type,
        category: r.category?.label,
        applyUrl: r.redirect_url,
        postedAt: r.created ? new Date(r.created) : undefined,
      }));

      logger.info(`Adzuna: fetched ${jobs.length} jobs (total available: ${data.count})`);
      return { jobs, total: data.count };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`Adzuna fetch failed: ${msg}`);
      return { jobs: [], total: 0 };
    }
  }
}

export const adzunaService = new AdzunaService();
