/**
 * Response headers that prevent caching of any response that writes or deletes a session cookie.
 *
 * A response that sets session cookies is specific to one user, so it must never be stored by
 * the browser or by a shared cache (CDN, proxy) and served to someone else. `Cache-Control: no-store`
 * is the modern directive. `Pragma: no-cache` is included for older HTTP/1.0 caches.
 *
 * Written whenever the session is saved or destroyed, whether through the adapters (`save()`,
 * `destroy()`) or directly onto a Response (`saveToResponse()`, `destroyToResponse()`).
 *
 * @internal
 */
export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
} as const;
