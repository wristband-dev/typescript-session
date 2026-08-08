/**
 * Error codes for Session operations.
 *
 * Provides structured identifiers for different types of session failures
 * without exposing internal implementation details.
 */
export enum SessionErrorCode {
  // --- Session lifecycle errors ---
  /** Attempted to modify or save a session that has been destroyed */
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  /** Failed to save session (encryption, serialization, or cookie write failed) */
  SESSION_SAVE_FAILED = 'SESSION_SAVE_FAILED',

  // --- Configuration errors ---
  /** Invalid session configuration provided */
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  /** Response object not available for cookie operations */
  MISSING_RESPONSE = 'MISSING_RESPONSE',

  // --- Deferred mode errors ---
  /** Attempted to flush when deferred mode is not enabled */
  DEFERRED_MODE_NOT_ENABLED = 'DEFERRED_MODE_NOT_ENABLED',

  // --- Wristband-specific errors ---
  /** Invalid or missing callback data from Wristband authentication */
  CALLBACK_DATA_INVALID = 'CALLBACK_DATA_INVALID',
  /** Attempted operation that requires authenticated session */
  SESSION_NOT_AUTHENTICATED = 'SESSION_NOT_AUTHENTICATED',
  /** Custom fields provided to fromCallback are not JSON-serializable */
  CUSTOM_FIELDS_NOT_SERIALIZABLE = 'CUSTOM_FIELDS_NOT_SERIALIZABLE',
}

/**
 * Error class for all session-related operations.
 *
 * Wraps internal errors (like SessionCryptoError) to provide a clean public API
 * while preserving debugging information through the error cause chain.
 *
 * @example
 * ```typescript
 * try {
 *   await session.save();
 * } catch (error) {
 *   if (error instanceof SessionError) {
 *     console.error('Session error:', error.code);
 *     console.error('Message:', error.message);
 *
 *     // For debugging, inspect the underlying cause
 *     if (error.cause) {
 *       console.error('Caused by:', error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class SessionError extends Error {
  public readonly code: SessionErrorCode;
  public readonly cause?: Error;

  /**
   * Create a new SessionError.
   *
   * @param code - The error code identifying the failure type
   * @param message - Human-readable error message
   * @param cause - Optional underlying error for debugging
   */
  constructor(code: SessionErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'SessionError';
    this.code = code;

    if (cause) {
      this.cause = cause;
    }

    // Maintain proper stack trace (V8 engines only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionError);
    }
  }

  /**
   * Returns a JSON-serializable representation of the error. The cause is omitted deliberately
   * to avoid leaking internal details.
   *
   * @returns Object containing error code and message (excludes cause for security)
   *
   * @example
   * ```typescript
   * catch (error) {
   *   if (error instanceof SessionError) {
   *     console.log(JSON.stringify(error)); // Uses toJSON()
   *     // Output: {"code":"SESSION_SAVE_FAILED","message":"Failed to save session"}
   *   }
   * }
   * ```
   */
  toJSON(): { code: SessionErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}

/**
 * Error codes for SessionCrypto operations.
 *
 * Provides structured identifiers for cryptographic failures without
 * exposing sensitive internal implementation details.
 */
export enum SessionCryptoErrorCode {
  // --- Input validation ---
  /** The provided secret is missing, too short, or invalid. */
  INVALID_SECRET = 'INVALID_SECRET',
  /** The provided list of secrets is not an array, empty, or contains too many items. */
  INVALID_SECRETS_LIST = 'INVALID_SECRETS_LIST',
  /** The maxAge value is not a positive number or is otherwise invalid. */
  INVALID_MAX_AGE = 'INVALID_MAX_AGE',

  // --- Session/cookie structural errors ---
  /** The session cookie exceeds the maximum allowed size (4KB). */
  SESSION_TOO_LARGE = 'SESSION_TOO_LARGE',
  /** The session cookie is malformed or cannot be parsed correctly. */
  MALFORMED_SESSION = 'MALFORMED_SESSION',
  /** The session cookie version is unsupported by this SDK version. */
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',

  // --- TTL / authentication errors ---
  /** The session has expired based on the embedded timestamp and maxAge. */
  EXPIRED = 'EXPIRED',
  /** Authentication failed (e.g., data tampering detected, wrong secret). */
  AUTH_FAILED = 'AUTH_FAILED',

  // --- Crypto operation failures ---
  /** Decryption failed due to an internal cryptographic error. */
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  /** Encryption failed due to an internal cryptographic error. */
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',

  // --- Node.js specific ---
  /** Node.js crypto module is required but unavailable (sync methods). */
  NODE_CRYPTO_UNAVAILABLE = 'NODE_CRYPTO_UNAVAILABLE',
}

/**
 * Error class for cryptographic operations.
 *
 * Internal error type used by SessionCrypto for encryption/decryption failures.
 * These errors are typically wrapped in SessionError before being exposed to users,
 * but can be inspected via the error cause chain for debugging.
 *
 * @internal
 *
 * @example
 * ```typescript
 * try {
 *   await SessionCrypto.decrypt(data, secret, maxAge);
 * } catch (error) {
 *   if (error instanceof SessionCryptoError) {
 *     console.error('Crypto error:', error.code);
 *     if (error.cause) {
 *       console.error('Caused by:', error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class SessionCryptoError extends Error {
  public readonly code: SessionCryptoErrorCode;
  public readonly cause?: Error;

  /**
   * Create a new SessionCryptoError.
   *
   * @param code - The error code identifying the failure type
   * @param message - Human-readable error message (defaults to code if not provided)
   * @param cause - Optional underlying error for debugging
   */
  constructor(code: SessionCryptoErrorCode, message?: string, cause?: unknown) {
    super(message ?? code);

    this.name = 'SessionCryptoError';
    this.code = code;

    if (cause) {
      this.cause = cause instanceof Error ? cause : new Error(String(cause));
    }

    // Maintain proper stack trace (V8 engines only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionCryptoError);
    }
  }
}
