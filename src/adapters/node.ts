import type { IncomingMessage, ServerResponse } from 'http';

import { BaseAdapter } from './base';
import { SessionError, SessionErrorCode } from '../error';
import { NO_CACHE_HEADERS } from '../core/constants';
import { CookieParser } from '../core/cookie-parser';
import { CookieOptions } from '../types';

/**
 * Node.js IncomingMessage/ServerResponse adapter for native HTTP server integration.
 *
 * Provides cookie reading and writing capabilities using Node.js native HTTP
 * IncomingMessage and ServerResponse objects. This adapter works with Node.js
 * HTTP servers, Express (without middleware), and other Node.js HTTP frameworks.
 *
 * @internal
 */
export class NodeAdapter extends BaseAdapter {
  declare protected request: IncomingMessage;
  declare protected response: ServerResponse | undefined;

  /**
   * Reads a cookie value from the incoming request.
   *
   * Parses the Cookie header from the Node.js IncomingMessage and extracts
   * the value for the specified cookie name.
   *
   * @param cookieName - Name of the cookie to read
   * @returns The cookie value if found, undefined otherwise
   *
   * @internal
   */
  readCookie(cookieName: string): string | undefined {
    const cookieHeader = this.request.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }

    const cookies = CookieParser.parse(cookieHeader);
    return cookies[cookieName];
  }

  /**
   * Writes a cookie to the outgoing response.
   *
   * Serializes the cookie with the provided options and sets it in the
   * Set-Cookie header. Handles multiple Set-Cookie headers by appending
   * to any existing cookies rather than overwriting them.
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

    const response = this.response as ServerResponse;
    const cookieString = CookieParser.serialize(cookieName, value, options);

    // Handle multiple Set-Cookie headers
    const existingCookies = response.getHeader('set-cookie');
    if (existingCookies) {
      const cookieArray = Array.isArray(existingCookies) ? existingCookies.map(String) : [String(existingCookies)];
      response.setHeader('set-cookie', [...cookieArray, cookieString]);
    } else {
      response.setHeader('set-cookie', cookieString);
    }
  }

  /**
   * Writes the no-cache headers to the outgoing response.
   *
   * Sets Cache-Control and Pragma so that a response carrying session cookies is never
   * stored by the browser or a shared cache. Called whenever session cookies are written.
   * Uses setHeader, so calling it more than once does not create duplicate headers.
   *
   * @throws {SessionError} If no response object is available for writing headers
   *
   * @internal
   */
  writeNoCacheHeaders(): void {
    if (!this.canWriteCookies()) {
      throw new SessionError(SessionErrorCode.MISSING_RESPONSE, 'No response object available for writing headers');
    }

    const response = this.response as ServerResponse;
    Object.entries(NO_CACHE_HEADERS).forEach(([name, value]) => {
      response.setHeader(name, value);
    });
  }

  /**
   * Checks if cookies can be written to the response.
   *
   * Verifies that a response object exists and has a setHeader method.
   * Note: Does not check if headers have already been sent to allow for
   * more flexible usage patterns.
   *
   * @returns True if cookies can be written, false otherwise
   *
   * @internal
   */
  canWriteCookies(): boolean {
    return this.response !== undefined && typeof this.response.setHeader === 'function';
  }
}
