/**
 * Proxy wrapper for seamless session data access
 */
import { SessionError, SessionErrorCode } from '../error';
import { Session, SessionData } from '../types';
import { SessionImpl } from './session';

/**
 * Create a proxied session that allows direct property access.
 * 
 * Enables both session methods (save, destroy, etc.) and direct data access:
 * - session.save() → Session method
 * - session.userId → Proxied to session.get('userId')
 * - session.customField = value → Proxied to session.set('customField', value)
 * 
 * @param sessionImpl - The underlying SessionImpl instance
 * @returns Proxied session with combined Session API and data access
 */
export function createProxiedSession<T extends SessionData>(sessionImpl: SessionImpl<T>): Session<T> & T {
  const proxy =  new Proxy(sessionImpl, {
    /**
     * Intercepts property reads on the session.
     * 
     * Prioritizes Session methods/properties over session data.
     * Falls back to session.get() for data access.
     * 
     * @param target - The SessionImpl instance
     * @param prop - Property being accessed
     * @returns The property value (method, Session property, or session data)
     */
    get(target, prop: string | symbol): unknown {
      // Prevent the session from being treated as a Promise
      if (prop === 'then') {
        return undefined;
      }

      // Hide the class name in console output
      if (prop === 'constructor') {
        return Object;
      }
      
      // For Object.prototype.toString()
      if (prop === Symbol.toStringTag) {
        return 'Object';
      }

      // Intercept toString to return JSON string
      if (prop === 'toString') {
        return () => target.toString();
      }
      
      // For Node.js console (if ever used)
      if (prop === Symbol.for('nodejs.util.inspect.custom')) {
        return () => target.toJSON();
      }
      
      // Private fields with # can't be accessed through Proxy
      if (typeof prop === 'string' && prop.startsWith('#')) {
        return undefined;
      }
      
      // Return actual Session methods/properties
      if (prop in target || typeof prop === 'symbol') {
        const value = target[prop as keyof SessionImpl<T>];
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }
      
      // Otherwise get from session data
      return target.get(prop as keyof T);
    },

    /**
     * Intercepts property writes on the session.
     * 
     * Prevents overwriting Session methods/properties.
     * Delegates data writes to session.set().
     * 
     * @param target - The SessionImpl instance
     * @param prop - Property being set
     * @param value - Value to set
     * @returns true if successful
     * @throws Error if attempting to override Session methods/properties
     */
    set(target, prop: string | symbol, value: unknown): boolean {
      // Don't allow overwriting Session methods/properties
      if (prop in target || typeof prop === 'symbol') {
        throw new SessionError(
          SessionErrorCode.INVALID_CONFIGURATION,
          `Cannot override session property: ${String(prop)}`
        );
      }
      
      // Set in session data
      target.set(prop as keyof T, value as T[keyof T]);
      return true;
    },

    /**
     * Intercepts property deletion on the session.
     * 
     * Delegates to session.delete() for data properties.
     * Prevents deletion of symbols.
     * 
     * @param target - The SessionImpl instance
     * @param prop - Property being deleted
     * @returns true if successful
     */
    deleteProperty(target, prop: string | symbol): boolean {
      if (typeof prop === 'symbol') {
        return false;
      }
      target.delete(prop as keyof T);
      return true;
    }
  }) as unknown as Session<T> & T;

  /**
   * Custom inspection for Node.js console.log() and util.inspect().
   * 
   * When you log a proxied session in Node.js (e.g., console.log(session)),
   * Node.js calls this custom inspector to determine what to display.
   * 
   * Without this, the proxy would show the entire SessionImpl class structure
   * (methods, private fields, etc.). With this custom inspector, it shows only
   * the session data (like { userId: '123', tenantId: 'abc' }).
   * 
   * Note: Must be defined directly on the proxy object (not via the trap)
   * because Node.js checks for this symbol before invoking proxy traps.
   */
  Object.defineProperty(proxy, Symbol.for('nodejs.util.inspect.custom'), {
    value: () => sessionImpl.toJSON(),
    enumerable: false,
    writable: false,
    configurable: false
  });

  return proxy;
}
