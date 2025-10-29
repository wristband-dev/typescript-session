/**
 * CSRF token generation utilities
 */
import { SessionError, SessionErrorCode } from './error';

const webCrypto = globalThis.crypto;
if (!webCrypto) {
  throw new SessionError(
    SessionErrorCode.INVALID_CONFIGURATION,
    'Web Crypto API is not available. CSRF protection requires crypto support.'
  );
}

/**
 * Generate a cryptographically secure CSRF token.
 * 
 * Creates a 64-character hexadecimal string (256 bits of entropy) suitable for CSRF protection.
 * Uses the Web Crypto API's cryptographically secure random number generator.
 * 
 * @returns A 64-character hexadecimal CSRF token
 * 
 * @example
 * ```typescript
 * const token = createCsrfToken();
 * // "a3f7b2c9d4e5f6a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5"
 * ```
 */
export function createCsrfToken(): string {
  // Create a typed array to hold 32 random bytes (256 bits)
  const array = new Uint8Array(32);

  // Fill the array with cryptographically secure random values
  webCrypto.getRandomValues(array);

  // Convert each byte to a 2-character hexadecimal string
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
