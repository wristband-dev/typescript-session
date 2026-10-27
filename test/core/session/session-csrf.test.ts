import { NormalizedSessionOptions } from '../../../src/types';
import { SessionImpl } from '../../../src/core/session';
import { MockAdapter, TestSessionData } from '../../test-utils';

describe('SessionImpl - CSRF Protection', () => {
  let adapter: MockAdapter;
  const baseOptions: NormalizedSessionOptions = {
    secrets: 'a'.repeat(32),
    cookieName: 'session',
    maxAge: 3600,
    path: '/',
    secure: true,
    sameSite: 'Lax',
    csrfCookieName: 'CSRF-TOKEN',
    enableCsrfProtection: false,
  };

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('CSRF disabled (default)', () => {
    it('should not auto-generate CSRF token on save', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      await session.save();
      expect(session.get('csrfToken')).toBeUndefined();
    });

    it('should not write CSRF cookie on save', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      await session.save();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
    });

    it('should not delete CSRF cookie on destroy', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      session.destroy();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
    });

    it('should allow manually setting CSRF token', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      session.set('csrfToken', 'manual-csrf-token');
      await session.save();
      expect(session.get('csrfToken')).toBe('manual-csrf-token');
      // No separate CSRF cookie should be written despite manual token setting
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
    });

    it('should persist manually set CSRF token in session', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      session.set('csrfToken', 'manual-token');
      await session.save();
      const encryptedCookie = adapter.writeCookie.mock.calls[0][1];
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedCookie,
        adapter as any,
        baseOptions
      );
      // Manual CSRF token should be preserved in session data
      expect(restoredSession.get('csrfToken')).toBe('manual-token');
    });

    it('should not include CSRF cookie in saveToResponse', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      const response = new Response('Hello');
      const newResponse = await session.saveToResponse(response);
      const setCookieHeader = newResponse.headers.get('set-cookie')!;
      expect(setCookieHeader).toContain('session=');
      expect(setCookieHeader).not.toContain('CSRF-TOKEN');
    });

    it('should not include CSRF cookie in destroyToResponse', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      const response = new Response('Goodbye');
      const newResponse = session.destroyToResponse(response);
      const setCookieHeader = newResponse.headers.get('set-cookie')!;
      expect(setCookieHeader).toContain('session=');
      expect(setCookieHeader).not.toContain('CSRF-TOKEN');
    });

    it('should not include CSRF cookie in getCookieDataForSave', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.set('userId', '123');
      const cookieData = await session.getCookieDataForSave();
      expect(cookieData.length).toBe(1);
      expect(cookieData[0].name).toBe('session');
    });

    it('should not include CSRF cookie in getCookieDataForDestroy', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      const cookieData = session.getCookieDataForDestroy();
      expect(cookieData.length).toBe(1);
      expect(cookieData[0].name).toBe('session');
    });

    it('should not write CSRF cookie on flushSync in deferred mode', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, baseOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      session.flushSync();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
    });
  });

  describe('CSRF enabled', () => {
    const optionsWithCsrf: NormalizedSessionOptions = { ...baseOptions, enableCsrfProtection: true };

    describe('save() - Node.js', () => {
      it('should auto-generate CSRF token on save', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        expect(session.get('csrfToken')).toBeUndefined();
        await session.save();
        expect(session.get('csrfToken')).toBeDefined();
        expect(typeof session.get('csrfToken')).toBe('string');
        expect(session.get('csrfToken')!.length).toBeGreaterThan(0);
      });

      it('should generate unique CSRF tokens', async () => {
        const session1 = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session1.set('userId', '123');
        await session1.save();
        const session2 = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session2.set('userId', '456');
        await session2.save();
        expect(session1.get('csrfToken')).not.toBe(session2.get('csrfToken'));
      });

      it('should write both session and CSRF cookies', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        await session.save();
        expect(adapter.writeCookie).toHaveBeenCalledTimes(2);

        // Session cookie
        expect(adapter.writeCookie).toHaveBeenCalledWith(
          'session',
          expect.any(String),
          expect.objectContaining({ httpOnly: true })
        );

        // CSRF cookie
        expect(adapter.writeCookie).toHaveBeenCalledWith(
          'CSRF-TOKEN',
          expect.any(String),
          expect.objectContaining({ httpOnly: false, sameSite: 'Lax' })
        );
      });

      it('should use custom CSRF cookie name', async () => {
        const customOptions: NormalizedSessionOptions = { ...optionsWithCsrf, csrfCookieName: 'X-TOKEN' };
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, customOptions);
        session.set('userId', '123');
        await session.save();
        expect(adapter.writeCookie).toHaveBeenCalledWith('X-TOKEN', expect.any(String), expect.any(Object));
      });

      it('should not overwrite manually set CSRF token', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        session.set('csrfToken', 'my-custom-token');
        await session.save();
        expect(session.get('csrfToken')).toBe('my-custom-token');
      });

      it('should write manually set CSRF token to cookie', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        session.set('csrfToken', 'my-custom-token');
        await session.save();
        expect(adapter.writeCookie).toHaveBeenCalledWith('CSRF-TOKEN', 'my-custom-token', expect.any(Object));
      });

      it('should persist CSRF token across saves', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        await session.save();
        const firstToken = session.get('csrfToken');

        // Save again
        adapter.writeCookie.mockClear();
        session.set('tenantId', 'tenant-456');
        await session.save();

        // Should keep the same token
        expect(session.get('csrfToken')).toBe(firstToken);
      });

      it('should generate CSRF token only once per session', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        await session.save();
        const token1 = session.get('csrfToken');
        await session.save();
        const token2 = session.get('csrfToken');
        await session.save();
        const token3 = session.get('csrfToken');
        // All should be the same token
        expect(token1).toBe(token2);
        expect(token2).toBe(token3);
      });
    });

    describe('destroy() - Node.js', () => {
      it('should delete both session and CSRF cookies', () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        session.destroy();
        expect(adapter.writeCookie).toHaveBeenCalledTimes(2);
        expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.objectContaining({ maxAge: 0 }));
        expect(adapter.writeCookie).toHaveBeenCalledWith('CSRF-TOKEN', '', expect.objectContaining({ maxAge: 0 }));
      });

      it('should delete custom named CSRF cookie', () => {
        const customOptions: NormalizedSessionOptions = { ...optionsWithCsrf, csrfCookieName: 'X-TOKEN' };
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, customOptions);
        session.set('userId', '123');
        session.destroy();
        expect(adapter.writeCookie).toHaveBeenCalledWith('X-TOKEN', '', expect.any(Object));
      });
    });

    describe('saveToResponse() - Edge', () => {
      it('should auto-generate CSRF token', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        expect(session.get('csrfToken')).toBeUndefined();
        const response = new Response('Hello');
        await session.saveToResponse(response);
        expect(session.get('csrfToken')).toBeDefined();
        expect(typeof session.get('csrfToken')).toBe('string');
      });

      it('should include CSRF cookie in response', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        const response = new Response('Hello');
        const newResponse = await session.saveToResponse(response);
        const setCookieHeader = newResponse.headers.get('set-cookie')!;
        expect(setCookieHeader).toContain('CSRF-TOKEN=');
        expect(setCookieHeader).toContain('SameSite=Lax');
      });

      it('should not overwrite manually set CSRF token', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        session.set('csrfToken', 'my-edge-token');
        const response = new Response('Hello');
        await session.saveToResponse(response);
        expect(session.get('csrfToken')).toBe('my-edge-token');
      });
    });

    describe('destroyToResponse() - Edge', () => {
      it('should include CSRF cookie deletion in response', () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        const response = new Response('Goodbye');
        const newResponse = session.destroyToResponse(response);
        const setCookieHeader = newResponse.headers.get('set-cookie')!;
        expect(setCookieHeader).toContain('CSRF-TOKEN=');
        expect(setCookieHeader).toContain('Max-Age=0');
      });
    });

    describe('getCookieDataForSave()', () => {
      it('should auto-generate CSRF token', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        expect(session.get('csrfToken')).toBeUndefined();
        await session.getCookieDataForSave();
        expect(session.get('csrfToken')).toBeDefined();
        expect(typeof session.get('csrfToken')).toBe('string');
      });

      it('should return both session and CSRF cookie data', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        const cookieData = await session.getCookieDataForSave();
        expect(cookieData.length).toBe(2);
        const sessionCookie = cookieData.find((c) => c.name === 'session');
        const csrfCookie = cookieData.find((c) => c.name === 'CSRF-TOKEN');
        expect(sessionCookie).toBeDefined();
        expect(csrfCookie).toBeDefined();
        expect(sessionCookie!.options.httpOnly).toBe(true);
        expect(csrfCookie!.options.httpOnly).toBe(false);
      });

      it('should not overwrite manually set CSRF token', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        session.set('csrfToken', 'my-manual-token');
        await session.getCookieDataForSave();
        expect(session.get('csrfToken')).toBe('my-manual-token');
      });
    });

    describe('getCookieDataForDestroy()', () => {
      it('should return both session and CSRF deletion data', () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.set('userId', '123');
        const cookieData = session.getCookieDataForDestroy();
        expect(cookieData.length).toBe(2);
        const sessionCookie = cookieData.find((c) => c.name === 'session');
        const csrfCookie = cookieData.find((c) => c.name === 'CSRF-TOKEN');
        expect(sessionCookie).toBeDefined();
        expect(csrfCookie).toBeDefined();
        expect(sessionCookie!.value).toBe('');
        expect(csrfCookie!.value).toBe('');
        expect(sessionCookie!.options.maxAge).toBe(0);
        expect(csrfCookie!.options.maxAge).toBe(0);
      });
    });

    describe('deferred mode', () => {
      it('should auto-generate CSRF token on save (not flush)', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.enableDeferredMode();
        session.set('userId', '123');
        expect(session.get('csrfToken')).toBeUndefined();

        // Token should be generated during save() call (not deferred)
        await session.save();
        expect(session.get('csrfToken')).toBeDefined();

        // But cookie write is deferred
        expect(adapter.writeCookie).not.toHaveBeenCalled();

        await session.flush();

        // Now cookies are written
        expect(adapter.writeCookie).toHaveBeenCalled();
      });

      it('should write both cookies on flush', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.enableDeferredMode();
        session.set('userId', '123');
        await session.save();
        await session.flush();
        expect(adapter.writeCookie).toHaveBeenCalledTimes(2);
        expect(adapter.writeCookie).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
        expect(adapter.writeCookie).toHaveBeenCalledWith('CSRF-TOKEN', expect.any(String), expect.any(Object));
      });

      it('should delete both cookies on flush after destroy', async () => {
        const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
        session.enableDeferredMode();
        session.set('userId', '123');
        session.destroy();
        await session.flush();
        expect(adapter.writeCookie).toHaveBeenCalledTimes(2);
        expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
        expect(adapter.writeCookie).toHaveBeenCalledWith('CSRF-TOKEN', '', expect.any(Object));
      });
    });
  });

  describe('CSRF token properties', () => {
    const optionsWithCsrf: NormalizedSessionOptions = { ...baseOptions, enableCsrfProtection: true };

    it('should generate tokens with sufficient length', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const token = session.get('csrfToken')!;
      expect(token.length).toBeGreaterThanOrEqual(32);
    });

    it('should generate alphanumeric tokens', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const token = session.get('csrfToken')!;
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // Should be base64-url safe characters
    });

    it('should persist token across session restore', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const token = session.get('csrfToken')!;
      const encryptedCookie = adapter.writeCookie.mock.calls[0][1];
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedCookie,
        adapter as any,
        optionsWithCsrf
      );
      expect(restoredSession.get('csrfToken')).toBe(token);
    });

    it('should allow reading token from session data', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const token = session.get('csrfToken')!;
      const sessionData = session.toJSON();
      expect(sessionData.csrfToken).toBe(token);
    });
  });

  describe('CSRF cookie attributes', () => {
    const optionsWithCsrf: NormalizedSessionOptions = { ...baseOptions, enableCsrfProtection: true };

    it('should set httpOnly to false for CSRF cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const csrfCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'CSRF-TOKEN');
      expect(csrfCall).toBeDefined();
      expect(csrfCall![2].httpOnly).toBe(false);
    });

    it('should use same sameSite as session cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const sessionCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'session');
      const csrfCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'CSRF-TOKEN');
      expect(sessionCall![2].sameSite).toBe(csrfCall![2].sameSite);
    });

    it('should use same secure setting as session cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const sessionCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'session');
      const csrfCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'CSRF-TOKEN');
      expect(sessionCall![2].secure).toBe(csrfCall![2].secure);
    });

    it('should use same path as session cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, optionsWithCsrf);
      session.set('userId', '123');
      await session.save();
      const sessionCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'session');
      const csrfCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'CSRF-TOKEN');
      expect(sessionCall![2].path).toBe(csrfCall![2].path);
    });

    it('should use custom CSRF domain when specified', async () => {
      const customOptions: NormalizedSessionOptions = {
        ...optionsWithCsrf,
        domain: 'example.com',
        csrfCookieDomain: 'custom.example.com',
      };
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, customOptions);
      session.set('userId', '123');
      await session.save();
      const csrfCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'CSRF-TOKEN');
      expect(csrfCall![2].domain).toBe('custom.example.com');
    });

    it('should use session domain for CSRF when CSRF domain not specified', async () => {
      const customOptions: NormalizedSessionOptions = {
        ...optionsWithCsrf,
        domain: 'example.com',
        csrfCookieDomain: 'example.com', // This should be set by normalizeOptions()
      };
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, customOptions);
      session.set('userId', '123');
      await session.save();
      const sessionCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'session');
      const csrfCall = adapter.writeCookie.mock.calls.find((call) => call[0] === 'CSRF-TOKEN');
      expect(sessionCall![2].domain).toBe('example.com');
      expect(csrfCall![2].domain).toBe('example.com');
    });
  });
});
