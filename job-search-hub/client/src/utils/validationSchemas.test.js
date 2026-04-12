import { describe, it, expect } from 'vitest';
import { 
  loginSchema, 
  registerSchema, 
  createJobSchema,
  createContactSchema,
  createReminderSchema,
  logOutreachSchema,
  totpVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validationSchemas';

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = {
        email: 'user@example.com',
        password: 'SecurePassword123',
        rememberMe: false,
      };
      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it('should lowercase email', () => {
      const data = { email: 'USER@EXAMPLE.COM', password: 'SecurePassword123' };
      const parsed = loginSchema.parse(data);
      expect(parsed.email).toBe('user@example.com');
    });

    it('should require email', () => {
      const data = { password: 'SecurePassword123' };
      expect(() => loginSchema.parse(data)).toThrow();
    });

    it('should reject invalid email', () => {
      const data = { email: 'not-an-email', password: 'SecurePassword123' };
      expect(() => loginSchema.parse(data)).toThrow();
    });

    it('should require password with minimum 8 characters', () => {
      const data = { email: 'user@example.com', password: 'short' };
      expect(() => loginSchema.parse(data)).toThrow();
    });
  });

  describe('registerSchema', () => {
    it('should validate correct registration data', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        terms: true,
      };
      expect(() => registerSchema.parse(data)).not.toThrow();
    });

    it('should require passwords to match', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePassword123',
        confirmPassword: 'DifferentPassword123',
        terms: true,
      };
      expect(() => registerSchema.parse(data)).toThrow('Passwords do not match');
    });

    it('should require terms acceptance', () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
        terms: false,
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });

    it('should require strong password', () => {
      const weakPassword = 'password'; // lowercase only
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: weakPassword,
        confirmPassword: weakPassword,
        terms: true,
      };
      expect(() => registerSchema.parse(data)).toThrow();
    });
  });

  describe('totpVerificationSchema', () => {
    it('should validate 6-digit code', () => {
      const data = { code: '123456' };
      expect(() => totpVerificationSchema.parse(data)).not.toThrow();
    });

    it('should reject non-numeric codes', () => {
      const data = { code: 'abcdef' };
      expect(() => totpVerificationSchema.parse(data)).toThrow();
    });

    it('should reject codes with wrong length', () => {
      const data = { code: '12345' };
      expect(() => totpVerificationSchema.parse(data)).toThrow();
    });
  });

  describe('createJobSchema', () => {
    it('should validate correct job data', () => {
      const data = {
        company: 'Acme Corp',
        position: 'Senior Engineer',
        status: 'applied',
      };
      expect(() => createJobSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid URL', () => {
      const data = {
        company: 'Acme Corp',
        position: 'Senior Engineer',
        jobUrl: 'not-a-url',
      };
      expect(() => createJobSchema.parse(data)).toThrow();
    });

    it('should allow optional fields', () => {
      const data = {
        company: 'Acme Corp',
        position: 'Senior Engineer',
      };
      expect(() => createJobSchema.parse(data)).not.toThrow();
    });
  });

  describe('createContactSchema', () => {
    it('should validate correct contact data', () => {
      const data = { name: 'John Smith' };
      expect(() => createContactSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid email', () => {
      const data = {
        name: 'John Smith',
        email: 'not-an-email',
      };
      expect(() => createContactSchema.parse(data)).toThrow();
    });
  });

  describe('logOutreachSchema', () => {
    it('should validate correct outreach data', () => {
      const data = {
        contactId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        method: 'email',
      };
      expect(() => logOutreachSchema.parse(data)).not.toThrow();
    });

    it('should reject invalid UUID', () => {
      const data = {
        contactId: 'not-a-uuid',
        method: 'email',
      };
      expect(() => logOutreachSchema.parse(data)).toThrow();
    });
  });
});
