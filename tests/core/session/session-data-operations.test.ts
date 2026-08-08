import { SessionError, SessionErrorCode } from '../../../src/error';
import { SessionImpl } from '../../../src/core/session';
import { MockAdapter, mockOptions, TestSessionData } from '../../test-utils';

describe('SessionImpl - Data Operations', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('get()', () => {
    it('should return undefined for non-existent keys', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(session.get('userId')).toBeUndefined();
    });

    it('should handle null values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId' as any, null);
      expect(session.get('userId')).toBeNull();
    });

    it('should retrieve a value that was set', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      expect(session.get('userId')).toBe('123');
    });

    it('should retrieve multiple different values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      expect(session.get('userId')).toBe('123');
      expect(session.get('tenantId')).toBe('tenant-456');
    });

    it('should handle boolean values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('isAuthenticated', true);
      expect(session.get('isAuthenticated')).toBe(true);
    });

    it('should handle number values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('counter', 42);
      expect(session.get('counter')).toBe(42);
    });

    it('should handle object values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const prefs = { theme: 'dark' };
      session.set('preferences', prefs);
      expect(session.get('preferences')).toEqual(prefs);
      expect(session.get('preferences')?.theme).toEqual('dark');
    });

    it('should handle array values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const arr = ['item1', 'item2', 'item3'];
      session.set('preferences' as any, arr);
      expect(session.get('preferences')).toEqual(arr);
    });

    it('should handle undefined values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', undefined);
      expect(session.get('userId')).toBeUndefined();
    });

    it('should handle empty string values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '');
      expect(session.get('userId')).toBe('');
    });

    it('should handle zero as a number value', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('counter', 0);
      expect(session.get('counter')).toBe(0);
    });
  });

  describe('set()', () => {
    it('should set a string value', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      expect(session.get('userId')).toBe('123');
    });

    it('should set a number value', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('counter', 100);
      expect(session.get('counter')).toBe(100);
    });

    it('should set an object value', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const prefs = { theme: 'light' };
      session.set('preferences', prefs);
      expect(session.get('preferences')).toEqual(prefs);
    });

    it('should overwrite existing values', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('userId', '456');
      expect(session.get('userId')).toBe('456');
    });

    it('should set multiple different keys', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      session.set('counter', 5);
      expect(session.get('userId')).toBe('123');
      expect(session.get('tenantId')).toBe('tenant-456');
      expect(session.get('counter')).toBe(5);
    });

    it('should throw error when session is destroyed', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.destroy();

      expect(() => {
        session.set('userId', '123');
      }).toThrow(SessionError);

      try {
        session.set('userId', '123');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_DESTROYED);
        expect((error as SessionError).message).toContain('Cannot modify a destroyed session');
      }
    });

    it('should allow setting values rapidly in succession', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      for (let i = 0; i < 100; i++) {
        session.set('counter', i);
      }
      expect(session.get('counter')).toBe(99);
    });

    describe('data isolation', () => {
      it('should keep data isolated between different session instances', () => {
        const session1 = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
        const session2 = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
        session1.set('userId', '123');
        session2.set('userId', '456');
        expect(session1.get('userId')).toBe('123');
        expect(session2.get('userId')).toBe('456');
      });

      it('should not mutate original data passed to constructor', () => {
        const originalData: TestSessionData = { userId: '123' };
        const session = new SessionImpl(originalData, adapter as any, mockOptions);
        session.set('userId', '456');
        expect(originalData.userId).toBe('123');
        expect(session.get('userId')).toBe('456');
      });
    });
  });

  describe('delete()', () => {
    it('should delete an existing key', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.delete('userId');
      expect(session.get('userId')).toBeUndefined();
    });

    it('should not throw when deleting non-existent key', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(() => {
        session.delete('userId');
      }).not.toThrow();
    });

    it('should delete multiple keys independently', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      session.delete('userId');
      expect(session.get('userId')).toBeUndefined();
      expect(session.get('tenantId')).toBe('tenant-456');
    });

    it('should allow re-setting after deletion', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.delete('userId');
      session.set('userId', '456');
      expect(session.get('userId')).toBe('456');
    });

    it('should throw error when session is destroyed', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();

      expect(() => {
        session.delete('userId');
      }).toThrow(SessionError);

      try {
        session.delete('userId');
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_DESTROYED);
        expect((error as SessionError).message).toContain('Cannot modify a destroyed session');
      }
    });

    it('should handle deleting the same key multiple times', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.delete('userId');
      session.delete('userId');
      session.delete('userId');
      expect(session.get('userId')).toBeUndefined();
    });
  });

  describe('toJSON()', () => {
    it('should return empty object for new session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(session.toJSON()).toEqual({});
    });

    it('should include complex nested objects', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const prefs = { theme: 'dark' };
      session.set('userId', '123');
      session.set('preferences', prefs);
      const json = session.toJSON();
      expect(json).toEqual({
        userId: '123',
        preferences: { theme: 'dark' },
      });
    });

    it('should reflect deletions', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      session.delete('userId');
      expect(session.toJSON()).toEqual({ tenantId: 'tenant-456' });
    });

    it('should not expose private fields', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const json = session.toJSON();
      expect(json).not.toHaveProperty('#data');
      expect(json).not.toHaveProperty('#isDestroyed');
      expect(json).not.toHaveProperty('#deferredMode');
      expect(json).not.toHaveProperty('#needsSave');
      expect(json).not.toHaveProperty('#needsDestroy');
      expect(json).not.toHaveProperty('#adapter');
      expect(json).not.toHaveProperty('#options');
      expect(json).not.toHaveProperty('#secrets');
    });

    it('should work with JSON.stringify()', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      const jsonString = JSON.stringify(session);
      const parsed = JSON.parse(jsonString);
      expect(parsed).toEqual({ userId: '123', tenantId: 'tenant-456' });
    });

    it('should return empty object after destroy', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      expect(session.toJSON()).toEqual({});
    });

    it('should handle undefined values in data', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', undefined);
      const json = session.toJSON();
      expect('userId' in json).toBe(true);
      expect(json.userId).toBeUndefined();
    });
  });

  describe('toString()', () => {
    it('should return JSON string for empty session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(session.toString()).toBe('{}');
    });

    it('should include nested objects', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('preferences', { theme: 'dark' });
      const result = session.toString();
      const parsed = JSON.parse(result);
      expect(parsed).toEqual({ userId: '123', preferences: { theme: 'dark' } });
    });

    it('should return valid JSON that can be parsed', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('counter', 42);
      const result = session.toString();
      expect(() => JSON.parse(result)).not.toThrow();
      expect(JSON.parse(result)).toEqual({ userId: '123', counter: 42 });
    });

    it('should return empty object string after destroy', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      expect(session.toString()).toBe('{}');
    });

    it('should not expose private fields in string output', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const result = session.toString();
      expect(result).not.toContain('#data');
      expect(result).not.toContain('#isDestroyed');
      expect(result).not.toContain('#deferredMode');
      expect(result).not.toContain('#needsSave');
      expect(result).not.toContain('#needsDestroy');
      expect(result).not.toContain('#adapter');
      expect(result).not.toContain('#options');
      expect(result).not.toContain('#secrets');
    });
  });

  describe('[Symbol.for("nodejs.util.inspect.custom")]()', () => {
    const inspectSymbol = Symbol.for('nodejs.util.inspect.custom');

    it('should return session data object', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({ userId: '123' });
    });

    it('should return empty object for new session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({});
    });

    it('should include all session data properties', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      session.set('counter', 42);
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({
        userId: '123',
        tenantId: 'tenant-456',
        counter: 42,
      });
    });

    it('should not expose private fields', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).not.toHaveProperty('#data');
      expect(inspectResult).not.toHaveProperty('#isDestroyed');
      expect(inspectResult).not.toHaveProperty('#deferredMode');
      expect(inspectResult).not.toHaveProperty('#needsSave');
      expect(inspectResult).not.toHaveProperty('#needsDestroy');
      expect(inspectResult).not.toHaveProperty('#adapter');
      expect(inspectResult).not.toHaveProperty('#options');
      expect(inspectResult).not.toHaveProperty('#secrets');
    });

    it('should not expose session methods', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).not.toHaveProperty('get');
      expect(inspectResult).not.toHaveProperty('set');
      expect(inspectResult).not.toHaveProperty('delete');
      expect(inspectResult).not.toHaveProperty('save');
      expect(inspectResult).not.toHaveProperty('destroy');
    });

    it('should reflect data changes', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      let inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({ userId: '123' });
      session.set('tenantId', 'tenant-456');
      inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({
        userId: '123',
        tenantId: 'tenant-456',
      });
    });

    it('should reflect deletions', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');
      session.delete('userId');
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({ tenantId: 'tenant-456' });
    });

    it('should return empty object after destroy', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.destroy();
      const inspectResult = (session as any)[inspectSymbol]();
      expect(inspectResult).toEqual({});
    });

    it('should work with Node.js util.inspect', () => {
      // This test verifies the symbol method exists and returns correct data
      // The inspect symbol is called internally by Node.js util.inspect()
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');

      // Verify the method exists by checking the symbol on the session
      const hasInspect = inspectSymbol in session;
      expect(hasInspect).toBe(true);

      // Verify calling it returns the expected data
      const result = (session as any)[inspectSymbol]();
      expect(result).toEqual({ userId: '123' });
    });
  });

  describe('consistency between serialization methods', () => {
    it('should have all serialization methods return consistent data', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', '123');
      session.set('tenantId', 'tenant-456');

      const json = session.toJSON();
      const str = session.toString();
      const inspect = (session as any)[Symbol.for('nodejs.util.inspect.custom')]();

      // toJSON and inspect should return same structure
      expect(json).toEqual(inspect);

      // toString should match JSON.stringify(toJSON())
      expect(str).toBe(JSON.stringify(json));

      // All should represent same data
      expect(json).toEqual({ userId: '123', tenantId: 'tenant-456' });
      expect(JSON.parse(str)).toEqual({ userId: '123', tenantId: 'tenant-456' });
      expect(inspect).toEqual({ userId: '123', tenantId: 'tenant-456' });
    });
  });
});
