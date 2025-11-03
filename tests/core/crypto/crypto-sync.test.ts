import { SessionCrypto } from '../../../src/core/crypto';
import { SessionCryptoError, SessionCryptoErrorCode } from '../../../src/error';
import { SessionData } from '../../../src/types';

describe('SessionCrypto - Sync Methods', () => {
  const validSecret = 'a'.repeat(32);
  const alternateSecret = 'b'.repeat(32);

  describe('encryptSync()', () => {
    it('should encrypt empty session data', () => {
      const encrypted = SessionCrypto.encryptSync({}, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should encrypt session with single property', () => {
      const encrypted = SessionCrypto.encryptSync({ userId: '123' }, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should encrypt session with multiple properties', () => {
      const sessionData: SessionData = {
        userId: '123',
        tenantId: 'tenant-456',
        accessToken: 'token-abc',
        isAuthenticated: true
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should produce different outputs for same data (random IV)', () => {
      const sessionData = { userId: '123' };
      const encrypted1 = SessionCrypto.encryptSync(sessionData, validSecret);
      const encrypted2 = SessionCrypto.encryptSync(sessionData, validSecret);
      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce different outputs for different secrets', () => {
      const sessionData = { userId: '123' };
      const encrypted1 = SessionCrypto.encryptSync(sessionData, validSecret);
      const encrypted2 = SessionCrypto.encryptSync(sessionData, alternateSecret);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle string values', () => {
      const sessionData = {
        userId: 'user-123',
        tenantId: 'tenant-456',
        tenantName: 'Test User'
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle number values', () => {
      const sessionData = {
        userId: '123',
        expiresAt: 1234567890
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle boolean values', () => {
      const sessionData = {
        isAuthenticated: true
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle nested objects', () => {
      const sessionData: any = {
        userId: '123',
        metadata: {
          theme: 'dark',
          language: 'en'
        }
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle arrays', () => {
      const sessionData: any = {
        userId: '123',
        roles: ['admin', 'editor', 'viewer']
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle special characters', () => {
      const sessionData = {
        userId: '123',
        tenantName: 'Test with special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./'
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should handle unicode characters', () => {
      const sessionData = {
        userId: '123',
        tenantName: '日本語 中文 한글 العربية 🎉'
      };
      const encrypted = SessionCrypto.encryptSync(sessionData, validSecret);
      expect(encrypted).toBeDefined();
    });

    it('should produce base64-encoded output', () => {
      const encrypted = SessionCrypto.encryptSync({ userId: '123' }, validSecret);
      // Base64 only contains A-Z, a-z, 0-9, +, /, =
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should throw SESSION_TOO_LARGE for very large session data', () => {
      const largeData: any = {
        userId: '123',
        largeField: 'x'.repeat(5000)
      };
      expect(() => SessionCrypto.encryptSync(largeData, validSecret)).toThrow(SessionCryptoError);
      
      try {
        SessionCrypto.encryptSync(largeData, validSecret);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.SESSION_TOO_LARGE);
      }
    });

    it('should accept moderately large session data under 4KB', () => {
      const moderateData: any = {
        userId: '123',
        data: 'x'.repeat(2000)
      };
      const encrypted = SessionCrypto.encryptSync(moderateData, validSecret);
      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeLessThan(4096);
    });

    it('should throw ENCRYPTION_FAILED for non-JSON-serializable data (BigInt)', () => {
      const dataWithBigInt: any = {
        userId: '123',
        bigNumber: BigInt(12345)
      };

      expect(() => {
        SessionCrypto.encryptSync(dataWithBigInt, validSecret);
      }).toThrow(SessionCryptoError);

      try {
        SessionCrypto.encryptSync(dataWithBigInt, validSecret);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
        expect((error as SessionCryptoError).message).toContain('Failed to encrypt session data');
      }
    });
  });

  describe('decryptSync()', () => {
    it('should decrypt valid encrypted session', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should decrypt session with multiple properties', () => {
      const original: SessionData = {
        userId: '123',
        tenantId: 'tenant-456',
        accessToken: 'token-abc',
        isAuthenticated: true
      };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should throw AUTH_FAILED for wrong secret', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      expect(() => SessionCrypto.decryptSync(encrypted, alternateSecret, 3600)).toThrow(SessionCryptoError);

      try {
        SessionCrypto.decryptSync(encrypted, alternateSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });

    it('should throw AUTH_FAILED for tampered data', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      // Tamper with the encrypted data
      const tampered = encrypted.substring(0, 20) + 'X' + encrypted.substring(21);
      expect(() => SessionCrypto.decryptSync(tampered, validSecret, 3600)).toThrow(SessionCryptoError);
      
      try {
        SessionCrypto.decryptSync(tampered, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });

    it('should throw AUTH_FAILED for invalid base64', () => {
      const invalidBase64 = '!!!invalid!!!';
      expect(() => SessionCrypto.decryptSync(invalidBase64, validSecret, 3600)).toThrow(SessionCryptoError);

      try {
        SessionCrypto.decryptSync(invalidBase64, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });

    it('should throw MALFORMED_SESSION for truncated data', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const truncated = encrypted.substring(0, 30);
      expect(() => SessionCrypto.decryptSync(truncated, validSecret, 3600)).toThrow(SessionCryptoError);

      try {
        SessionCrypto.decryptSync(truncated, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.MALFORMED_SESSION);
      }
    });

    it('should throw SESSION_TOO_LARGE for cookie exceeding 4KB', () => {
      const tooLarge = 'A'.repeat(50000);
      expect(() => SessionCrypto.decryptSync(tooLarge, validSecret, 3600)).toThrow(SessionCryptoError);

      try {
        SessionCrypto.decryptSync(tooLarge, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.SESSION_TOO_LARGE);
      }
    });

    it('should throw EXPIRED for expired session', () => {
      // Save original skew value
      const SessionCryptoClass = SessionCrypto as any;
      const originalSkew = SessionCryptoClass.TIMESTAMP_SKEW_MS;
      // Temporarily reduce skew tolerance to 0 for testing
      SessionCryptoClass.TIMESTAMP_SKEW_MS = 0;

      try {
        const original = { userId: '123' };
        const encrypted = SessionCrypto.encryptSync(original, validSecret);
        
        // Wait 100ms with maxAge of 50ms (0.05 seconds)
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Busy wait for sync context
        }

        expect(() => SessionCrypto.decryptSync(encrypted, validSecret, 0.05)).toThrow(SessionCryptoError);

        try {
          SessionCrypto.decryptSync(encrypted, validSecret, 0.05);
        } catch (error) {
          expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.EXPIRED);
        }
      } finally {
        // Restore original skew value
        SessionCryptoClass.TIMESTAMP_SKEW_MS = originalSkew;
      }
    });

    it('should accept session within maxAge', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should include 60-second clock skew tolerance', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);

      // Wait 1+ second with maxAge of 1 second
      const start = Date.now();
      while (Date.now() - start < 1100) {
        // Busy wait
      }

      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 1);
      expect(decrypted).toEqual(original);
    });

    it('should throw AUTH_FAILED when decipher operations fail', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);

      // Decode, corrupt the encrypted data portion, re-encode
      const bytes = Buffer.from(encrypted, 'base64');
      bytes[25] = bytes[25] ^ 0xFF; // Corrupt encrypted data
      const corrupted = bytes.toString('base64');

      expect(() => {
        SessionCrypto.decryptSync(corrupted, validSecret, 3600);
      }).toThrow(SessionCryptoError);

      try {
        SessionCrypto.decryptSync(corrupted, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
        expect((error as SessionCryptoError).message).toBe('Failed to decrypt session data');
      }
    });
  });

  describe('roundtrip integrity (sync)', () => {
    it('should roundtrip empty object', () => {
      const original = {};
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should roundtrip complex nested data', () => {
      const original: any = {
        userId: '123',
        metadata: {
          preferences: {
            theme: 'dark',
            notifications: true
          },
          tags: ['admin', 'premium']
        },
        loginHistory: [
          { timestamp: 1234567890, ip: '192.168.1.1' },
          { timestamp: 1234567900, ip: '192.168.1.2' }
        ]
      };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should preserve data types', () => {
      const original: any = {
        stringField: 'test',
        numberField: 42,
        booleanField: true,
        nullField: null,
        arrayField: [1, 2, 3],
        objectField: { nested: 'value' }
      };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted: any = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
      expect(typeof decrypted.stringField).toBe('string');
      expect(typeof decrypted.numberField).toBe('number');
      expect(typeof decrypted.booleanField).toBe('boolean');
      expect(decrypted.nullField).toBeNull();
      expect(Array.isArray(decrypted.arrayField)).toBe(true);
      expect(typeof decrypted.objectField).toBe('object');
    });

    it('should preserve unicode characters', () => {
      const original = {
        userId: '123',
        tenantName: '日本語 中文 한글 العربية 🎉🚀'
      };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
      expect(decrypted.tenantName).toBe('日本語 中文 한글 العربية 🎉🚀');
    });

    it('should preserve special characters', () => {
      const original = {
        userId: '123',
        tenantName: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./'
      };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });
  });

  describe('decryptWithSecretsSync()', () => {
    it('should decrypt with first secret', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptWithSecretsSync(
        encrypted,
        [validSecret, alternateSecret],
        3600
      );
      expect(decrypted).toEqual(original);
    });

    it('should decrypt with second secret when first fails', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptWithSecretsSync(
        encrypted,
        [alternateSecret, validSecret],
        3600
      );
      expect(decrypted).toEqual(original);
    });

    it('should decrypt with third secret when first two fail', () => {
      const thirdSecret = 'c'.repeat(32);
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, thirdSecret);
      const decrypted = SessionCrypto.decryptWithSecretsSync(
        encrypted,
        [validSecret, alternateSecret, thirdSecret],
        3600
      );
      expect(decrypted).toEqual(original);
    });

    it('should throw DECRYPTION_FAILED when all secrets fail', () => {
      const wrongSecret = 'z'.repeat(32);
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, wrongSecret);

      expect(() => 
        SessionCrypto.decryptWithSecretsSync(
          encrypted,
          [validSecret, alternateSecret],
          3600
        )
      ).toThrow(SessionCryptoError);

      try {
        SessionCrypto.decryptWithSecretsSync(
          encrypted,
          [validSecret, alternateSecret],
          3600
        );
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.DECRYPTION_FAILED);
      }
    });

    it('should work with single secret in array', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = SessionCrypto.decryptWithSecretsSync(
        encrypted,
        [validSecret],
        3600
      );
      expect(decrypted).toEqual(original);
    });

    it('should try secrets in order (performance)', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, alternateSecret);
      const decrypted = SessionCrypto.decryptWithSecretsSync(
        encrypted,
        [alternateSecret, validSecret],
        3600
      );
      expect(decrypted).toEqual(original);
    });
  });

  describe('cross-compatibility (sync ↔ async)', () => {
    it('should decrypt async-encrypted data with sync', async () => {
      const original = { userId: '123', tenantId: 'tenant-456' };
      const encrypted = await SessionCrypto.encrypt(original, validSecret);
      const decrypted = SessionCrypto.decryptSync(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should decrypt sync-encrypted data with async', async () => {
      const original = { userId: '123', tenantId: 'tenant-456' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted).toEqual(original);
    });

    it('should handle complex data cross-platform', async () => {
      const original: any = {
        userId: '123',
        metadata: {
          roles: ['admin', 'user'],
          settings: { theme: 'dark' }
        }
      };

      // Encrypt with async, decrypt with sync
      const encryptedAsync = await SessionCrypto.encrypt(original, validSecret);
      const decryptedFromAsync = SessionCrypto.decryptSync(encryptedAsync, validSecret, 3600);
      expect(decryptedFromAsync).toEqual(original);

      // Encrypt with sync, decrypt with async
      const encryptedSync = SessionCrypto.encryptSync(original, validSecret);
      const decryptedFromSync = await SessionCrypto.decrypt(encryptedSync, validSecret, 3600);
      expect(decryptedFromSync).toEqual(original);
    });

    it('should handle unicode data cross-platform', async () => {
      const original = {
        userId: '123',
        tenantName: '日本語 🎉'
      };
      const encryptedAsync = await SessionCrypto.encrypt(original, validSecret);
      const decryptedSync = SessionCrypto.decryptSync(encryptedAsync, validSecret, 3600);
      expect(decryptedSync).toEqual(original);
      const encryptedSync = SessionCrypto.encryptSync(original, validSecret);
      const decryptedAsync = await SessionCrypto.decrypt(encryptedSync, validSecret, 3600);
      expect(decryptedAsync).toEqual(original);
    });

    it('should support key rotation cross-platform', async () => {
      const original = { userId: '123' };

      // Encrypt with async, decrypt with sync using multiple secrets
      const encryptedAsync = await SessionCrypto.encrypt(original, validSecret);
      const decryptedSync = SessionCrypto.decryptWithSecretsSync(
        encryptedAsync,
        [alternateSecret, validSecret],
        3600
      );
      expect(decryptedSync).toEqual(original);
      
      // Encrypt with sync, decrypt with async using multiple secrets
      const encryptedSync = SessionCrypto.encryptSync(original, alternateSecret);
      const decryptedAsync = await SessionCrypto.decryptWithSecrets(
        encryptedSync,
        [validSecret, alternateSecret],
        3600
      );
      expect(decryptedAsync).toEqual(original);
    });
  });

  describe('binary format validation (sync)', () => {
    it('should have minimum size of 39 bytes', () => {
      const original = {};
      const encrypted = SessionCrypto.encryptSync(original, validSecret);
      expect(encrypted.length).toBeGreaterThanOrEqual(39);
    });

    it('should throw UNSUPPORTED_VERSION for wrong version', () => {
      const original = { userId: '123' };
      const encrypted = SessionCrypto.encryptSync(original, validSecret);

      // Decode, change version byte, re-encode
      const bytes = Buffer.from(encrypted, 'base64');
      bytes[0] = 99;
      const modifiedEncrypted = bytes.toString('base64');
      expect(() => SessionCrypto.decryptSync(modifiedEncrypted, validSecret, 3600)).toThrow(SessionCryptoError);
      
      try {
        SessionCrypto.decryptSync(modifiedEncrypted, validSecret, 3600);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.UNSUPPORTED_VERSION);
        expect((error as SessionCryptoError).message).toContain('99');
      }
    });
  });

  describe('Node crypto error handling', () => {
    it('should throw ENCRYPTION_FAILED when cipher operations fail', () => {
      // Mock Node crypto to make cipher fail
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const crypto = require('node:crypto');
      const originalCreateCipheriv = crypto.createCipheriv;
      crypto.createCipheriv = jest.fn().mockImplementation(() => {
        throw new Error('Cipher creation failed');
      });
      
      try {
        SessionCrypto.encryptSync({ userId: '123' }, validSecret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
        expect((error as SessionCryptoError).message).toBe('Failed to encrypt session data');
      } finally {
        // Restore
        crypto.createCipheriv = originalCreateCipheriv;
      }
    });
  });
});
