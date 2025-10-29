/**
 * Cookie parsing and serialization utilities
 */
import { CookieOptions } from '../types';

const EPOCH_EXPIRATION_TIMESTAMP = 'Thu, 01 Jan 1970 00:00:00 GMT';

export class CookieParser {
  /**
   * Parse cookie header string into key-value pairs
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
   * Serialize cookie with options into Set-Cookie header value
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
   * Create a cookie for session destruction
   */
  static createDestroyCookie(name: string, options: CookieOptions): string {
    return this.serialize(name, '', { ...options, maxAge: 0 });
  }
}
