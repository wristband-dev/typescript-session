import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { NodeAdapter } from '../../src/adapters/node';
import { SessionError, SessionErrorCode } from '../../src/error';
import { CookieOptions } from '../../src/types';

describe('NodeAdapter', () => {
  function createMockRequest(cookieHeader?: string): IncomingMessage {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    if (cookieHeader) {
      req.headers.cookie = cookieHeader;
    }
    return req;
  }

  function createMockResponse(): ServerResponse {
    const socket = new Socket();
    const res = new ServerResponse(new IncomingMessage(socket));
    return res;
  }

  describe('constructor', () => {
    it('should create adapter with request only', () => {
      const req = createMockRequest();
      const adapter = new NodeAdapter(req);
      expect(adapter).toBeDefined();
    });

    it('should create adapter with request and response', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      expect(adapter).toBeDefined();
    });
  });

  describe('readCookie()', () => {
    it('should return undefined when no cookie header present', () => {
      const req = createMockRequest();
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBeUndefined();
    });

    it('should return undefined when cookie not found', () => {
      const req = createMockRequest('other=value');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBeUndefined();
    });

    it('should read single cookie', () => {
      const req = createMockRequest('session=abc123');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBe('abc123');
    });

    it('should read cookie from multiple cookies', () => {
      const req = createMockRequest('foo=bar; session=abc123; baz=qux');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBe('abc123');
    });

    it('should URL-decode cookie values with encoded special characters', () => {
      const req = createMockRequest('session=value%20with%20spaces');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBe('value with spaces');
    });

    it('should read last cookie when duplicate names exist', () => {
      const req = createMockRequest('session=first; session=second');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBe('second');
    });

    it('should handle empty cookie value', () => {
      const req = createMockRequest('session=');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('session');
      expect(value).toBe('');
    });

    it('should read cookie values containing equals signs', () => {
      const req = createMockRequest('token=eyJhbGc=base64=data');
      const adapter = new NodeAdapter(req);
      const value = adapter.readCookie('token');
      expect(value).toBe('eyJhbGc=base64=data');
    });
  });

  describe('writeCookie()', () => {
    it('should throw error when no response object', () => {
      const req = createMockRequest();
      const adapter = new NodeAdapter(req);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      expect(() => adapter.writeCookie('session', 'value', options)).toThrow(SessionError);
      expect(() => adapter.writeCookie('session', 'value', options)).toThrow('No response object available');
    });

    it('should write single cookie', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value123', options);
      const setCookie = res.getHeader('set-cookie');
      expect(setCookie).toBeDefined();
      expect(setCookie).toContain('session=value123');
      expect(setCookie).toContain('Max-Age=3600');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
    });

    it('should handle multiple writeCookie calls', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value1', options);
      adapter.writeCookie('csrf', 'value2', options);
      const setCookie = res.getHeader('set-cookie') as string[];
      expect(setCookie.length).toBe(2);
      expect(setCookie[0]).toContain('session=value1');
      expect(setCookie[1]).toContain('csrf=value2');
    });

    it('should append to existing Set-Cookie header (string)', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      res.setHeader('set-cookie', 'existing=cookie; Path=/');
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie') as string[];
      expect(Array.isArray(setCookie)).toBe(true);
      expect(setCookie.length).toBe(2);
      expect(setCookie[0]).toContain('existing=cookie');
      expect(setCookie[1]).toContain('session=value');
    });

    it('should append to existing Set-Cookie header (array)', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      res.setHeader('set-cookie', ['first=cookie; Path=/', 'second=cookie; Path=/']);
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie') as string[];
      expect(Array.isArray(setCookie)).toBe(true);
      expect(setCookie.length).toBe(3);
      expect(setCookie[0]).toContain('first=cookie');
      expect(setCookie[1]).toContain('second=cookie');
      expect(setCookie[2]).toContain('session=value');
    });

    it('should write cookie with domain', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        domain: '.example.com',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie');
      expect(setCookie).toContain('Domain=.example.com');
    });

    it('should write cookie with custom path', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/api',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie');
      expect(setCookie).toContain('Path=/api');
    });

    it('should write cookie with sameSite=Strict', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      };
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie');
      expect(setCookie).toContain('SameSite=Strict');
    });

    it('should write cookie with sameSite=None', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'None',
      };
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie');
      expect(setCookie).toContain('SameSite=None');
    });

    it('should write non-secure cookie', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: false,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie') as string;
      expect(setCookie).not.toContain('Secure');
    });

    it('should write non-httpOnly cookie', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value', options);
      const setCookie = res.getHeader('set-cookie') as string;
      expect(setCookie).not.toContain('HttpOnly');
    });

    it('should URL-encode cookie values with special characters when writing', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', 'value with spaces', options);
      const setCookie = res.getHeader('set-cookie') as string;
      expect(setCookie).toContain('session=value%20with%20spaces');
    });

    it('should write cookie with maxAge=0 for deletion', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      const options: CookieOptions = {
        maxAge: 0,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };
      adapter.writeCookie('session', '', options);
      const setCookie = res.getHeader('set-cookie') as string;
      expect(setCookie).toContain('Max-Age=0');
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });
  });

  describe('canWriteCookies()', () => {
    it('should return false when no response object', () => {
      const req = createMockRequest();
      const adapter = new NodeAdapter(req);
      expect(adapter.canWriteCookies()).toBe(false);
    });

    it('should return true when response object present', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const adapter = new NodeAdapter(req, res);
      expect(adapter.canWriteCookies()).toBe(true);
    });

    it('should return false when response is undefined', () => {
      const req = createMockRequest();
      const adapter = new NodeAdapter(req, undefined);
      expect(adapter.canWriteCookies()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw SessionError with MISSING_RESPONSE code', () => {
      const req = createMockRequest();
      const adapter = new NodeAdapter(req);
      const options: CookieOptions = {
        maxAge: 3600,
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax',
      };

      try {
        adapter.writeCookie('session', 'value', options);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.MISSING_RESPONSE);
      }
    });
  });
});
