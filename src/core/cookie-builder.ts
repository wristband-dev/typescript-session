/**
 * Helper utilities for building cookie options
 */
import { CookieOptions, NormalizedSessionOptions } from '../types';

export class CookieBuilder {
  /**
   * Build session cookie options
   */
  static forSession(options: NormalizedSessionOptions): CookieOptions {
    const cookieOptions: CookieOptions = {
      maxAge: options.maxAge,
      path: options.path,
      secure: options.secure,
      httpOnly: true, // Session cookies shouldn't be accessible by Javascript
      sameSite: options.sameSite
    };
    
    if (options.domain !== undefined) {
      cookieOptions.domain = options.domain;
    }
    
    return cookieOptions;
  }

  /**
   * Build CSRF cookie options
   */
  static forCsrf(options: NormalizedSessionOptions): CookieOptions {
    const cookieOptions: CookieOptions = {
      maxAge: options.maxAge,
      path: options.path,
      secure: options.secure,
      httpOnly: false, // CSRF cookies must be accessible by Javascript
      sameSite: options.sameSite
    };
    
    if (options.csrfCookieDomain !== undefined) {
      cookieOptions.domain = options.csrfCookieDomain;
    }
    
    return cookieOptions;
  }

  /**
   * Build session destroy cookie options
   */
  static forSessionDestroy(options: NormalizedSessionOptions): CookieOptions {
    const destroyOptions: CookieOptions = {
      path: options.path,
      maxAge: 0,
      secure: options.secure,
      httpOnly: true,
      sameSite: options.sameSite
    };
    
    if (options.domain !== undefined) {
      destroyOptions.domain = options.domain;
    }
    
    return destroyOptions;
  }

  /**
   * Build CSRF destroy cookie options
   */
  static forCsrfDestroy(options: NormalizedSessionOptions): CookieOptions {
    const destroyOptions: CookieOptions = {
      path: options.path,
      maxAge: 0,
      secure: options.secure,
      httpOnly: false,
      sameSite: options.sameSite
    };
    
    if (options.csrfCookieDomain !== undefined) {
      destroyOptions.domain = options.csrfCookieDomain;
    }
    
    return destroyOptions;
  }
}
