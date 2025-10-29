# How Session Encryption & Expiration Works

## The Big Picture

Your session SDK uses defense-in-depth for expiration:

1. Browser-side expiration: Cookie `maxAge` (can be tampered with)
2. Server-side expiration: Timestamp embedded in the encrypted seal (cryptographically verified)

The seal TTL is the real security boundary - even if someone manipulates the cookie, the server will reject expired seals.

<hr>

## The Flow

### 🔐 When Creating a Session (`encrypt`)

```typescript
// User logs in
session.fromCallback(callbackData);
await session.save();
```

**What happens internally:**
1. Current time: `2025-01-15 10:00:00` (timestamp = 1736935200000)

2. Session data: `{ userId: "123", accessToken: "abc..." }`

3. Encrypt creates a "seal":
   [version][timestamp][iv][encrypted data]
   [   1   ][timestamp][ 12 bytes ][encrypted JSON]

4. Cookie sent to browser:
   `session=dGVzdC1lbmNyeXB0ZWQtZGF0YQ==; Max-Age=86400`
   - Cookie expires in 24 hours (browser enforces)
   - Seal has timestamp embedded (server enforces)

### 🔓 When Reading a Session (decrypt)

```typescript
// User makes a request
const session = await getSession(req, options);
```

**What happens internally:**
1. Browser sends cookie: `session=dGVzdC1lbmNyeXB0ZWQtZGF0YQ==`

2. Server decodes seal:
   - Extract version (byte 0)
   - Extract timestamp (bytes 1-8)
   - Extract IV (bytes 9-20)
   - Extract encrypted data (bytes 21+)

3. Validate expiration:
   Current time: 1736935300000
   Seal timestamp: 1736935200000
   Age: 100 seconds
   MaxAge: 86400000ms (24 hours)
   Skew allowance: 60000ms (60 seconds)
   
   Check: 100 seconds < (86400000 + 60000)?  ✅ Valid!

4. If valid: Decrypt and return session data
   If expired: Throw "Session expired" error → Return new empty session

<hr>

## Clock Skew Protection

**The 60-second buffer (`TIMESTAMP_SKEW_MS`):**
```typescript
// Without skew tolerance:
if (Date.now() - timestamp > maxAge) ❌

// With skew tolerance:
if (Date.now() - timestamp > maxAge + 60000) ✅
```

**Why this matters:**
Server A time:  10:00:00  (creates session)
Server B time:  10:00:45  (reads session, clock 45s ahead)

Without skew: Server B thinks session is 45s older than it is
With skew: 60s buffer prevents false expiration

This handles:
- Load balancers routing between servers with slightly different clocks
- Cloud providers with minor time drift
- Deployment scenarios where servers aren't perfectly synchronized

<hr>

## Key Rotation Support

```typescript
const secrets = ['new-secret', 'old-secret'];
```

**How it works:**
1. Always encrypt with secrets[0] (newest)
2. Decrypt tries secrets in order: new → old
3. If new secret fails, try old secret
4. This allows seamless secret rotation without downtime

**Example scenario:**
Day 1: Secret = "secret-v1"
  - All sessions encrypted with "secret-v1"

Day 2: Rotate to "secret-v2"
  - Options: ['secret-v2', 'secret-v1']
  - New sessions encrypted with "secret-v2"
  - Old sessions still decrypt with "secret-v1"

Day 3: Old sessions expired (24hrs passed)
  - Options: ['secret-v2']
  - Remove "secret-v1" safely

<hr>

## Why This Approach?

| Attack Vector | Defense |
| ------------- | ------- |
| Tamper with cookie maxAge | ❌ Seal TTL validates server-side |
| Replay old cookie | ❌ Timestamp in seal is too old |
| Steal and reuse cookie | ❌ Expires based on creation time |
| Manipulate timestamp | ❌ Encrypted - tampering breaks decryption |
| Clock is wrong | ✅ 60s skew tolerance handles it |

Bottom line: The timestamp is inside the encrypted seal, so it's cryptographically protected. You can't fake it without breaking the encryption. ✅
