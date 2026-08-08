import { CookieBuilder } from '../../src/core/cookie-builder';
import { NormalizedSessionOptions } from '../../src/types';
import { mockOptions } from '../test-utils';

describe('CookieBuilder', () => {
  describe('forSession', () => {
    it('should create session cookie options with httpOnly true', () => {
      const result = CookieBuilder.forSession(mockOptions);
      expect(result).toEqual({
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      });
    });

    it('should include domain when provided', () => {
      const optionsWithDomain: NormalizedSessionOptions = { ...mockOptions, domain: '.example.com' };
      const result = CookieBuilder.forSession(optionsWithDomain);
      expect(result).toEqual({
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
        domain: '.example.com',
      });
    });

    it('should omit domain when not provided', () => {
      const result = CookieBuilder.forSession(mockOptions);
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should handle different maxAge values', () => {
      const shortSession: NormalizedSessionOptions = { ...mockOptions, maxAge: 60 };
      const result = CookieBuilder.forSession(shortSession);
      expect(result.maxAge).toBe(60);
    });

    it('should handle different path values', () => {
      const customPath: NormalizedSessionOptions = { ...mockOptions, path: '/app' };
      const result = CookieBuilder.forSession(customPath);
      expect(result.path).toBe('/app');
    });

    it('should handle secure false', () => {
      const insecure: NormalizedSessionOptions = { ...mockOptions, secure: false };
      const result = CookieBuilder.forSession(insecure);
      expect(result.secure).toBe(false);
    });

    it('should handle different sameSite values', () => {
      const strictSite: NormalizedSessionOptions = { ...mockOptions, sameSite: 'Strict' };
      const result = CookieBuilder.forSession(strictSite);
      expect(result.sameSite).toBe('Strict');
    });

    it('should handle sameSite None', () => {
      const noneSite: NormalizedSessionOptions = { ...mockOptions, sameSite: 'None' };
      const result = CookieBuilder.forSession(noneSite);
      expect(result.sameSite).toBe('None');
    });

    it('should always set httpOnly to true regardless of input', () => {
      const result = CookieBuilder.forSession(mockOptions);
      expect(result.httpOnly).toBe(true);
    });
  });

  describe('forCsrf', () => {
    it('should create CSRF cookie options with httpOnly false', () => {
      const result = CookieBuilder.forCsrf(mockOptions);
      expect(result).toEqual({
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax',
      });
    });

    it('should use csrfCookieDomain when provided', () => {
      const optionsWithCsrfDomain: NormalizedSessionOptions = { ...mockOptions, csrfCookieDomain: '.csrf.example.com' };
      const result = CookieBuilder.forCsrf(optionsWithCsrfDomain);
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should omit domain when csrfCookieDomain not provided', () => {
      const result = CookieBuilder.forCsrf(mockOptions);
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should prefer csrfCookieDomain over domain', () => {
      const optionsWithBoth: NormalizedSessionOptions = {
        ...mockOptions,
        domain: '.example.com',
        csrfCookieDomain: '.csrf.example.com',
      };
      const result = CookieBuilder.forCsrf(optionsWithBoth);
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should not use domain property if csrfCookieDomain is not set', () => {
      const optionsWithDomain: NormalizedSessionOptions = { ...mockOptions, domain: '.example.com' };
      const result = CookieBuilder.forCsrf(optionsWithDomain);
      // CSRF should NOT use domain unless csrfCookieDomain is set
      expect(result.domain).toBeUndefined();
    });

    it('should handle different maxAge values', () => {
      const longSession: NormalizedSessionOptions = { ...mockOptions, maxAge: 7200 };
      const result = CookieBuilder.forCsrf(longSession);
      expect(result.maxAge).toBe(7200);
    });

    it('should handle different sameSite values', () => {
      const strictSite: NormalizedSessionOptions = { ...mockOptions, sameSite: 'Strict' };
      const result = CookieBuilder.forCsrf(strictSite);
      expect(result.sameSite).toBe('Strict');
    });

    it('should always set httpOnly to false regardless of input', () => {
      const result = CookieBuilder.forCsrf(mockOptions);
      expect(result.httpOnly).toBe(false);
    });
  });

  describe('forSessionDestroy', () => {
    it('should create destroy options with maxAge 0 and httpOnly true', () => {
      const result = CookieBuilder.forSessionDestroy(mockOptions);
      expect(result).toEqual({
        maxAge: 0,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      });
    });

    it('should include domain when provided', () => {
      const optionsWithDomain: NormalizedSessionOptions = { ...mockOptions, domain: '.example.com' };
      const result = CookieBuilder.forSessionDestroy(optionsWithDomain);
      expect(result.domain).toBe('.example.com');
    });

    it('should omit domain when not provided', () => {
      const result = CookieBuilder.forSessionDestroy(mockOptions);
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should always set maxAge to 0', () => {
      const result = CookieBuilder.forSessionDestroy(mockOptions);
      expect(result.maxAge).toBe(0);
    });

    it('should preserve path from original options', () => {
      const customPath: NormalizedSessionOptions = { ...mockOptions, path: '/api' };
      const result = CookieBuilder.forSessionDestroy(customPath);
      expect(result.path).toBe('/api');
    });

    it('should preserve secure flag from original options', () => {
      const insecure: NormalizedSessionOptions = { ...mockOptions, secure: false };
      const result = CookieBuilder.forSessionDestroy(insecure);
      expect(result.secure).toBe(false);
    });

    it('should preserve sameSite from original options', () => {
      const strictSite: NormalizedSessionOptions = { ...mockOptions, sameSite: 'Strict' };
      const result = CookieBuilder.forSessionDestroy(strictSite);
      expect(result.sameSite).toBe('Strict');
    });

    it('should always set httpOnly to true', () => {
      const result = CookieBuilder.forSessionDestroy(mockOptions);
      expect(result.httpOnly).toBe(true);
    });
  });

  describe('forCsrfDestroy', () => {
    it('should create destroy options with maxAge 0 and httpOnly false', () => {
      const result = CookieBuilder.forCsrfDestroy(mockOptions);
      expect(result).toEqual({
        maxAge: 0,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax',
      });
    });

    it('should use csrfCookieDomain when provided', () => {
      const optionsWithCsrfDomain: NormalizedSessionOptions = { ...mockOptions, csrfCookieDomain: '.csrf.example.com' };
      const result = CookieBuilder.forCsrfDestroy(optionsWithCsrfDomain);
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should omit domain when csrfCookieDomain not provided', () => {
      const result = CookieBuilder.forCsrfDestroy(mockOptions);
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should prefer csrfCookieDomain over domain', () => {
      const optionsWithBoth: NormalizedSessionOptions = {
        ...mockOptions,
        domain: '.example.com',
        csrfCookieDomain: '.csrf.example.com',
      };
      const result = CookieBuilder.forCsrfDestroy(optionsWithBoth);
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should not use domain property if csrfCookieDomain is not set', () => {
      const optionsWithDomain: NormalizedSessionOptions = { ...mockOptions, domain: '.example.com' };
      const result = CookieBuilder.forCsrfDestroy(optionsWithDomain);
      expect(result.domain).toBeUndefined();
    });

    it('should always set maxAge to 0', () => {
      const result = CookieBuilder.forCsrfDestroy(mockOptions);
      expect(result.maxAge).toBe(0);
    });

    it('should preserve path from original options', () => {
      const customPath: NormalizedSessionOptions = { ...mockOptions, path: '/api' };
      const result = CookieBuilder.forCsrfDestroy(customPath);
      expect(result.path).toBe('/api');
    });

    it('should always set httpOnly to false', () => {
      const result = CookieBuilder.forCsrfDestroy(mockOptions);
      expect(result.httpOnly).toBe(false);
    });
  });

  describe('cross-method consistency', () => {
    it('should maintain consistent paths across all methods', () => {
      const customPath: NormalizedSessionOptions = { ...mockOptions, path: '/custom' };
      const session = CookieBuilder.forSession(customPath);
      const csrf = CookieBuilder.forCsrf(customPath);
      const sessionDestroy = CookieBuilder.forSessionDestroy(customPath);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(customPath);
      expect(session.path).toBe('/custom');
      expect(csrf.path).toBe('/custom');
      expect(sessionDestroy.path).toBe('/custom');
      expect(csrfDestroy.path).toBe('/custom');
    });

    it('should maintain consistent secure flags across all methods', () => {
      const secureOptions: NormalizedSessionOptions = { ...mockOptions, secure: true };
      const session = CookieBuilder.forSession(secureOptions);
      const csrf = CookieBuilder.forCsrf(secureOptions);
      const sessionDestroy = CookieBuilder.forSessionDestroy(secureOptions);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(secureOptions);
      expect(session.secure).toBe(true);
      expect(csrf.secure).toBe(true);
      expect(sessionDestroy.secure).toBe(true);
      expect(csrfDestroy.secure).toBe(true);
    });

    it('should maintain consistent sameSite across all methods', () => {
      const strictOptions: NormalizedSessionOptions = { ...mockOptions, sameSite: 'Strict' };
      const session = CookieBuilder.forSession(strictOptions);
      const csrf = CookieBuilder.forCsrf(strictOptions);
      const sessionDestroy = CookieBuilder.forSessionDestroy(strictOptions);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(strictOptions);
      expect(session.sameSite).toBe('Strict');
      expect(csrf.sameSite).toBe('Strict');
      expect(sessionDestroy.sameSite).toBe('Strict');
      expect(csrfDestroy.sameSite).toBe('Strict');
    });

    it('session and sessionDestroy should have matching httpOnly', () => {
      const session = CookieBuilder.forSession(mockOptions);
      const sessionDestroy = CookieBuilder.forSessionDestroy(mockOptions);
      expect(session.httpOnly).toBe(sessionDestroy.httpOnly);
      expect(session.httpOnly).toBe(true);
    });

    it('csrf and csrfDestroy should have matching httpOnly', () => {
      const csrf = CookieBuilder.forCsrf(mockOptions);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(mockOptions);
      expect(csrf.httpOnly).toBe(csrfDestroy.httpOnly);
      expect(csrf.httpOnly).toBe(false);
    });

    it('session and sessionDestroy should use same domain logic', () => {
      const withDomain: NormalizedSessionOptions = { ...mockOptions, domain: '.example.com' };
      const session = CookieBuilder.forSession(withDomain);
      const sessionDestroy = CookieBuilder.forSessionDestroy(withDomain);
      expect(session.domain).toBe(sessionDestroy.domain);
    });

    it('csrf and csrfDestroy should use same domain logic', () => {
      const withCsrfDomain: NormalizedSessionOptions = { ...mockOptions, csrfCookieDomain: '.csrf.example.com' };
      const csrf = CookieBuilder.forCsrf(withCsrfDomain);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(withCsrfDomain);
      expect(csrf.domain).toBe(csrfDestroy.domain);
    });
  });

  describe('edge cases', () => {
    it('should handle maxAge of 0 in forSession', () => {
      const zeroMaxAge: NormalizedSessionOptions = { ...mockOptions, maxAge: 0 };
      const result = CookieBuilder.forSession(zeroMaxAge);
      expect(result.maxAge).toBe(0);
    });

    it('should handle very large maxAge values', () => {
      const largeMaxAge: NormalizedSessionOptions = { ...mockOptions, maxAge: 31536000 }; // 1 year in seconds
      const result = CookieBuilder.forSession(largeMaxAge);
      expect(result.maxAge).toBe(31536000);
    });

    it('should handle empty string path', () => {
      const emptyPath: NormalizedSessionOptions = { ...mockOptions, path: '' };
      const result = CookieBuilder.forSession(emptyPath);
      expect(result.path).toBe('');
    });

    it('should handle root domain', () => {
      const rootDomain: NormalizedSessionOptions = { ...mockOptions, domain: '.com' };
      const result = CookieBuilder.forSession(rootDomain);
      expect(result.domain).toBe('.com');
    });
  });
});
