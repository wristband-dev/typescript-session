import type { IncomingMessage, ServerResponse } from 'http';

import { CookieOptions, SessionAdapter } from '../types';

/**
 * Abstract base adapter that defines the interface for platform-specific cookie operations.
 *
 * Provides a common constructor and abstract methods that concrete adapters must implement
 * for reading and writing cookies on different platforms (Web Standard, Node.js, etc.).
 *
 * @internal
 */
export abstract class BaseAdapter implements SessionAdapter {
  protected request: Request | IncomingMessage;
  protected response: Response | ServerResponse | undefined;

  constructor(request: unknown, response?: unknown) {
    this.request = request as Request | IncomingMessage;
    this.response = response as Response | ServerResponse | undefined;
  }

  abstract readCookie(cookieName: string): string | undefined;
  abstract writeCookie(cookieName: string, value: string, options: CookieOptions): void;
  abstract canWriteCookies(): boolean;
}

/**
 * Utility class for detecting the execution platform of a request object.
 *
 * Provides static type guards for distinguishing between Web Standard and Node.js
 * request types. This enables the SDK to dynamically select the appropriate session
 * adapter implementation at runtime. This class does not instantiate adapters directly; it is
 * used internally by the adapter factory to determine which concrete adapter should be created.
 *
 * @internal
 */
export class PlatformDetector {
  /**
   * Type guard to check if an object has specific properties.
   *
   * @param obj - Object to check
   * @param props - Property names to look for
   * @returns True if object has all specified properties
   *
   * @internal
   */
  private static hasProps(obj: unknown, ...props: string[]): obj is Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    return props.every((prop) => prop in obj);
  }

  /**
   * Checks if object is a Web Standard Request.
   *
   * Detects Request objects by checking for headers.get() method and url property,
   * which are characteristic of the Web Standard Request API.
   *
   * @param obj - Object to check
   * @returns True if object is a Web Standard Request
   *
   * @internal
   */
  static isWebRequest(obj: unknown): obj is Request {
    if (!this.hasProps(obj, 'headers', 'url')) {
      return false;
    }

    const headers = obj.headers as Record<string, unknown>;
    return typeof headers.get === 'function' && typeof obj.url === 'string';
  }

  /**
   * Checks if object is a Node.js IncomingMessage.
   *
   * Detects IncomingMessage objects by checking for headers, method, and url properties,
   * while ensuring it does NOT have headers.get() (which would indicate Web Standard Request).
   *
   * @param obj - Object to check
   * @returns True if object is a Node.js IncomingMessage
   *
   * @internal
   */
  static isNodeRequest(obj: unknown): obj is IncomingMessage {
    if (!this.hasProps(obj, 'headers', 'method', 'url')) {
      return false;
    }

    const headers = obj.headers as Record<string, unknown>;
    return typeof obj.method === 'string' && typeof obj.url === 'string' && !headers.get;
  }
}
