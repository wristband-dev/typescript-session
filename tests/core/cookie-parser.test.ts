/**
 * Unit tests for CookieParser utility class.
 * 
 * Tests cover:
 * - Cookie header parsing (request cookies)
 * - Set-Cookie header serialization (response cookies)
 * - Cookie deletion
 * - URL encoding/decoding
 * - Edge cases and malformed input
 * - RFC 6265 compliance
 */

import { CookieParser } from '../../src/core/cookie-parser';
import { CookieOptions } from '../../src/types';

describe('CookieParser', () => {
  // Base cookie options for testing
  const baseOptions: CookieOptions = {
    path: '/',
    maxAge: 3600,
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  };

  describe('parse', () => {
    it('should parse simple cookie string', () => {
      const result = CookieParser.parse('session=abc123');
      expect(result).toEqual({ session: 'abc123' });
    });

    it('should parse multiple cookies', () => {
      const result = CookieParser.parse('session=abc123; theme=dark; lang=en');
      expect(result).toEqual({
        session: 'abc123',
        theme: 'dark',
        lang: 'en'
      });
    });

    it('should handle empty cookie header', () => {
      const result = CookieParser.parse('');
      expect(result).toEqual({});
    });

    it('should handle cookies with spaces around semicolons', () => {
      const result = CookieParser.parse('session=abc123 ; theme=dark ; lang=en');
      expect(result).toEqual({
        session: 'abc123',
        theme: 'dark',
        lang: 'en'
      });
    });

    it('should decode URL-encoded cookie values', () => {
      const result = CookieParser.parse('email=user%40example.com');
      expect(result).toEqual({ email: 'user@example.com' });
    });

    it('should handle cookies with equals signs in values', () => {
      const result = CookieParser.parse('data=key=value');
      expect(result).toEqual({ data: 'key=value' });
    });

    it('should handle cookies with multiple equals signs in values', () => {
      const result = CookieParser.parse('token=eyJhbGc=base64=data');
      expect(result).toEqual({ token: 'eyJhbGc=base64=data' });
    });

    it('should handle empty cookie values', () => {
      const result = CookieParser.parse('session=');
      expect(result).toEqual({ session: '' });
    });

    it('should handle cookies with special characters in values', () => {
      const encoded = encodeURIComponent('hello world!@#$%');
      const result = CookieParser.parse(`data=${encoded}`);
      expect(result).toEqual({ data: 'hello world!@#$%' });
    });

    it('should ignore malformed cookies without equals sign', () => {
      const result = CookieParser.parse('session=abc123; invalidcookie; theme=dark');
      expect(result).toEqual({
        session: 'abc123',
        theme: 'dark'
      });
    });

    it('should handle cookies with only name and no value', () => {
      const result = CookieParser.parse('session=abc123; empty=; theme=dark');
      expect(result).toEqual({
        session: 'abc123',
        empty: '',
        theme: 'dark'
      });
    });

    it('should trim whitespace from cookie pairs', () => {
      const result = CookieParser.parse(' session=abc123 ;  theme=dark ');
      expect(result).toEqual({
        session: 'abc123',
        theme: 'dark'
      });
    });

    it('should handle single cookie without semicolon', () => {
      const result = CookieParser.parse('session=abc123');
      expect(result).toEqual({ session: 'abc123' });
    });

    it('should handle cookies with JSON-like values', () => {
      const jsonValue = encodeURIComponent('{"key":"value"}');
      const result = CookieParser.parse(`data=${jsonValue}`);
      expect(result).toEqual({ data: '{"key":"value"}' });
    });

    it('should handle very long cookie values', () => {
      const longValue = 'a'.repeat(4000);
      const result = CookieParser.parse(`session=${longValue}`);
      expect(result).toEqual({ session: longValue });
    });
  });

  describe('serialize', () => {
    it('should serialize basic cookie with all options', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      
      expect(result).toContain('session=abc123');
      expect(result).toContain('Path=/');
      expect(result).toContain('SameSite=lax');
      expect(result).toContain('Max-Age=3600');
      expect(result).toContain('Secure');
      expect(result).toContain('HttpOnly');
    });

    it('should URL-encode cookie values', () => {
      const result = CookieParser.serialize('email', 'user@example.com', baseOptions);
      expect(result).toContain('email=user%40example.com');
    });

    it('should handle special characters in values', () => {
      const result = CookieParser.serialize('data', 'hello world!@#$%', baseOptions);
      expect(result).toContain(encodeURIComponent('hello world!@#$%'));
    });

    it('should include domain when provided', () => {
      const options: CookieOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const result = CookieParser.serialize('session', 'abc123', options);
      expect(result).toContain('Domain=.example.com');
    });

    it('should omit domain when not provided', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      expect(result).not.toContain('Domain=');
    });

    it('should include Secure flag when secure is true', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      expect(result).toContain('Secure');
    });

    it('should omit Secure flag when secure is false', () => {
      const options: CookieOptions = {
        ...baseOptions,
        secure: false
      };
      
      const result = CookieParser.serialize('session', 'abc123', options);
      expect(result).not.toContain('Secure');
    });

    it('should include HttpOnly flag when httpOnly is true', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      expect(result).toContain('HttpOnly');
    });

    it('should omit HttpOnly flag when httpOnly is false', () => {
      const options: CookieOptions = {
        ...baseOptions,
        httpOnly: false
      };
      
      const result = CookieParser.serialize('session', 'abc123', options);
      expect(result).not.toContain('HttpOnly');
    });

    it('should handle different sameSite values', () => {
      const strictOptions: CookieOptions = {
        ...baseOptions,
        sameSite: 'strict'
      };
      
      const result = CookieParser.serialize('session', 'abc123', strictOptions);
      expect(result).toContain('SameSite=strict');
    });

    it('should handle sameSite none', () => {
      const noneOptions: CookieOptions = {
        ...baseOptions,
        sameSite: 'none'
      };
      
      const result = CookieParser.serialize('session', 'abc123', noneOptions);
      expect(result).toContain('SameSite=none');
    });

    it('should handle different path values', () => {
      const options: CookieOptions = {
        ...baseOptions,
        path: '/api'
      };
      
      const result = CookieParser.serialize('session', 'abc123', options);
      expect(result).toContain('Path=/api');
    });

    it('should handle maxAge of 0 with Expires header', () => {
      const options: CookieOptions = {
        ...baseOptions,
        maxAge: 0
      };
      
      const result = CookieParser.serialize('session', '', options);
      expect(result).toContain('Max-Age=0');
      expect(result).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    it('should not include Expires header for non-zero maxAge', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      expect(result).not.toContain('Expires=');
    });

    it('should handle empty cookie value', () => {
      const result = CookieParser.serialize('session', '', baseOptions);
      expect(result).toContain('session=');
    });

    it('should handle very large maxAge values', () => {
      const options: CookieOptions = {
        ...baseOptions,
        maxAge: 31536000 // 1 year
      };
      
      const result = CookieParser.serialize('session', 'abc123', options);
      expect(result).toContain('Max-Age=31536000');
    });

    it('should throw error when name is missing', () => {
      expect(() => {
        CookieParser.serialize('', 'value', baseOptions);
      }).toThrow('Cookie serialization missing the [name] argument');
    });

    it('should throw error when options are missing', () => {
      expect(() => {
        // @ts-expect-error Testing runtime error
        CookieParser.serialize('session', 'value', null);
      }).toThrow('Cookie serialization missing the [options] argument');
    });

    it('should handle cookie names with hyphens', () => {
      const result = CookieParser.serialize('csrf-token', 'abc123', baseOptions);
      expect(result).toContain('csrf-token=abc123');
    });

    it('should handle cookie names with underscores', () => {
      const result = CookieParser.serialize('session_id', 'abc123', baseOptions);
      expect(result).toContain('session_id=abc123');
    });

    it('should preserve order of cookie attributes', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      
      // Verify the order: name=value; Path; SameSite; Max-Age; [Secure]; [HttpOnly]
      const parts = result.split('; ');
      expect(parts[0]).toBe('session=abc123');
      expect(parts[1]).toBe('Path=/');
      expect(parts[2]).toBe('SameSite=lax');
      expect(parts[3]).toBe('Max-Age=3600');
    });
  });

  describe('createDestroyCookie', () => {
    it('should create cookie with empty value and maxAge 0', () => {
      const result = CookieParser.createDestroyCookie('session', baseOptions);
      
      expect(result).toContain('session=');
      expect(result).toContain('Max-Age=0');
      expect(result).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    it('should preserve all other cookie options', () => {
      const result = CookieParser.createDestroyCookie('session', baseOptions);
      
      expect(result).toContain('Path=/');
      expect(result).toContain('SameSite=lax');
      expect(result).toContain('Secure');
      expect(result).toContain('HttpOnly');
    });

    it('should include domain when provided', () => {
      const options: CookieOptions = {
        ...baseOptions,
        domain: '.example.com'
      };
      
      const result = CookieParser.createDestroyCookie('session', options);
      expect(result).toContain('Domain=.example.com');
    });

    it('should work with different cookie names', () => {
      const result = CookieParser.createDestroyCookie('csrf-token', baseOptions);
      expect(result).toContain('csrf-token=');
      expect(result).toContain('Max-Age=0');
    });

    it('should handle custom path', () => {
      const options: CookieOptions = {
        ...baseOptions,
        path: '/api'
      };
      
      const result = CookieParser.createDestroyCookie('session', options);
      expect(result).toContain('Path=/api');
    });

    it('should respect httpOnly false', () => {
      const options: CookieOptions = {
        ...baseOptions,
        httpOnly: false
      };
      
      const result = CookieParser.createDestroyCookie('csrf-token', options);
      expect(result).not.toContain('HttpOnly');
    });

    it('should respect secure false', () => {
      const options: CookieOptions = {
        ...baseOptions,
        secure: false
      };
      
      const result = CookieParser.createDestroyCookie('session', options);
      expect(result).not.toContain('Secure');
    });
  });

  describe('parse and serialize roundtrip', () => {
    it('should successfully roundtrip simple value', () => {
      const serialized = CookieParser.serialize('session', 'abc123', baseOptions);
      
      // Extract just the cookie value part (before first semicolon)
      const cookiePart = serialized.split(';')[0];
      const parsed = CookieParser.parse(cookiePart);
      
      expect(parsed.session).toBe('abc123');
    });

    it('should successfully roundtrip URL-encoded values', () => {
      const value = 'user@example.com';
      const serialized = CookieParser.serialize('email', value, baseOptions);
      
      // Extract just the cookie value part
      const cookiePart = serialized.split(';')[0];
      const parsed = CookieParser.parse(cookiePart);
      
      expect(parsed.email).toBe(value);
    });

    it('should successfully roundtrip special characters', () => {
      const value = 'hello world!@#$%';
      const serialized = CookieParser.serialize('data', value, baseOptions);
      
      const cookiePart = serialized.split(';')[0];
      const parsed = CookieParser.parse(cookiePart);
      
      expect(parsed.data).toBe(value);
    });

    it('should successfully roundtrip values with equals signs', () => {
      const value = 'key=value';
      const serialized = CookieParser.serialize('data', value, baseOptions);
      
      const cookiePart = serialized.split(';')[0];
      const parsed = CookieParser.parse(cookiePart);
      
      expect(parsed.data).toBe(value);
    });

    it('should successfully roundtrip empty values', () => {
      const serialized = CookieParser.serialize('empty', '', baseOptions);
      
      const cookiePart = serialized.split(';')[0];
      const parsed = CookieParser.parse(cookiePart);
      
      expect(parsed.empty).toBe('');
    });
  });

  describe('RFC 6265 compliance', () => {
    it('should use semicolon and space as delimiter', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      const parts = result.split('; ');
      
      expect(parts.length).toBeGreaterThan(1);
      expect(result).toMatch(/; /);
    });

    it('should format attributes correctly', () => {
      const result = CookieParser.serialize('session', 'abc123', baseOptions);
      
      // Attributes should be in format "Key=Value" or just "Key"
      expect(result).toMatch(/Path=\//);
      expect(result).toMatch(/Max-Age=\d+/);
      expect(result).toMatch(/SameSite=(strict|lax|none)/);
      expect(result).toContain('Secure');
      expect(result).toContain('HttpOnly');
    });

    it('should use correct Expires format for epoch', () => {
      const options: CookieOptions = {
        ...baseOptions,
        maxAge: 0
      };
      
      const result = CookieParser.serialize('session', '', options);
      expect(result).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    it('should properly encode cookie values per RFC 6265', () => {
      // RFC 6265 requires certain characters to be percent-encoded
      const specialChars = ' ,";<>';
      const result = CookieParser.serialize('test', specialChars, baseOptions);
      
      expect(result).toContain(encodeURIComponent(specialChars));
    });
  });
});
