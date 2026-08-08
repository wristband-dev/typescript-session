import { CookieBuilder } from './cookie-builder';
import { CookieParser } from './cookie-parser';
import { createCsrfToken } from './csrf';
import { SessionCrypto } from './crypto';
import { SessionError, SessionErrorCode } from '../error';
import {
  CallbackData,
  CookieOptions,
  NormalizedSessionOptions,
  Session,
  SessionAdapter,
  SessionData,
  SessionResponse,
  TokenResponse,
} from '../types';

/**
 * Internal implementation of the Session interface.
 *
 * Wraps session data in a type-safe container that provides controlled access
 * to session properties while hiding internal implementation details. The class
 * uses a private field to store data and exposes it through a Proxy, ensuring
 * that serialization methods (toJSON, toString, inspect) don't leak private fields.
 *
 * @template T - The session data type, must extend SessionData
 *
 * @internal
 *
 * @example
 * const session = new SessionImpl({ userId: "123", role: "admin" });
 * console.log(session.userId); // "123"
 * JSON.stringify(session); // Uses toJSON() method
 */
export class SessionImpl<T extends SessionData = SessionData> implements Session<T> {
  #data: T;
  #isDestroyed: boolean = false;
  #deferredMode: boolean = false;
  #needsSave: boolean = false;
  #needsDestroy: boolean = false;

  #adapter: SessionAdapter;
  #options: NormalizedSessionOptions;
  #secrets: string[];

  constructor(data: T, adapter: SessionAdapter, options: NormalizedSessionOptions) {
    this.#data = { ...data };
    this.#adapter = adapter;
    this.#options = options;
    this.#secrets = Array.isArray(options.secrets) ? options.secrets : [options.secrets];
  }

  ////////////////////////////////////
  // COMMON FUNCTIONS
  ////////////////////////////////////

  /**
   * Custom JSON serialization to hide sensitive data.
   *
   * Returns a sanitized copy of the internal data structure when the object
   * is serialized to JSON (e.g., via JSON.stringify()). This prevents exposure
   * of the private field through serialization.
   *
   * @returns {T} The internal data object
   *
   * @example
   * const obj = new SensitiveData({ apiKey: "secret", userId: 123 });
   * const json = JSON.stringify(obj); // Uses toJSON() internally
   * console.log(json); // Only shows the data, not private fields
   */
  toJSON(): T {
    return this.#data;
  }

  /**
   * Custom string representation for the session object.
   *
   * Returns the session data in JSON format for logging and debugging.
   *
   * @returns {string} The session data as a JSON string
   * @internal
   */
  toString(): string {
    return JSON.stringify(this.#data);
  }

  /**
   * Custom inspection handler for Node.js util.inspect().
   *
   * Controls how the session object appears in Node.js console output and
   * debuggers. Returns only the data object to prevent exposing internal
   * implementation details like private fields in debug output.
   *
   * @returns {T} The internal data object for inspection
   * @internal
   * @see {@link https://nodejs.org/api/util.html#custom-inspection-functions-on-objects}
   */
  [Symbol.for('nodejs.util.inspect.custom')](): T {
    return this.#data;
  }

  /**
   * Get a value from the session by key.
   *
   * @param key - The session data key to retrieve
   * @returns The value associated with the key, or undefined if not present
   *
   * @example
   * ```typescript
   * const userId = session.get('userId');
   * ```
   */
  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.#data[key];
  }

  /**
   * Set a value in the session.
   *
   * Changes are kept in memory until save() or saveToResponse() is called.
   *
   * @param key - The session data key to set
   * @param value - The value to store
   * @throws {SessionError} If session has been destroyed
   *
   * @example
   * ```typescript
   * session.set('userId', '123');
   * await session.save();
   * ```
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    if (this.#isDestroyed) {
      throw new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Cannot modify a destroyed session');
    }
    this.#data[key] = value;
  }

  /**
   * Delete a value from the session.
   *
   * Changes are kept in memory until save() or saveToResponse() is called.
   *
   * @param key - The session data key to delete
   * @throws {SessionError} If session has been destroyed
   *
   * @example
   * ```typescript
   * session.delete('tempData');
   * await session.save();
   * ```
   */
  delete<K extends keyof T>(key: K): void {
    if (this.#isDestroyed) {
      throw new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Cannot modify a destroyed session');
    }
    delete this.#data[key];
  }

  ////////////////////////////////////
  // NODE-SPECIFIC FUNCTIONS
  ////////////////////////////////////

  /**
   * Enable deferred mode for Express and similar frameworks.
   *
   * **When it's needed:**
   * In frameworks like Express, calling save() multiple times in a request (e.g., in middleware
   * + route handler) would encrypt the session data multiple times. Encryption can be expensive,
   * so doing it multiple times per request wastes CPU cycles.
   *
   * Deferred mode solves this by:
   * - Making save() only MARK the session for saving (no encryption or cookie header writes)
   * - flush() or flushSync() performs ONE encryption and cookie header at the very end
   * - No matter how many times you call save(), encryption only happens ONCE
   *
   * In deferred mode:
   * - save() and destroy() only set flags (instant, no crypto operations)
   * - flush() or flushSync() actually encrypts and writes cookies ONCE
   * - Performance improvement when save() is called multiple times in a single request
   *
   * ⚠️ Once enabled, deferred mode cannot be disabled for the session instance.
   *
   * @example
   * ```typescript
   * // Express - multiple saves, one encryption
   * app.use(async (req, res, next) => {
   *   const session = await getSession(req, res);
   *   session.enableDeferredMode();
   *   req.session = session;
   *   next();
   * });
   *
   * app.post('/resource', async (req, res) => {
   *   req.session.set('userId', '123');
   *   await req.session.save(); // Just sets flag (fast)
   *
   *   req.session.set('loginTime', Date.now());
   *   await req.session.save(); // Just sets flag (fast)
   *
   *   await req.session.flush(); // ONE encryption (only crypto operation)
   *   res.json({ success: true });
   * });
   * ```
   */
  enableDeferredMode(): void {
    this.#deferredMode = true;
  }

  /**
   * Save the session by writing cookies.
   *
   * In normal mode: Immediately encrypts and writes session cookies.
   * In deferred mode: Marks session for save; call flush() to actually write.
   *
   * For Edge/browser environments without response object access, use saveToResponse() instead.
   *
   * @throws {SessionError} If session is destroyed or no response object available.
   *
   * @example
   * ```typescript
   * // Express/Node.js
   * session.set('userId', '123');
   * await session.save();
   * ```
   */
  async save(): Promise<void> {
    // First, validate that we can save a session at all
    if (!this.#adapter.canWriteCookies()) {
      throw new SessionError(
        SessionErrorCode.MISSING_RESPONSE,
        'Cannot save session: no response object available for writing cookies. ' +
          'Use saveToResponse(response) in Edge runtimes instead.'
      );
    }

    if (this.#isDestroyed) {
      throw new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Cannot save a destroyed session');
    }

    // Set the csrfToken only if protection enabled and the user hasn't set a token explicitly yet.
    if (this.#options.enableCsrfProtection && !this.#data.csrfToken) {
      this.#data.csrfToken = createCsrfToken();
    }

    // In deferred mode, just mark for save for later.
    if (this.#deferredMode) {
      this.#needsSave = true;
      return;
    }

    await this.saveCookies();
  }

  /**
   * Destroy the session and clear all data.
   *
   * In normal mode: Immediately deletes session cookies.
   * In deferred mode: Marks session for destruction; call flush() to actually delete.
   *
   * After calling destroy(), the session cannot be used or saved.
   * For Edge/browser environments, use destroyToResponse() instead.
   *
   * @example
   * ```typescript
   * // Logout
   * session.destroy();
   * res.redirect('/login');
   * ```
   */
  destroy(): void {
    this.#isDestroyed = true;
    this.#data = {} as T;

    // In deferred mode, just mark for destroy
    if (this.#deferredMode) {
      this.#needsDestroy = true;
      this.#needsSave = false; // Destroy takes precedence
      return;
    }

    this.destroyCookies();
  }

  /**
   * Flush deferred operations by actually writing or deleting cookies.
   *
   * Only valid when deferred mode is enabled via enableDeferredMode().
   * Call this after the response is ready to be sent but before it's finalized.
   *
   * This method uses async encryption, so it works in all environments.
   * For synchronous flushing in Node.js, use flushSync() instead.
   *
   * @throws {SessionError} If deferred mode is not enabled or response object is unavailable.
   *
   * @example
   * ```typescript
   * session.enableDeferredMode();
   * session.set('userId', '123');
   * await session.save(); // Marks for save
   * await session.flush(); // Actually writes cookies
   * ```
   */
  async flush(): Promise<void> {
    if (!this.#deferredMode) {
      throw new SessionError(
        SessionErrorCode.DEFERRED_MODE_NOT_ENABLED,
        'Cannot flush when deferred mode is not enabled. Call enableDeferredMode() first.'
      );
    }

    if (this.#needsDestroy) {
      this.destroyCookies();
    } else if (this.#needsSave) {
      // Perform actual save
      if (!this.#adapter.canWriteCookies()) {
        throw new SessionError(
          SessionErrorCode.MISSING_RESPONSE,
          'Cannot save session: no response object available for writing cookies'
        );
      }

      await this.saveCookies();
    }

    // Reset flags
    this.#needsSave = false;
    this.#needsDestroy = false;
  }

  /**
   * Flush deferred operations synchronously. Call this after response is ready to be sent.
   * Only used in deferred mode with Node.js environments.
   *
   * ⚠️ Requires Node.js crypto. For Edge/browser, use async flush() instead.
   *
   * @throws {SessionError} If node:crypto is not available or deferred mode not enabled
   */
  flushSync(): void {
    if (!this.#deferredMode) {
      throw new SessionError(
        SessionErrorCode.DEFERRED_MODE_NOT_ENABLED,
        'Cannot flush when deferred mode is not enabled. Call enableDeferredMode() first.'
      );
    }

    if (this.#needsDestroy) {
      this.destroyCookies();
    } else if (this.#needsSave) {
      // Perform actual save using SYNC encryption
      if (!this.#adapter.canWriteCookies()) {
        throw new SessionError(
          SessionErrorCode.MISSING_RESPONSE,
          'Cannot save session: no response object available for writing cookies'
        );
      }

      try {
        // Use synchronous encryption
        const encryptedValue = SessionCrypto.encryptSync(this.#data, this.#secrets[0]);
        const sessionCookieOptions = CookieBuilder.forSession(this.#options);
        this.#adapter.writeCookie(this.#options.cookieName, encryptedValue, sessionCookieOptions);

        if (this.#options.enableCsrfProtection && this.#data.csrfToken) {
          const csrfCookieOptions = CookieBuilder.forCsrf(this.#options);
          this.#adapter.writeCookie(this.#options.csrfCookieName, this.#data.csrfToken, csrfCookieOptions);
        }
      } catch (error) {
        const cause = error instanceof Error ? error : undefined;
        throw new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Failed to save session', cause);
      }
    }

    // Reset flags
    this.#needsSave = false;
    this.#needsDestroy = false;
  }

  ////////////////////////////////////
  // WEB/EDGE-SPECIFIC FUNCTIONS
  ////////////////////////////////////

  /**
   * Save the session by returning a new Response with Set-Cookie headers appended.
   *
   * Use this in Edge runtimes (Cloudflare Workers, Vercel Edge, etc.) where
   * you don't have direct access to a response object for writing cookies.
   *
   * This method:
   * 1. Encrypts the session data
   * 2. Creates Set-Cookie headers for session and CSRF cookies
   * 3. Clones the provided response and appends cookie headers
   * 4. Preserves existing headers, status, and body from the original response
   *
   * @param response - The Response object to clone and add session cookies to
   * @returns New Response with session cookies appended to existing headers
   * @throws {SessionError} If session has been destroyed or encryption fails
   *
   * @example
   * ```typescript
   * // Cloudflare Workers
   * const session = await getSession(request);
   * session.set('userId', '123');
   *
   * const response = new Response('Success');
   * return session.saveToResponse(response);
   * ```
   */
  async saveToResponse(response: Response): Promise<Response> {
    // First, validate that we can save a session at all
    if (this.#isDestroyed) {
      throw new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Cannot save a destroyed session');
    }

    // Set the csrfToken only if protection enabled and the user hasn't set a token explicitly yet.
    if (this.#options.enableCsrfProtection && !this.#data.csrfToken) {
      this.#data.csrfToken = createCsrfToken();
    }

    // Get session cookie header (may throw SessionError from encryption)
    let sessionCookieHeader: string;
    try {
      const encryptedValue = await SessionCrypto.encrypt(this.#data, this.#secrets[0]);
      sessionCookieHeader = CookieParser.serialize(
        this.#options.cookieName,
        encryptedValue,
        CookieBuilder.forSession(this.#options)
      );
    } catch (error) {
      const cause = error instanceof Error ? error : undefined;
      throw new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Failed to encrypt session data', cause);
    }

    // Create new Response headers with session cookie
    const newHeaders = new Headers(response.headers);
    newHeaders.append('set-cookie', sessionCookieHeader);

    // Add CSRF cookie to headers if csrfToken exists in session
    if (this.#options.enableCsrfProtection && this.#data.csrfToken) {
      const csrfCookieHeader = CookieParser.serialize(
        this.#options.csrfCookieName,
        this.#data.csrfToken,
        CookieBuilder.forCsrf(this.#options)
      );
      newHeaders.append('set-cookie', csrfCookieHeader);
    }

    // Return created response with all cookie headers set
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  /**
   * Destroy the session by returning a new Response with cookie deletion headers.
   *
   * Use this in Edge runtimes (Cloudflare Workers, Vercel Edge, etc.) where
   * you don't have direct access to a response object for writing cookies.
   *
   * This method:
   * 1. Marks the session as destroyed
   * 2. Creates Set-Cookie headers that delete session and CSRF cookies
   * 3. Returns a new Response with these deletion headers appended
   *
   * @param response - The original Response object to clone
   * @returns New Response with cookie deletion headers
   *
   * @example
   * ```typescript
   * // Cloudflare Workers logout
   * const session = await getSession(request);
   * const response = new Response('Logged out', { status: 302, headers: { Location: '/login' } });
   * return session.destroyToResponse(response);
   * ```
   */
  destroyToResponse(response: Response): Response {
    // Mark session as destroyed
    this.#isDestroyed = true;
    this.#data = {} as T;

    // Get destroy session cookie header
    const sessionCookieHeader = CookieParser.createDestroyCookie(
      this.#options.cookieName,
      CookieBuilder.forSessionDestroy(this.#options)
    );

    // Create new Response headers with destroy session cookie header
    const newHeaders = new Headers(response.headers);
    newHeaders.append('set-cookie', sessionCookieHeader);

    // Add destroy CSRF cookie header if there was a CSRF token
    if (this.#options.enableCsrfProtection) {
      const csrfCookieHeader = CookieParser.createDestroyCookie(
        this.#options.csrfCookieName,
        CookieBuilder.forCsrfDestroy(this.#options)
      );
      newHeaders.append('set-cookie', csrfCookieHeader);
    }

    // Return created response with all cookie headers set
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  /**
   * Get prepared cookie data for manual cookie setting.
   *
   * Useful for frameworks that don't use standard Response objects (e.g., Next.js Server Actions).
   * Returns an array of cookie objects with name, value, and options.
   *
   * @returns Array of cookie data objects ready to be set
   * @throws {SessionError} If session is destroyed or encryption fails
   *
   * @example
   * ```typescript
   * // Next.js Server Action helper
   * const cookieData = await session.getCookieData();
   * const cookieStore = await cookies();
   * for (const { name, value, options } of cookieData) {
   *   cookieStore.set(name, value, options);
   * }
   * ```
   */
  async getCookieDataForSave(): Promise<Array<{ name: string; value: string; options: CookieOptions }>> {
    if (this.#isDestroyed) {
      throw new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Cannot get cookie data from a destroyed session');
    }

    // Set the csrfToken only if protection enabled and the user hasn't set a token explicitly yet.
    if (this.#options.enableCsrfProtection && !this.#data.csrfToken) {
      this.#data.csrfToken = createCsrfToken();
    }

    try {
      // Session cookie
      const cookies = [];
      const data = await SessionCrypto.encrypt(this.#data, this.#secrets[0]);
      cookies.push({ name: this.#options.cookieName, value: data, options: CookieBuilder.forSession(this.#options) });

      // CSRF cookie (if enabled)
      if (this.#options.enableCsrfProtection && this.#data.csrfToken) {
        cookies.push({
          name: this.#options.csrfCookieName,
          value: this.#data.csrfToken,
          options: CookieBuilder.forCsrf(this.#options),
        });
      }

      return cookies;
    } catch (error) {
      const cause = error instanceof Error ? error : undefined;
      throw new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Failed to encrypt session data', cause);
    }
  }

  /**
   * Get prepared cookie data for destroying a session.
   *
   * Returns an array of cookie objects with empty values and expiration dates in the past,
   * which will delete the cookies when set. Use this in conjunction with destroy() for
   * frameworks that require manual cookie setting (e.g., Next.js Server Actions).
   *
   * This method is synchronous since no encryption is needed for empty cookie values.
   *
   * @returns Array of cookie deletion data objects ready to be set
   *
   * @example
   * ```typescript
   * // Next.js Server Action helper
   * export async function destroySession(session) {
   *   await session.destroy(); // Mark as destroyed, clear data
   *
   *   const cookieStore = await cookies();
   *   const cookieData = session.getCookieDataForDestroy();
   *
   *   for (const { name, value, options } of cookieData) {
   *     cookieStore.set(name, value, options); // Set empty cookies with past expiry
   *   }
   * }
   * ```
   */
  getCookieDataForDestroy(): Array<{ name: string; value: string; options: CookieOptions }> {
    const cookies = [];
    cookies.push({
      name: this.#options.cookieName,
      value: '',
      options: CookieBuilder.forSessionDestroy(this.#options),
    });

    if (this.#options.enableCsrfProtection) {
      cookies.push({
        name: this.#options.csrfCookieName,
        value: '',
        options: CookieBuilder.forCsrfDestroy(this.#options),
      });
    }

    return cookies;
  }

  ////////////////////////////////////
  // WRISTBAND-SPECIFIC FUNCTIONS
  ////////////////////////////////////

  /**
   * Create session from Wristband callback data.
   *
   * This is a convenience method that builds session state from authentication
   * callback data and optionally merges custom fields. Call save() or
   * saveToResponse() to persist the session.
   *
   * @param callbackData - Callback data containing tokens and user info
   * @param customFields - Optional additional fields to store (must be JSON-serializable)
   * @throws {SessionError} If session is destroyed, callbackData is missing, or customFields aren't serializable
   *
   * @example
   * ```typescript
   * // After successful callback
   * const callbackResult = await wristbandAuth.appRouter.callback(req);
   * const session = await getSession();
   *
   * session.fromCallback(callbackResult.callbackData, {
   *   preferences: { theme: 'dark' },
   *   role: 'admin'
   * });
   *
   * await session.save();
   * ```
   *
   * Fields extracted from callback data:
   * - isAuthenticated (set to true)
   * - accessToken
   * - expiresAt
   * - userId
   * - tenantId
   * - tenantName
   * - identityProviderName
   * - refreshToken (if "offline_access" scope configured)
   * - tenantCustomDomain (if provided during auth request)
   *
   * Note:
   * - Custom fields are merged with core session fields
   * - All values must be JSON-serializable
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fromCallback(callbackData: CallbackData, customFields?: Record<string, any>): void {
    if (this.#isDestroyed) {
      throw new SessionError(SessionErrorCode.SESSION_DESTROYED, 'Cannot modify a destroyed session');
    }

    // Validate required data
    if (!callbackData) {
      throw new SessionError(SessionErrorCode.CALLBACK_DATA_INVALID, 'callbackData is required to create a session');
    }
    if (!callbackData.userinfo) {
      throw new SessionError(
        SessionErrorCode.CALLBACK_DATA_INVALID,
        'callbackData.userinfo is required to create a session'
      );
    }

    // Build base session data from callback
    const sessionData: Partial<T> = {
      isAuthenticated: true,
      accessToken: callbackData.accessToken,
      expiresAt: callbackData.expiresAt,
      userId: callbackData.userinfo.userId,
      tenantId: callbackData.userinfo.tenantId,
      tenantName: callbackData.tenantName,
      identityProviderName: callbackData.userinfo.identityProviderName,
    } as Partial<T>;

    // Only include optional fields if they have values
    if (callbackData.refreshToken) {
      sessionData.refreshToken = callbackData.refreshToken;
    }
    if (callbackData.tenantCustomDomain) {
      sessionData.tenantCustomDomain = callbackData.tenantCustomDomain;
    }

    // Add custom fields if provided
    if (customFields) {
      try {
        JSON.stringify(customFields);
        Object.assign(sessionData, customFields);
      } catch (error) {
        throw new SessionError(
          SessionErrorCode.CUSTOM_FIELDS_NOT_SERIALIZABLE,
          `Custom fields must be JSON-serializable: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Copy all fields from sessionData to this.#data
    Object.assign(this.#data, sessionData);
  }

  /**
   * Create a SessionResponse for Wristband frontend SDKs.
   *
   * This method extracts tenantId and userId from the session and returns them
   * in the format expected by Wristband's frontend SDKs.
   *
   * @param metadata - Optional custom metadata to include. Must be JSON-serializable.
   *                   Defaults to an empty object if not provided.
   * @returns SessionResponse containing tenantId, userId, and metadata
   * @throws {SessionError} If tenantId or userId are missing from session
   *
   * @example
   * ```typescript
   * // In your session endpoint
   * app.get('/api/v1/session', async (req, res) => {
   *   const session = await getSession(req);
   *   const response = session.getSessionResponse({ foo: 'bar' });
   *   res.json(response);
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionResponse(metadata?: Record<string, any>): SessionResponse {
    const tenantId = this.#data.tenantId;
    const userId = this.#data.userId;

    if (!tenantId || !userId) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_AUTHENTICATED,
        'Session is not authenticated or missing required fields'
      );
    }

    return { tenantId, userId, metadata: metadata ?? {} };
  }

  /**
   * Create a TokenResponse for Wristband frontend SDKs.
   *
   * This method extracts accessToken and expiresAt from the session and returns them
   * in the format expected by Wristband's frontend SDKs.
   *
   * @returns TokenResponse containing accessToken and expiresAt timestamp
   * @throws {SessionError} If accessToken or expiresAt are missing from session
   *
   * @example
   * ```typescript
   * // In your token endpoint
   * app.get('/api/v1/token', async (req, res) => {
   *   const session = await getSession(req);
   *   const response = session.getTokenResponse();
   *   res.json(response);
   * });
   * ```
   */
  getTokenResponse(): TokenResponse {
    const accessToken = this.#data.accessToken;
    const expiresAt = this.#data.expiresAt;

    if (!accessToken || !expiresAt) {
      throw new SessionError(
        SessionErrorCode.SESSION_NOT_AUTHENTICATED,
        'Session is not authenticated or missing token data'
      );
    }

    return { accessToken, expiresAt };
  }

  ////////////////////////////////////
  // INTERNAL FUNCTIONS
  ////////////////////////////////////

  /**
   * Delete session and CSRF cookies by writing empty values with expired dates.
   * Only executes if adapter can write cookies (has response object).
   */
  private destroyCookies(): void {
    if (!this.#adapter.canWriteCookies()) {
      return;
    }
    this.#adapter.writeCookie(this.#options.cookieName, '', CookieBuilder.forSessionDestroy(this.#options));

    if (this.#options.enableCsrfProtection) {
      this.#adapter.writeCookie(this.#options.csrfCookieName, '', CookieBuilder.forCsrfDestroy(this.#options));
    }
  }

  /**
   * Encrypt and write session and CSRF cookies.
   * Uses the first secret for encryption.
   *
   * @throws {SessionError} If encryption fails
   */
  private async saveCookies(): Promise<void> {
    try {
      const encryptedValue = await SessionCrypto.encrypt(this.#data, this.#secrets[0]);
      this.#adapter.writeCookie(this.#options.cookieName, encryptedValue, CookieBuilder.forSession(this.#options));

      if (this.#options.enableCsrfProtection && this.#data.csrfToken) {
        this.#adapter.writeCookie(
          this.#options.csrfCookieName,
          this.#data.csrfToken,
          CookieBuilder.forCsrf(this.#options)
        );
      }
    } catch (error) {
      const cause = error instanceof Error ? error : undefined;
      throw new SessionError(SessionErrorCode.SESSION_SAVE_FAILED, 'Failed to save session', cause);
    }
  }

  /**
   * Create a session instance from an encrypted cookie value.
   *
   * Attempts to decrypt the cookie using the provided secrets (tries each in order).
   * Also validates the session hasn't expired based on maxAge.
   * If decryption or validation fails, returns a new empty session.
   *
   * @param cookieValue - The encrypted session cookie value
   * @param adapter - Session adapter for cookie operations
   * @param options - Normalized session configuration
   * @returns SessionImpl instance with decrypted data or empty data if decryption failed
   *
   * @example
   * ```typescript
   * const cookieValue = getCookie(req, 'session');
   * const session = await SessionImpl.fromCookie(cookieValue, adapter, options);
   * ```
   */
  static async fromCookie<T extends SessionData>(
    cookieValue: string,
    adapter: SessionAdapter,
    options: NormalizedSessionOptions
  ): Promise<SessionImpl<T>> {
    const secrets = Array.isArray(options.secrets) ? options.secrets : [options.secrets];

    try {
      // Try to decrypt - this also validates TTL expiration.
      const data = await SessionCrypto.decryptWithSecrets(cookieValue, secrets, options.maxAge);
      return new SessionImpl<T>(data as T, adapter, options);
    } catch (error) {
      // If decryption or TTL validation fails, return new session.
      return new SessionImpl<T>({} as T, adapter, options);
    }
  }

  /**
   * Synchronous version of fromCookie() using Node.js crypto.
   *
   * ⚠️ Only available in Node.js environments.
   * For Edge/browser, use async fromCookie() instead.
   *
   * @param cookieValue - The encrypted session cookie value
   * @param adapter - Session adapter for cookie operations
   * @param options - Normalized session configuration
   * @returns SessionImpl instance with decrypted data or empty data if decryption failed
   *
   * @throws {SessionError} If node:crypto is not available.
   */
  static fromCookieSync<T extends SessionData>(
    cookieValue: string,
    adapter: SessionAdapter,
    options: NormalizedSessionOptions
  ): SessionImpl<T> {
    const secrets = Array.isArray(options.secrets) ? options.secrets : [options.secrets];

    try {
      const data = SessionCrypto.decryptWithSecretsSync(cookieValue, secrets, options.maxAge);
      return new SessionImpl<T>(data as T, adapter, options);
    } catch (error) {
      return new SessionImpl<T>({} as T, adapter, options);
    }
  }

  /**
   * Create a new empty session instance.
   *
   * Used when no session cookie exists or when starting a fresh session.
   *
   * @param adapter - Session adapter for cookie operations
   * @param options - Normalized session configuration
   * @returns New empty SessionImpl instance
   */
  static createNew<T extends SessionData>(adapter: SessionAdapter, options: NormalizedSessionOptions): SessionImpl<T> {
    return new SessionImpl<T>({} as T, adapter, options);
  }
}
