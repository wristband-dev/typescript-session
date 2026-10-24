import { SessionError, SessionErrorCode } from '../../../src/error';
import { CallbackData, UserInfo } from '../../../src/types';
import { SessionImpl } from '../../../src/core/session';
import { MockAdapter, mockOptions, TestSessionData } from '../../test-utils';

describe('SessionImpl - Wristband Integration', () => {
  let adapter: MockAdapter;

  const mockUserInfo: UserInfo = {
    userId: 'user-123',
    tenantId: 'tenant-456',
    applicationId: 'app-789',
    identityProviderName: 'Wristband',
    email: 'user@example.com',
    fullName: 'Test User',
  };

  const mockCallbackData: CallbackData = {
    accessToken: 'access-token-abc',
    expiresAt: Date.now() + 3600000,
    expiresIn: 3600,
    idToken: 'id-token-xyz',
    tenantName: 'Test Tenant',
    userinfo: mockUserInfo,
  };

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('fromCallback()', () => {
    it('should populate session with callback data', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      expect(session.get('isAuthenticated')).toBe(true);
      expect(session.get('accessToken')).toBe('access-token-abc');
      expect(session.get('expiresAt')).toBe(mockCallbackData.expiresAt);
      expect(session.get('userId')).toBe('user-123');
      expect(session.get('tenantId')).toBe('tenant-456');
      expect(session.get('tenantName')).toBe('Test Tenant');
      expect(session.get('identityProviderName')).toBe('Wristband');
    });

    it('should include refreshToken when provided', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const callbackWithRefresh = { ...mockCallbackData, refreshToken: 'refresh-token-123' };
      session.fromCallback(callbackWithRefresh);
      expect(session.get('refreshToken')).toBe('refresh-token-123');
    });

    it('should not include refreshToken when not provided', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      expect(session.get('refreshToken')).toBeUndefined();
    });

    it('should include tenantCustomDomain when provided', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const callbackWithDomain = { ...mockCallbackData, tenantCustomDomain: 'custom.example.com' };
      session.fromCallback(callbackWithDomain);
      expect(session.get('tenantCustomDomain')).toBe('custom.example.com');
    });

    it('should not include tenantCustomDomain when not provided', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      expect(session.get('tenantCustomDomain')).toBeUndefined();
    });

    it('should merge custom fields', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const customFields = { customField: 'custom-value', preferences: { theme: 'dark' } };
      session.fromCallback(mockCallbackData, customFields);
      expect(session.get('customField')).toBe('custom-value');
      expect(session.get('preferences')).toEqual({ theme: 'dark' });
    });

    it('should preserve Wristband fields when merging custom fields', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const customFields = { customField: 'custom-value' };
      session.fromCallback(mockCallbackData, customFields);
      expect(session.get('userId')).toBe('user-123');
      expect(session.get('tenantId')).toBe('tenant-456');
      expect(session.get('accessToken')).toBe('access-token-abc');
      expect(session.get('customField')).toBe('custom-value');
    });

    it('should throw error when callbackData is missing', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);

      expect(() => {
        session.fromCallback(null as any);
      }).toThrow(SessionError);

      try {
        session.fromCallback(null as any);
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.CALLBACK_DATA_INVALID);
        expect((error as SessionError).message).toContain('callbackData is required');
      }
    });

    it('should throw error when userinfo is missing', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const invalidCallback = { ...mockCallbackData, userinfo: undefined as any };

      expect(() => {
        session.fromCallback(invalidCallback);
      }).toThrow(SessionError);

      try {
        session.fromCallback(invalidCallback);
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.CALLBACK_DATA_INVALID);
        expect((error as SessionError).message).toContain('userinfo is required');
      }
    });

    it('should throw error when session is destroyed', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.destroy();

      expect(() => {
        session.fromCallback(mockCallbackData);
      }).toThrow(SessionError);

      try {
        session.fromCallback(mockCallbackData);
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_DESTROYED);
        expect((error as SessionError).message).toContain('Cannot modify a destroyed session');
      }
    });

    it('should throw error when custom fields are not serializable', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      // Create circular reference
      const nonSerializableFields = { circular: {} as any };
      nonSerializableFields.circular.self = nonSerializableFields.circular;

      expect(() => {
        session.fromCallback(mockCallbackData, nonSerializableFields);
      }).toThrow(SessionError);

      try {
        session.fromCallback(mockCallbackData, nonSerializableFields);
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.CUSTOM_FIELDS_NOT_SERIALIZABLE);
        expect((error as SessionError).message).toContain('JSON-serializable');
      }
    });

    it('should allow calling multiple times to update session', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      expect(session.get('userId')).toBe('user-123');

      // Update with new callback data
      const newCallbackData = {
        ...mockCallbackData,
        userinfo: { ...mockUserInfo, userId: 'user-456' },
      };
      session.fromCallback(newCallbackData);
      expect(session.get('userId')).toBe('user-456');
    });

    it('should handle empty custom fields', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData, {});
      const json = session.toJSON();
      const fieldCount = Object.keys(json).length;

      // Should only have the 7 base Wristband fields (no custom fields added)
      expect(fieldCount).toBe(7);
      expect(json).toHaveProperty('isAuthenticated');
      expect(json).toHaveProperty('accessToken');
      expect(json).toHaveProperty('expiresAt');
      expect(json).toHaveProperty('userId');
      expect(json).toHaveProperty('tenantId');
      expect(json).toHaveProperty('tenantName');
      expect(json).toHaveProperty('identityProviderName');
    });
  });

  describe('getSessionResponse()', () => {
    it('should return session response with tenantId and userId', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const response = session.getSessionResponse();
      expect(response.tenantId).toBe('tenant-456');
      expect(response.userId).toBe('user-123');
      expect(response.metadata).toEqual({});
    });

    it('should include provided metadata', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const metadata = { foo: 'bar', baz: 123 };
      const response = session.getSessionResponse(metadata);
      expect(response.tenantId).toBe('tenant-456');
      expect(response.userId).toBe('user-123');
      expect(response.metadata).toEqual({ foo: 'bar', baz: 123 });
    });

    it('should use empty object for metadata when not provided', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const response = session.getSessionResponse();
      expect(response.metadata).toEqual({});
    });

    it('should throw error when tenantId is missing', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('userId', 'user-123');

      expect(() => {
        session.getSessionResponse();
      }).toThrow(SessionError);

      try {
        session.getSessionResponse();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_NOT_AUTHENTICATED);
        expect((error as SessionError).message).toContain('not authenticated');
      }
    });

    it('should throw error when userId is missing', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('tenantId', 'tenant-456');

      expect(() => {
        session.getSessionResponse();
      }).toThrow(SessionError);

      try {
        session.getSessionResponse();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_NOT_AUTHENTICATED);
        expect((error as SessionError).message).toContain('not authenticated');
      }
    });

    it('should handle complex metadata', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const metadata = {
        user: { name: 'Test', age: 30 },
        preferences: ['a', 'b', 'c'],
        flags: { feature1: true, feature2: false },
      };
      const response = session.getSessionResponse(metadata);
      expect(response.metadata).toEqual(metadata);
    });
  });

  describe('getTokenResponse()', () => {
    it('should return token response with accessToken and expiresAt', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const response = session.getTokenResponse();
      expect(response.accessToken).toBe('access-token-abc');
      expect(response.expiresAt).toBe(mockCallbackData.expiresAt);
    });

    it('should throw error when accessToken is missing', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('expiresAt', Date.now());

      expect(() => {
        session.getTokenResponse();
      }).toThrow(SessionError);

      try {
        session.getTokenResponse();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_NOT_AUTHENTICATED);
        expect((error as SessionError).message).toContain('not authenticated');
      }
    });

    it('should throw error when expiresAt is missing', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.set('accessToken', 'token-123');

      expect(() => {
        session.getTokenResponse();
      }).toThrow(SessionError);

      try {
        session.getTokenResponse();
      } catch (error) {
        expect(error).toBeInstanceOf(SessionError);
        expect((error as SessionError).code).toBe(SessionErrorCode.SESSION_NOT_AUTHENTICATED);
        expect((error as SessionError).message).toContain('missing token data');
      }
    });

    it('should return numeric expiresAt timestamp', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const response = session.getTokenResponse();
      expect(typeof response.expiresAt).toBe('number');
      expect(response.expiresAt).toBeGreaterThan(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete authentication flow', async () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);

      // Step 1: Populate session from callback
      session.fromCallback(mockCallbackData, { customField: 'custom-value' });

      // Step 2: Get session response for frontend
      const sessionResponse = session.getSessionResponse({ foo: 'bar' });
      expect(sessionResponse.tenantId).toBe('tenant-456');
      expect(sessionResponse.userId).toBe('user-123');
      expect(sessionResponse.metadata.foo).toBe('bar');

      // Step 3: Get token response for frontend
      const tokenResponse = session.getTokenResponse();
      expect(tokenResponse.accessToken).toBe('access-token-abc');
      expect(tokenResponse.expiresAt).toBe(mockCallbackData.expiresAt);

      // Step 4: Save session
      await session.save();
      expect(adapter.writeCookie).toHaveBeenCalled();
    });

    it('should work with offline_access scope (refresh token)', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const callbackWithRefresh = { ...mockCallbackData, refreshToken: 'refresh-token-abc' };
      session.fromCallback(callbackWithRefresh);
      expect(session.get('refreshToken')).toBe('refresh-token-abc');
      expect(session.get('accessToken')).toBe('access-token-abc');
      const tokenResponse = session.getTokenResponse();
      expect(tokenResponse.accessToken).toBe('access-token-abc');
    });

    it('should work with tenant custom domain', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      const callbackWithDomain = { ...mockCallbackData, tenantCustomDomain: 'acme.example.com' };
      session.fromCallback(callbackWithDomain);
      expect(session.get('tenantCustomDomain')).toBe('acme.example.com');
      expect(session.get('tenantName')).toBe('Test Tenant');
      const sessionResponse = session.getSessionResponse();
      expect(sessionResponse.tenantId).toBe('tenant-456');
    });

    it('should handle session endpoint pattern', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const response = session.getSessionResponse({
        preferences: { theme: 'dark' },
        roles: ['admin'],
      });

      expect(response).toEqual({
        tenantId: 'tenant-456',
        userId: 'user-123',
        metadata: {
          preferences: { theme: 'dark' },
          roles: ['admin'],
        },
      });
    });

    it('should handle token endpoint pattern', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      session.fromCallback(mockCallbackData);
      const response = session.getTokenResponse();

      expect(response).toEqual({
        accessToken: 'access-token-abc',
        expiresAt: mockCallbackData.expiresAt,
      });
    });

    it('should prevent usage without authentication', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);
      expect(() => session.getSessionResponse()).toThrow(SessionError);
      expect(() => session.getTokenResponse()).toThrow(SessionError);
    });

    it('should handle re-authentication', () => {
      const session = SessionImpl.createNew<TestSessionData>(adapter as any, mockOptions);

      // Initial authentication
      session.fromCallback(mockCallbackData);
      expect(session.get('userId')).toBe('user-123');

      // Re-authenticate with different user
      const newCallback = {
        ...mockCallbackData,
        userinfo: { ...mockUserInfo, userId: 'user-789', tenantId: 'tenant-abc' },
      };
      session.fromCallback(newCallback);

      expect(session.get('userId')).toBe('user-789');
      expect(session.get('tenantId')).toBe('tenant-abc');

      const response = session.getSessionResponse();
      expect(response.userId).toBe('user-789');
      expect(response.tenantId).toBe('tenant-abc');
    });
  });
});
