/**
 * Web Crypto API utilities for session encryption/decryption
 */
import { Base64 } from './base64';
import { SessionData } from '../types';
import { SessionCryptoError, SessionCryptoErrorCode } from '../error';

// Load Node's crypto module (required for synchronous methods in this class)
let nodeCrypto: typeof import('crypto') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  nodeCrypto = require('node:crypto');
} catch {
  // Node crypto not available (Edge/browser environment)
  nodeCrypto = null;
}

// Ensure we're using Web Crypto API across all environments
const webCrypto = globalThis.crypto;
if (!webCrypto?.subtle) {
  throw new SessionCryptoError(
    SessionCryptoErrorCode.NODE_CRYPTO_UNAVAILABLE,
    'Web Crypto API is not available. This environment requires global crypto.subtle support.'
  );
}

/**
 * Cryptographic utilities for secure session cookie encryption and decryption.
 * 
 * Provides both asynchronous (Web Crypto API) and synchronous (Node.js crypto) methods
 * for encrypting session data into tamper-proof, time-limited cookies. Uses AES-256-GCM
 * authenticated encryption with HKDF key derivation for maximum security.
 * 
 * @remarks
 * **Security Features:**
 * - AES-256-GCM authenticated encryption (confidentiality + integrity in one operation)
 * - HKDF-SHA256 key derivation with domain separation
 * - Random 96-bit IV per encryption (never reused)
 * - 128-bit authentication tag for tamper detection
 * - Timestamp-based TTL validation with clock skew tolerance
 * - Support for zero-downtime secret rotation
 * 
 * **Cross-Platform Compatibility:**
 * - Async methods: Node.js 20+, Deno, Bun, Cloudflare Workers, browsers
 * - Sync methods: Node.js only (uses native crypto module)
 * - Binary format is identical across all platforms for seamless interoperability
 * 
 * **Binary Cookie Format:**
 * ```
 * [version:1][timestamp:8][iv:12][encrypted_data + auth_tag:variable]
 * ```
 * All values are base64-encoded for safe cookie storage.
 * 
 * @example
 * ```typescript
 * // Async encryption (works everywhere)
 * const sessionData = { userId: '123', role: 'admin' };
 * const encrypted = await SessionCrypto.encrypt(sessionData, secret);
 * 
 * // Async decryption with TTL validation (1 hour)
 * const decrypted = await SessionCrypto.decrypt(encrypted, secret, 3600000);
 * 
 * // Sync encryption (Node.js only, for middleware)
 * const encrypted = SessionCrypto.encryptSync(sessionData, secret);
 * 
 * // Secret rotation support
 * const decrypted = await SessionCrypto.decryptWithSecrets(
 *   encrypted, 
 *   [newSecret, oldSecret], 
 *   3600000
 * );
 * ```
 * 
 * @see {@link https://tools.ietf.org/html/rfc5869 | RFC 5869 - HKDF}
 * @see {@link https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf | NIST SP 800-38D - GCM}
 */
export class SessionCrypto {
  /** AES-GCM algorithm identifier */
  private static readonly ALGORITHM = 'AES-GCM';
  /** HKDF info parameter for domain separation */
  private static readonly INFO = 'aes-gcm-encryption';
  /** AES key length in bits (256-bit security) */
  private static readonly KEY_LENGTH = 256;
  /** HKDF salt for key derivation (version-specific) */
  private static readonly SALT = 'wristband-session-v1';
  /** Clock skew tolerance in milliseconds (60 seconds) */
  private static readonly TIMESTAMP_SKEW_MS = 60000;
  /** Binary format version for future compatibility */
  private static readonly VERSION = 1;

  // Maximum size: 4KB browser cookie limit
  private static readonly MAX_SESSION_SIZE_BYTES = 4096;
  // Minimum size: version(1) + timestamp(8) + iv(12) + tag(16) + empty "{}"(2) = 39 bytes minimum
  private static readonly MIN_SESSION_SIZE_BYTES = 39;

  /** Reusable text encoder instance */
  private static readonly encoder = new TextEncoder();
  /** Reusable text decoder instance */
  private static readonly decoder = new TextDecoder();

  /**
   * Derive a CryptoKey from a secret string using HKDF-SHA256.
   * 
   * HKDF (HMAC-based Key Derivation Function, RFC 5869) is the standard approach
   * for deriving cryptographic keys from high-entropy secrets. While HMAC-SHA256
   * alone would be functionally secure for this purpose, HKDF provides:
   * 
   * 1. **Standardization** - RFC 5869 is the accepted standard for key derivation
   * 2. **Clear semantics** - Explicitly designed for key derivation, not message authentication
   * 3. **Domain separation** - The `info` parameter prevents derived keys from being
   *    reused across different contexts (e.g., encryption vs signing)
   * 4. **Future-proofing** - Easy to derive multiple independent keys from one secret
   * 
   * For session cookies with 32+ character secrets, the security difference between
   * HKDF and raw HMAC is negligible, but HKDF is considered best practice.
   * 
   * Note: We use a single derived key with AES-GCM (authenticated encryption), which
   * handles both confidentiality and integrity in one operation. No separate MAC key
   * is needed, unlike older approaches (AES-CBC + HMAC) which require two keys.
   * 
   * @param secret - High-entropy secret (min 32 chars, validated elsewhere)
   * @returns CryptoKey suitable for AES-GCM encryption/decryption
   * @throws {SessionCryptoError} If key derivation fails.
   * 
   * @see https://tools.ietf.org/html/rfc5869 - HKDF specification
   */
  private static async deriveKey(secret: string): Promise<CryptoKey> {
    this.validateSecret(secret);

    try {
      // Import secret as HKDF base key
      const secretBytes = this.encoder.encode(secret);
      const baseKey = await webCrypto.subtle.importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
      
      // Use HKDF to derive AES-GCM key
      const salt = this.encoder.encode(this.SALT);
      const info = this.encoder.encode(this.INFO);
      
      return webCrypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        baseKey,
        { name: this.ALGORITHM, length: this.KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new SessionCryptoError(
        SessionCryptoErrorCode.ENCRYPTION_FAILED,
        'Failed to derive encryption key from secret',
      );
    }
  }

  /**
   * Asynchronously encrypt session data into a secure, base64-encoded cookie value.
   * 
   * Uses AES-256-GCM authenticated encryption with a randomly generated IV for each
   * encryption operation. The resulting cookie includes version metadata, encryption
   * timestamp, IV, and encrypted data with authentication tag.
   * 
   * This method works across all JavaScript environments (Node.js, Deno, Bun, 
   * Cloudflare Workers, browsers) using the Web Crypto API.
   * 
   * @param data - Session data object to encrypt (will be JSON-serialized)
   * @param secret - High-entropy secret string (minimum 32 characters recommended)
   * @returns Promise resolving to base64-encoded encrypted cookie string
   * @throws {SessionCryptoError} If encryption fails or Web Crypto API is unavailable
   * 
   * @remarks
   * - Generates a fresh random 96-bit IV for each encryption (never reuses IVs)
   * - Embeds current timestamp for TTL validation during decryption
   * - Output is safe for HTTP cookie storage (base64-encoded, no special characters)
   * - Maximum practical size is ~2.7KB of session data (4KB cookie limit minus overhead)
   * 
   * @example
   * ```typescript
   * const session = { userId: '123', roles: ['admin'], loginTime: Date.now() };
   * const secret = process.env.SESSION_SECRET; // min 32 chars
   * const encryptedCookie = await SessionCrypto.encrypt(session, secret);
   * // Returns: "AQABkx7f2g...base64..." (ready for Set-Cookie header)
   * ```
   * 
   * @see {@link decrypt} for decryption and TTL validation
   * @see {@link encryptSync} for synchronous Node.js version
   */
  static async encrypt(data: SessionData, secret: string): Promise<string> {
    this.validateSessionData(data);
    this.validateSecret(secret);

    try {
      const key = await this.deriveKey(secret);
      const iv = webCrypto.getRandomValues(new Uint8Array(12));
      
      let dataBytes;
      try {
        dataBytes = this.encoder.encode(JSON.stringify(data));
      } catch (error) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.ENCRYPTION_FAILED,
          'Session data must be JSON-serializable'
        );
      }
      if (dataBytes.length > 4096) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.SESSION_TOO_LARGE,
          `Session data too large: ${dataBytes.length} bytes`
        );
      }
      
      const encrypted = await webCrypto.subtle.encrypt(
        { name: this.ALGORITHM, iv, tagLength: 128 },
        key,
        dataBytes.buffer
      );

      // Create compact binary format: [version(1)][timestamp(8)][iv(12)][encrypted data + tag(16)]
      // Note: Web Crypto API automatically appends the 16-byte GCM auth tag to encrypted data
      const timestamp = new Uint8Array(8);
      new DataView(timestamp.buffer).setBigUint64(0, BigInt(Date.now()), false);
      
      const combined = new Uint8Array(1 + 8 + 12 + encrypted.byteLength);
      combined[0] = this.VERSION;
      combined.set(timestamp, 1);
      combined.set(iv, 9);
      combined.set(new Uint8Array(encrypted), 21);

      // Convert to base64
      const encodedValue = Base64.encode(combined);

      // Check actual cookie size is not more than 4KB
      if (encodedValue.length > this.MAX_SESSION_SIZE_BYTES) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.SESSION_TOO_LARGE,
          `Encrypted session exceeds 4KB cookie limit: ${encodedValue.length} bytes`
        );
      }

      return encodedValue;
    } catch (error) {
      if (error instanceof SessionCryptoError) {
        throw error;
      }
      throw new SessionCryptoError(SessionCryptoErrorCode.ENCRYPTION_FAILED, 'Failed to encrypt session data');
    }
  }

  /**
   * Asynchronously decrypt and validate an encrypted session cookie.
   * 
   * Decrypts a base64-encoded session cookie, validates its authentication tag to
   * ensure integrity, and checks that the session has not expired based on the
   * embedded timestamp and provided maxAge parameter.
   * 
   * This method works across all JavaScript environments using the Web Crypto API.
   * 
   * @param encryptedValue - Base64-encoded encrypted cookie string (from {@link encrypt})
   * @param secret - Secret string used during encryption (must match)
   * @param maxAge - Maximum session age in seconds (e.g., 3600 for 1 hour)
   * @returns Promise resolving to decrypted SessionData object
   * @throws {SessionCryptoError} If decryption fails due to:
   * - Invalid base64 encoding
   * - Cookie size exceeds 4KB limit
   * - Malformed cookie structure
   * - Unsupported version number
   * - Session expired (timestamp exceeds maxAge + clock skew tolerance)
   * - Authentication tag verification failed (tampered data)
   * - Wrong secret provided
   * 
   * @remarks
   * - Includes 60-second clock skew tolerance to handle server time differences
   * - Constant-time operations prevent timing attacks
   * - Any tampering with the cookie causes authentication failure
   * - Failed decryption throws a generic error to avoid leaking information
   * 
   * @example
   * ```typescript
   * const encryptedCookie = req.cookies.session;
   * const secret = process.env.SESSION_SECRET;
   * const maxAge = 24 * 60 * 60; // 24 hours
   * 
   * try {
   *   const session = await SessionCrypto.decrypt(encryptedCookie, secret, maxAge);
   *   console.log('User ID:', session.userId);
   * } catch (err) {
   *   // Session invalid, expired, or tampered - require re-authentication
   *   res.redirect('/login');
   * }
   * ```
   * 
   * @see {@link encrypt} for encryption
   * @see {@link decryptWithSecrets} for secret rotation support
   * @see {@link decryptSync} for synchronous Node.js version
   */
  static async decrypt(encryptedValue: string, secret: string, maxAge: number): Promise<SessionData> {
    this.validateEncryptedValue(encryptedValue);
    this.validateSecret(secret);
    this.validateMaxAge(maxAge);

    try {
      // Decode base64
      const bytes = Base64.decode(encryptedValue);

      // Maximum size check (4KB browser cookie limit)
      if (bytes.length > this.MAX_SESSION_SIZE_BYTES) {
        throw new SessionCryptoError(SessionCryptoErrorCode.SESSION_TOO_LARGE, 'Session cookie exceeds 4KB limit');
      }

      // Minimum size check (39 bytes minimum)
      if (bytes.length < this.MIN_SESSION_SIZE_BYTES) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.MALFORMED_SESSION,
          'Session cookie is malformed (too small)'
        );
      }

      // Check version
      const version = bytes[0];
      if (version !== this.VERSION) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.UNSUPPORTED_VERSION,
          `Unsupported session version: ${version}`
        );
      }

      // Extract and validate timestamp for TTL
      const timestampBytes = bytes.slice(1, 9);
      const timestamp = Number(new DataView(timestampBytes.buffer).getBigUint64(0, false));
      const maxAgeMs = maxAge * 1000;
      if (Date.now() - timestamp > maxAgeMs + SessionCrypto.TIMESTAMP_SKEW_MS) {
        throw new SessionCryptoError(SessionCryptoErrorCode.EXPIRED, 'Session has expired');
      }

      // Extract components
      const iv = bytes.slice(9, 21);
      const encryptedData = bytes.slice(21);

      const key = await this.deriveKey(secret);
      
      const decrypted = await webCrypto.subtle.decrypt(
        { name: this.ALGORITHM, iv, tagLength: 128 },
        key,
        encryptedData
      );

      const jsonString = this.decoder.decode(decrypted);
      return JSON.parse(jsonString) as SessionData;
    } catch (error) {
      if (error instanceof SessionCryptoError) {
        throw error;
      }
      // Any other error (auth tag failure, wrong secret, corrupt data, JSON parse error)
      throw new SessionCryptoError(SessionCryptoErrorCode.AUTH_FAILED, 'Failed to decrypt session data');
    }
  }

  /**
   * Attempt to decrypt a session cookie using multiple secrets for zero-downtime rotation.
   * 
   * Tries each secret in order until one successfully decrypts and validates the session.
   * This enables seamless secret rotation by accepting both new and old secrets during
   * a transition period.
   * 
   * TTL validation is performed during each decryption attempt.
   * 
   * @param encryptedValue - Base64-encoded encrypted cookie string
   * @param secrets - Array of secret strings to try (typically [newSecret, oldSecret])
   * @param maxAge - Maximum session age in seconds
   * 
   * @returns Promise resolving to decrypted SessionData object
   * 
   * @throws {Error} If decryption fails with all provided secrets
   * 
   * @remarks
   * - Secrets are tried in array order (put most recent first for performance)
   * - Stops immediately on first successful decryption
   * - Failed attempts are silent - only throws if all secrets fail
   * - Useful for gradual secret rotation without user disruption
   * 
   * @example
   * ```typescript
   * // During secret rotation period
   * const NEW_SECRET = process.env.NEW_SESSION_SECRET;
   * const OLD_SECRET = process.env.OLD_SESSION_SECRET;
   * 
   * try {
   *   // Try new secret first, fall back to old secret
   *   const session = await SessionCrypto.decryptWithSecrets(
   *     encryptedCookie,
   *     [NEW_SECRET, OLD_SECRET],
   *     3600000
   *   );
   *   
   *   // Re-encrypt with new secret to migrate session
   *   const newCookie = await SessionCrypto.encrypt(session, NEW_SECRET);
   *   res.cookie('session', newCookie);
   * } catch (err) {
   *   // All secrets failed - session invalid
   *   res.redirect('/login');
   * }
   * ```
   * 
   * @see {@link decrypt} for single-secret decryption
   * @see {@link decryptWithSecretsSync} for synchronous Node.js version
   * @throws {SessionCryptoError} If decryption fails for all provided secrets.
   */
  static async decryptWithSecrets(encryptedValue: string, secrets: string[], maxAge: number): Promise<SessionData> {
    this.validateSecretsList(secrets);

    let lastError: Error | null = null;

    for (const secret of secrets) {
      try {
        return await this.decrypt(encryptedValue, secret, maxAge);
      } catch (error: unknown) {
        // Try the next secret if error encountered
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new SessionCryptoError(
      SessionCryptoErrorCode.DECRYPTION_FAILED, 
      'Failed to decrypt with provided secrets',
      lastError
    );
  }

  /**
   * Synchronously encrypt session data using Node.js native crypto module.
   * 
   * Provides identical functionality to {@link encrypt} but operates synchronously,
   * making it suitable for use in synchronous middleware contexts where async operations
   * are problematic. Uses Node.js's native crypto module with the same cryptographic
   * parameters as the async version.
   * 
   * ⚠️ **Node.js Only** - This method is only available in Node.js environments.
   * For Edge, Cloudflare Workers, Deno, Bun, or browsers, use {@link encrypt} instead.
   * 
   * Binary format is identical to async version, ensuring full cross-compatibility.
   * Sessions encrypted with this method can be decrypted with {@link decrypt} and vice versa.
   * 
   * @param data - Session data object to encrypt (will be JSON-serialized)
   * @param secret - High-entropy secret string (minimum 32 characters recommended)
   * 
   * @returns Base64-encoded encrypted cookie string
   * 
   * @throws {Error} If:
   * - Called in non-Node.js environment (no node:crypto module)
   * - Encryption operation fails
   * - Invalid input data or secret
   * 
   * @remarks
   * - Uses identical binary format to {@link encrypt}: `[version][timestamp][iv][data+tag]`
   * - Generates fresh random 96-bit IV per encryption
   * - Embeds current timestamp for TTL validation
   * - Output is cross-compatible with async methods
   * 
   * @example
   * ```typescript
   * // In Node.js middleware (synchronous context)
   * function sessionMiddleware(req, res, next) {
   *   const session = { userId: req.user.id, role: req.user.role };
   *   const secret = process.env.SESSION_SECRET;
   *   
   *   try {
   *     const encryptedCookie = SessionCrypto.encryptSync(session, secret);
   *     res.cookie('session', encryptedCookie, { 
   *       httpOnly: true, 
   *       secure: true,
   *       maxAge: 3600 
   *     });
   *     next();
   *   } catch (err) {
   *     next(err);
   *   }
   * }
   * ```
   * 
   * @see {@link encrypt} for asynchronous cross-platform version
   * @see {@link decryptSync} for synchronous decryption
   */
  static encryptSync(data: SessionData, secret: string): string {
    // Runtime require - only fails if this function is called in non-Node environment
    if (!nodeCrypto) {
      throw new SessionCryptoError(
        SessionCryptoErrorCode.NODE_CRYPTO_UNAVAILABLE,
        'encryptSync() requires Node.js crypto. Use async encrypt() for Edge/browser environments.'
      );
    }

    this.validateSessionData(data);
    this.validateSecret(secret);

    try {
      // Derive key using HKDF (sync)
      const key = nodeCrypto.hkdfSync(
        'sha256',
        secret,
        Buffer.from(this.SALT),
        Buffer.from(this.INFO),
        32 // 256 bits
      );
      const keyBuffer = Buffer.from(key);

      // Generate IV (randomBytes without callback is synchronous)
      const iv = nodeCrypto.randomBytes(12);

      // Create cipher
      const cipher = nodeCrypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

      // Encrypt
      const dataString = JSON.stringify(data);
      let encrypted = cipher.update(dataString, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get auth tag and append to encrypted data (matching Web Crypto API behavior)
      const authTag = cipher.getAuthTag();
      const encryptedWithTag = Buffer.concat([encrypted, authTag]);

      // Create compact binary format: [version(1)][timestamp(8)][iv(12)][encrypted data + tag(16)]
      const timestamp = Buffer.allocUnsafe(8);
      timestamp.writeBigUInt64BE(BigInt(Date.now()));
      const combined = Buffer.concat([
        Buffer.from([this.VERSION]),
        timestamp,
        iv,
        encryptedWithTag
      ]);

      // Convert to base64 (matching async version)
      const encodedValue = Base64.encode(new Uint8Array(combined));

      // Check actual cookie size is not more than 4KB
      if (encodedValue.length > this.MAX_SESSION_SIZE_BYTES) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.SESSION_TOO_LARGE,
          `Encrypted session exceeds 4KB cookie limit: ${encodedValue.length} bytes`
        );
      }

      return encodedValue;
    } catch (error) {
      if (error instanceof SessionCryptoError) {
        throw error;
      }
      throw new SessionCryptoError(SessionCryptoErrorCode.ENCRYPTION_FAILED, 'Failed to encrypt session data');
    }
  }

  /**
   * Synchronously decrypt and validate an encrypted session cookie using Node.js crypto.
   * 
   * Provides identical functionality to {@link decrypt} but operates synchronously using
   * Node.js's native crypto module. Suitable for synchronous middleware contexts.
   * 
   * ⚠️ **Node.js Only** - This method is only available in Node.js environments.
   * For Edge, Cloudflare Workers, Deno, Bun, or browsers, use {@link decrypt} instead.
   * 
   * Binary format is identical to async version, ensuring full cross-compatibility.
   * Can decrypt sessions created by {@link encrypt} or {@link encryptSync}.
   * 
   * @param encryptedValue - Base64-encoded encrypted cookie string
   * @param secret - Secret string used during encryption (must match)
   * @param maxAge - Maximum session age in seconds (e.g., 3600 for 1 hour)
   * 
   * @returns Decrypted SessionData object
   * 
   * @throws {Error} If:
   * - Called in non-Node.js environment (no node:crypto module)
   * - Decryption or validation fails (see {@link decrypt} for detailed failure modes)
   * - Session expired, tampered, or encrypted with different secret
   * 
   * @remarks
   * - Compatible with cookies encrypted by {@link encrypt} (cross-platform support)
   * - Includes 60-second clock skew tolerance
   * - Validates authentication tag to detect tampering
   * - Generic error messages prevent information leakage
   * 
   * @example
   * ```typescript
   * // In Node.js middleware (synchronous context)
   * function sessionMiddleware(req, res, next) {
   *   const encryptedCookie = req.cookies.session;
   *   const secret = process.env.SESSION_SECRET;
   *   const maxAge = 24 * 60 * 60; // 24 hours
   *   
   *   if (!encryptedCookie) {
   *     return res.redirect('/login');
   *   }
   *   
   *   try {
   *     req.session = SessionCrypto.decryptSync(encryptedCookie, secret, maxAge);
   *     next();
   *   } catch (err) {
   *     // Session invalid - clear cookie and redirect
   *     res.clearCookie('session');
   *     res.redirect('/login');
   *   }
   * }
   * ```
   * 
   * @see {@link decrypt} for asynchronous cross-platform version
   * @see {@link encryptSync} for synchronous encryption
   * @see {@link decryptWithSecretsSync} for secret rotation support
   */
  static decryptSync(encryptedValue: string, secret: string, maxAge: number): SessionData {
    if (!nodeCrypto) {
      throw new SessionCryptoError(
        SessionCryptoErrorCode.NODE_CRYPTO_UNAVAILABLE,
        'decryptSync() requires Node.js crypto. Use async decrypt() for Edge/browser environments.'
      );
    }

    this.validateEncryptedValue(encryptedValue);
    this.validateSecret(secret);
    this.validateMaxAge(maxAge);

    try {
      // Decode base64 (matching async version)
      const bytes = Buffer.from(Base64.decode(encryptedValue));
      
      // Validate size
      if (bytes.length > this.MAX_SESSION_SIZE_BYTES) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.SESSION_TOO_LARGE,
          'Session cookie exceeds 4KB limit'
        );
      }
      if (bytes.length < this.MIN_SESSION_SIZE_BYTES) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.MALFORMED_SESSION,
          'Session cookie is malformed (too small)'
        );
      }
      
      // Check version
      const version = bytes[0];
      if (version !== this.VERSION) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.UNSUPPORTED_VERSION,
          `Unsupported session version: ${version}`
        );
      }
      
      // Validate timestamp
      const timestamp = bytes.readBigUInt64BE(1);
      const maxAgeMs = maxAge * 1000;
      if (Date.now() - Number(timestamp) > maxAgeMs + this.TIMESTAMP_SKEW_MS) {
        throw new SessionCryptoError(SessionCryptoErrorCode.EXPIRED, 'Session has expired');
      }

      // Extract components
      const iv = bytes.subarray(9, 21);
      const encryptedDataWithTag = bytes.subarray(21);

      // Auth tag is the last 16 bytes of encryptedDataWithTag
      if (encryptedDataWithTag.length < 16) {
        throw new SessionCryptoError(
          SessionCryptoErrorCode.MALFORMED_SESSION,
          'Session cookie malformed: missing auth tag'
        );
      }

      const encryptedData = encryptedDataWithTag.subarray(0, -16);
      const authTag = encryptedDataWithTag.subarray(-16);
      
      // Derive key
      const key = nodeCrypto.hkdfSync(
        'sha256',
        secret,
        Buffer.from(this.SALT),
        Buffer.from(this.INFO),
        32
      );
      const keyBuffer = Buffer.from(key);
      
      // Decrypt
      const decipher = nodeCrypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted: string = decipher.update(encryptedData, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted) as SessionData;
    } catch (error) {
      if (error instanceof SessionCryptoError) {
        throw error;
      }
      throw new SessionCryptoError(SessionCryptoErrorCode.AUTH_FAILED, 'Failed to decrypt session data');
    }
  }

  /**
   * Synchronously attempt decryption using multiple secrets for zero-downtime rotation.
   * 
   * Synchronous version of {@link decryptWithSecrets}. Tries each secret in order until
   * one successfully decrypts and validates the session. Uses Node.js native crypto module.
   * 
   * ⚠️ **Node.js Only** - This method is only available in Node.js environments.
   * 
   * @param encryptedValue - Base64-encoded encrypted cookie string
   * @param secrets - Array of secret strings to try (typically [newSecret, oldSecret])
   * @param maxAge - Maximum session age in seconds
   * 
   * @returns Decrypted SessionData object
   * 
   * @throws {Error} If decryption fails with all provided secrets or if called in non-Node.js environment
   * 
   * @remarks
   * - Secrets are tried in array order (put most recent first for best performance)
   * - Stops immediately on first successful decryption
   * - Failed attempts are silent - only throws if all secrets fail
   * - Enables gradual secret rotation without service disruption
   * 
   * @example
   * ```typescript
   * // In Node.js middleware during secret rotation
   * function sessionMiddleware(req, res, next) {
   *   const encryptedCookie = req.cookies.session;
   *   const NEW_SECRET = process.env.NEW_SESSION_SECRET;
   *   const OLD_SECRET = process.env.OLD_SESSION_SECRET;
   *   
   *   try {
   *     const session = SessionCrypto.decryptWithSecretsSync(
   *       encryptedCookie,
   *       [NEW_SECRET, OLD_SECRET],
   *       3600000
   *     );
   *     
   *     // Optionally re-encrypt with new secret to migrate session
   *     const newCookie = SessionCrypto.encryptSync(session, NEW_SECRET);
   *     res.cookie('session', newCookie, { httpOnly: true });
   *     
   *     req.session = session;
   *     next();
   *   } catch (err) {
   *     res.redirect('/login');
   *   }
   * }
   * ```
   * 
   * @see {@link decryptWithSecrets} for asynchronous cross-platform version
   * @see {@link decryptSync} for single-secret synchronous decryption
   * @throws {SessionCryptoError} If decryption fails for all provided secrets.
   */
  static decryptWithSecretsSync(encryptedValue: string, secrets: string[], maxAge: number): SessionData {
    this.validateSecretsList(secrets);

    let lastError: Error | null = null;

    for (const secret of secrets) {
      try {
        return this.decryptSync(encryptedValue, secret, maxAge);
      } catch (error: unknown) {
        // Try the next secret if error encountered
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new SessionCryptoError(
      SessionCryptoErrorCode.DECRYPTION_FAILED, 
      'Failed to decrypt with provided secrets',
      lastError
    );
  }

  /**
   * Validates a list of secrets used for encryption.
   * 
   * Ensures the input is an array containing between 1 and 3 non-empty string values.
   * Each secret should later be individually validated with {@link validateSecret}.
   *
   * @param {string[]} secrets - An array of secret strings.
   * @throws {SessionCryptoError} If the input is not an array, empty, or contains more than 3 secrets.
   */
  private static validateSecretsList(secrets: string[]): void {
    if (!secrets || !Array.isArray(secrets)) {
      throw new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRETS_LIST, 'Secrets must be an array');
    }
    if (secrets.length === 0) {
      throw new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRETS_LIST, 'At least one secret is required');
    }
    if (secrets.length > 3) {
      throw new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRETS_LIST, 'Maximum 3 secrets allowed');
    }
  }

  /**
   * Validates a single secret string for strength and format.
   * 
   * Ensures the secret is a non-empty string of sufficient length for secure usage.
   *
   * @param {string} secret - The secret string to validate.
   * @throws {SessionCryptoError} If the secret is not a string or is shorter than 32 characters.
   */
  private static validateSecret(secret: string): void {
    if (!secret || typeof secret !== 'string') {
      throw new SessionCryptoError(SessionCryptoErrorCode.INVALID_SECRET, 'Secret must be a non-empty string');
    }
    if (secret.length < 32) {
      throw new SessionCryptoError(
        SessionCryptoErrorCode.INVALID_SECRET,
        `Secret must be at least 32 characters for adequate security (current: ${secret.length})`
      );
    }
  }

  /**
   * Validates the maximum age value for token or session expiration.
   * 
   * Ensures the value is a positive number greater than zero.
   *
   * @param {number} maxAge - The maximum age (in seconds or milliseconds, depending on context).
   * @throws {SessionCryptoError} If maxAge is not a positive number.
   */
  private static validateMaxAge(maxAge: number): void {
    if (typeof maxAge !== 'number' || maxAge <= 0) {
      throw new SessionCryptoError(SessionCryptoErrorCode.INVALID_MAX_AGE, 'maxAge must be greater than 0');
    }
  }

  /**
   * Validates session data before encryption. Ensures the data is a valid plain object.
   *
   * @param {SessionData} data - The session data to validate.
   * @throws {SessionCryptoError} If the data is invalid.
   */
  private static validateSessionData(data: SessionData): void {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new SessionCryptoError(SessionCryptoErrorCode.ENCRYPTION_FAILED, 'Session data must be a plain object');
    }
  }

  /**
   * Validates an encrypted cookie value before attempting decryption.
   * 
   * Ensures the value is a non-empty string suitable for decoding.
   *
   * @param {string} encryptedValue - The encrypted cookie string to validate.
   * @throws {SessionCryptoError} If the value is invalid.
   */
  private static validateEncryptedValue(encryptedValue: string): void {
    if (!encryptedValue || typeof encryptedValue !== 'string') {
      throw new SessionCryptoError(
        SessionCryptoErrorCode.MALFORMED_SESSION,
        'Encrypted value must be a non-empty string'
      );
    }
  }
}
