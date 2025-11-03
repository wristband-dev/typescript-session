import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { getSession, getSessionSync } from '../src/get-session';
import { SessionError, SessionErrorCode } from '../src/error';
import { SessionOptions } from '../src/types';

describe('getSession', () => {
  const validOptions: SessionOptions = { secrets: 'a'.repeat(32) };

  describe('platform detection', () => {
    it('should accept Web Standard Request', async () => {
      const mockRequest = new Request('http://localhost');
      const session = await getSession(mockRequest, validOptions);
      expect(session).toBeDefined();
    });

    it('should accept Node.js IncomingMessage', async () => {
      const socket = new Socket();
      const mockRequest = new IncomingMessage(socket);
      mockRequest.url = '/test';
      mockRequest.method = 'GET';
      const session = await getSession(mockRequest, validOptions);
      expect(session).toBeDefined();
    });

    it('should throw error for unsupported request type', async () => {
      const invalidRequest = { invalid: 'object' };
      await expect(getSession(invalidRequest, validOptions)).rejects.toThrow(SessionError);
      await expect(getSession(invalidRequest, validOptions)).rejects.toThrow('Unsupported request type');
    });

    it('should throw error for null request', async () => {
      await expect(getSession(null as any, validOptions)).rejects.toThrow(SessionError);
    });

    it('should throw error for undefined request', async () => {
      await expect(getSession(undefined as any, validOptions)).rejects.toThrow(SessionError);
    });
  });

  describe('session creation', () => {
    it('should create new session when no cookie present', async () => {
      const mockRequest = new Request('http://localhost');
      const session = await getSession(mockRequest, validOptions);
      expect(session).toBeDefined();
      expect(typeof session.get).toBe('function');
      expect(typeof session.set).toBe('function');
      expect(typeof session.save).toBe('function');
    });

    it('should handle invalid/corrupted cookie gracefully', async () => {
      const mockRequest = new Request('http://localhost', {
        headers: { 'Cookie': 'session=invalid-encrypted-value' }
      });
      const session = await getSession(mockRequest, validOptions);
      // Should create new empty session instead of throwing
      expect(session).toBeDefined();
      expect(typeof session.get).toBe('function');
    });
  });

  describe('proxied session behavior', () => {
    it('should return proxied session with all methods', async () => {
      const mockRequest = new Request('http://localhost');
      const session = await getSession(mockRequest, validOptions);

      // Common methods
      expect(session.get).toBeDefined();
      expect(session.set).toBeDefined();
      expect(session.delete).toBeDefined();
      expect(session.toJSON).toBeDefined();
      expect(session.toString).toBeDefined();
      
      // Node-specific methods
      expect(session.save).toBeDefined();
      expect(session.destroy).toBeDefined();
      expect(session.enableDeferredMode).toBeDefined();
      expect(session.flush).toBeDefined();
      expect(session.flushSync).toBeDefined();
      
      // Edge-specific methods
      expect(session.saveToResponse).toBeDefined();
      expect(session.destroyToResponse).toBeDefined();
      expect(session.getCookieDataForSave).toBeDefined();
      expect(session.getCookieDataForDestroy).toBeDefined();
      
      // Wristband-specific methods
      expect(session.fromCallback).toBeDefined();
      expect(session.getSessionResponse).toBeDefined();
      expect(session.getTokenResponse).toBeDefined();
    });

    it('should support direct property access', async () => {
      const mockRequest = new Request('http://localhost');
      const session = await getSession(mockRequest, validOptions);
      session.userId = 'test-user';
      expect(session.userId).toBe('test-user');
    });

    it('should support method-based access', async () => {
      const mockRequest = new Request('http://localhost');
      const session = await getSession(mockRequest, validOptions);
      session.set('userId', 'test-user');
      expect(session.get('userId')).toBe('test-user');
    });
  });

  describe('argument handling', () => {
    it('should handle 2-argument form (request, options)', async () => {
      const mockRequest = new Request('http://localhost');
      const session = await getSession(mockRequest, validOptions);
      expect(session).toBeDefined();
    });

    it('should handle 3-argument form (request, response, options)', async () => {
      const mockRequest = new Request('http://localhost');
      const mockResponse = new Response();
      const session = await getSession(mockRequest, mockResponse, validOptions);
      expect(session).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should propagate validation errors from prepareOptions', async () => {
      const mockRequest = new Request('http://localhost');
      const options: SessionOptions = { secrets: 'short' };
      
      try {
        await getSession(mockRequest, options);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.INVALID_CONFIGURATION);
      }
    });
  });
});

describe('getSessionSync', () => {
  const validOptions: SessionOptions = { secrets: 'a'.repeat(32) };

  describe('session creation', () => {
    it('should create new session when no cookie present', () => {
      const mockRequest = new Request('http://localhost');
      const mockResponse = new Response();
      const session = getSessionSync(mockRequest, mockResponse, validOptions);
      expect(session).toBeDefined();
      expect(typeof session.get).toBe('function');
      expect(typeof session.set).toBe('function');
      expect(typeof session.save).toBe('function');
    });

    it('should support direct property access', () => {
      const mockRequest = new Request('http://localhost');
      const mockResponse = new Response();
      const session = getSessionSync(mockRequest, mockResponse, validOptions);
      session.userId = 'test-user';
      expect(session.userId).toBe('test-user');
    });
  });

  describe('platform detection', () => {
    it('should accept Web Standard Request and Response', () => {
      const mockRequest = new Request('http://localhost');
      const mockResponse = new Response();
      const session = getSessionSync(mockRequest, mockResponse, validOptions);
      expect(session).toBeDefined();
    });

    it('should accept Node.js IncomingMessage and ServerResponse', () => {
      const socket = new Socket();
      const mockRequest = new IncomingMessage(socket);
      mockRequest.url = '/test';
      mockRequest.method = 'GET';
      const mockResponse = new ServerResponse(mockRequest);
      const session = getSessionSync(mockRequest, mockResponse, validOptions);
      expect(session).toBeDefined();
    });

    it('should throw error for unsupported request type', () => {
      const invalidRequest = { invalid: 'object' };
      const mockResponse = new Response();
      expect(() => getSessionSync(invalidRequest, mockResponse, validOptions)).toThrow(SessionError);
      expect(() => getSessionSync(invalidRequest, mockResponse, validOptions)).toThrow('Unsupported request type');
    });
  });

  describe('error handling', () => {
    it('should propagate validation errors from prepareOptions', () => {
      const mockRequest = new Request('http://localhost');
      const mockResponse = new Response();
      const options: SessionOptions = { secrets: 'short' };
      expect(() => getSessionSync(mockRequest, mockResponse, options)).toThrow(SessionError);
      expect(() => getSessionSync(mockRequest, mockResponse, options)).toThrow('at least 32 characters');
    });
  });
});
