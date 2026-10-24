import { SessionError, SessionErrorCode } from '../../src/error';
import { SessionImpl } from '../../src/core/session';
import { createProxiedSession } from '../../src/core/proxy';
import { MockAdapter, mockOptions, TestSessionData } from '../test-utils';

describe('createProxiedSession', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('property get trap', () => {
    it('should access session data properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');

      const proxy = createProxiedSession(sessionImpl);

      expect((proxy as any).userId).toBe('123');
    });

    it('should access Session methods', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);

      // Common methods
      expect(typeof proxy.get).toBe('function');
      expect(typeof proxy.set).toBe('function');
      expect(typeof proxy.delete).toBe('function');
      expect(typeof proxy.toJSON).toBe('function');
      expect(typeof proxy.toString).toBe('function');

      // Node-specific methods
      expect(typeof proxy.save).toBe('function');
      expect(typeof proxy.destroy).toBe('function');
      expect(typeof proxy.enableDeferredMode).toBe('function');
      expect(typeof proxy.flush).toBe('function');
      expect(typeof proxy.flushSync).toBe('function');

      // Edge-specific methods
      expect(typeof proxy.saveToResponse).toBe('function');
      expect(typeof proxy.destroyToResponse).toBe('function');
      expect(typeof proxy.getCookieDataForSave).toBe('function');
      expect(typeof proxy.getCookieDataForDestroy).toBe('function');

      // Wristband-specific methods
      expect(typeof proxy.fromCallback).toBe('function');
      expect(typeof proxy.getSessionResponse).toBe('function');
      expect(typeof proxy.getTokenResponse).toBe('function');
    });

    it('should bind Session methods to target', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');

      const proxy = createProxiedSession(sessionImpl);
      const getValue = proxy.get;

      // Method should still work when extracted
      expect(getValue('userId')).toBe('123');
    });

    it('should return undefined for "then" property', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);

      expect((proxy as any).then).toBeUndefined();
    });

    it('should return Object for "constructor" property', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);

      expect((proxy as any).constructor).toBe(Object);
    });

    it('should return "Object" for Symbol.toStringTag', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);

      expect((proxy as any)[Symbol.toStringTag]).toBe('Object');
    });

    it('should handle toString() method', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');

      const proxy = createProxiedSession(sessionImpl);

      expect(typeof proxy.toString).toBe('function');
      const result = (proxy as any).toString();
      expect(result).toContain('userId');
      expect(result).toContain('123');
    });

    it('should return undefined for properties starting with #', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);

      expect((proxy as any)['#private']).toBeUndefined();
    });

    it('should handle symbol properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);
      const testSymbol = Symbol('test');

      // Symbols that exist on target should return undefined (since they're not in SessionImpl)
      expect((proxy as any)[testSymbol]).toBeUndefined();
    });

    it('should return undefined for non-existent data properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);

      expect((proxy as any).userId).toBeUndefined();
    });

    it('should handle nodejs.util.inspect.custom symbol', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');

      const proxy = createProxiedSession(sessionImpl);
      const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

      const inspectFn = (proxy as any)[inspectSymbol];
      expect(typeof inspectFn).toBe('function');

      const result = inspectFn();
      expect(result).toEqual({ userId: '123' });
    });
  });

  describe('property set trap', () => {
    it('should set session data properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      proxy.userId = '456';

      expect(proxy.userId).toBe('456');
      expect(sessionImpl.get('userId')).toBe('456');
    });

    it('should set multiple data properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      proxy.userId = '123';
      proxy.tenantId = 'tenant-456';

      expect(proxy.userId).toBe('123');
      expect(proxy.tenantId).toBe('tenant-456');
    });

    it('should throw error when trying to override Session methods', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      expect(() => {
        proxy.get = (): any => 'hacked';
      }).toThrow(SessionError);

      try {
        proxy.set = (): any => {};
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.INVALID_CONFIGURATION);
        expect((error as SessionError).message).toContain('Cannot override session property');
        expect((error as SessionError).message).toContain('set');
      }
    });

    it('should throw error when trying to set symbol properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;
      const testSymbol = Symbol('test');

      expect(() => {
        proxy[testSymbol] = 'value';
      }).toThrow(SessionError);
    });

    it('should handle setting undefined values', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      proxy.userId = undefined;

      expect(proxy.userId).toBeUndefined();
    });

    it('should handle setting null values', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      proxy.userId = null;

      expect(proxy.userId).toBeNull();
    });
  });

  describe('deleteProperty trap', () => {
    it('should delete session data properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');

      const proxy = createProxiedSession(sessionImpl) as any;

      expect(proxy.userId).toBe('123');

      delete proxy.userId;

      expect(proxy.userId).toBeUndefined();
      expect(sessionImpl.get('userId')).toBeUndefined();
    });

    it('should return false for symbol properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);
      const testSymbol = Symbol('test');

      const result = Reflect.deleteProperty(proxy, testSymbol);

      expect(result).toBe(false);
    });

    it('should handle deleting non-existent properties', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      expect(() => {
        delete proxy.userId;
      }).not.toThrow();
    });
  });

  describe('custom nodejs inspector', () => {
    it('should define custom inspector as non-enumerable', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl);
      const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

      const descriptor = Object.getOwnPropertyDescriptor(proxy, inspectSymbol);

      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(false);
      expect(descriptor?.writable).toBe(false);
      expect(descriptor?.configurable).toBe(false);
    });

    it('should return session data for inspection', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');
      sessionImpl.set('tenantId', 'tenant-456');

      const proxy = createProxiedSession(sessionImpl);
      const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

      const inspectFn = (proxy as any)[inspectSymbol];
      const result = inspectFn();

      expect(result).toEqual({
        userId: '123',
        tenantId: 'tenant-456',
      });
    });

    it('should not include Session properties in inspection', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');

      const proxy = createProxiedSession(sessionImpl);
      const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

      const inspectFn = (proxy as any)[inspectSymbol];
      const result = inspectFn();

      expect(result).not.toHaveProperty('isNew');
      expect(result).not.toHaveProperty('get');
      expect(result).not.toHaveProperty('set');
    });
  });

  describe('integration scenarios', () => {
    it('should work with destructuring', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');
      sessionImpl.set('tenantId', 'tenant-456');

      const proxy = createProxiedSession(sessionImpl) as any;
      const { userId, tenantId } = proxy;

      expect(userId).toBe('123');
      expect(tenantId).toBe('tenant-456');
    });

    it('should work with toJSON() to get all data', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      sessionImpl.set('userId', '123');
      sessionImpl.set('tenantId', 'tenant-456');

      const proxy = createProxiedSession(sessionImpl);
      const data = proxy.toJSON();
      const keys = Object.keys(data);

      expect(keys).toContain('userId');
      expect(keys).toContain('tenantId');
      expect(data.userId).toBe('123');
      expect(data.tenantId).toBe('tenant-456');
    });

    it('should maintain method context across multiple calls', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      proxy.counter = 0;
      proxy.set('counter', proxy.get('counter')! + 1);
      proxy.set('counter', proxy.get('counter')! + 1);

      expect(proxy.counter).toBe(2);
    });

    it('should handle chaining operations', () => {
      const sessionImpl = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const proxy = createProxiedSession(sessionImpl) as any;

      proxy.userId = '123';
      expect(proxy.get('userId')).toBe('123');

      proxy.set('tenantId', 'tenant-456');
      expect(proxy.tenantId).toBe('tenant-456');

      proxy.delete('userId');
      expect(proxy.userId).toBeUndefined();
    });
  });
});
