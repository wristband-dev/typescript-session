import { SessionCryptoError, SessionCryptoErrorCode, SessionError, SessionErrorCode } from '../src/error';

describe('SessionError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Session has been destroyed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SessionError);
      expect(error.name).toBe('SessionError');
      expect(error.code).toBe(SessionErrorCode.SESSION_DESTROYED);
      expect(error.message).toBe('Session has been destroyed');
    });

    it('should create error without cause', () => {
      const error = new SessionError(SessionErrorCode.INVALID_CONFIGURATION, 'Invalid config');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with cause', () => {
      const cause = new Error('Underlying error');
      const error = new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Failed to save', cause);
      expect(error.cause).toBe(cause);
      expect(error.cause?.message).toBe('Underlying error');
    });

    it('should preserve stack trace', () => {
      const error = new SessionError(SessionErrorCode.MISSING_RESPONSE, 'No response object');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SessionError');
    });
  });

  describe('error codes', () => {
    it('should support SESSION_DESTROYED code', () => {
      const error = new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Destroyed');
      expect(error.code).toBe('SESSION_DESTROYED');
    });

    it('should support SESSION_SAVE_FAILED code', () => {
      const error = new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Save failed');
      expect(error.code).toBe('SESSION_SAVE_FAILED');
    });

    it('should support INVALID_CONFIGURATION code', () => {
      const error = new SessionError(SessionErrorCode.INVALID_CONFIGURATION, 'Invalid config');
      expect(error.code).toBe('INVALID_CONFIGURATION');
    });

    it('should support MISSING_RESPONSE code', () => {
      const error = new SessionError(SessionErrorCode.MISSING_RESPONSE, 'No response');
      expect(error.code).toBe('MISSING_RESPONSE');
    });

    it('should support DEFERRED_MODE_NOT_ENABLED code', () => {
      const error = new SessionError(SessionErrorCode.DEFERRED_MODE_NOT_ENABLED, 'Deferred not enabled');
      expect(error.code).toBe('DEFERRED_MODE_NOT_ENABLED');
    });

    it('should support CALLBACK_DATA_INVALID code', () => {
      const error = new SessionError(SessionErrorCode.CALLBACK_DATA_INVALID, 'Invalid callback data');
      expect(error.code).toBe('CALLBACK_DATA_INVALID');
    });

    it('should support SESSION_NOT_AUTHENTICATED code', () => {
      const error = new SessionError(SessionErrorCode.SESSION_NOT_AUTHENTICATED, 'Not authenticated');
      expect(error.code).toBe('SESSION_NOT_AUTHENTICATED');
    });

    it('should support CUSTOM_FIELDS_NOT_SERIALIZABLE code', () => {
      const error = new SessionError(SessionErrorCode.CUSTOM_FIELDS_NOT_SERIALIZABLE, 'Cannot serialize');
      expect(error.code).toBe('CUSTOM_FIELDS_NOT_SERIALIZABLE');
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON with code and message', () => {
      const error = new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Session destroyed');
      const json = error.toJSON();
      expect(json).toEqual({ code: 'SESSION_DESTROYED', message: 'Session destroyed' });
    });

    it('should omit cause from JSON serialization', () => {
      const cause = new Error('Underlying error');
      const error = new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Save failed', cause);
      const json = error.toJSON();
      expect(json).toEqual({ code: 'SESSION_SAVE_FAILED', message: 'Save failed' });
      expect(json).not.toHaveProperty('cause');
    });

    it('should work with JSON.stringify', () => {
      const error = new SessionError(SessionErrorCode.INVALID_CONFIGURATION, 'Invalid config');
      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual({ code: 'INVALID_CONFIGURATION', message: 'Invalid config' });
    });

    it('should omit stack trace from JSON', () => {
      const error = new SessionError(SessionErrorCode.MISSING_RESPONSE, 'No response');
      const json = error.toJSON();
      expect(json).not.toHaveProperty('stack');
      expect(json).not.toHaveProperty('name');
    });
  });

  describe('error cause chain', () => {
    it('should preserve cause chain', () => {
      const rootCause = new Error('Root cause');
      const middleCause = new SessionCryptoError(
        SessionCryptoErrorCode.DECRYPTION_FAILED,
        'Decryption failed',
        rootCause
      );
      const error = new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Save failed', middleCause);
      expect(error.cause).toBe(middleCause);
      expect((error.cause as SessionCryptoError).cause).toBe(rootCause);
    });

    it('should allow inspecting cause for debugging', () => {
      const cause = new SessionCryptoError(SessionCryptoErrorCode.AUTH_FAILED, 'Auth failed');
      const error = new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Save failed', cause);
      expect(error.cause).toBeInstanceOf(SessionCryptoError);
      if (error.cause instanceof SessionCryptoError) {
        expect(error.cause.code).toBe(SessionCryptoErrorCode.AUTH_FAILED);
      }
    });
  });

  describe('instanceof checks', () => {
    it('should be instanceof Error', () => {
      const error = new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Destroyed');
      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof SessionError', () => {
      const error = new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Destroyed');
      expect(error instanceof SessionError).toBe(true);
    });

    it('should not be instanceof SessionCryptoError', () => {
      const error = new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Destroyed');
      expect(error instanceof SessionCryptoError).toBe(false);
    });
  });
});

describe('SessionCryptoError', () => {
  describe('constructor', () => {
    it('should create error with code and message', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Decryption failed');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SessionCryptoError);
      expect(error.name).toBe('SessionCryptoError');
      expect(error.code).toBe(SessionCryptoErrorCode.DECRYPTION_FAILED);
      expect(error.message).toBe('Decryption failed');
    });

    it('should use code as message when message not provided', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRET);
      expect(error.message).toBe('INVALID_SECRET');
    });

    it('should create error without cause', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.ENCRYPTION_FAILED, 'Encryption failed');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with Error cause', () => {
      const cause = new Error('Underlying error');
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Decryption failed', cause);
      expect(error.cause).toBe(cause);
      expect(error.cause?.message).toBe('Underlying error');
    });

    it('should wrap non-Error cause in Error', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.AUTH_FAILED, 'Auth failed', 'string cause');
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause?.message).toBe('string cause');
    });

    it('should preserve stack trace', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.EXPIRED, 'Session expired');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('SessionCryptoError');
    });
  });

  describe('error codes', () => {
    it('should support INVALID_SECRET code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRET, 'Invalid secret');
      expect(error.code).toBe('INVALID_SECRET');
    });

    it('should support INVALID_SECRETS_LIST code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRETS_LIST, 'Invalid list');
      expect(error.code).toBe('INVALID_SECRETS_LIST');
    });

    it('should support INVALID_MAX_AGE code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.INVALID_MAX_AGE, 'Invalid maxAge');
      expect(error.code).toBe('INVALID_MAX_AGE');
    });

    it('should support SESSION_TOO_LARGE code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.SESSION_TOO_LARGE, 'Too large');
      expect(error.code).toBe('SESSION_TOO_LARGE');
    });

    it('should support MALFORMED_SESSION code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.MALFORMED_SESSION, 'Malformed');
      expect(error.code).toBe('MALFORMED_SESSION');
    });

    it('should support UNSUPPORTED_VERSION code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.UNSUPPORTED_VERSION, 'Unsupported');
      expect(error.code).toBe('UNSUPPORTED_VERSION');
    });

    it('should support EXPIRED code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.EXPIRED, 'Expired');
      expect(error.code).toBe('EXPIRED');
    });

    it('should support AUTH_FAILED code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.AUTH_FAILED, 'Auth failed');
      expect(error.code).toBe('AUTH_FAILED');
    });

    it('should support DECRYPTION_FAILED code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Decryption failed');
      expect(error.code).toBe('DECRYPTION_FAILED');
    });

    it('should support ENCRYPTION_FAILED code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.ENCRYPTION_FAILED, 'Encryption failed');
      expect(error.code).toBe('ENCRYPTION_FAILED');
    });

    it('should support NODE_CRYPTO_UNAVAILABLE code', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.NODE_CRYPTO_UNAVAILABLE, 'Node crypto unavailable');
      expect(error.code).toBe('NODE_CRYPTO_UNAVAILABLE');
    });
  });

  describe('cause handling', () => {
    it('should preserve Error cause as-is', () => {
      const cause = new TypeError('Type error');
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Failed', cause);
      expect(error.cause).toBe(cause);
      expect(error.cause).toBeInstanceOf(TypeError);
    });

    it('should wrap string cause in Error', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.AUTH_FAILED, 'Auth failed', 'Invalid signature');
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause?.message).toBe('Invalid signature');
    });

    it('should wrap number cause in Error', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Failed', 404);
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause?.message).toBe('404');
    });

    it('should wrap object cause in Error', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.ENCRYPTION_FAILED, 'Failed', {
        detail: 'Some detail',
      });
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause?.message).toContain('object');
    });

    it('should handle null cause', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.EXPIRED, 'Expired', null);
      expect(error.cause).toBeUndefined();
    });

    it('should handle undefined cause', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.EXPIRED, 'Expired', undefined);
      expect(error.cause).toBeUndefined();
    });
  });

  describe('instanceof checks', () => {
    it('should be instanceof Error', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Failed');
      expect(error instanceof Error).toBe(true);
    });

    it('should be instanceof SessionCryptoError', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Failed');
      expect(error instanceof SessionCryptoError).toBe(true);
    });

    it('should not be instanceof SessionError', () => {
      const error = new SessionCryptoError(SessionCryptoErrorCode.DECRYPTION_FAILED, 'Failed');
      expect(error instanceof SessionError).toBe(false);
    });
  });
});

describe('SessionErrorCode enum', () => {
  it('should have all expected error codes', () => {
    const errorCodes = Object.keys(SessionErrorCode);
    expect(errorCodes).toHaveLength(8);
    expect(SessionErrorCode.SESSION_DESTROYED).toBe('SESSION_DESTROYED');
    expect(SessionErrorCode.SESSION_SAVE_FAILED).toBe('SESSION_SAVE_FAILED');
    expect(SessionErrorCode.INVALID_CONFIGURATION).toBe('INVALID_CONFIGURATION');
    expect(SessionErrorCode.MISSING_RESPONSE).toBe('MISSING_RESPONSE');
    expect(SessionErrorCode.DEFERRED_MODE_NOT_ENABLED).toBe('DEFERRED_MODE_NOT_ENABLED');
    expect(SessionErrorCode.CALLBACK_DATA_INVALID).toBe('CALLBACK_DATA_INVALID');
    expect(SessionErrorCode.SESSION_NOT_AUTHENTICATED).toBe('SESSION_NOT_AUTHENTICATED');
    expect(SessionErrorCode.CUSTOM_FIELDS_NOT_SERIALIZABLE).toBe('CUSTOM_FIELDS_NOT_SERIALIZABLE');
  });
});

describe('SessionCryptoErrorCode enum', () => {
  it('should have all expected error codes', () => {
    const errorCodes = Object.keys(SessionCryptoErrorCode);
    expect(errorCodes).toHaveLength(11);
    expect(SessionCryptoErrorCode.INVALID_SECRET).toBe('INVALID_SECRET');
    expect(SessionCryptoErrorCode.INVALID_SECRETS_LIST).toBe('INVALID_SECRETS_LIST');
    expect(SessionCryptoErrorCode.INVALID_MAX_AGE).toBe('INVALID_MAX_AGE');
    expect(SessionCryptoErrorCode.SESSION_TOO_LARGE).toBe('SESSION_TOO_LARGE');
    expect(SessionCryptoErrorCode.MALFORMED_SESSION).toBe('MALFORMED_SESSION');
    expect(SessionCryptoErrorCode.UNSUPPORTED_VERSION).toBe('UNSUPPORTED_VERSION');
    expect(SessionCryptoErrorCode.EXPIRED).toBe('EXPIRED');
    expect(SessionCryptoErrorCode.AUTH_FAILED).toBe('AUTH_FAILED');
    expect(SessionCryptoErrorCode.DECRYPTION_FAILED).toBe('DECRYPTION_FAILED');
    expect(SessionCryptoErrorCode.ENCRYPTION_FAILED).toBe('ENCRYPTION_FAILED');
    expect(SessionCryptoErrorCode.NODE_CRYPTO_UNAVAILABLE).toBe('NODE_CRYPTO_UNAVAILABLE');
  });
});
