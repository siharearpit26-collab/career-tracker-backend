import request from 'supertest';
import app from '../../app';

describe('Application API', () => {
  let authToken: string;

  beforeEach(async () => {
    // Register and get token
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'TestPass123',
    });
    authToken = res.body.data.tokens.accessToken;
  });

  const testApp = {
    company: 'Google',
    jobTitle: 'Software Engineer',
    location: 'Mountain View, CA',
    source: 'LinkedIn',
    status: 'Applied',
    notes: 'Great opportunity',
    salaryMin: 150000,
    salaryMax: 200000,
    salaryCurrency: 'USD',
  };

  describe('POST /api/applications', () => {
    it('should create an application', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.company).toBe('Google');
      expect(res.body.data.jobTitle).toBe('Software Engineer');
      expect(res.body.data.status).toBe('Applied');
      expect(res.body.data.id).toBeDefined();
    });

    it('should reject without auth', async () => {
      await request(app)
        .post('/api/applications')
        .send(testApp)
        .expect(401);
    });

    it('should reject missing company', async () => {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ jobTitle: 'SWE' })
        .expect(422);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/applications', () => {
    beforeEach(async () => {
      // Create a few applications
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testApp, company: 'Meta', status: 'Interview Scheduled' });

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testApp, company: 'Amazon', status: 'Rejected' });
    });

    it('should list all applications', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data.length).toBe(3);
      expect(res.body.data.pagination.total).toBe(3);
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/applications?status=Applied')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].company).toBe('Google');
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/applications?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.pagination.hasNext).toBe(true);
    });
  });

  describe('GET /api/applications/:id', () => {
    it('should get application by ID', async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      const id = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/applications/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.company).toBe('Google');
      expect(res.body.data.id).toBe(id);
    });

    it('should return 404 for non-existent application', async () => {
      await request(app)
        .get('/api/applications/507f1f77bcf86cd799439011')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/applications/:id', () => {
    it('should update an application', async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      const id = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/applications/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ company: 'Alphabet', jobTitle: 'Senior SWE' })
        .expect(200);

      expect(res.body.data.company).toBe('Alphabet');
      expect(res.body.data.jobTitle).toBe('Senior SWE');
    });
  });

  describe('DELETE /api/applications/:id', () => {
    it('should delete an application', async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      const id = createRes.body.data.id;

      await request(app)
        .delete(`/api/applications/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify it's gone
      await request(app)
        .get(`/api/applications/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/applications/:id/status', () => {
    it('should update application status', async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      const id = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/applications/${id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'Interview Scheduled' })
        .expect(200);

      expect(res.body.data.status).toBe('Interview Scheduled');
    });

    it('should reject invalid status', async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      const id = createRes.body.data.id;

      await request(app)
        .patch(`/api/applications/${id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'InvalidStatus' })
        .expect(400);
    });
  });

  describe('GET /api/applications/stats', () => {
    it('should return application statistics', async () => {
      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testApp);

      await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testApp, company: 'Meta', status: 'Offer' });

      const res = await request(app)
        .get('/api/applications/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.data.total).toBe(2);
      expect(res.body.data.byStatus).toBeDefined();
      expect(res.body.data.byStatus['Applied']).toBe(1);
      expect(res.body.data.byStatus['Offer']).toBe(1);
    });
  });
});
