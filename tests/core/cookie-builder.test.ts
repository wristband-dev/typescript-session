import { CookieBuilder } from '../../src/core/cookie-builder';
import { NormalizedSessionOptions } from '../../src/types';

describe('CookieBuilder', () => {
  // Base options that will be used across tests
  const baseOptions: NormalizedSessionOptions = {
    cookieName: 'session',
    secrets: 'test-secret-key-minimum-32-chars-long',
    csrfCookieName: 'CSRF-TOKEN',
    enableCsrfProtection: false,
    maxAge: 3600,
    path: '/',
    secure: true,
    sameSite: 'lax' as const
  };

  describe('forSession', () => {
    it('should create session cookie options with httpOnly true', () => {
      const result = CookieBuilder.forSession(baseOptions);
      
      expect(result).toEqual({
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax'
      });
    });

    it('should include domain when provided', () => {
      const optionsWithDomain: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const result = CookieBuilder.forSession(optionsWithDomain);
      
      expect(result).toEqual({
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        domain: '.example.com'
      });
    });

    it('should omit domain when not provided', () => {
      const result = CookieBuilder.forSession(baseOptions);
      
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should handle different maxAge values', () => {
      const shortSession: NormalizedSessionOptions = {
        ...baseOptions,
        maxAge: 60
      };
      
      const result = CookieBuilder.forSession(shortSession);
      expect(result.maxAge).toBe(60);
    });

    it('should handle different path values', () => {
      const customPath: NormalizedSessionOptions = {
        ...baseOptions,
        path: '/app'
      };
      
      const result = CookieBuilder.forSession(customPath);
      expect(result.path).toBe('/app');
    });

    it('should handle secure false', () => {
      const insecure: NormalizedSessionOptions = {
        ...baseOptions,
        secure: false
      };
      
      const result = CookieBuilder.forSession(insecure);
      expect(result.secure).toBe(false);
    });

    it('should handle different sameSite values', () => {
      const strictSite: NormalizedSessionOptions = {
        ...baseOptions,
        sameSite: 'strict'
      };
      
      const result = CookieBuilder.forSession(strictSite);
      expect(result.sameSite).toBe('strict');
    });

    it('should handle sameSite none', () => {
      const noneSite: NormalizedSessionOptions = {
        ...baseOptions,
        sameSite: 'none'
      };
      
      const result = CookieBuilder.forSession(noneSite);
      expect(result.sameSite).toBe('none');
    });

    it('should always set httpOnly to true regardless of input', () => {
      const result = CookieBuilder.forSession(baseOptions);
      expect(result.httpOnly).toBe(true);
    });
  });

  describe('forCsrf', () => {
    it('should create CSRF cookie options with httpOnly false', () => {
      const result = CookieBuilder.forCsrf(baseOptions);
      
      expect(result).toEqual({
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax'
      });
    });

    it('should use csrfCookieDomain when provided', () => {
      const optionsWithCsrfDomain: NormalizedSessionOptions = {
        ...baseOptions,
        csrfCookieDomain: '.csrf.example.com'
      };
      
      const result = CookieBuilder.forCsrf(optionsWithCsrfDomain);
      
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should omit domain when csrfCookieDomain not provided', () => {
      const result = CookieBuilder.forCsrf(baseOptions);
      
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should prefer csrfCookieDomain over domain', () => {
      const optionsWithBoth: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com',
        csrfCookieDomain: '.csrf.example.com'
      };
      
      const result = CookieBuilder.forCsrf(optionsWithBoth);
      
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should not use domain property if csrfCookieDomain is not set', () => {
      const optionsWithDomain: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const result = CookieBuilder.forCsrf(optionsWithDomain);
      
      // CSRF should NOT use domain unless csrfCookieDomain is set
      expect(result.domain).toBeUndefined();
    });

    it('should handle different maxAge values', () => {
      const longSession: NormalizedSessionOptions = {
        ...baseOptions,
        maxAge: 7200
      };
      
      const result = CookieBuilder.forCsrf(longSession);
      expect(result.maxAge).toBe(7200);
    });

    it('should handle different sameSite values', () => {
      const strictSite: NormalizedSessionOptions = {
        ...baseOptions,
        sameSite: 'strict'
      };
      
      const result = CookieBuilder.forCsrf(strictSite);
      expect(result.sameSite).toBe('strict');
    });

    it('should always set httpOnly to false regardless of input', () => {
      const result = CookieBuilder.forCsrf(baseOptions);
      expect(result.httpOnly).toBe(false);
    });
  });

  describe('forSessionDestroy', () => {
    it('should create destroy options with maxAge 0 and httpOnly true', () => {
      const result = CookieBuilder.forSessionDestroy(baseOptions);
      
      expect(result).toEqual({
        maxAge: 0,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'lax'
      });
    });

    it('should include domain when provided', () => {
      const optionsWithDomain: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const result = CookieBuilder.forSessionDestroy(optionsWithDomain);
      
      expect(result.domain).toBe('.example.com');
    });

    it('should omit domain when not provided', () => {
      const result = CookieBuilder.forSessionDestroy(baseOptions);
      
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should always set maxAge to 0', () => {
      const result = CookieBuilder.forSessionDestroy(baseOptions);
      expect(result.maxAge).toBe(0);
    });

    it('should preserve path from original options', () => {
      const customPath: NormalizedSessionOptions = {
        ...baseOptions,
        path: '/api'
      };
      
      const result = CookieBuilder.forSessionDestroy(customPath);
      expect(result.path).toBe('/api');
    });

    it('should preserve secure flag from original options', () => {
      const insecure: NormalizedSessionOptions = {
        ...baseOptions,
        secure: false
      };
      
      const result = CookieBuilder.forSessionDestroy(insecure);
      expect(result.secure).toBe(false);
    });

    it('should preserve sameSite from original options', () => {
      const strictSite: NormalizedSessionOptions = {
        ...baseOptions,
        sameSite: 'strict'
      };
      
      const result = CookieBuilder.forSessionDestroy(strictSite);
      expect(result.sameSite).toBe('strict');
    });

    it('should always set httpOnly to true', () => {
      const result = CookieBuilder.forSessionDestroy(baseOptions);
      expect(result.httpOnly).toBe(true);
    });
  });

  describe('forCsrfDestroy', () => {
    it('should create destroy options with maxAge 0 and httpOnly false', () => {
      const result = CookieBuilder.forCsrfDestroy(baseOptions);
      
      expect(result).toEqual({
        maxAge: 0,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'lax'
      });
    });

    it('should use csrfCookieDomain when provided', () => {
      const optionsWithCsrfDomain: NormalizedSessionOptions = {
        ...baseOptions,
        csrfCookieDomain: '.csrf.example.com'
      };
      
      const result = CookieBuilder.forCsrfDestroy(optionsWithCsrfDomain);
      
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should omit domain when csrfCookieDomain not provided', () => {
      const result = CookieBuilder.forCsrfDestroy(baseOptions);
      
      expect(result.domain).toBeUndefined();
      expect('domain' in result).toBe(false);
    });

    it('should prefer csrfCookieDomain over domain', () => {
      const optionsWithBoth: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com',
        csrfCookieDomain: '.csrf.example.com'
      };
      
      const result = CookieBuilder.forCsrfDestroy(optionsWithBoth);
      
      expect(result.domain).toBe('.csrf.example.com');
    });

    it('should not use domain property if csrfCookieDomain is not set', () => {
      const optionsWithDomain: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const result = CookieBuilder.forCsrfDestroy(optionsWithDomain);
      
      expect(result.domain).toBeUndefined();
    });

    it('should always set maxAge to 0', () => {
      const result = CookieBuilder.forCsrfDestroy(baseOptions);
      expect(result.maxAge).toBe(0);
    });

    it('should preserve path from original options', () => {
      const customPath: NormalizedSessionOptions = {
        ...baseOptions,
        path: '/api'
      };
      
      const result = CookieBuilder.forCsrfDestroy(customPath);
      expect(result.path).toBe('/api');
    });

    it('should always set httpOnly to false', () => {
      const result = CookieBuilder.forCsrfDestroy(baseOptions);
      expect(result.httpOnly).toBe(false);
    });
  });

  describe('cross-method consistency', () => {
    it('should maintain consistent paths across all methods', () => {
      const customPath: NormalizedSessionOptions = {
        ...baseOptions,
        path: '/custom'
      };
      
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
      const secureOptions: NormalizedSessionOptions = {
        ...baseOptions,
        secure: true
      };
      
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
      const strictOptions: NormalizedSessionOptions = {
        ...baseOptions,
        sameSite: 'strict'
      };
      
      const session = CookieBuilder.forSession(strictOptions);
      const csrf = CookieBuilder.forCsrf(strictOptions);
      const sessionDestroy = CookieBuilder.forSessionDestroy(strictOptions);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(strictOptions);
      
      expect(session.sameSite).toBe('strict');
      expect(csrf.sameSite).toBe('strict');
      expect(sessionDestroy.sameSite).toBe('strict');
      expect(csrfDestroy.sameSite).toBe('strict');
    });

    it('session and sessionDestroy should have matching httpOnly', () => {
      const session = CookieBuilder.forSession(baseOptions);
      const sessionDestroy = CookieBuilder.forSessionDestroy(baseOptions);
      
      expect(session.httpOnly).toBe(sessionDestroy.httpOnly);
      expect(session.httpOnly).toBe(true);
    });

    it('csrf and csrfDestroy should have matching httpOnly', () => {
      const csrf = CookieBuilder.forCsrf(baseOptions);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(baseOptions);
      
      expect(csrf.httpOnly).toBe(csrfDestroy.httpOnly);
      expect(csrf.httpOnly).toBe(false);
    });

    it('session and sessionDestroy should use same domain logic', () => {
      const withDomain: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const session = CookieBuilder.forSession(withDomain);
      const sessionDestroy = CookieBuilder.forSessionDestroy(withDomain);
      
      expect(session.domain).toBe(sessionDestroy.domain);
    });

    it('csrf and csrfDestroy should use same domain logic', () => {
      const withCsrfDomain: NormalizedSessionOptions = {
        ...baseOptions,
        csrfCookieDomain: '.csrf.example.com'
      };
      
      const csrf = CookieBuilder.forCsrf(withCsrfDomain);
      const csrfDestroy = CookieBuilder.forCsrfDestroy(withCsrfDomain);
      
      expect(csrf.domain).toBe(csrfDestroy.domain);
    });
  });

  describe('edge cases', () => {
    it('should handle maxAge of 0 in forSession', () => {
      const zeroMaxAge: NormalizedSessionOptions = {
        ...baseOptions,
        maxAge: 0
      };
      
      const result = CookieBuilder.forSession(zeroMaxAge);
      expect(result.maxAge).toBe(0);
    });

    it('should handle very large maxAge values', () => {
      const largeMaxAge: NormalizedSessionOptions = {
        ...baseOptions,
        maxAge: 31536000 // 1 year in seconds
      };
      
      const result = CookieBuilder.forSession(largeMaxAge);
      expect(result.maxAge).toBe(31536000);
    });

    it('should handle empty string path', () => {
      const emptyPath: NormalizedSessionOptions = {
        ...baseOptions,
        path: ''
      };
      
      const result = CookieBuilder.forSession(emptyPath);
      expect(result.path).toBe('');
    });

    it('should handle root domain', () => {
      const rootDomain: NormalizedSessionOptions = {
        ...baseOptions,
        domain: '.com'
      };
      
      const result = CookieBuilder.forSession(rootDomain);
      expect(result.domain).toBe('.com');
    });
  });
});
