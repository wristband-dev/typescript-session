/**
 * Session SDK - Main entry point
 */

// Main API
export { getSession, getSessionSync } from './get-session';

// Types for consumers
export type {
  CallbackData,
  CookieOptions,
  SameSiteOption,
  Session,
  SessionData,
  SessionOptions,
  SessionResponse,
  TokenResponse,
  UserInfo,
  UserInfoRole
} from './types';

// Error Handling for consumers
export { SessionError, SessionErrorCode } from './error';
