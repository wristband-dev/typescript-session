import { NormalizedSessionOptions, SessionData } from '../src/types';

export class MockAdapter {
  readCookie = jest.fn().mockReturnValue(undefined);
  writeCookie = jest.fn();
  writeNoCacheHeaders = jest.fn();
  canWriteCookies = jest.fn().mockReturnValue(true);
}

export class EdgeMockAdapter {
  readCookie = jest.fn().mockReturnValue(undefined);
  writeCookie = jest.fn();
  writeNoCacheHeaders = jest.fn();
  canWriteCookies = jest.fn().mockReturnValue(false); // Edge doesn't have direct cookie access
}

export const mockOptions: NormalizedSessionOptions = {
  secrets: 'a'.repeat(32),
  cookieName: 'session',
  maxAge: 3600,
  path: '/',
  secure: true,
  sameSite: 'Lax',
  csrfCookieName: 'CSRF-TOKEN',
  enableCsrfProtection: false,
};

export interface TestSessionData extends SessionData {
  counter?: number;
  customField?: string;
  preferences?: { theme: string };
}
