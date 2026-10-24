import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { PlatformDetector } from '../../src/adapters/base';

describe('PlatformDetector', () => {
  describe('hasProps() - via other methods', () => {
    it('should return false for null', () => {
      expect(PlatformDetector.isWebRequest(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(PlatformDetector.isWebRequest(undefined)).toBe(false);
    });

    it('should return false for primitive types', () => {
      expect(PlatformDetector.isWebRequest('string')).toBe(false);
      expect(PlatformDetector.isWebRequest(123)).toBe(false);
      expect(PlatformDetector.isWebRequest(true)).toBe(false);
    });

    it('should return false for objects missing required properties', () => {
      expect(PlatformDetector.isWebRequest({})).toBe(false);
      expect(PlatformDetector.isWebRequest({ headers: {} })).toBe(false);
    });
  });

  describe('isWebRequest()', () => {
    it('should return true for valid Web Standard Request', () => {
      const req = new Request('http://localhost');
      expect(PlatformDetector.isWebRequest(req)).toBe(true);
    });

    it('should return false when missing headers property', () => {
      const obj = {
        url: 'http://localhost',
      };
      expect(PlatformDetector.isWebRequest(obj)).toBe(false);
    });

    it('should return false when missing url property', () => {
      const obj = {
        headers: new Headers(),
      };
      expect(PlatformDetector.isWebRequest(obj)).toBe(false);
    });

    it('should return false when headers.get is not a function', () => {
      const obj = {
        headers: { get: 'not a function' },
        url: 'http://localhost',
      };
      expect(PlatformDetector.isWebRequest(obj)).toBe(false);
    });

    it('should return false when url is not a string', () => {
      const obj = {
        headers: { get: (): any => {} },
        url: 123,
      };
      expect(PlatformDetector.isWebRequest(obj)).toBe(false);
    });

    it('should return false for Node.js IncomingMessage', () => {
      const socket = new Socket();
      const req = new IncomingMessage(socket);
      req.url = '/test';
      req.method = 'GET';

      expect(PlatformDetector.isWebRequest(req)).toBe(false);
    });
  });

  describe('isNodeRequest()', () => {
    it('should return true for valid Node.js IncomingMessage', () => {
      const socket = new Socket();
      const req = new IncomingMessage(socket);
      req.url = '/test';
      req.method = 'GET';

      expect(PlatformDetector.isNodeRequest(req)).toBe(true);
    });

    it('should return false when missing headers property', () => {
      const obj = {
        method: 'GET',
        url: '/test',
      };
      expect(PlatformDetector.isNodeRequest(obj)).toBe(false);
    });

    it('should return false when missing method property', () => {
      const obj = {
        headers: {},
        url: '/test',
      };
      expect(PlatformDetector.isNodeRequest(obj)).toBe(false);
    });

    it('should return false when missing url property', () => {
      const obj = {
        headers: {},
        method: 'GET',
      };
      expect(PlatformDetector.isNodeRequest(obj)).toBe(false);
    });

    it('should return false when method is not a string', () => {
      const obj = {
        headers: {},
        method: 123,
        url: '/test',
      };
      expect(PlatformDetector.isNodeRequest(obj)).toBe(false);
    });

    it('should return false when url is not a string', () => {
      const obj = {
        headers: {},
        method: 'GET',
        url: 123,
      };
      expect(PlatformDetector.isNodeRequest(obj)).toBe(false);
    });

    it('should return false when headers.get exists (Web Request)', () => {
      const obj = {
        headers: {
          get: (): any => {},
        },
        method: 'GET',
        url: '/test',
      };
      expect(PlatformDetector.isNodeRequest(obj)).toBe(false);
    });

    it('should return false for Web Standard Request', () => {
      const req = new Request('http://localhost');
      expect(PlatformDetector.isNodeRequest(req)).toBe(false);
    });
  });
});
