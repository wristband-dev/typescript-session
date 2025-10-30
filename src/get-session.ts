import { PlatformDetector } from './adapters/base';
import { NodeAdapter } from './adapters/node';
import { WebStandardAdapter } from './adapters/web-standard';
import { createProxiedSession } from './core/proxy';
import { SessionImpl } from './core/session';
import { SessionError, SessionErrorCode } from './error';
import { NormalizedSessionOptions, Session, SessionData, SessionOptions } from './types';

const DEFAULT_CSRF_COOKIE_NAME = 'CSRF-TOKEN';
const DEFAULT_CSRF_PROTECTION_ENABLED = false;
const DEFAULT_MAX_AGE = 3600; // 1 hour
const DEFAULT_PATH = '/';
const DEFAULT_SAME_SITE = 'lax';
const DEFAULT_SECURE = true;
const DEFAULT_SESSION_COOKIE_NAME = 'session';
const MAX_SECRETS_ALLOWED = 3;
const MIN_SECRET_LENGTH = 32;

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
    sameSite: options.sameSite ?? DEFAULT_SAME_SITE,
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
 * Validates session options for security and correctness.
 * 
 * Ensures that:
 * - At least one secret is provided
 * - No more than 3 secrets for key rotation
 * - All secrets are non-empty strings of at least 32 characters
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
 * Creates the appropriate adapter based on the runtime environment.
 * 
 * Automatically detects whether the request/response objects are Web Standard
 * (Request/Response) or Node.js (IncomingMessage/ServerResponse) and returns
 * the corresponding adapter.
 * 
 * @param request - Platform-specific request object
 * @param response - Optional platform-specific response object
 * @returns WebStandardAdapter or NodeAdapter based on detected platform
 * @throws {SessionError} If request type cannot be detected
 * 
 * @internal
 */
function createAdapter(request: unknown, response?: unknown): WebStandardAdapter | NodeAdapter {
  if (PlatformDetector.isWebRequest(request)) {
    return new WebStandardAdapter(request, response);
  }
  if (PlatformDetector.isNodeRequest(request)) {
    return new NodeAdapter(request, response);
  }
  throw new SessionError(
    SessionErrorCode.INVALID_CONFIGURATION,
    'Unsupported request type. Expected Web Standard Request or Node.js IncomingMessage'
  );
}

/**
 * Get or create a session for the given request.
 * 
 * Automatically detects the runtime (Node.js vs Edge) and returns a session
 * with encrypted cookie storage. If a session cookie exists, it decrypts and
 * returns the session data. Otherwise, returns a new empty session.
 * 
 * **Usage patterns:**
 * - Node.js (2 args): `getSession(req, options)` - reads from req, writes to adapter
 * - Node.js (3 args): `getSession(req, res, options)` - reads from req, writes to res
 * - Edge (2 args): `getSession(request, options)` - reads from Request, use saveToResponse()
 * 
 * @param request - Node.js IncomingMessage or Web Standard Request
 * @param responseOrOptions - Node.js ServerResponse or SessionOptions (2-arg mode)
 * @param optionsIfThreeArgs - SessionOptions (only for 3-arg mode)
 * @returns Proxied session with both Session API methods and direct data access
 * @throws {SessionError} If options are invalid or request type is unsupported
 * 
 * @example
 * ```typescript
 * // Express (Node.js)
 * app.get('/profile', async (req, res) => {
 *   const session = await getSession(req, res, { secrets: process.env.SESSION_SECRET });
 *   if (!session.userId) return res.redirect('/login');
 *   res.json({ userId: session.userId });
 * });
 * 
 * // Cloudflare Workers (Edge)
 * export default {
 *   async fetch(request) {
 *     const session = await getSession(request, { secrets: env.SESSION_SECRET });
 *     session.set('userId', '123');
 *     const response = new Response('Success');
 *     return session.saveToResponse(response);
 *   }
 * };
 * ```
 */
export async function getSession<T extends SessionData = SessionData>(
  request: unknown,
  responseOrOptions?: unknown,
  optionsIfThreeArgs?: SessionOptions
): Promise<Session<T> & T> {
  // Determine if called with 2 or 3 arguments
  let response: unknown;
  let options: SessionOptions;
  
  if (optionsIfThreeArgs) {
    // 3 args: getSession(req, res, options)
    response = responseOrOptions;
    options = optionsIfThreeArgs;
  } else {
    // 2 args: getSession(req, options)
    response = undefined;
    options = responseOrOptions as SessionOptions;
  }
  
  const normalizedOptions = normalizeOptions(options);
  validateOptions(normalizedOptions);
  
  const adapter = createAdapter(request, response);
  const cookieValue = adapter.readCookie(normalizedOptions.cookieName);

  let sessionImpl: SessionImpl<T>;
  
  if (cookieValue) {
    sessionImpl = await SessionImpl.fromCookie<T>(cookieValue, adapter, normalizedOptions);
  } else {
    sessionImpl = SessionImpl.createNew<T>(adapter, normalizedOptions);
  }
  
  return createProxiedSession<T>(sessionImpl);
}

/**
 * Synchronously get or create a session (Node.js only).
 * 
 * Uses Node.js crypto for synchronous encryption/decryption.
 * Only works in Node.js environments - for Edge runtimes, use async getSession().
 * 
 * @param request - Node.js IncomingMessage
 * @param response - Node.js ServerResponse
 * @param options - Session configuration
 * @returns Proxied session with both Session API methods and direct data access
 * @throws {SessionError} If node:crypto is not available or options are invalid
 * 
 * ⚠️ Only use this if you absolutely need synchronous session access.
 * The async getSession() is preferred for most use cases.
 * 
 * @example
 * ```typescript
 * // Express with synchronous session access
 * app.get('/profile', (req, res) => {
 *   const session = getSessionSync(req, res, { secrets: process.env.SESSION_SECRET });
 *   if (!session.userId) return res.redirect('/login');
 *   res.json({ userId: session.userId });
 * });
 * ```
 */
export function getSessionSync<T extends SessionData = SessionData>(
  request: unknown,
  response: unknown,
  options: SessionOptions
): Session<T> & T {
  const normalizedOptions = normalizeOptions(options);
  validateOptions(normalizedOptions);
  
  const adapter = createAdapter(request, response);
  const cookieValue = adapter.readCookie(normalizedOptions.cookieName);

  let sessionImpl: SessionImpl<T>;
  
  if (cookieValue) {
    sessionImpl = SessionImpl.fromCookieSync<T>(cookieValue, adapter, normalizedOptions);
  } else {
    sessionImpl = SessionImpl.createNew<T>(adapter, normalizedOptions);
  }
  
  return createProxiedSession<T>(sessionImpl);
}
