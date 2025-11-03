import { CookieOptions } from '../types';

const EPOCH_EXPIRATION_TIMESTAMP = 'Thu, 01 Jan 1970 00:00:00 GMT';

/**
 * Utility class for parsing and serializing HTTP cookies.
 * 
 * Handles cookie header parsing from requests and cookie serialization
 * for Set-Cookie headers in responses, following RFC 6265 standards.
 * 
 * @internal
 */
export class CookieParser {
  /**
   * Parse a Cookie header string into key-value pairs.
   * 
   * Splits the cookie header by semicolons and decodes cookie values.
   * Handles empty headers and malformed cookie strings gracefully.
   * 
   * @param cookieHeader - Raw Cookie header string from HTTP request (e.g., "session=abc123; theme=dark")
   * @returns Object mapping cookie names to their decoded values
   * 
   * @example
   * ```typescript
   * const cookies = CookieParser.parse('session=abc123; theme=dark');
   * console.log(cookies); // { session: 'abc123', theme: 'dark' }
   * ```
   */
  static parse(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    if (!cookieHeader) {return cookies;}
    
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.trim().split('=');
      if (name && rest.length > 0) {
        cookies[name] = decodeURIComponent(rest.join('='));
      }
    });
    
    return cookies;
  }

  /**
   * Serialize a cookie name, value, and options into a Set-Cookie header value.
   * 
   * Creates a properly formatted Set-Cookie header string following RFC 6265.
   * URL-encodes the cookie value and includes all relevant cookie attributes
   * (Path, SameSite, Max-Age, Domain, Secure, HttpOnly).
   * 
   * When maxAge is 0, automatically adds an Expires attribute set to the epoch
   * to ensure the cookie is deleted across all browsers.
   * 
   * @param name - Cookie name (required, cannot be empty)
   * @param value - Cookie value to encode
   * @param options - Cookie configuration (path, domain, security settings, etc.)
   * @returns Formatted Set-Cookie header value ready to be sent to browser
   * @throws {Error} If name or options are missing
   * 
   * @example
   * ```typescript
   * const header = CookieParser.serialize('session', 'abc123', {
   *   path: '/',
   *   maxAge: 3600,
   *   secure: true,
   *   httpOnly: true,
   *   sameSite: 'Lax'
   * });
   * // Returns: "session=abc123; Path=/; SameSite=Lax; Max-Age=3600; Secure; HttpOnly"
   * ```
   */
  static serialize(name: string, value: string, options: CookieOptions): string {
    if (!name) {
      throw new Error('Cookie serialization missing the [name] argument');
    }
    if (!options) {
      throw new Error('Cookie serialization missing the [options] argument');
    }

    const cookieParts = [`${name}=${encodeURIComponent(value)}`];
    cookieParts.push(`Path=${options.path}`);
    cookieParts.push(`SameSite=${options.sameSite}`);
    cookieParts.push(`Max-Age=${options.maxAge}`);

    if (options.maxAge === 0) {
      // Add Expires header when deleting (maxAge=0)
      cookieParts.push(`Expires=${EPOCH_EXPIRATION_TIMESTAMP}`);
    }
    if (options.domain) {
      cookieParts.push(`Domain=${options.domain}`);
    }
    if (options.secure) {
      cookieParts.push('Secure');
    }
    if (options.httpOnly) {
      cookieParts.push('HttpOnly');
    }

    return cookieParts.join('; ');
  }

  /**
   * Create a Set-Cookie header value that deletes a cookie.
   * 
   * Convenience method that creates a cookie with an empty value and maxAge of 0,
   * which instructs the browser to delete the cookie. Also sets the Expires attribute
   * to the Unix epoch for maximum browser compatibility.
   * 
   * @param name - Name of the cookie to delete
   * @param options - Cookie options (path, domain, etc. must match the original cookie)
   * @returns Set-Cookie header value that will delete the cookie
   * 
   * @example
   * ```typescript
   * const header = CookieParser.createDestroyCookie('session', {
   *   path: '/',
   *   secure: true,
   *   httpOnly: true,
   *   sameSite: 'Lax'
   * });
   * // Returns: "session=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly"
   * ```
   */
  static createDestroyCookie(name: string, options: CookieOptions): string {
    return this.serialize(name, '', { ...options, maxAge: 0 });
  }
}
