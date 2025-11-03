import { PlatformDetector } from './adapters/base';
import { NodeAdapter } from './adapters/node';
import { WebStandardAdapter } from './adapters/web-standard';
import { prepareOptions } from './core/options';
import { createProxiedSession } from './core/proxy';
import { SessionImpl } from './core/session';
import { SessionError, SessionErrorCode } from './error';
import { Session, SessionData, SessionOptions } from './types';

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
  
  const normalizedOptions = prepareOptions(options);
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
  const normalizedOptions = prepareOptions(options);
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
