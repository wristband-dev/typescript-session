import { SessionCrypto } from '../../../src/core/crypto';
import { SessionCryptoError, SessionCryptoErrorCode } from '../../../src/error';
import { SessionData } from '../../../src/types';

describe('SessionCrypto - Async Methods', () => {
  const validSecret = 'a'.repeat(32);
  const alternateSecret = 'b'.repeat(32);

  describe('encrypt()', () => {
    it('should encrypt empty session data', async () => {
      const encrypted = await SessionCrypto.encrypt({}, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should encrypt session with single property', async () => {
      const encrypted = await SessionCrypto.encrypt({ userId: '123' }, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt session with multiple properties', async () => {
      const sessionData: SessionData = {
        userId: '123',
        tenantId: 'tenant-456',
        accessToken: 'token-abc',
        isAuthenticated: true,
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different outputs for same data (random IV)', async () => {
      const sessionData = { userId: '123' };
      const encrypted1 = await SessionCrypto.encrypt(sessionData, validSecret);
      const encrypted2 = await SessionCrypto.encrypt(sessionData, validSecret);
      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce different outputs for different secrets', async () => {
      const sessionData = { userId: '123' };
      const encrypted1 = await SessionCrypto.encrypt(sessionData, validSecret);
      const encrypted2 = await SessionCrypto.encrypt(sessionData, alternateSecret);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle string values', async () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        tenantName: 'Test User',
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle number values', async () => {
      const sessionData = {
        userId: '123',
        expiresAt: 1234567890,
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle boolean values', async () => {
      const sessionData = {
        isAuthenticated: true,
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle nested objects', async () => {
      const sessionData: any = {
        userId: '123',
        metadata: {
          theme: 'dark',
          language: 'en',
        },
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle arrays', async () => {
      const sessionData: any = {
        userId: '123',
        roles: ['admin', 'editor', 'viewer'],
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle null values', async () => {
      const sessionData: any = {
        userId: '123',
        optionalField: null,
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle special characters in strings', async () => {
      const sessionData = {
        userId: '123',
        tenantName: 'Test with special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./',
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const sessionData = {
        userId: '123',
        tenantName: '日本語 中文 한글 العربية 🎉',
      };
      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should produce base64-encoded output', async () => {
      const encrypted = await SessionCrypto.encrypt({ userId: '123' }, validSecret);
      // Base64 only contains A-Z, a-z, 0-9, +, /, =
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should throw SESSION_TOO_LARGE for very large session data', async () => {
      // Create data that will exceed 4KB when encrypted
      const largeData: any = {
        userId: '123',
        largeField: 'x'.repeat(5000), // 5KB of data
      };

      await expect(SessionCrypto.encrypt(largeData, validSecret)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.encrypt(largeData, validSecret);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.SESSION_TOO_LARGE);
      }
    });

    it('should accept moderately large session data under 4KB', async () => {
      // Create data that's large but under the limit
      const moderateData: any = {
        userId: '123',
        data: 'x'.repeat(2000), // ~2KB
      };
      const encrypted = await SessionCrypto.encrypt(moderateData, validSecret);
      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeLessThan(4096);
    });

    it('should throw ENCRYPTION_FAILED for non-JSON-serializable data (BigInt)', async () => {
      const dataWithBigInt: any = {
        userId: '123',
        bigNumber: BigInt(12345), // BigInt is not JSON-serializable
      };

      await expect(SessionCrypto.encrypt(dataWithBigInt, validSecret)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.encrypt(dataWithBigInt, validSecret);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
        expect((error as SessionCryptoError).message).toContain('JSON-serializable');
      }
    });
  });

  describe('decrypt()', () => {
    it('should decrypt valid encrypted session', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should decrypt session with multiple properties', async () => {
      const original: SessionData = {
        userId: '123',
        tenantId: 'tenant-456',
        accessToken: 'token-abc',
        isAuthenticated: true,
      };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should throw AUTH_FAILED for wrong secret', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);

      await expect(SessionCrypto.decrypt(encrypted, alternateSecret, 3600)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.decrypt(encrypted, alternateSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });

    it('should throw AUTH_FAILED for tampered data', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);

      // Tamper with the end of the data (likely the auth tag or encrypted payload)
      const tampered = encrypted.slice(0, -5) + 'XXXXX';

      await expect(SessionCrypto.decrypt(tampered, validSecret, 3600)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.decrypt(tampered, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });

    it('should throw AUTH_FAILED for invalid base64', async () => {
      const invalidBase64 = '!!!invalid!!!';

      await expect(SessionCrypto.decrypt(invalidBase64, validSecret, 3600)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.decrypt(invalidBase64, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });

    it('should throw MALFORMED_SESSION for truncated data', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      // Truncate the encrypted data
      const truncated = encrypted.substring(0, 30);

      await expect(SessionCrypto.decrypt(truncated, validSecret, 3600)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.decrypt(truncated, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.MALFORMED_SESSION);
      }
    });

    it('should throw SESSION_TOO_LARGE for cookie exceeding 4KB', async () => {
      // Create a fake encrypted value that's too large
      const tooLarge = 'A'.repeat(50000);

      await expect(SessionCrypto.decrypt(tooLarge, validSecret, 3600)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.decrypt(tooLarge, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.SESSION_TOO_LARGE);
      }
    });

    it('should throw EXPIRED for expired session', async () => {
      // Save original skew value
      const SessionCryptoClass = SessionCrypto as any;
      const originalSkew = SessionCryptoClass.TIMESTAMP_SKEW_MS;
      // Temporarily reduce skew tolerance to 0 for testing
      SessionCryptoClass.TIMESTAMP_SKEW_MS = 0;

      try {
        const original = { userId: '123' };
        const encrypted = await SessionCrypto.encrypt(original, validSecret);

        // Wait 100ms with maxAge of 50ms (0.05 seconds)
        await new Promise((resolve) => setTimeout(resolve, 100));

        await expect(SessionCrypto.decrypt(encrypted, validSecret, 0.05)).rejects.toThrow(SessionCryptoError);

        try {
          await SessionCrypto.decrypt(encrypted, validSecret, 0.05);
        } catch (error) {
          expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.EXPIRED);
        }
      } finally {
        // Restore original skew value
        SessionCryptoClass.TIMESTAMP_SKEW_MS = originalSkew;
      }
    });

    it('should accept session within maxAge', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);

      // Decrypt immediately with generous maxAge
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should include 60-second clock skew tolerance', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);

      // Wait 1 second with maxAge of 1 second
      // Should still work due to 60-second skew tolerance
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 1);
      expect(decrypted).toEqual(original);
    });
  });

  describe('roundtrip integrity', () => {
    it('should roundtrip empty object', async () => {
      const original = {};
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should roundtrip complex nested data', async () => {
      const original: any = {
        userId: '123',
        metadata: {
          preferences: {
            theme: 'dark',
            notifications: true,
          },
          tags: ['admin', 'premium'],
        },
        loginHistory: [
          { timestamp: 1234567890, ip: '192.168.1.1' },
          { timestamp: 1234567900, ip: '192.168.1.2' },
        ],
      };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should preserve data types', async () => {
      const original: any = {
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        nullField: null,
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' },
      };

      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted: any = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
      expect(typeof decrypted.stringField).toBe('string');
      expect(typeof decrypted.numberField).toBe('number');
      expect(typeof decrypted.booleanField).toBe('boolean');
      expect(decrypted.nullField).toBeNull();
      expect(Array.isArray(decrypted.arrayField)).toBe(true);
      expect(typeof decrypted.objectField).toBe('object');
    });

    it('should preserve unicode characters', async () => {
      const original = {
        userId: '123',
        tenantName: '日本語 中文 한글 العربية 🎉🚀',
      };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
      expect(decrypted.tenantName).toBe('日本語 中文 한글 العربية 🎉🚀');
    });

    it('should preserve special characters', async () => {
      const original = {
        userId: '123',
        tenantName: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./',
      };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });
  });

  describe('decryptWithSecrets()', () => {
    it('should decrypt with first secret', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decryptWithSecrets(encrypted, [validSecret, alternateSecret], 3600);
      expect(decrypted).toEqual(original);
    });

    it('should decrypt with second secret when first fails', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decryptWithSecrets(
        encrypted,
        [alternateSecret, validSecret], // validSecret is second
        3600
      );
      expect(decrypted).toEqual(original);
    });

    it('should decrypt with third secret when first two fail', async () => {
      const thirdSecret = 'c'.repeat(32);
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, thirdSecret);
      const decrypted = await SessionCrypto.decryptWithSecrets(
        encrypted,
        [validSecret, alternateSecret, thirdSecret], // thirdSecret is last
        3600
      );
      expect(decrypted).toEqual(original);
    });

    it('should throw DECRYPTION_FAILED when all secrets fail', async () => {
      const wrongSecret = 'z'.repeat(32);
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, wrongSecret);

      await expect(SessionCrypto.decryptWithSecrets(encrypted, [validSecret, alternateSecret], 3600)).rejects.toThrow(
        SessionCryptoError
      );

      try {
        await SessionCrypto.decryptWithSecrets(encrypted, [validSecret, alternateSecret], 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.DECRYPTION_FAILED);
      }
    });

    it('should work with single secret in array', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = await SessionCrypto.decryptWithSecrets(encrypted, [validSecret], 3600);
      expect(decrypted).toEqual(original);
    });

    it('should try secrets in order (performance)', async () => {
      // This is more of a documentation test - order matters for performance
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, alternateSecret);

      // Should succeed faster if correct secret is first
      const decrypted = await SessionCrypto.decryptWithSecrets(
        encrypted,
        [alternateSecret, validSecret], // Correct secret first
        3600
      );
      expect(decrypted).toEqual(original);
    });
  });

  describe('binary format validation', () => {
    it('should have minimum size of 39 bytes', async () => {
      // Even empty session should have: version(1) + timestamp(8) + iv(12) + tag(16) + data(2 for "{}")
      const original = {};
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      // Base64 encoding increases size, but binary should be at least 39
      expect(encrypted.length).toBeGreaterThanOrEqual(39);
    });

    it('should throw UNSUPPORTED_VERSION for wrong version', async () => {
      const original = { userId: '123' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);

      // Decode, change version byte, re-encode
      const bytes = Buffer.from(encrypted, 'base64');
      bytes[0] = 99; // Invalid version
      const modifiedEncrypted = bytes.toString('base64');

      await expect(SessionCrypto.decrypt(modifiedEncrypted, validSecret, 3600)).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.decrypt(modifiedEncrypted, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.UNSUPPORTED_VERSION);
        expect((error as SessionCryptoError).message).toContain('99');
      }
    });
  });

  describe('Web Crypto error handling', () => {
    it('should throw ENCRYPTION_FAILED when key derivation fails', async () => {
      const originalSubtle = globalThis.crypto.subtle;
      const mockSubtle = {
        ...originalSubtle,
        deriveKey: jest.fn().mockRejectedValue(new Error('Algorithm not supported')),
      };

      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: mockSubtle,
        writable: true,
        configurable: true,
      });

      try {
        await SessionCrypto.encrypt({ userId: '123' }, validSecret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
        expect((error as SessionCryptoError).message).toContain('derive encryption key');
      } finally {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: originalSubtle,
          writable: true,
          configurable: true,
        });
      }
    });

    it('should throw ENCRYPTION_FAILED when Web Crypto encrypt fails', async () => {
      const originalSubtle = globalThis.crypto.subtle;
      const mockSubtle = {
        ...originalSubtle,
        importKey: originalSubtle.importKey.bind(originalSubtle),
        deriveKey: originalSubtle.deriveKey.bind(originalSubtle),
        encrypt: jest.fn().mockRejectedValue(new Error('Encryption operation failed')),
      };

      Object.defineProperty(globalThis.crypto, 'subtle', {
        value: mockSubtle,
        writable: true,
        configurable: true,
      });

      try {
        await SessionCrypto.encrypt({ userId: '123' }, validSecret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
        expect((error as SessionCryptoError).message).toBe('Failed to encrypt session data');
      } finally {
        Object.defineProperty(globalThis.crypto, 'subtle', {
          value: originalSubtle,
          writable: true,
          configurable: true,
        });
      }
    });
  });
});
