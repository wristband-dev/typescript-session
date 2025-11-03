import { SessionError, SessionErrorCode } from '../../src/error';
import { prepareOptions } from '../../src/core/options';
import { SessionOptions } from '../../src/types';

describe('prepareOptions', () => {
  const validSecret = 'a'.repeat(32);

  describe('normalization - defaults', () => {
    it('should apply default cookieName', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.cookieName).toBe('session');
    });

    it('should apply default maxAge', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.maxAge).toBe(3600);
    });

    it('should apply default path', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.path).toBe('/');
    });

    it('should apply default secure flag', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.secure).toBe(true);
    });

    it('should apply default sameSite', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('Lax');
    });

    it('should apply default csrfCookieName', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.csrfCookieName).toBe('CSRF-TOKEN');
    });

    it('should apply default enableCsrfProtection', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.enableCsrfProtection).toBe(false);
    });

    it('should not set domain when not provided', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.domain).toBeUndefined();
    });

    it('should not set csrfCookieDomain when neither domain nor csrfCookieDomain provided', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      expect(result.csrfCookieDomain).toBeUndefined();
    });
  });

  describe('normalization - custom values', () => {
    it('should use custom cookieName when provided', () => {
      const options: SessionOptions = { secrets: validSecret, cookieName: 'custom-session' };
      const result = prepareOptions(options);
      expect(result.cookieName).toBe('custom-session');
    });

    it('should use custom maxAge when provided', () => {
      const options: SessionOptions = { secrets: validSecret, maxAge: 7200 };
      const result = prepareOptions(options);
      expect(result.maxAge).toBe(7200);
    });

    it('should use custom path when provided', () => {
      const options: SessionOptions = { secrets: validSecret, path: '/api' };
      const result = prepareOptions(options);
      expect(result.path).toBe('/api');
    });

    it('should use custom secure flag when provided', () => {
      const options: SessionOptions = { secrets: validSecret, secure: false };
      const result = prepareOptions(options);
      expect(result.secure).toBe(false);
    });

    it('should preserve domain when provided', () => {
      const options: SessionOptions = { secrets: validSecret, domain: '.example.com' };
      const result = prepareOptions(options);
      expect(result.domain).toBe('.example.com');
    });

    it('should use csrfCookieDomain when provided', () => {
      const options: SessionOptions = { secrets: validSecret, csrfCookieDomain: '.csrf.example.com' };
      const result = prepareOptions(options);
      expect(result.csrfCookieDomain).toBe('.csrf.example.com');
    });

    it('should fallback csrfCookieDomain to domain when csrfCookieDomain not provided', () => {
      const options: SessionOptions = { secrets: validSecret, domain: '.example.com' };
      const result = prepareOptions(options);
      expect(result.csrfCookieDomain).toBe('.example.com');
    });

    it('should use csrfCookieDomain over domain when both provided', () => {
      const options: SessionOptions = {
        secrets: validSecret,
        domain: '.example.com',
        csrfCookieDomain: '.csrf.example.com'
      };
      const result = prepareOptions(options);
      expect(result.csrfCookieDomain).toBe('.csrf.example.com');
    });

    it('should use custom csrfCookieName when provided', () => {
      const options: SessionOptions = { secrets: validSecret, csrfCookieName: 'X-CSRF' };
      const result = prepareOptions(options);
      expect(result.csrfCookieName).toBe('X-CSRF');
    });

    it('should use custom enableCsrfProtection when provided', () => {
      const options: SessionOptions = { secrets: validSecret, enableCsrfProtection: true };
      const result = prepareOptions(options);
      expect(result.enableCsrfProtection).toBe(true);
    });
  });

  describe('sameSite normalization', () => {
    it('should normalize lowercase "lax" to "Lax"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'lax' };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('Lax');
    });

    it('should normalize lowercase "strict" to "Strict"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'strict' };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('Strict');
    });

    it('should normalize lowercase "none" to "None"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'none' };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('None');
    });

    it('should accept capitalized "Lax"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'Lax' };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('Lax');
    });

    it('should accept capitalized "Strict"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'Strict' };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('Strict');
    });

    it('should accept capitalized "None"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'None' };
      const result = prepareOptions(options);
      expect(result.sameSite).toBe('None');
    });

    it('should throw error for invalid sameSite value "NONE"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'NONE' as any };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('Invalid sameSite value');
    });

    it('should throw error for invalid sameSite value "LAX"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'LAX' as any };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('Invalid sameSite value');
    });

    it('should throw error for invalid sameSite value "loose"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'loose' as any };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('Invalid sameSite value');
    });

    it('should throw error for mixed case "lAx"', () => {
      const options: SessionOptions = { secrets: validSecret, sameSite: 'lAx' as any };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('Invalid sameSite value');
    });
  });

  describe('secret validation', () => {
    it('should throw error when secrets is empty array', () => {
      const options: SessionOptions = { secrets: [] };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('At least one secret is required');
      
      try {
        prepareOptions(options);
      } catch (error) {
        expect((error as SessionError).code).toBe(SessionErrorCode.INVALID_CONFIGURATION);
      }
    });

    it('should throw error when secret is empty string', () => {
      const options: SessionOptions = { secrets: '' };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('non-empty strings');
    });

    it('should throw error when secret is too short', () => {
      const options: SessionOptions = { secrets: 'tooshort' };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('at least 32 characters');
    });

    it('should accept secret that is exactly 32 characters', () => {
      const options: SessionOptions = { secrets: 'a'.repeat(32) };
      const result = prepareOptions(options);
      expect(result.secrets).toBe('a'.repeat(32));
    });

    it('should accept secret longer than 32 characters', () => {
      const options: SessionOptions = { secrets: 'a'.repeat(64) };
      const result = prepareOptions(options);
      expect(result.secrets).toBe('a'.repeat(64));
    });

    it('should throw error when more than 3 secrets provided', () => {
      const options: SessionOptions = {
        secrets: ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32), 'd'.repeat(32)]
      };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('Maximum 3 secrets');
    });

    it('should accept exactly 3 secrets', () => {
      const options: SessionOptions = {
        secrets: ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)]
      };
      const result = prepareOptions(options);
      expect(result.secrets).toEqual(['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32)]);
    });

    it('should accept array with single secret', () => {
      const options: SessionOptions = { secrets: ['a'.repeat(32)] };
      const result = prepareOptions(options);
      expect(result.secrets).toEqual(['a'.repeat(32)]);
    });

    it('should accept array with two secrets', () => {
      const options: SessionOptions = { secrets: ['a'.repeat(32), 'b'.repeat(32)] };
      const result = prepareOptions(options);
      expect(result.secrets).toEqual(['a'.repeat(32), 'b'.repeat(32)]);
    });

    it('should throw error when secrets array contains empty string', () => {
      const options: SessionOptions = { secrets: ['a'.repeat(32), ''] };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('non-empty strings');
    });

    it('should throw error when secrets array contains short string', () => {
      const options: SessionOptions = { secrets: ['a'.repeat(32), 'short'] };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('at least 32 characters');
    });
  });

  describe('maxAge validation', () => {
    it('should throw error when maxAge is 0', () => {
      const options: SessionOptions = { secrets: validSecret, maxAge: 0 };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('maxAge must be greater than 0');
      
      try {
        prepareOptions(options);
      } catch (error) {
        expect((error as SessionError).code).toBe(SessionErrorCode.INVALID_CONFIGURATION);
      }
    });

    it('should throw error when maxAge is negative', () => {
      const options: SessionOptions = { secrets: validSecret, maxAge: -100 };
      expect(() => prepareOptions(options)).toThrow(SessionError);
      expect(() => prepareOptions(options)).toThrow('maxAge must be greater than 0');
    });

    it('should accept maxAge of 1', () => {
      const options: SessionOptions = { secrets: validSecret, maxAge: 1 };
      const result = prepareOptions(options);
      expect(result.maxAge).toBe(1);
    });

    it('should accept large maxAge values', () => {
      const options: SessionOptions = { secrets: validSecret, maxAge: 86400 * 365 }; // 1 year
      const result = prepareOptions(options);
      expect(result.maxAge).toBe(86400 * 365);
    });
  });

  describe('complete option scenarios', () => {
    it('should handle minimal configuration', () => {
      const options: SessionOptions = { secrets: validSecret };
      const result = prepareOptions(options);
      
      expect(result).toEqual({
        cookieName: 'session',
        secrets: validSecret,
        maxAge: 3600,
        path: '/',
        secure: true,
        sameSite: 'Lax',
        csrfCookieName: 'CSRF-TOKEN',
        enableCsrfProtection: false
      });
    });

    it('should handle fully customized configuration', () => {
      const options: SessionOptions = {
        secrets: ['a'.repeat(32), 'b'.repeat(32)],
        cookieName: 'my-session',
        maxAge: 7200,
        domain: '.example.com',
        path: '/api',
        secure: false,
        sameSite: 'strict',
        csrfCookieName: 'X-CSRF',
        csrfCookieDomain: '.csrf.example.com',
        enableCsrfProtection: true
      };
      const result = prepareOptions(options);
      
      expect(result).toEqual({
        cookieName: 'my-session',
        secrets: ['a'.repeat(32), 'b'.repeat(32)],
        maxAge: 7200,
        domain: '.example.com',
        path: '/api',
        secure: false,
        sameSite: 'Strict',
        csrfCookieName: 'X-CSRF',
        csrfCookieDomain: '.csrf.example.com',
        enableCsrfProtection: true
      });
    });

    it('should handle CSRF-enabled configuration with domain fallback', () => {
      const options: SessionOptions = {
        secrets: validSecret,
        domain: '.example.com',
        enableCsrfProtection: true
      };
      const result = prepareOptions(options);
      
      expect(result.domain).toBe('.example.com');
      expect(result.csrfCookieDomain).toBe('.example.com');
      expect(result.enableCsrfProtection).toBe(true);
    });
  });
});
