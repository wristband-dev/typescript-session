/**
 * Core session SDK types
 */

/**
 * Represents the `SameSite` attribute for cookies, which controls 
 * whether cookies are sent along with cross-site requests.
 *
 * - `'strict'`: Cookies are only sent for same-site requests.
 * - `'lax'`: Cookies are sent for top-level navigations and same-site requests (default in most browsers).
 * - `'none'`: Cookies are sent in all contexts, including cross-site requests.
 *             Must be used with `Secure` in modern browsers.
 */
export type SameSiteOption = 'strict' | 'lax' | 'none';

/**
 * Configuration options for session management.
 * 
 * These options control how sessions are created, encrypted, and stored in cookies.
 * All cookie-related options follow standard HTTP cookie specifications.
 */
export interface SessionOptions {
  /** 
   * Session cookie name. 
   * 
   * @default 'session'
   */
  cookieName?: string;
  /**
   * Secret key(s) for encryption. 
   * 
   * - Single string: Used for both encryption and decryption
   * - Array of strings: First key encrypts, all keys tried for decryption (enables key rotation)
   * - Must be at least 32 characters for security
   * - Use cryptographically random strings (e.g., from a secure password generator)
   * 
   * @example
   * ```typescript
   * // Single secret
   * secrets: process.env.SESSION_SECRET
   * 
   * // Key rotation (old key still works for existing sessions)
   * secrets: [process.env.NEW_SECRET, process.env.OLD_SECRET]
   * ```
   */
  secrets: string | string[];
  /** 
   * Session expiration time in seconds.
   * 
   * Determines how long a session remains valid. After this time,
   * the session cookie expires and users must re-authenticate.
   * 
   * @default 3600 (1 hour)
   * 
   * @example
   * ```typescript
   * maxAge: 24 * 60 * 60  // 24 hours
   * maxAge: 7 * 24 * 60 * 60  // 7 days
   * ```
   */
  maxAge?: number;
  /** 
   * Cookie domain attribute.
   * 
   * Controls which domains can access the cookie:
   * - Undefined: Cookie only sent to current domain
   * - '.example.com': Cookie sent to example.com and all subdomains
   * - 'app.example.com': Cookie only sent to app.example.com
   * 
   * @default undefined (current domain only)
   */
  domain?: string;
  /** 
   * Cookie path attribute. Specifies which URL paths can access the cookie.
   * 
   * @default '/' (all paths)
   */
  path?: string;
  /** 
   * Cookie Secure flag. If true, cookie is only sent over HTTPS connections.
   * 
   * **Security recommendation:** Always use true in production.
   * Only set to false for local development over HTTP when using browsers like
   * Safari that can't handle secure cookies over localhost.
   * 
   * @default true
   */
  secure?: boolean;
  /**
   * Cookie SameSite setting. Controls whether cookies are sent on cross-site requests.
   * 
   * - 'strict': Cookies only sent for same-site requests (best CSRF protection, default)
   * - 'lax': Cookies sent for same-site + top-level navigation GET requests
   * - 'none': Cookies sent for all requests (requires secure: true, needs CSRF protection)
   * 
   * @default 'lax'
   */
  sameSite?: SameSiteOption;
  /** 
   * Name of the CSRF cookie (only used if enableCsrfProtection is true).
   * 
   * @default 'CSRF-TOKEN'
   */
  csrfCookieName?: string;
  /** 
   * Domain for CSRF cookie. Follows same rules as 'domain' option.
   * 
   * @default Same as 'domain' if specified, otherwise undefined
   */
  csrfCookieDomain?: string;
  /**
   * Enable CSRF protection by generating and validating CSRF tokens.
   * 
   * **Recommendation:**
   * Only enable CSRF protection if you use sameSite: 'none' or want defense-in-depth.
   * Otherwise, rely on the default sameSite: 'strict' or 'lax' setting for CSRF protection,
   * as those are sufficient in most cases.
   * 
   * When enabled:
   * - A CSRF token is automatically generated after authentication when you call fromCallback()
   * - The token is stored in both the session and a separate cookie
   * - CSRF cookies are deleted when calling destroy() or destroyToResponse()
   * - Your frontend must include the CSRF token in request headers for server validation
   * 
   * When disabled:
   * - No CSRF tokens are generated
   * - No CSRF cookies are set or deleted
   * 
   * @default false (sameSite: 'strict' or 'lax' provides sufficient CSRF protection)
   */
  enableCsrfProtection?: boolean;
}

/**
 * Base session data interface that all session types must extend.
 * 
 * **Using with Wristband:**
 * Pre-defined fields for Wristband authentication (userId, tenantId, accessToken, etc.)
 * are automatically populated when you call fromCallback() after authentication.
 * 
 * **Using without Wristband:**
 * All fields are optional and can be ignored. Extend this interface with your own
 * custom fields and use the session SDK as a general-purpose encrypted session library.
 * 
 * @example
 * ```typescript
 * // With Wristband
 * const session = await getSession(request, options);
 * session.fromCallback(callbackData);  // Populates Wristband fields
 * await session.save();
 * 
 * // Without Wristband (custom session data)
 * interface MySessionData extends SessionData {
 *   cartItems?: string[];
 *   theme?: string;
 * }
 * 
 * const session = await getSession<MySessionData>(request, options);
 * session.cartItems = ['item1', 'item2'];
 * session.theme = 'dark';
 * await session.save();
 * ```
 */
export interface SessionData {
  /** Whether the user is authenticated. Set to true by fromCallback(). */
  isAuthenticated?: boolean;
  /** JWT access token for making authenticated API calls to Wristband and other services. */
  accessToken?: string;
  /** Token expiration time as Unix timestamp in milliseconds. Accounts for token_expiration_buffer from SDK config. */
  expiresAt?: number;
  /** Unique identifier for the authenticated user. */
  userId?: string;
  /** Unique identifier for the tenant that the user belongs to. */
  tenantId?: string;
  /** Name of the tenant that the user belongs to. */
  tenantName?: string;
  /** Name of the identity provider that the user belongs to. */
  identityProviderName?: string;
  /** CSRF token for request validation. Automatically generated by `fromCallback()` if `enableCsrfProtection=true`. */
  csrfToken?: string;
  /**
   * Refresh token for obtaining new access tokens when they expire. Only present if 'offline_access' scope was
   * requested during authentication.
   */
  refreshToken?: string;
  /** 
   * Custom domain for the tenant, if configured. Only present if a tenant custom domain was used during authentication.
   */
  tenantCustomDomain?: string;
}

/**
 * Cookie-specific options passed to adapters for serialization.
 * These options control the Set-Cookie header attributes.
 */
export interface CookieOptions {
  /**
   * Maximum age of the cookie in seconds.
   * 
   * Defines how long the cookie should persist. After this time,
   * the cookie expires and is removed by the browser.
   * 
   * @example
   * ```typescript
   * maxAge: 3600      // 1 hour (60 * 60)
   * maxAge: 86400     // 24 hours (24 * 60 * 60)
   * maxAge: 604800    // 7 days (7 * 24 * 60 * 60)
   * ```
   */
  maxAge: number;
  /**
   * Cookie domain attribute.
   * 
   * Controls which domains can access the cookie:
   * - Undefined: Cookie only sent to the exact domain that set it
   * - '.example.com': Cookie sent to example.com and all subdomains
   * - 'app.example.com': Cookie only sent to app.example.com
   * 
   * @default undefined (current domain only, no subdomains)
   */
  domain?: string;
  /**
   * Cookie path attribute.
   * 
   * Specifies which URL paths on the domain can access the cookie.
   * The cookie is available to the specified path and all subpaths.
   * 
   * @default '/' (all paths on the domain)
   * 
   * @example
   * ```typescript
   * path: '/'           // Available to entire site
   * path: '/api'        // Only available to /api and /api/*
   * path: '/admin'      // Only available to /admin and /admin/*
   * ```
   */
  path: string;
  /**
   * Cookie Secure flag.
   * 
   * When true, the cookie is only sent over HTTPS connections,
   * protecting it from man-in-the-middle attacks.
   * 
   * **Security recommendation:** Always use true in production.
   * Set to false only for local development over HTTP.
   * 
   * @default true
   */
  secure: boolean;
  /**
   * Cookie HttpOnly flag.
   * 
   * When true, prevents JavaScript from accessing the cookie via
   * `document.cookie`, protecting against XSS attacks.
   * 
   * **Security recommendation:** Always use true for session cookies
   * containing sensitive data like authentication tokens.
   * 
   * @default true
   */
  httpOnly: boolean;
  /**
   * Cookie SameSite attribute.
   * 
   * Controls whether cookies are sent on cross-site requests,
   * providing CSRF attack protection.
   * 
   * - `'strict'`: Cookies only sent for same-site requests (strongest protection)
   * - `'lax'`: Cookies sent for same-site + top-level navigation (default in modern browsers)
   * - `'none'`: Cookies sent for all requests (requires `secure: true`)
   * 
   * @default 'lax'
   * 
   * @example
   * ```typescript
   * sameSite: 'strict'  // Best for auth cookies on same domain
   * sameSite: 'lax'     // Good balance for most use cases
   * sameSite: 'none'    // Required for cross-site iframes (must use secure: true)
   * ```
   */
  sameSite: SameSiteOption;
}

/**
 * Session interface providing methods for reading, writing, and managing session data.
 * 
 * This is a general-purpose encrypted session library that works with any Node.js or Edge runtime.
 * It includes optional Wristband-specific helper methods (fromCallback, getSessionResponse, getTokenResponse)
 * that can be ignored if not using Wristband authentication.
 * 
 * Sessions provide both method-based access (get/set) and direct property access via proxy.
 * The generic type parameter allows for type-safe custom session fields.
 * 
 * @template T - Session data type extending SessionData
 * 
 * @example
 * ```typescript
 * // With Wristband
 * const session = await getSession(request, options);
 * session.fromCallback(callbackData);  // Wristband helper method
 * await session.save();
 * 
 * // Without Wristband (general-purpose session management)
 * interface CustomSession extends SessionData {
 *   cartItems?: string[];
 * }
 * 
 * const session = await getSession<CustomSession>(request, options);
 * session.cartItems = ['item1'];  // Direct property access
 * session.set('userId', '123');   // Method-based access
 * await session.save();
 * // Don't call fromCallback(), getSessionResponse(), or getTokenResponse()
 * ```
 */
export interface Session<T extends SessionData = SessionData> {
  /**
   * Get a value from the session by key.
   * 
   * @param key - The session data key to retrieve
   * @returns The value associated with the key, or undefined if not present
   */
  get<K extends keyof T>(key: K): T[K] | undefined;
  /**
   * Set a value in the session.
   * 
   * Changes are kept in memory until save() or saveToResponse() is called.
   * 
   * @param key - The session data key to set
   * @param value - The value to store
   * @throws Error if session has been destroyed
   */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /**
   * Delete a value from the session.
   * 
   * Changes are kept in memory until save() or saveToResponse() is called.
   * 
   * @param key - The session data key to delete
   * @throws Error if session has been destroyed
   */
  delete<K extends keyof T>(key: K): void;
  /**
   * Serializes the session data to JSON.
   * 
   * @returns {T} The session data object
   */
  toJSON(): T;
  /**
   * Save the session by writing cookies.
   * 
   * In normal mode: Immediately encrypts and writes session cookies.
   * In deferred mode: Marks session for save; call flush() to actually write.
   * 
   * For Edge/browser environments, use saveToResponse() instead.
   * 
   * @throws Error if session is destroyed or no response object available
   */
  save(): Promise<void>;
  /**
   * Save the session by returning a new Response with Set-Cookie headers appended.
   * 
   * Use this in Edge runtimes (Cloudflare Workers, Vercel Edge, etc.) where
   * you don't have direct access to a response object for writing cookies.
   * 
   * This method clones the provided response and appends session cookie headers,
   * preserving any existing headers, status, and body from the original response.
   * 
   * @param response - The Response object to clone and add session cookies to
   * @returns New Response with session cookies appended to existing headers
   * @throws Error if session has been destroyed
   */
  saveToResponse(response: Response): Promise<Response>;
  /**
   * Enable deferred mode for Express and similar frameworks.
   * 
   * **Why it's needed - PERFORMANCE:**
   * Prevents multiple expensive encryption operations per request.
   * When save() is called multiple times (e.g., in middleware + route handlers),
   * only one encryption happens at flush().
   * 
   * In deferred mode:
   * - save() and destroy() only set flags (no encryption/cookie writes)
   * - flush() or flushSync() actually encrypts and writes cookies ONCE
   * 
   * ⚠️ Once enabled, deferred mode cannot be disabled for this session instance.
   */
  enableDeferredMode(): void;
  /**
   * Flush deferred operations by actually writing or deleting cookies.
   * 
   * Only valid when deferred mode is enabled via enableDeferredMode().
   * Uses async encryption - works in all environments (Node.js, Edge, browser).
   * 
   * @throws Error if deferred mode is not enabled or response object is unavailable
   */
  flush(): Promise<void>;
  /**
   * Flush deferred operations synchronously.
   * 
   * Only valid when deferred mode is enabled via enableDeferredMode().
   * Uses Node.js crypto for synchronous encryption.
   * 
   * ⚠️ Only available in Node.js environments. For Edge/browser, use async flush().
   * 
   * @throws Error if node:crypto is not available or deferred mode is not enabled
   */
  flushSync(): void;
  /**
   * Destroy the session and clear all data.
   * 
   * In normal mode: Immediately deletes session cookies.
   * In deferred mode: Marks session for destruction; call flush() to actually delete.
   * 
   * For Edge/browser environments, use destroyToResponse() instead.
   */
  destroy(): void;
  /**
   * Destroy the session by returning a new Response with cookie deletion headers appended.
   * 
   * Use this in Edge runtimes (Cloudflare Workers, Vercel Edge, etc.) where
   * you don't have direct access to a response object for writing cookies.
   * 
   * This method clones the provided response and appends cookie deletion headers,
   * preserving any existing headers, status, and body from the original response.
   * 
   * @param response - The Response object to clone and add cookie deletion headers to
   * @returns New Response with cookie deletion headers appended to existing headers
   */
  destroyToResponse(response: Response): Response;
  /**
   * Get prepared cookie data for manual cookie setting.
   * 
   * Useful for frameworks that don't use standard Response objects (e.g., Next.js Server Actions).
   * Returns an array of cookie objects with name, value, and options that can be passed
   * directly to cookie-setting APIs like Next.js cookies().set()
   * 
   * @returns Promise resolving to array of cookie data objects ready to be set
   * @throws Error if session has been destroyed
   * 
   * @example
   * ```typescript
   * // Next.js Server Action helper
   * const cookieData = await session.getCookieDataForSave();
   * const cookieStore = await cookies();
   * for (const { name, value, options } of cookieData) {
   *   cookieStore.set(name, value, options);
   * }
   * ```
   */
  getCookieDataForSave(): Promise<Array<{ name: string; value: string; options: CookieOptions }>>;
  /**
   * Get prepared cookie data for destroying a session.
   * 
   * Returns an array of cookie objects with empty values and expiration dates in the past,
   * which will delete the cookies when set. Use this in conjunction with destroy() for
   * frameworks that require manual cookie setting (e.g., Next.js Server Actions).
   * 
   * This method is synchronous since no encryption is needed for empty cookie values.
   * It can be called after destroy() has been called on the session.
   * 
   * @returns Array of cookie deletion data objects ready to be set
   * 
   * @example
   * ```typescript
   * // Next.js Server Action helper
   * export async function destroySession(session) {
   *   session.destroy(); // Mark as destroyed, clear data
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
  getCookieDataForDestroy(): Array<{ name: string; value: string; options: CookieOptions }>;
  /**
   * Create session from Wristband callback data.
   * 
   * This is a convenience method that builds session state from authentication
   * callback data and optionally merges custom fields. Call save() or return
   * saveToResponse() to persist the session.
   * 
   * @param callbackData - Callback data containing tokens and user info
   * @param customFields - Optional additional fields to store (must be JSON-serializable)
   * @throws Error if session is destroyed, callbackData is missing, or customFields aren't serializable
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fromCallback(callbackData: CallbackData, customFields?: Record<string, any>): void;
  /**
   * Create a SessionResponse for Wristband frontend SDKs.
   * 
   * Extracts tenantId and userId from the session and returns them
   * in the format expected by Wristband's frontend SDKs.
   * 
   * @param metadata - Optional custom metadata to include (must be JSON-serializable)
   * @returns SessionResponse containing tenantId, userId, and metadata
   * @throws Error if tenantId or userId are missing from session
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSessionResponse(metadata?: Record<string, any>): SessionResponse;
  /**
   * Create a TokenResponse for Wristband frontend SDKs.
   * 
   * Extracts accessToken and expiresAt from the session and returns them
   * in the format expected by Wristband's frontend SDKs.
   * 
   * @returns TokenResponse containing accessToken and expiresAt timestamp
   * @throws Error if accessToken or expiresAt are missing from session
   */
  getTokenResponse(): TokenResponse;
}



/**
 * User Info Role model representing a role assigned to a user.
 */
export interface UserInfoRole {
  /** Globally unique ID of the role */
  id: string;
  /** The role name (e.g., "app:app-name:admin") */
  name: string;
  /** The human-readable display name for the role */
  displayName: string;
}

/**
 * User Info model representing claims from the Wristband UserInfo endpoint.
 *
 * This model represents user information returned from Wristband's OIDC-compliant
 * UserInfo endpoint, with field names mapped to match the User entity field names
 * in Wristband's Resource Management API. The claims returned depend on the scopes
 * requested during authorization.
 *
 * Always returned claims: userId, tenantId, applicationId, identityProviderName
 *
 * Scope-dependent claims:
 * - profile: fullName, givenName, familyName, middleName, nickname, displayName,
 *            pictureUrl, gender, birthdate, timeZone, locale, updatedAt
 * - email: email, emailVerified
 * - phone: phoneNumber, phoneNumberVerified
 * - roles: roles
 *
 * @example
 * ```json
 * {
 *   "userId": "x25rpgafgvgedcvjw52ooul3xm",
 *   "tenantId": "lu4a47jcm2ejayovsgbgbpkihb",
 *   "applicationId": "hblu4a47jcm2ejayovsgbgbpki",
 *   "identityProviderName": "Wristband",
 *   "fullName": "Bob Jay Smith",
 *   "givenName": "Bob",
 *   "familyName": "Smith",
 *   "email": "bob@example.com",
 *   "emailVerified": true,
 *   "roles": [
 *     {
 *       "id": "x25rpgafgvgedcvjw52oool3xm",
 *       "name": "app:app-name:admin",
 *       "displayName": "Admin Role"
 *     }
 *   ],
 *   "customClaims": {
 *     "fieldA": "a",
 *     "fieldB": "b"
 *   }
 * }
 * ```
 */
export interface UserInfo {
  // Always returned - mapped from OIDC standard claims
  /** ID of the user (mapped from "sub" claim) */
  userId: string;
  /** ID of the tenant that the user belongs to (mapped from "tnt_id") */
  tenantId: string;
  /** ID of the application that the user belongs to (mapped from "app_id") */
  applicationId: string;
  /** Name of the identity provider (mapped from "idp_name") */
  identityProviderName: string;

  // Profile scope - mapped to User entity field names
  /** End-User's full name in displayable form (mapped from "name") */
  fullName?: string;
  /** Given name(s) or first name(s) of the End-User */
  givenName?: string;
  /** Surname(s) or last name(s) of the End-User */
  familyName?: string;
  /** Middle name(s) of the End-User */
  middleName?: string;
  /** Casual name of the End-User */
  nickname?: string;
  /** Shorthand name by which the End-User wishes to be referred (mapped from "preferred_username") */
  displayName?: string;
  /** URL of the End-User's profile picture (mapped from "picture") */
  pictureUrl?: string;
  /** End-User's gender */
  gender?: string;
  /** End-User's birthday in YYYY-MM-DD format */
  birthdate?: string;
  /** End-User's time zone (mapped from "zoneinfo") */
  timeZone?: string;
  /** End-User's locale as BCP47 language tag (e.g., "en-US") */
  locale?: string;
  /** The value is represented as the number of seconds from the Unix epoch. */
  updatedAt?: number;

  // Email scope
  /** End-User's preferred email address */
  email?: string;
  /** True if the End-User's email address has been verified */
  emailVerified?: boolean;

  // Phone scope
  /** End-User's telephone number in E.164 format */
  phoneNumber?: string;
  /** True if the End-User's phone number has been verified */
  phoneNumberVerified?: boolean;

  // Roles scope
  /** The roles assigned to the user */
  roles?: UserInfoRole[];

  // Custom claims
  /** Object containing any configured custom claims */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customClaims?: Record<string, any>;
}

/**
 * Callback data from Wristband authentication.
 * 
 * This represents the complete data received after successful authentication,
 * including tokens, user information, and tenant details.
 * 
 * @example
 * ```typescript
 * const callbackData: CallbackData = {
 *   accessToken: "eyJhbGc...",
 *   expiresAt: 1735689600000,
 *   expiresIn: 3600,
 *   idToken: "eyJhbGc...",
 *   refreshToken: "eyJhbGc...",
 *   tenantName: "customer01",
 *   tenantCustomDomain: "customer01.com",
 *   returnUrl: "https://app.com/dashboard",
 *   customState: { theme: "dark" },
 *   userinfo: {
 *     userId: "user_123",
 *     tenantId: "tenant_abc",
 *     applicationId: "app_xyz",
 *     identityProviderName: "wristband",
 *     email: "user@example.com"
 *   }
 * };
 * ```
 */
export interface CallbackData {
  /** The access token for API authentication */
  accessToken: string;
  /** The absolute expiration time of the access token in milliseconds since the Unix epoch */
  expiresAt: number;
  /** The duration from the current time until the access token expires (in seconds) */
  expiresIn: number;
  /** The ID token uniquely identifying the user */
  idToken: string;
  /** The refresh token for renewing expired access tokens (optional) */
  refreshToken?: string;
  /** The name of the tenant the user belongs to */
  tenantName: string;
  /** The tenant custom domain (if applicable) */
  tenantCustomDomain?: string;
  /** The URL to return to after authentication */
  returnUrl?: string;
  /** Custom state data preserved through the auth flow */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customState?: Record<string, any>;
  /** User information from the Wristband UserInfo endpoint */
  userinfo: UserInfo;
}

/**
 * Response model for session endpoints.
 *
 * This model is used to return session information including tenant ID, user ID,
 * and any additional metadata associated with the session. The metadata field
 * accepts a dictionary of JSON-serializable values. The response format
 * matches what Wristband frontend SDKs expect for session endpoints.
 *
 * @example
 * ```json
 * {
 *   "tenantId": "tenant_abc123",
 *   "userId": "user_xyz789",
 *   "metadata": {
 *     "foo": "bar"
 *   }
 * }
 * ```
 */
export interface SessionResponse {
  /** The tenant identifier for the authenticated user's organization */
  tenantId: string;
  /** The unique identifier for the authenticated user */
  userId: string;
  /** Additional session data as key-value pairs. Values must be JSON-serializable */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Token response model for the Token Endpoint.
 *
 * This model is used by applications to expose token data to Wristband frontend SDKs.
 *
 * @example
 * ```json
 * {
 *   "accessToken": "eyJhbGc...",
 *   "expiresAt": 1735689600000
 * }
 * ```
 */
export interface TokenResponse {
  /** The JWT access token for authenticating API requests */
  accessToken: string;
  /** Unix timestamp in milliseconds when the token expires */
  expiresAt: number;
}

////////////////////////////////////
//  INTERNAL TYPES
////////////////////////////////////

/**
 * Adapter interface for reading and writing session cookies.
 * 
 * Implementations exist for both Node.js (IncomingMessage/ServerResponse)
 * and Web Standard (Request/Response) APIs.
 */
export interface SessionAdapter {
  /** Read cookie value from request */
  readCookie(cookieName: string): string | undefined;
  /** Write cookie to response */
  writeCookie(cookieName: string, value: string, options: CookieOptions): void;
  /** Check if adapter can write cookies directly */
  canWriteCookies(): boolean;
}

/**
 * Internal normalized session options with all defaults applied.
 * 
 * Created by normalizeOptions() from user-provided SessionOptions.
 * All optional fields are resolved to required fields with defaults.
 */
export interface NormalizedSessionOptions {
  /** Session cookie name (defaults to 'session') */
  cookieName: string;
  /** Secret key(s) for encryption */
  secrets: string | string[];
  /** Session expiration time in seconds (defaults to 3600) */
  maxAge: number;
  /** Cookie domain (optional) */
  domain?: string;
  /** Cookie path (defaults to '/') */
  path: string;
  /** Cookie secure flag (defaults to true) */
  secure: boolean;
  /** Cookie sameSite setting (defaults to 'lax') */
  sameSite: SameSiteOption;
  /** CSRF cookie name (defaults to 'CSRF-TOKEN') */
  csrfCookieName: string;
  /** Domain for CSRF cookie. Defaults to session cookie domain if not specified */
  csrfCookieDomain?: string;
  /**
   * Enable CSRF protection by generating and validating CSRF tokens.
   * 
   * **Recommendation:**
   * Only enable CSRF protection if you use sameSite: 'none' or want defense-in-depth.
   * Otherwise, rely on the default sameSite: 'strict' or 'lax' setting for CSRF protection,
   * as those are sufficient in most cases.
   * 
   * When enabled:
   * - A CSRF token is automatically generated after authentication when you call fromCallback()
   * - The token is stored in both the session and a separate cookie
   * - CSRF cookies are deleted when calling destroy() or destroyToResponse()
   * - Your frontend must include the CSRF token in request headers for server validation
   * 
   * When disabled:
   * - No CSRF tokens are generated
   * - No CSRF cookies are set or deleted
   * 
   * @default false (sameSite: 'strict' or 'lax' provides sufficient CSRF protection)
   */
  enableCsrfProtection: boolean;
}
