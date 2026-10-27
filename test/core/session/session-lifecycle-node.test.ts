import { SessionError, SessionErrorCode } from '../../../src/error';
import { SessionCrypto } from '../../../src/core/crypto';
import { SessionImpl } from '../../../src/core/session';
import { MockAdapter, mockOptions, TestSessionData } from '../../test-utils';

describe('SessionImpl - Lifecycle (Node.js)', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('save() - normal mode', () => {
    it('should write session cookie when adapter can write', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await session.save();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
      expect(adapter.writeCookie).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({
          maxAge: 3600,
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Lax',
        })
      );
    });

    it('should encrypt session data before writing', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      await session.save();
      const writtenValue = adapter.writeCookie.mock.calls[0][1];
      // Encrypted value should not contain plain text
      expect(writtenValue).not.toContain('123');
      expect(writtenValue).not.toContain('tenant-456');
      expect(writtenValue).not.toContain('userId');
    });

    it('should throw error when adapter cannot write cookies', async () => {
      adapter.canWriteCookies.mockReturnValue(false);
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await expect(session.save()).rejects.toThrow(SessionError);

      try {
        await session.save();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.MISSING_RESPONSE);
        expect((error as SessionError).message).toContain('no response object available');
      }
    });

    it('should throw error when session is destroyed', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      await expect(session.save()).rejects.toThrow(SessionError);

      try {
        await session.save();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_DESTROYED);
        expect((error as SessionError).message).toContain('Cannot save a destroyed session');
      }
    });

    it('should allow multiple saves with different data', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await session.save();
      session.set('tenantId', 'tenant-456');
      await session.save();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(2);
    });

    it('should write no-cache headers once, after writing the session cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await session.save();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
      expect(adapter.writeNoCacheHeaders.mock.invocationCallOrder[0]).toBeGreaterThan(
        adapter.writeCookie.mock.invocationCallOrder[0]
      );
    });

    it('should write no-cache headers once when CSRF protection adds a second cookie', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, {
        ...mockOptions,
        enableCsrfProtection: true,
      });
      session.set('userId', '123');
      await session.save();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(2);
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
    });

    it('should not write no-cache headers when adapter cannot write cookies', async () => {
      adapter.canWriteCookies.mockReturnValue(false);
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await expect(session.save()).rejects.toThrow(SessionError);
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
    });

    it('should throw SESSION_SAVE_FAILED and write nothing when encryption fails', async () => {
      const encryptSpy = jest.spyOn(SessionCrypto, 'encrypt').mockRejectedValue(new Error('Encryption failed'));
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      try {
        await session.save();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_SAVE_FAILED);
        expect((error as SessionError).message).toBe('Failed to save session');
      } finally {
        encryptSpy.mockRestore();
      }

      expect(adapter.writeCookie).not.toHaveBeenCalled();
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
    });
  });

  describe('destroy() - normal mode', () => {
    it('should clear session data', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      session.destroy();
      expect(session.get('userId')).toBeUndefined();
      expect(session.get('tenantId')).toBeUndefined();
      expect(session.toJSON()).toEqual({});
    });

    it('should write empty cookie to delete session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.objectContaining({ maxAge: 0 }));
    });

    it('should not write cookies if adapter cannot write', () => {
      adapter.canWriteCookies.mockReturnValue(false);
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should allow multiple destroy calls', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      session.destroy();
      session.destroy();
      expect(session.toJSON()).toEqual({});
    });

    it('should write no-cache headers once, after deleting the session cookie', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
      expect(adapter.writeNoCacheHeaders.mock.invocationCallOrder[0]).toBeGreaterThan(
        adapter.writeCookie.mock.invocationCallOrder[0]
      );
    });

    it('should not write no-cache headers if adapter cannot write', () => {
      adapter.canWriteCookies.mockReturnValue(false);
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
    });
  });

  describe('enableDeferredMode()', () => {
    it('should allow calling multiple times', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(() => {
        session.enableDeferredMode();
        session.enableDeferredMode();
        session.enableDeferredMode();
      }).not.toThrow();
    });
  });

  describe('save() - deferred mode', () => {
    it('should not write cookies immediately', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      // Should NOT have written cookies yet
      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should mark session for saving', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      // Verify by calling flush - should write cookies now
      await session.flush();
      expect(adapter.writeCookie).toHaveBeenCalled();
    });

    it('should allow multiple save calls before flush', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      session.set('tenantId', 'tenant-456');
      await session.save();
      session.set('userId', '789');
      await session.save();
      // Should not have written anything yet
      expect(adapter.writeCookie).not.toHaveBeenCalled();
      // Flush should write only once with latest data
      await session.flush();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
    });

    it('should not write no-cache headers until flush', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
      await session.flush();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy() - deferred mode', () => {
    it('should not delete cookies immediately', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();
      // Should NOT have deleted cookies yet
      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should clear data immediately even in deferred mode', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();
      expect(session.toJSON()).toEqual({});
    });

    it('should delete cookies on flush', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();
      await session.flush();
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
    });

    it('should prioritize destroy over save', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save(); // Mark for save
      session.destroy(); // Should cancel save
      await session.flush();
      // Should only delete, not save
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
    });
  });

  describe('flush() - async', () => {
    it('should throw error when deferred mode not enabled', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await expect(session.flush()).rejects.toThrow(SessionError);

      try {
        await session.flush();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.DEFERRED_MODE_NOT_ENABLED);
        expect((error as SessionError).message).toContain('deferred mode is not enabled');
      }
    });

    it('should write cookies when save was called', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      await session.flush();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
    });

    it('should delete cookies when destroy was called', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();
      await session.flush();
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
    });

    it('should do nothing if no operations were pending', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      await session.flush();
      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should reset flags after flush', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      await session.flush();
      // Second flush should do nothing (flags reset)
      adapter.writeCookie.mockClear();
      await session.flush();
      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should throw error if adapter cannot write cookies', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save(); // Mark for save while adapter can write
      // Now make adapter unable to write
      adapter.canWriteCookies.mockReturnValue(false);
      await expect(session.flush()).rejects.toThrow(SessionError);

      try {
        await session.flush();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.MISSING_RESPONSE);
      }
    });

    it('should allow multiple flush calls', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      await session.flush();
      await session.flush();
      await session.flush();

      // Only first flush should write
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
    });

    it('should write no-cache headers once when flushing a save', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      await session.flush();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
    });

    it('should write no-cache headers once when flushing a destroy', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();
      await session.flush();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
    });

    it('should not write no-cache headers if no operations were pending', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      await session.flush();
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
    });
  });

  describe('flushSync()', () => {
    it('should throw error when deferred mode not enabled', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      expect(() => session.flushSync()).toThrow(SessionError);

      try {
        session.flushSync();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.DEFERRED_MODE_NOT_ENABLED);
        expect((error as SessionError).message).toContain('deferred mode is not enabled');
      }
    });

    it('should write cookies synchronously when save was called', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      session.flushSync();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
    });

    it('should delete cookies synchronously when destroy was called', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();

      session.flushSync();

      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
    });

    it('should do nothing if no operations were pending', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();

      session.flushSync();

      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should reset flags after flush', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.save();

      session.flushSync();

      // Second flush should do nothing (flags reset)
      adapter.writeCookie.mockClear();
      session.flushSync();
      expect(adapter.writeCookie).not.toHaveBeenCalled();
    });

    it('should throw error if adapter cannot write cookies', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      // Now make adapter unable to write
      adapter.canWriteCookies.mockReturnValue(false);
      expect(() => session.flushSync()).toThrow(SessionError);

      try {
        session.flushSync();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.MISSING_RESPONSE);
      }
    });

    it('should write no-cache headers once when flushing a save', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      session.flushSync();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
      expect(adapter.writeNoCacheHeaders.mock.invocationCallOrder[0]).toBeGreaterThan(
        adapter.writeCookie.mock.invocationCallOrder[0]
      );
    });

    it('should write no-cache headers once when flushing a destroy', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      session.destroy();
      session.flushSync();
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
    });

    it('should not write no-cache headers if no operations were pending', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.flushSync();
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
    });

    it('should write the CSRF cookie and no-cache headers once when CSRF protection is enabled', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, {
        ...mockOptions,
        enableCsrfProtection: true,
      });
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      session.flushSync();

      expect(adapter.writeCookie).toHaveBeenCalledTimes(2);
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
      expect(adapter.writeCookie).toHaveBeenCalledWith('CSRF-TOKEN', expect.any(String), expect.any(Object));
      expect(adapter.writeNoCacheHeaders).toHaveBeenCalledTimes(1);
      expect(adapter.writeNoCacheHeaders.mock.invocationCallOrder[0]).toBeGreaterThan(
        adapter.writeCookie.mock.invocationCallOrder[1]
      );
    });

    it('should throw SESSION_SAVE_FAILED and write nothing when encryption fails', async () => {
      const encryptSyncSpy = jest.spyOn(SessionCrypto, 'encryptSync').mockImplementation(() => {
        throw new Error('Encryption failed');
      });
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();

      try {
        session.flushSync();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_SAVE_FAILED);
        expect((error as SessionError).message).toBe('Failed to save session');
      } finally {
        encryptSyncSpy.mockRestore();
      }

      expect(adapter.writeCookie).not.toHaveBeenCalled();
      expect(adapter.writeNoCacheHeaders).not.toHaveBeenCalled();
    });
  });

  describe('deferred mode integration', () => {
    it('should handle typical Express middleware pattern', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();

      // Middleware touches session for rolling expiration
      await session.save();

      // Route handler updates data
      session.set('customField', 'foo');
      await session.save();

      // Another middleware updates again
      session.set('customField', 'bar');
      await session.save();

      // Should not have written anything yet
      expect(adapter.writeCookie).not.toHaveBeenCalled();

      // Final flush writes once with latest data
      await session.flush();
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
    });

    it('should handle save followed by destroy', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.enableDeferredMode();
      session.set('userId', '123');
      await session.save();
      session.destroy();
      await session.flush();
      // Should only delete, not save
      expect(adapter.writeCookie).toHaveBeenCalledWith('session', '', expect.any(Object));
      expect(adapter.writeCookie).toHaveBeenCalledTimes(1);
    });
  });
});
