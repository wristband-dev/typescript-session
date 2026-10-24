import { NormalizedSessionOptions } from '../../../src/types';
import { SessionImpl } from '../../../src/core/session';
import { SessionCrypto } from '../../../src/core/crypto';
import { MockAdapter, mockOptions, TestSessionData } from '../../test-utils';

describe('SessionImpl - Factory Methods', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('createNew()', () => {
    it('should create empty session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(session).toBeInstanceOf(SessionImpl);
      expect(session.toJSON()).toEqual({});
    });

    it('should create session with correct adapter', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.destroy();
      expect(adapter.writeCookie).toHaveBeenCalled();
    });

    it('should create session with correct options', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      await session.save();

      // Verify options are used (check cookie name and attributes)
      expect(adapter.writeCookie).toHaveBeenCalledWith(
        'session',
        expect.any(String),
        expect.objectContaining({
          maxAge: 3600,
          path: '/',
          secure: true,
          sameSite: 'Lax',
        })
      );
    });

    it('should create independent session instances', () => {
      const session1 = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const session2 = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session1.set('userId', '123');
      session2.set('userId', '456');
      expect(session1.get('userId')).toBe('123');
      expect(session2.get('userId')).toBe('456');
    });
  });

  describe('fromCookie() - async', () => {
    it('should decrypt valid cookie and restore session', async () => {
      // First create and save a session
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      originalSession.set('userId', '123');
      originalSession.set('tenantId', 'tenant-456');
      await originalSession.save();

      // Get the encrypted cookie value
      const encryptedValue = adapter.writeCookie.mock.calls[0][1];

      // Create new session from cookie
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedValue,
        adapter as any,
        mockOptions
      );

      expect(restoredSession.get('userId')).toBe('123');
      expect(restoredSession.get('tenantId')).toBe('tenant-456');
    });

    it('should return empty session for invalid cookie', async () => {
      const session = await SessionImpl.fromCookie<TestSessionData>(
        'invalid-encrypted-data',
        adapter as any,
        mockOptions
      );
      expect(session.toJSON()).toEqual({});
    });

    it('should return empty session for corrupted cookie', async () => {
      const session = await SessionImpl.fromCookie<TestSessionData>('corrupted!@#$%^&*()', adapter as any, mockOptions);
      expect(session.toJSON()).toEqual({});
    });

    it('should return empty session for empty cookie', async () => {
      const session = await SessionImpl.fromCookie<TestSessionData>('', adapter as any, mockOptions);
      expect(session.toJSON()).toEqual({});
    });

    it('should handle multiple secrets (key rotation)', async () => {
      const oldSecret = 'b'.repeat(32);
      const newSecret = 'c'.repeat(32);

      // Create session with old secret
      const oldOptions: NormalizedSessionOptions = { ...mockOptions, secrets: oldSecret };
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, oldOptions);
      originalSession.set('userId', '123');
      await originalSession.save();
      const encryptedValue = adapter.writeCookie.mock.calls[0][1];

      // Try to decrypt with new secret first, old secret second
      const newOptions: NormalizedSessionOptions = { ...mockOptions, secrets: [newSecret, oldSecret] };
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(encryptedValue, adapter as any, newOptions);

      // Should successfully decrypt with old secret
      expect(restoredSession.get('userId')).toBe('123');
    });

    it('should try all secrets in order', async () => {
      const secret1 = 'a'.repeat(32);
      const secret2 = 'b'.repeat(32);
      const secret3 = 'c'.repeat(32);

      // Encrypt with secret3
      const options: NormalizedSessionOptions = { ...mockOptions, secrets: secret3 };
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, options);
      originalSession.set('userId', '123');
      await originalSession.save();
      const encryptedValue = adapter.writeCookie.mock.calls[0][1];

      // Try to decrypt with all three secrets
      const multiSecretOptions: NormalizedSessionOptions = { ...mockOptions, secrets: [secret1, secret2, secret3] };
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedValue,
        adapter as any,
        multiSecretOptions
      );

      // Should find and decrypt with secret3
      expect(restoredSession.get('userId')).toBe('123');
    });

    it('should handle complex nested data', async () => {
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      originalSession.set('userId', '123');
      originalSession.set('tenantId', 'tenant-456');
      originalSession.set('counter', 42);
      await originalSession.save();
      const encryptedValue = adapter.writeCookie.mock.calls[0][1];
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedValue,
        adapter as any,
        mockOptions
      );
      expect(restoredSession.get('userId')).toBe('123');
      expect(restoredSession.get('tenantId')).toBe('tenant-456');
      expect(restoredSession.get('counter')).toBe(42);
    });

    it('should return empty session for expired cookie', async () => {
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      originalSession.set('userId', '123');
      await originalSession.save();
      const encryptedValue = adapter.writeCookie.mock.calls[0][1];
      const expiredOptions: NormalizedSessionOptions = { ...mockOptions, maxAge: 0 };

      // Wait a tiny bit to ensure TTL validation fails
      await new Promise((resolve) => setTimeout(resolve, 10));
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedValue,
        adapter as any,
        expiredOptions
      );

      // Should return empty session due to expiration
      expect(restoredSession.toJSON()).toEqual({});
    });

    it('should preserve all session data types', async () => {
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      originalSession.set('isAuthenticated', true);
      originalSession.set('accessToken', 'token-abc');
      originalSession.set('expiresAt', 1234567890);
      originalSession.set('userId', 'user-123');
      originalSession.set('tenantId', 'tenant-456');
      await originalSession.save();
      const encryptedValue = adapter.writeCookie.mock.calls[0][1];
      const restoredSession = await SessionImpl.fromCookie<TestSessionData>(
        encryptedValue,
        adapter as any,
        mockOptions
      );
      expect(restoredSession.get('isAuthenticated')).toBe(true);
      expect(restoredSession.get('accessToken')).toBe('token-abc');
      expect(restoredSession.get('expiresAt')).toBe(1234567890);
      expect(restoredSession.get('userId')).toBe('user-123');
      expect(restoredSession.get('tenantId')).toBe('tenant-456');
    });
  });

  describe('fromCookieSync()', () => {
    it('should decrypt valid cookie synchronously', () => {
      const originalSession = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      originalSession.set('userId', '123');
      originalSession.set('tenantId', 'tenant-456');
      const data = { userId: '123', tenantId: 'tenant-456' };
      const encryptedValue = SessionCrypto.encryptSync(data, mockOptions.secrets as string);

      // Create new session from cookie synchronously
      const restoredSession = SessionImpl.fromCookieSync<TestSessionData>(encryptedValue, adapter as any, mockOptions);
      expect(restoredSession.get('userId')).toBe('123');
      expect(restoredSession.get('tenantId')).toBe('tenant-456');
    });

    it('should return empty session for invalid cookie', () => {
      const session = SessionImpl.fromCookieSync<TestSessionData>(
        'invalid-encrypted-data',
        adapter as any,
        mockOptions
      );
      expect(session.toJSON()).toEqual({});
    });

    it('should return empty session for corrupted cookie', () => {
      const session = SessionImpl.fromCookieSync<TestSessionData>('corrupted!@#$%^&*()', adapter as any, mockOptions);
      expect(session.toJSON()).toEqual({});
    });

    it('should return empty session for empty cookie', () => {
      const session = SessionImpl.fromCookieSync<TestSessionData>('', adapter as any, mockOptions);
      expect(session.toJSON()).toEqual({});
    });

    it('should handle multiple secrets (key rotation)', () => {
      const oldSecret = 'b'.repeat(32);
      const newSecret = 'c'.repeat(32);

      // Encrypt with old secret
      const data = { userId: '123' };
      const encryptedValue = SessionCrypto.encryptSync(data, oldSecret);

      // Try to decrypt with new secret first, old secret second
      const newOptions: NormalizedSessionOptions = { ...mockOptions, secrets: [newSecret, oldSecret] };
      const restoredSession = SessionImpl.fromCookieSync<TestSessionData>(encryptedValue, adapter as any, newOptions);

      // Should successfully decrypt with old secret
      expect(restoredSession.get('userId')).toBe('123');
    });

    it('should be synchronous (not return a Promise)', () => {
      const data = { userId: '123' };
      const encryptedValue = SessionCrypto.encryptSync(data, mockOptions.secrets as string);
      const result = SessionImpl.fromCookieSync<TestSessionData>(encryptedValue, adapter as any, mockOptions);
      expect(result).not.toBeInstanceOf(Promise);
      expect(result).toBeInstanceOf(SessionImpl);
    });

    it('should handle complex nested data', () => {
      const data = {
        userId: '123',
        tenantId: 'tenant-456',
        counter: 42,
        isAuthenticated: true,
      };
      const encryptedValue = SessionCrypto.encryptSync(data, mockOptions.secrets as string);
      const restoredSession = SessionImpl.fromCookieSync<TestSessionData>(encryptedValue, adapter as any, mockOptions);
      expect(restoredSession.get('userId')).toBe('123');
      expect(restoredSession.get('tenantId')).toBe('tenant-456');
      expect(restoredSession.get('counter')).toBe(42);
    });

    it('should return empty session for expired cookie', () => {
      const data = { userId: '123' };
      const encryptedValue = SessionCrypto.encryptSync(data, mockOptions.secrets as string);
      const expiredOptions: NormalizedSessionOptions = { ...mockOptions, maxAge: 0 };

      // Wait a tiny bit to ensure TTL validation fails
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait
      }

      const restoredSession = SessionImpl.fromCookieSync<TestSessionData>(
        encryptedValue,
        adapter as any,
        expiredOptions
      );

      // Should return empty session due to expiration
      expect(restoredSession.toJSON()).toEqual({});
    });
  });

  describe('factory method comparison', () => {
    it('should produce equivalent results for async and sync', async () => {
      const data = { userId: '123', tenantId: 'tenant-456' };
      const encryptedValue = SessionCrypto.encryptSync(data, mockOptions.secrets as string);
      const asyncSession = await SessionImpl.fromCookie<TestSessionData>(encryptedValue, adapter as any, mockOptions);
      const syncSession = SessionImpl.fromCookieSync<TestSessionData>(encryptedValue, adapter as any, mockOptions);
      expect(asyncSession.toJSON()).toEqual(syncSession.toJSON());
      expect(asyncSession.get('userId')).toBe(syncSession.get('userId'));
      expect(asyncSession.get('tenantId')).toBe(syncSession.get('tenantId'));
    });

    it('should handle errors consistently', async () => {
      const invalidCookie = 'invalid-data';
      const asyncSession = await SessionImpl.fromCookie<TestSessionData>(invalidCookie, adapter as any, mockOptions);
      const syncSession = SessionImpl.fromCookieSync<TestSessionData>(invalidCookie, adapter as any, mockOptions);
      expect(asyncSession.toJSON()).toEqual({});
      expect(syncSession.toJSON()).toEqual({});
    });
  });

  describe('integration scenarios', () => {
    it('should handle full session lifecycle', async () => {
      // Step 1: Create new session
      const session1 = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session1.set('userId', '123');
      session1.set('tenantId', 'tenant-456');
      await session1.save();

      // Step 2: Get encrypted cookie
      const encryptedCookie = adapter.writeCookie.mock.calls[0][1];

      // Step 3: Restore session from cookie (simulating new request)
      const session2 = await SessionImpl.fromCookie<TestSessionData>(encryptedCookie, adapter as any, mockOptions);

      // Step 4: Verify data is intact
      expect(session2.get('userId')).toBe('123');
      expect(session2.get('tenantId')).toBe('tenant-456');

      // Step 5: Modify and save again
      session2.set('counter', 42);
      adapter.writeCookie.mockClear();
      await session2.save();

      // Step 6: Restore again
      const encryptedCookie2 = adapter.writeCookie.mock.calls[0][1];
      const session3 = await SessionImpl.fromCookie<TestSessionData>(encryptedCookie2, adapter as any, mockOptions);

      // Step 7: Verify all data is intact
      expect(session3.get('userId')).toBe('123');
      expect(session3.get('tenantId')).toBe('tenant-456');
      expect(session3.get('counter')).toBe(42);
    });

    it('should handle secret rotation scenario', async () => {
      const oldSecret = 'old-secret-32-chars-long-xxxxxxx';
      const newSecret = 'new-secret-32-chars-long-yyyyyyy';

      // Step 1: Create session with old secret
      const oldOptions: NormalizedSessionOptions = { ...mockOptions, secrets: oldSecret };
      const session1 = SessionImpl.createNew<TestSessionData>(adapter as any, oldOptions);
      session1.set('userId', '123');
      await session1.save();
      const oldEncryptedCookie = adapter.writeCookie.mock.calls[0][1];

      // Step 2: Deploy new version with both secrets (rotation)
      // New secret first for new sessions
      const rotationOptions: NormalizedSessionOptions = { ...mockOptions, secrets: [newSecret, oldSecret] };

      // Step 3: Old cookie should still work
      const session2 = await SessionImpl.fromCookie<TestSessionData>(
        oldEncryptedCookie,
        adapter as any,
        rotationOptions
      );
      expect(session2.get('userId')).toBe('123');

      // Step 4: Save with new secret
      adapter.writeCookie.mockClear();
      await session2.save();
      const newEncryptedCookie = adapter.writeCookie.mock.calls[0][1];
      // New cookie should be different (encrypted with new secret)
      expect(newEncryptedCookie).not.toBe(oldEncryptedCookie);

      // Step 5: New cookie works with rotation options
      const session3 = await SessionImpl.fromCookie<TestSessionData>(
        newEncryptedCookie,
        adapter as any,
        rotationOptions
      );
      expect(session3.get('userId')).toBe('123');

      // Step 6: Eventually remove old secret (after all cookies re-encrypted)
      const newOnlyOptions: NormalizedSessionOptions = { ...mockOptions, secrets: newSecret };

      // New cookies still work
      const session4 = await SessionImpl.fromCookie<TestSessionData>(
        newEncryptedCookie,
        adapter as any,
        newOnlyOptions
      );
      expect(session4.get('userId')).toBe('123');

      // Old cookies no longer work (expected)
      const session5 = await SessionImpl.fromCookie<TestSessionData>(
        oldEncryptedCookie,
        adapter as any,
        newOnlyOptions
      );
      expect(session5.toJSON()).toEqual({});
    });

    it('should handle missing cookie scenario', async () => {
      const session = await SessionImpl.fromCookie<TestSessionData>('', adapter as any, mockOptions);
      expect(session.toJSON()).toEqual({});

      // Can still use it as a new session and save it
      session.set('userId', '123');
      expect(session.get('userId')).toBe('123');
      await session.save();
      expect(adapter.writeCookie).toHaveBeenCalled();
    });
  });
});
