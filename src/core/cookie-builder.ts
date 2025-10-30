import { CookieOptions, NormalizedSessionOptions } from '../types';

/**
 * Factory class for building cookie option configurations.
 * 
 * Provides consistent cookie configuration builders for different cookie types
 * (session cookies, CSRF cookies) and operations (creation, deletion).
 * Ensures proper security settings like HttpOnly flags are applied correctly.
 * 
 * @internal
 */
export class CookieBuilder {
  /**
   * Build cookie options for session cookies.
   * 
   * Creates a cookie configuration with HttpOnly set to true to prevent
   * JavaScript access, which protects session data from XSS attacks.
   * Applies maxAge, path, domain, secure, and sameSite settings from
   * the session configuration.
   * 
   * @param options - Normalized session configuration
   * @returns Cookie options for session cookie creation
   * 
   * @example
   * ```typescript
   * const cookieOptions = CookieBuilder.forSession({
   *   maxAge: 3600,
   *   path: '/',
   *   secure: true,
   *   sameSite: 'lax',
   *   domain: '.example.com'
   * });
   * // Returns: { maxAge: 3600, path: '/', secure: true, httpOnly: true, sameSite: 'lax', domain: '.example.com' }
   * ```
   */
  static forSession(options: NormalizedSessionOptions): CookieOptions {
    const cookieOptions: CookieOptions = {
      maxAge: options.maxAge,
      path: options.path,
      secure: options.secure,
      httpOnly: true, // Session cookies shouldn't be accessible by Javascript
      sameSite: options.sameSite
    };
    
    if (options.domain !== undefined) {
      cookieOptions.domain = options.domain;
    }
    
    return cookieOptions;
  }

  /**
   * Build cookie options for CSRF token cookies.
   * 
   * Creates a cookie configuration with HttpOnly set to false, allowing
   * JavaScript to read the CSRF token so it can be included in request
   * headers for CSRF validation.
   * 
   * Uses `csrfCookieDomain` if specified, otherwise falls back to the
   * session cookie domain setting.
   * 
   * @param options - Normalized session configuration
   * @returns Cookie options for CSRF cookie creation
   * 
   * @example
   * ```typescript
   * const cookieOptions = CookieBuilder.forCsrf({
   *   maxAge: 3600,
   *   path: '/',
   *   secure: true,
   *   sameSite: 'lax',
   *   domain: '.example.com' // value of `csrfCookieDomain`
   * });
   * // Returns: { maxAge: 3600, path: '/', secure: true, httpOnly: false, sameSite: 'lax', domain: '.example.com' }
   * ```
   */
  static forCsrf(options: NormalizedSessionOptions): CookieOptions {
    const cookieOptions: CookieOptions = {
      maxAge: options.maxAge,
      path: options.path,
      secure: options.secure,
      httpOnly: false,
      sameSite: options.sameSite
    };
    
    if (options.csrfCookieDomain !== undefined) {
      cookieOptions.domain = options.csrfCookieDomain;
    }
    
    return cookieOptions;
  }

  /**
   * Build cookie options for deleting session cookies.
   * 
   * Creates a cookie configuration with maxAge set to 0, which instructs
   * the browser to delete the cookie. Path and domain must match the
   * original session cookie for deletion to work correctly.
   * 
   * HttpOnly is set to true to match the original session cookie settings.
   * 
   * @param options - Normalized session configuration
   * @returns Cookie options for session cookie deletion
   * 
   * @example
   * ```typescript
   * const cookieOptions = CookieBuilder.forSessionDestroy({
   *   path: '/',
   *   secure: true,
   *   sameSite: 'lax',
   *   domain: '.example.com'
   * });
   * // Returns: { maxAge: 0, path: '/', secure: true, httpOnly: true, sameSite: 'lax', domain: '.example.com' }
   * ```
   */
  static forSessionDestroy(options: NormalizedSessionOptions): CookieOptions {
    const destroyOptions: CookieOptions = {
      path: options.path,
      maxAge: 0,
      secure: options.secure,
      httpOnly: true,
      sameSite: options.sameSite
    };
    
    if (options.domain !== undefined) {
      destroyOptions.domain = options.domain;
    }
    
    return destroyOptions;
  }

  /**
   * Build cookie options for deleting CSRF token cookies.
   * 
   * Creates a cookie configuration with maxAge set to 0, which instructs
   * the browser to delete the cookie. Path and domain must match the
   * original CSRF cookie for deletion to work correctly.
   * 
   * HttpOnly is set to false to match the original CSRF cookie settings.
   * 
   * @param options - Normalized session configuration
   * @returns Cookie options for CSRF cookie deletion
   * 
   * @example
   * ```typescript
   * const cookieOptions = CookieBuilder.forCsrfDestroy({
   *   path: '/',
   *   secure: true,
   *   sameSite: 'lax',
   *   csrfCookieDomain: '.example.com'
   * });
   * // Returns: { maxAge: 0, path: '/', secure: true, httpOnly: false, sameSite: 'lax', domain: '.example.com' }
   * ```
   */
  static forCsrfDestroy(options: NormalizedSessionOptions): CookieOptions {
    const destroyOptions: CookieOptions = {
      path: options.path,
      maxAge: 0,
      secure: options.secure,
      httpOnly: false,
      sameSite: options.sameSite
    };
    
    if (options.csrfCookieDomain !== undefined) {
      destroyOptions.domain = options.csrfCookieDomain;
    }
    
    return destroyOptions;
  }
}
