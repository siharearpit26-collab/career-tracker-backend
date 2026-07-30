import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from '../../validators/auth.validators';
import {
  createApplicationSchema,
} from '../../validators/application.validators';

describe('Auth Validators', () => {
  describe('registerSchema', () => {
    it('should validate a correct registration', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject short first name', () => {
      const result = registerSchema.safeParse({
        firstName: 'J',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        password: 'Password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'PasswordABC',
      });

      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'Pass1',
      });

      expect(result.success).toBe(false);
    });

    it('should trim and lowercase email', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: '  John@Example.COM  ',
        password: 'Password123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
      }
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login', () => {
      const result = loginSchema.safeParse({
        email: 'john@example.com',
        password: 'anypassword',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'john@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('changePasswordSchema', () => {
    it('should validate correct password change', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpass',
        newPassword: 'NewPass123',
      });

      expect(result.success).toBe(true);
    });

    it('should reject weak new password', () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: 'oldpass',
        newPassword: 'weak',
      });

      expect(result.success).toBe(false);
    });
  });
});

describe('Application Validators', () => {
  describe('createApplicationSchema', () => {
    it('should validate a valid application', () => {
      const result = createApplicationSchema.safeParse({
        company: 'Google',
        jobTitle: 'Software Engineer',
        location: 'Mountain View, CA',
        status: 'Applied',
        source: 'LinkedIn',
      });

      expect(result.success).toBe(true);
    });

    it('should reject missing company', () => {
      const result = createApplicationSchema.safeParse({
        jobTitle: 'Software Engineer',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing job title', () => {
      const result = createApplicationSchema.safeParse({
        company: 'Google',
      });

      expect(result.success).toBe(false);
    });

    it('should accept minimal required fields', () => {
      const result = createApplicationSchema.safeParse({
        company: 'Google',
        jobTitle: 'SWE',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = createApplicationSchema.safeParse({
        company: 'Google',
        jobTitle: 'SWE',
        status: 'InvalidStatus',
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative salary', () => {
      const result = createApplicationSchema.safeParse({
        company: 'Google',
        jobTitle: 'SWE',
        salaryMin: -1000,
      });

      expect(result.success).toBe(false);
    });
  });
});
