import { emailClassifierService } from '../../services/emailClassifier.service';

// Mock the application repository
jest.mock('../../repositories/application.repository', () => ({
  applicationRepository: {
    findByUserId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  },
}));

describe('Email Classifier Service', () => {
  const userId = '507f1f77bcf86cd799439011';

  describe('classify', () => {
    it('should classify interview-related emails', async () => {
      const result = await emailClassifierService.classify(
        userId,
        'Interview Scheduled - Software Engineer Position',
        'We would like to schedule a technical interview with you next week.',
        'hr@company.com'
      );

      expect(result.classification).toBe('interview');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify offer emails', async () => {
      const result = await emailClassifierService.classify(
        userId,
        'Job Offer - Congratulations!',
        'We are pleased to offer you the position. Please find the offer letter attached with compensation details.',
        'talent@company.com'
      );

      expect(result.classification).toBe('offer');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.suggestedStatus).toBe('Offer');
    });

    it('should classify rejection emails', async () => {
      const result = await emailClassifierService.classify(
        userId,
        'Update on your application',
        'Unfortunately, we have decided not to proceed with your application. We wish you the best in your future endeavors.',
        'noreply@company.com'
      );

      expect(result.classification).toBe('rejection');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.suggestedStatus).toBe('Rejected');
    });

    it('should classify recruitment emails', async () => {
      const result = await emailClassifierService.classify(
        userId,
        'Application received - Software Engineer',
        'Thank you for applying to our position. We received your application and will review it shortly.',
        'jobs@greenhouse.io'
      );

      expect(result.classification).toBe('recruitment');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify follow-up emails', async () => {
      const result = await emailClassifierService.classify(
        userId,
        'Following up on your application',
        'Just checking in on the status of your application. Please let us know if you need any updates on next steps.',
        'recruiter@company.com'
      );

      expect(result.classification).toBe('follow_up');
      expect(result.confidence).toBeGreaterThan(0.4);
    });

    it('should classify unrelated emails', async () => {
      const result = await emailClassifierService.classify(
        userId,
        'Your Amazon order has shipped',
        'Your package is on its way. Track your delivery here.',
        'shipping@amazon.com'
      );

      expect(result.classification).toBe('unrelated');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should give higher confidence to emails from recruitment platforms', async () => {
      const fromRecruitmentPlatform = await emailClassifierService.classify(
        userId,
        'New application update',
        'Your application has been received.',
        'notifications@greenhouse.io'
      );

      const fromGenericEmail = await emailClassifierService.classify(
        userId,
        'New application update',
        'Your application has been received.',
        'info@randomcompany.com'
      );

      expect(fromRecruitmentPlatform.confidence).toBeGreaterThanOrEqual(
        fromGenericEmail.confidence
      );
    });

    it('should return appropriate suggested status for classifications', async () => {
      const interview = await emailClassifierService.classify(
        userId,
        'Interview invitation',
        'We would like to schedule an interview with you.',
        'hr@company.com'
      );
      expect(interview.suggestedStatus).toBe('Interview Scheduled');

      const offer = await emailClassifierService.classify(
        userId,
        'Congratulations! Job offer',
        'We are pleased to offer you the position.',
        'hr@company.com'
      );
      expect(offer.suggestedStatus).toBe('Offer');

      const rejection = await emailClassifierService.classify(
        userId,
        'Application update',
        'Unfortunately we will not be moving forward with your application.',
        'hr@company.com'
      );
      expect(rejection.suggestedStatus).toBe('Rejected');
    });
  });
});
