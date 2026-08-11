import { Types } from 'mongoose';
import { JobModel } from '../models';
import { urlDiscoveryService } from './urlDiscovery.service';
import { fetcherService } from './fetcher.service';
import { classifierService } from './classifier.service';
import { extractorService } from './extractor.service';
import { normalizerService } from './normalizer.service';
import { deduplicatorService, generateJobFingerprint } from './deduplicator.service';
import { jobLifecycleService } from './jobLifecycle.service';
import { jobAlertsService } from './jobAlerts.service';
import { sourceRegistryService } from './sourceRegistry.service';
import { IJobDocument } from '../types';
import { logger } from '../../utils/logger';

export interface PipelineRunResult {
  urlsFetched: number;
  pagesClassified: number;
  jobsExtracted: number;
  jobsIndexed: number;
  duplicatesSkipped: number;
  errors: number;
  duration: number;
}

export class PipelineService {
  /**
   * Run a single pipeline cycle:
   * 1. Get next batch of queued URLs
   * 2. Fetch each one (with rate limiting)
   * 3. Classify the page
   * 4. Extract job data if individual job
   * 5. Normalize, deduplicate, index
   */
  async runCycle(batchSize = 10): Promise<PipelineRunResult> {
    const start = Date.now();
    const result: PipelineRunResult = {
      urlsFetched: 0,
      pagesClassified: 0,
      jobsExtracted: 0,
      jobsIndexed: 0,
      duplicatesSkipped: 0,
      errors: 0,
      duration: 0,
    };

    try {
      // 1. Get next batch of URLs
      const urls = await urlDiscoveryService.getNextFetchBatch(batchSize);

      if (urls.length === 0) {
        logger.info('Pipeline: No URLs to process');
        result.duration = Date.now() - start;
        return result;
      }

      logger.info(`Pipeline: Processing ${urls.length} URLs`);

      // 2. Process each URL
      for (const jobUrl of urls) {
        try {
          // Fetch
          const fetchResult = await fetcherService.fetch(jobUrl.url, jobUrl.domain);
          result.urlsFetched++;

          if (!fetchResult || !fetchResult.html) {
            await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'failed', {
              httpStatus: fetchResult?.httpStatus,
              error: 'No content returned',
            });
            continue;
          }

          await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'fetched', {
            httpStatus: fetchResult.httpStatus,
            contentHash: fetchResult.contentHash,
          });

          // Classify
          const classification = classifierService.classify(jobUrl.url, fetchResult.html);
          result.pagesClassified++;

          await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'classified', {
            pageType: classification.pageType,
            classificationConfidence: classification.confidence,
          });

          // If listing page, extract linked URLs and queue them
          if (classification.pageType === 'job_listing_page' && classification.linkedUrls?.length) {
            await urlDiscoveryService.submitBatch(
              classification.linkedUrls.map((url) => ({
                url,
                domain: jobUrl.domain,
                sourceId: jobUrl.sourceId.toString(),
                discoveryMethod: 'listing_page' as const,
              }))
            );
          }

          // Only extract from individual job pages
          if (classification.pageType !== 'individual_job') {
            await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'skipped');
            continue;
          }

          // Extract
          const extraction = extractorService.extract(fetchResult.html, jobUrl.url);

          if (!extraction || !extraction.data.title || !extraction.data.company) {
            await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'failed', {
              error: 'Extraction failed — missing title or company',
            });
            result.errors++;
            continue;
          }

          result.jobsExtracted++;

          // Normalize
          const normalized = normalizerService.normalizeJob({
            rawTitle: extraction.data.rawTitle ?? extraction.data.title ?? '',
            rawCompany: extraction.data.rawCompany ?? extraction.data.company ?? '',
            rawLocation: extraction.data.rawLocation,
            skills: extraction.data.skills as string[] | undefined,
          });

          // Generate fingerprint
          const fingerprint = generateJobFingerprint(
            normalized.companyNormalized,
            normalized.title.toLowerCase(),
            normalized.locations[0]?.city ?? '',
            (extraction.data.description ?? '').slice(0, 500)
          );

          // Deduplicate
          const dedup = await deduplicatorService.checkDuplicate({
            sourceId: jobUrl.sourceId.toString(),
            sourceJobId: extraction.data.sourceJobId as string | undefined,
            sourceUrl: jobUrl.url,
            companyNormalized: normalized.companyNormalized,
            title: normalized.title,
            location: normalized.locations[0]?.city ?? '',
            description: extraction.data.description ?? '',
            jobFingerprint: fingerprint,
          });

          if (dedup.isDuplicate && dedup.confidence >= 90 && dedup.existingJobId) {
            // Merge alternate source
            await deduplicatorService.mergeSource(dedup.existingJobId, jobUrl.url);
            await jobLifecycleService.verify(dedup.existingJobId);
            await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'indexed');
            result.duplicatesSkipped++;
            continue;
          }

          // Index new job
          const newJob = await JobModel.create({
            sourceId: new Types.ObjectId(jobUrl.sourceId.toString()),
            sourceUrl: jobUrl.url,
            sourceJobId: extraction.data.sourceJobId,
            applicationUrl: extraction.data.applicationUrl ?? jobUrl.url,
            jobFingerprint: fingerprint,

            rawTitle: extraction.data.rawTitle ?? extraction.data.title,
            rawCompany: extraction.data.rawCompany ?? extraction.data.company,
            rawLocation: extraction.data.rawLocation,
            rawDescription: extraction.data.rawDescription ?? extraction.data.description,

            title: normalized.title,
            company: extraction.data.company,
            companyNormalized: normalized.companyNormalized,
            description: (extraction.data.description ?? '').slice(0, 10000),
            locations: normalized.locations,
            employmentType: extraction.data.employmentType ?? 'FULL_TIME',
            seniority: normalized.seniority,
            experienceRange: extraction.data.experienceRange ?? {},
            salary: extraction.data.salary ?? {},
            skills: extraction.data.skills ?? [],
            skillsNormalized: normalized.skillsNormalized,

            status: 'active',
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            sourcePostedAt: extraction.data.sourcePostedAt,
            lastVerifiedAt: new Date(),

            extractionMethod: extraction.method,
            extractionConfidence: extraction.confidence,
          });

          await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'indexed');
          await sourceRegistryService.recordValidJob(jobUrl.domain);

          result.jobsIndexed++;

          // Check immediate alerts for this new job
          try {
            await jobAlertsService.checkImmediateAlerts(newJob as IJobDocument);
          } catch {
            // Non-critical
          }

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.error(`Pipeline error for ${jobUrl.url}: ${errMsg}`);
          await urlDiscoveryService.updateStatus(jobUrl._id.toString(), 'failed', {
            error: errMsg.slice(0, 200),
          });
          result.errors++;
        }
      }
    } catch (error) {
      logger.error('Pipeline cycle failed:', error);
    }

    result.duration = Date.now() - start;
    logger.info(`Pipeline cycle complete: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Run the expiration check for stale jobs.
   */
  async runExpirationCheck(): Promise<number> {
    return jobLifecycleService.expireStaleJobs(14);
  }

  /**
   * Run daily alert processing.
   */
  async runDailyAlerts(): Promise<number> {
    return jobAlertsService.processDailyAlerts();
  }

  /**
   * Run weekly alert processing.
   */
  async runWeeklyAlerts(): Promise<number> {
    return jobAlertsService.processWeeklyAlerts();
  }
}

export const pipelineService = new PipelineService();
