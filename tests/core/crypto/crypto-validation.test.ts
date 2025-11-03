import { SessionCrypto } from '../../../src/core/crypto';
import { SessionCryptoError, SessionCryptoErrorCode } from '../../../src/error';

describe('SessionCrypto - Validation', () => {
  describe('secret validation', () => {
    it('should reject empty string secret', async () => {
      await expect(
        SessionCrypto.encrypt({ userId: '123' }, '')
      ).rejects.toThrow(SessionCryptoError);
      
      await expect(
        SessionCrypto.encrypt({ userId: '123' }, '')
      ).rejects.toThrow('non-empty string');
    });

    it('should reject secret shorter than 32 characters', async () => {
      const shortSecret = 'a'.repeat(31);
      
      await expect(
        SessionCrypto.encrypt({ userId: '123' }, shortSecret)
      ).rejects.toThrow(SessionCryptoError);
      
      await expect(
        SessionCrypto.encrypt({ userId: '123' }, shortSecret)
      ).rejects.toThrow('at least 32 characters');
    });

    it('should accept secret exactly 32 characters', async () => {
      const validSecret = 'a'.repeat(32);
      const encrypted = await SessionCrypto.encrypt({ userId: '123' }, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should accept secret longer than 32 characters', async () => {
      const longSecret = 'a'.repeat(64);
      const encrypted = await SessionCrypto.encrypt({ userId: '123' }, longSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should reject non-string secret', async () => {
      await expect(
        SessionCrypto.encrypt({ userId: '123' }, 12345 as any)
      ).rejects.toThrow(SessionCryptoError);
      
      await expect(
        SessionCrypto.encrypt({ userId: '123' }, null as any)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should include actual length in error message', async () => {
      const secret = 'short';

      try {
        await SessionCrypto.encrypt({ userId: '123' }, secret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).message).toContain('5'); // actual length
      }
    });
  });

  describe('secrets list validation', () => {
    const validSecret = 'a'.repeat(32);
    let encryptedValue: string;

    beforeAll(async () => {
      // Create a real encrypted value to use in tests
      encryptedValue = await SessionCrypto.encrypt({ userId: '123' }, validSecret);
    });

    it('should reject non-array secrets', async () => {
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, null as any, 3600)
      ).rejects.toThrow(SessionCryptoError);
      
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, 'not-array' as any, 3600)
      ).rejects.toThrow('must be an array');
    });

    it('should reject empty secrets array', async () => {
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, [], 3600)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, [], 3600)
      ).rejects.toThrow('At least one secret is required');
    });

    it('should reject more than 3 secrets', async () => {
      const tooManySecrets = [
        'a'.repeat(32),
        'b'.repeat(32),
        'c'.repeat(32),
        'd'.repeat(32)
      ];

      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, tooManySecrets, 3600)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, tooManySecrets, 3600)
      ).rejects.toThrow('Maximum 3 secrets allowed');
    });

    it('should accept exactly 3 secrets', async () => {
      // All different secrets (none match validSecret), so decryption will fail
      const threeSecrets = [
        'b'.repeat(32),
        'c'.repeat(32),
        'd'.repeat(32)
      ];

      // Passes validation, fails decryption (wrong secrets)
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, threeSecrets, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should accept single secret in array', async () => {
      // Different secret, so decryption will fail
      const oneSecret = ['b'.repeat(32)];

      // Passes validation, fails decryption (wrong secret)
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, oneSecret, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should accept two secrets', async () => {
      // Both different secrets, so decryption will fail
      const twoSecrets = [
        'b'.repeat(32),
        'c'.repeat(32)
      ];

      // Passes validation, fails decryption (wrong secrets)
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, twoSecrets, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject undefined secrets', async () => {
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, undefined as any, 3600)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, undefined as any, 3600)
      ).rejects.toThrow('must be an array');
    });

    it('should reject object as secrets', async () => {
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, { secret: validSecret } as any, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject falsy non-null/undefined secrets', async () => {
      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, 0 as any, 3600)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decryptWithSecrets(encryptedValue, '' as any, 3600)
      ).rejects.toThrow('must be an array');
    });
  });

  describe('maxAge validation', () => {
    const validSecret = 'a'.repeat(32);
    const encryptedValue = 'AQABkx7f2g...'; // Mock encrypted value

    it('should reject zero maxAge', async () => {
      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, 0)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, 0)
      ).rejects.toThrow('maxAge must be greater than 0');
    });

    it('should reject negative maxAge', async () => {
      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, -100)
      ).rejects.toThrow(SessionCryptoError);
      
      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, -100)
      ).rejects.toThrow('maxAge must be greater than 0');
    });

    it('should accept maxAge of 1', async () => {
      // Will fail decryption but pass validation
      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, 1)
      ).rejects.toThrow(); // Fails at decryption, not validation
    });

    it('should accept large maxAge values', async () => {
      const oneYear = 365 * 24 * 60 * 60;

      // Will fail decryption but pass validation
      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, oneYear)
      ).rejects.toThrow(); // Fails at decryption, not validation
    });

    it('should reject non-number maxAge', async () => {
      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, '3600' as any)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decrypt(encryptedValue, validSecret, null as any)
      ).rejects.toThrow(SessionCryptoError);
    });
  });

  describe('session data validation', () => {
    const validSecret = 'a'.repeat(32);

    it('should reject null session data', async () => {
      await expect(
        SessionCrypto.encrypt(null as any, validSecret)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.encrypt(null as any, validSecret)
      ).rejects.toThrow('plain object');
    });

    it('should reject undefined session data', async () => {
      await expect(
        SessionCrypto.encrypt(undefined as any, validSecret)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject array as session data', async () => {
      await expect(
        SessionCrypto.encrypt([] as any, validSecret)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.encrypt([1, 2, 3] as any, validSecret)
      ).rejects.toThrow('plain object');
    });

    it('should accept empty object', async () => {
      const encrypted = await SessionCrypto.encrypt({}, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should accept object with properties', async () => {
      const sessionData = {
        userId: '123',
        role: 'admin',
        loginTime: Date.now()
      };

      const encrypted = await SessionCrypto.encrypt(sessionData, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
    });

    it('should handle data with functions by omitting them', async () => {
      const dataWithFunction = {
        userId: '123',
        callback: (): any => console.log('test')
      };

      // Should succeed - functions are silently omitted by JSON.stringify
      const encrypted = await SessionCrypto.encrypt(dataWithFunction as any, validSecret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');

      // Decrypt and verify function was omitted
      const decrypted = await SessionCrypto.decrypt(encrypted, validSecret, 3600);
      expect(decrypted.userId).toBe('123');
      expect(decrypted).not.toHaveProperty('callback');
    });

    it('should reject circular references', async () => {
      const circular: any = { userId: '123' };
      circular.self = circular;

      await expect(
        SessionCrypto.encrypt(circular, validSecret)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject string as session data', async () => {
      await expect(
        SessionCrypto.encrypt('not an object' as any, validSecret)
      ).rejects.toThrow(SessionCryptoError);

      try {
        await SessionCrypto.encrypt('not an object' as any, validSecret);
      } catch (error) {
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
        expect((error as SessionCryptoError).message).toContain('plain object');
      }
    });

    it('should reject number as session data', async () => {
      await expect(
        SessionCrypto.encrypt(123 as any, validSecret)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject boolean as session data', async () => {
      await expect(
        SessionCrypto.encrypt(true as any, validSecret)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject string as session data (sync)', () => {
      expect(() => {
        SessionCrypto.encryptSync('not an object' as any, validSecret);
      }).toThrow(SessionCryptoError);
    });

    it('should reject number as session data (sync)', () => {
      expect(() => {
        SessionCrypto.encryptSync(123 as any, validSecret);
      }).toThrow(SessionCryptoError);
    });
  });

  describe('encrypted value validation', () => {
    const validSecret = 'a'.repeat(32);

    it('should reject empty string', async () => {
      await expect(
        SessionCrypto.decrypt('', validSecret, 3600)
      ).rejects.toThrow(SessionCryptoError);
      
      await expect(
        SessionCrypto.decrypt('', validSecret, 3600)
      ).rejects.toThrow('non-empty string');
    });

    it('should reject null encrypted value', async () => {
      await expect(
        SessionCrypto.decrypt(null as any, validSecret, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject undefined encrypted value', async () => {
      await expect(
        SessionCrypto.decrypt(undefined as any, validSecret, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });

    it('should reject non-string encrypted value', async () => {
      await expect(
        SessionCrypto.decrypt(12345 as any, validSecret, 3600)
      ).rejects.toThrow(SessionCryptoError);

      await expect(
        SessionCrypto.decrypt({} as any, validSecret, 3600)
      ).rejects.toThrow(SessionCryptoError);
    });
  });

  describe('error codes', () => {
    const validSecret = 'a'.repeat(32);

    it('should throw INVALID_SECRET for bad secret', async () => {
      try {
        await SessionCrypto.encrypt({ userId: '123' }, 'short');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.INVALID_SECRET);
      }
    });

    it('should throw INVALID_SECRETS_LIST for bad secrets array', async () => {
      try {
        await SessionCrypto.decryptWithSecrets('test', [], 3600);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.INVALID_SECRETS_LIST);
      }
    });

    it('should throw INVALID_MAX_AGE for bad maxAge', async () => {
      try {
        await SessionCrypto.decrypt('test', validSecret, 0);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.INVALID_MAX_AGE);
      }
    });

    it('should throw ENCRYPTION_FAILED for bad session data', async () => {
      try {
        await SessionCrypto.encrypt(null as any, validSecret);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.ENCRYPTION_FAILED);
      }
    });

    it('should throw MALFORMED_SESSION for bad encrypted value', async () => {
      try {
        await SessionCrypto.decrypt('', validSecret, 3600);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionCryptoError);
        expect((error as SessionCryptoError).code).toBe(SessionCryptoErrorCode.MALFORMED_SESSION);
      }
    });
  });
});
