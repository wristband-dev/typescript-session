import { SessionError, SessionErrorCode } from '../error';
import { NormalizedSessionOptions, SameSiteOption, SessionOptions } from '../types';

const DEFAULT_CSRF_COOKIE_NAME = 'CSRF-TOKEN';
const DEFAULT_CSRF_PROTECTION_ENABLED = false;
const DEFAULT_MAX_AGE = 3600; // 1 hour
const DEFAULT_PATH = '/';
const DEFAULT_SAME_SITE = 'Lax';
const DEFAULT_SECURE = true;
const DEFAULT_SESSION_COOKIE_NAME = 'session';
const MAX_SECRETS_ALLOWED = 3;
const MIN_SECRET_LENGTH = 32;
const VALID_SAME_SITE_VALUES = ['lax', 'strict', 'none', 'Lax', 'Strict', 'None'];

/**
 * Normalizes session options by filling in defaults for missing values.
 * 
 * Applies default values for all optional configuration parameters and handles
 * the special case of csrfCookieDomain falling back to domain if not specified.
 * 
 * @param options - User-provided session options
 * @returns Fully populated options object with defaults applied
 * 
 * @internal
 */
function normalizeOptions(options: SessionOptions): NormalizedSessionOptions {
  const normalized: NormalizedSessionOptions = {
    cookieName: options.cookieName ?? DEFAULT_SESSION_COOKIE_NAME,
    secrets: options.secrets,
    maxAge: options.maxAge ?? DEFAULT_MAX_AGE,
    path: options.path ?? DEFAULT_PATH,
    secure: options.secure ?? DEFAULT_SECURE,
    sameSite: normalizeSameSite(options.sameSite),
    csrfCookieName: options.csrfCookieName ?? DEFAULT_CSRF_COOKIE_NAME,
    enableCsrfProtection: options.enableCsrfProtection ?? DEFAULT_CSRF_PROTECTION_ENABLED,
  };

  if (options.domain !== undefined) {
    normalized.domain = options.domain;
  }

  // CSRF domain falls back to session domain.
  // Only set if either csrfCookieDomain or domain is provided.
  if (options.csrfCookieDomain !== undefined) {
    normalized.csrfCookieDomain = options.csrfCookieDomain;
  } else if (options.domain !== undefined) {
    normalized.csrfCookieDomain = options.domain;
  }
  
  return normalized;
}

/**
 * Normalizes the sameSite cookie attribute to RFC-compliant title case format.
 * 
 * Accepts both lowercase ('lax', 'strict', 'none') and title case ('Lax', 'Strict', 'None')
 * values for developer convenience, and normalizes them to the RFC 6265 standard title case
 * format required for Set-Cookie headers.
 * 
 * @param sameSite - The sameSite value to normalize. Accepts 'Lax', 'Strict', 'None', 
 *                   'lax', 'strict', or 'none'. If undefined, returns the default value.
 * @returns The normalized sameSite value in title case ('Lax', 'Strict', or 'None')
 * @throws {SessionError} If the provided value is not one of the accepted values
 * 
 * @example
 * ```typescript
 * normalizeSameSite('lax')     // Returns: 'Lax'
 * normalizeSameSite('Strict')  // Returns: 'Strict'
 * normalizeSameSite()          // Returns: 'Lax' (default)
 * normalizeSameSite('NONE')    // Throws: SessionError
 * ```
 * 
 * @internal
 */
function normalizeSameSite(sameSite?: SameSiteOption | 'lax' | 'strict' | 'none'): SameSiteOption {
  if (!sameSite) {
    return DEFAULT_SAME_SITE;
  }

  if (!VALID_SAME_SITE_VALUES.includes(sameSite)) {
    throw new SessionError(
      SessionErrorCode.INVALID_CONFIGURATION,
      `Invalid sameSite value: ${sameSite}. Expected 'Lax', 'Strict', or 'None'.`
    );
  }

  return (sameSite.charAt(0).toUpperCase() + sameSite.slice(1).toLowerCase()) as SameSiteOption;
}

/**
 * Validates session options for security and correctness.
 * 
 * Ensures that:
 * - At least one secret is provided
 * - No more than 3 secrets for key rotation
 * - All secrets are non-empty strings of at least 32 characters
 * - sameSite is one of 'Lax', 'Strict', or 'None' (case-insensitive)
 * - maxAge is positive
 * 
 * @param options - Normalized session options to validate
 * @throws {SessionError} If validation fails
 * 
 * @internal
 */
function validateOptions(options: NormalizedSessionOptions): void {
  const secrets = Array.isArray(options.secrets) ? options.secrets : [options.secrets];
  
  if (secrets.length === 0) {
    throw new SessionError(SessionErrorCode.INVALID_CONFIGURATION, 'At least one secret is required');
  }
  
  if (secrets.length > MAX_SECRETS_ALLOWED) {
    throw new SessionError(
      SessionErrorCode.INVALID_CONFIGURATION,
      `Maximum ${MAX_SECRETS_ALLOWED} secrets allowed for rotation`
    );
  }
  
  for (const secret of secrets) {
    if (typeof secret !== 'string' || secret.length === 0) {
      throw new SessionError(SessionErrorCode.INVALID_CONFIGURATION, 'All secrets must be non-empty strings');
    }
    
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new SessionError(
        SessionErrorCode.INVALID_CONFIGURATION,
        `Secrets must be at least ${MIN_SECRET_LENGTH} characters long for security`
      );
    }
  }

  if (options.maxAge <= 0) {
    throw new SessionError(SessionErrorCode.INVALID_CONFIGURATION, 'maxAge must be greater than 0');
  }
}

/**
 * Prepares session configuration options by normalizing defaults and validating correctness.
 * 
 * This function combines normalization and validation into a single step:
 * - Fills in default values for missing optional fields (e.g., `maxAge`, `secure`, `sameSite`)
 * - Ensures that all required parameters are provided and secure (e.g., valid secrets, positive `maxAge`)
 * - Applies RFC-compliant formatting to certain attributes (such as `SameSite`)
 * 
 * Use this as the single entry point for processing developer-supplied session configuration
 * before initializing session handling. It guarantees that the returned options object is
 * complete, valid, and safe for use by the SDK.
 * 
 * @param options - The user-provided session configuration object.
 * @returns A fully validated and normalized `NormalizedSessionOptions` object ready for use.
 * @throws {SessionError} If any configuration value is invalid or insecure.
 * 
 * @example
 * ```typescript
 * const options = prepareOptions({
 *   secrets: ['supersecretkey'],
 *   enableCsrfProtection: true
 * });
 * 
 * // Returns:
 * // {
 * //   cookieName: 'session',
 * //   secrets: ['supersecretkey'],
 * //   maxAge: 3600,
 * //   path: '/',
 * //   secure: true,
 * //   sameSite: 'Lax',
 * //   csrfCookieName: 'CSRF-TOKEN',
 * //   enableCsrfProtection: true
 * // }
 * ```
 * 
 * @internal
 */
export function prepareOptions(options: SessionOptions): NormalizedSessionOptions {
  const normalized = normalizeOptions(options);
  validateOptions(normalized);
  return normalized;
}
