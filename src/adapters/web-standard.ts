import { BaseAdapter } from './base';
import { NO_CACHE_HEADERS } from '../core/constants';
import { CookieParser } from '../core/cookie-parser';
import { SessionError, SessionErrorCode } from '../error';
import { CookieOptions } from '../types';

/**
 * Web standard Request/Response adapter for platform-agnostic session management.
 *
 * Provides cookie reading and writing capabilities using the standard Web API
 * Request and Response objects. This adapter works in any environment that supports
 * the Web Standards (e.g., Cloudflare Workers, Deno, modern edge runtimes).
 *
 * @internal
 */
export class WebStandardAdapter extends BaseAdapter {
  declare protected request: Request;
  declare protected response: Response | undefined;

  /**
   * Reads a cookie value from the incoming request.
   *
   * Parses the Cookie header from the request and extracts the value
   * for the specified cookie name.
   *
   * @param cookieName - Name of the cookie to read
   * @returns The cookie value if found, undefined otherwise
   *
   * @internal
   */
  readCookie(cookieName: string): string | undefined {
    const cookieHeader = this.request.headers.get('cookie');

    if (!cookieHeader) {
      return undefined;
    }

    const cookies = CookieParser.parse(cookieHeader);
    return cookies[cookieName];
  }

  /**
   * Writes a cookie to the outgoing response.
   *
   * Serializes the cookie with the provided options and appends it to the
   * Set-Cookie header of the response.
   *
   * @param cookieName - Name of the cookie to write
   * @param value - Cookie value to set
   * @param options - Cookie options (domain, path, secure, etc.)
   * @throws {SessionError} If no response object is available for writing cookies
   *
   * @internal
   */
  writeCookie(cookieName: string, value: string, options: CookieOptions): void {
    if (!this.canWriteCookies()) {
      throw new SessionError(SessionErrorCode.MISSING_RESPONSE, 'No response object available for writing cookies');
    }

    const response = this.response as Response;
    const cookieString = CookieParser.serialize(cookieName, value, options);
    response.headers.append('set-cookie', cookieString);
  }

  /**
   * Writes the no-cache headers to the outgoing response.
   *
   * Sets Cache-Control and Pragma so that a response carrying session cookies is never
   * stored by the browser or a shared cache. Called whenever session cookies are written.
   * Uses headers.set, so calling it more than once does not create duplicate headers.
   *
   * @throws {SessionError} If no response object is available for writing headers
   *
   * @internal
   */
  writeNoCacheHeaders(): void {
    if (!this.canWriteCookies()) {
      throw new SessionError(SessionErrorCode.MISSING_RESPONSE, 'No response object available for writing headers');
    }

    const response = this.response as Response;
    Object.entries(NO_CACHE_HEADERS).forEach(([name, value]) => {
      response.headers.set(name, value);
    });
  }

  /**
   * Checks if cookies can be written to the response.
   *
   * Verifies that a response object exists and has a writable headers object.
   *
   * @returns True if cookies can be written, false otherwise
   *
   * @internal
   */
  canWriteCookies(): boolean {
    return this.response !== undefined && typeof this.response.headers?.set === 'function';
  }
}
