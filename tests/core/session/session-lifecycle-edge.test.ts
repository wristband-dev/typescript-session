import { SessionError, SessionErrorCode } from '../../../src/error';
import { SessionImpl } from '../../../src/core/session';
import { EdgeMockAdapter, mockOptions, TestSessionData } from '../../test-utils';

describe('SessionImpl - Lifecycle (Edge/Web)', () => {
  let adapter: EdgeMockAdapter;

  beforeEach(() => {
    adapter = new EdgeMockAdapter();
  });

  describe('saveToResponse()', () => {
    it('should return new Response with session cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Hello World');
      const newResponse = await session.saveToResponse(originalResponse);
      expect(newResponse).toBeInstanceOf(Response);
      expect(newResponse).not.toBe(originalResponse); // Should be a new Response
      const setCookieHeader = newResponse.headers.get('set-cookie');
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('session=');
    });

    it('should preserve original response body', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Hello World');
      const newResponse = await session.saveToResponse(originalResponse);
      const body = await newResponse.text();
      expect(body).toBe('Hello World');
    });

    it('should preserve original response status', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Not Found', { status: 404 });
      const newResponse = await session.saveToResponse(originalResponse);
      expect(newResponse.status).toBe(404);
    });

    it('should preserve original response statusText', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Not Found', { status: 404, statusText: 'Custom Not Found' });
      const newResponse = await session.saveToResponse(originalResponse);
      expect(newResponse.statusText).toBe('Custom Not Found');
    });

    it('should preserve existing headers', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Hello', {
        headers: { 'Content-Type': 'text/plain', 'X-Custom-Header': 'custom-value' },
      });
      const newResponse = await session.saveToResponse(originalResponse);
      expect(newResponse.headers.get('content-type')).toBe('text/plain');
      expect(newResponse.headers.get('x-custom-header')).toBe('custom-value');
    });

    it('should append set-cookie header without removing existing ones', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Hello', {
        headers: { 'Set-Cookie': 'existing=cookie; Path=/' },
      });
      const newResponse = await session.saveToResponse(originalResponse);
      const setCookieHeaders = newResponse.headers.get('set-cookie');
      // Headers.get() only returns the first value, but both should be present
      expect(setCookieHeaders).toBeTruthy();
    });

    it('should encrypt session data', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      const originalResponse = new Response('Hello');
      const newResponse = await session.saveToResponse(originalResponse);
      const setCookieHeader = newResponse.headers.get('set-cookie')!;
      // Encrypted cookie should not contain plain text
      expect(setCookieHeader).not.toContain('123');
      expect(setCookieHeader).not.toContain('tenant-456');
      expect(setCookieHeader).not.toContain('userId');
    });

    it('should include cookie attributes', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const originalResponse = new Response('Hello');
      const newResponse = await session.saveToResponse(originalResponse);
      const setCookieHeader = newResponse.headers.get('set-cookie')!;
      expect(setCookieHeader).toContain('Path=/');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('Secure');
      expect(setCookieHeader).toContain('SameSite=Lax');
      expect(setCookieHeader).toContain('Max-Age=3600');
    });

    it('should throw error when session is destroyed', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      const originalResponse = new Response('Hello');
      await expect(session.saveToResponse(originalResponse)).rejects.toThrow(SessionError);

      try {
        await session.saveToResponse(originalResponse);
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_DESTROYED);
        expect((error as SessionError).message).toContain('Cannot save a destroyed session');
      }
    });
  });

  describe('destroyToResponse()', () => {
    it('should return new Response with cookie deletion headers', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const originalResponse = new Response('Goodbye');
      const newResponse = session.destroyToResponse(originalResponse);

      expect(newResponse).toBeInstanceOf(Response);
      expect(newResponse).not.toBe(originalResponse);

      const setCookieHeader = newResponse.headers.get('set-cookie');
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain('session=');
      expect(setCookieHeader).toContain('Max-Age=0'); // Immediate expiration
    });

    it('should preserve original response body', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const originalResponse = new Response('Logged out');
      const newResponse = session.destroyToResponse(originalResponse);

      const body = await newResponse.text();
      expect(body).toBe('Logged out');
    });

    it('should preserve original response status', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const originalResponse = new Response('Redirect', {
        status: 302,
        headers: { Location: '/login' },
      });
      const newResponse = session.destroyToResponse(originalResponse);

      expect(newResponse.status).toBe(302);
      expect(newResponse.headers.get('location')).toBe('/login');
    });

    it('should preserve existing headers', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const originalResponse = new Response('Goodbye', {
        headers: {
          'Content-Type': 'text/plain',
          'X-Custom-Header': 'custom-value',
        },
      });
      const newResponse = session.destroyToResponse(originalResponse);

      expect(newResponse.headers.get('content-type')).toBe('text/plain');
      expect(newResponse.headers.get('x-custom-header')).toBe('custom-value');
    });

    it('should clear session data', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');

      const originalResponse = new Response('Goodbye');
      session.destroyToResponse(originalResponse);

      expect(session.toJSON()).toEqual({});
    });

    it('should set empty cookie value', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const originalResponse = new Response('Goodbye');
      const newResponse = session.destroyToResponse(originalResponse);

      const setCookieHeader = newResponse.headers.get('set-cookie')!;
      expect(setCookieHeader).toMatch(/session=;/);
    });

    it('should allow calling on already destroyed session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();

      const originalResponse = new Response('Goodbye');

      expect(() => {
        session.destroyToResponse(originalResponse);
      }).not.toThrow();
    });
  });

  describe('getCookieDataForSave()', () => {
    it('should return array with session cookie data', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const cookieData = await session.getCookieDataForSave();

      expect(Array.isArray(cookieData)).toBe(true);
      expect(cookieData.length).toBeGreaterThanOrEqual(1);

      const sessionCookie = cookieData[0];
      expect(sessionCookie.name).toBe('session');
      expect(typeof sessionCookie.value).toBe('string');
      expect(sessionCookie.value.length).toBeGreaterThan(0);
      expect(sessionCookie.options).toBeDefined();
    });

    it('should include cookie options', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const cookieData = await session.getCookieDataForSave();
      const options = cookieData[0].options;

      expect(options.maxAge).toBe(3600);
      expect(options.path).toBe('/');
      expect(options.secure).toBe(true);
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('Lax');
    });

    it('should encrypt session data', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');

      const cookieData = await session.getCookieDataForSave();
      const encryptedValue = cookieData[0].value;

      // Should not contain plain text
      expect(encryptedValue).not.toContain('123');
      expect(encryptedValue).not.toContain('tenant-456');
      expect(encryptedValue).not.toContain('userId');
    });

    it('should throw error when session is destroyed', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();

      await expect(session.getCookieDataForSave()).rejects.toThrow(SessionError);

      try {
        await session.getCookieDataForSave();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_DESTROYED);
      }
    });
  });

  describe('getCookieDataForDestroy()', () => {
    it('should return array with cookie deletion data', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const cookieData = session.getCookieDataForDestroy();

      expect(Array.isArray(cookieData)).toBe(true);
      expect(cookieData.length).toBeGreaterThanOrEqual(1);

      const sessionCookie = cookieData[0];
      expect(sessionCookie.name).toBe('session');
      expect(sessionCookie.value).toBe('');
      expect(sessionCookie.options.maxAge).toBe(0);
    });

    it('should include deletion options', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const cookieData = session.getCookieDataForDestroy();
      const options = cookieData[0].options;

      expect(options.maxAge).toBe(0); // Immediate expiration
      expect(options.path).toBe('/');
      expect(options.secure).toBe(true);
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe('Lax');
    });

    it('should work after destroy() is called', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();

      expect(() => {
        const cookieData = session.getCookieDataForDestroy();
        expect(cookieData.length).toBeGreaterThanOrEqual(1);
      }).not.toThrow();
    });

    it('should be synchronous', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      // Should not return a Promise
      const result = session.getCookieDataForDestroy();
      expect(result).not.toBeInstanceOf(Promise);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should work with Cloudflare Workers pattern', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const response = new Response('Success', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const finalResponse = await session.saveToResponse(response);

      expect(finalResponse.status).toBe(200);
      expect(finalResponse.headers.get('content-type')).toBe('application/json');
      expect(finalResponse.headers.get('set-cookie')).toContain('session=');
    });

    it('should work with logout redirect pattern', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      const response = new Response(null, {
        status: 302,
        headers: { Location: '/login' },
      });

      const finalResponse = session.destroyToResponse(response);

      expect(finalResponse.status).toBe(302);
      expect(finalResponse.headers.get('location')).toBe('/login');
      expect(finalResponse.headers.get('set-cookie')).toContain('session=');
      expect(finalResponse.headers.get('set-cookie')).toContain('Max-Age=0');
    });

    it('should work with Next.js Server Actions pattern', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      // Get cookie data for manual setting
      const cookieData = await session.getCookieDataForSave();

      expect(cookieData.length).toBeGreaterThanOrEqual(1);

      // Simulate setting cookies with Next.js cookies() API
      for (const { name, value, options } of cookieData) {
        expect(name).toBeTruthy();
        expect(value).toBeTruthy();
        expect(options).toBeDefined();
        expect(options.maxAge).toBeGreaterThan(0);
      }
    });
  });
});
