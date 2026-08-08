<div align="center">
  <a href="https://wristband.dev">
    <picture>
      <img src="https://assets.wristband.dev/images/email_branding_logo_v1.png" alt="Wristband" width="297" height="64">
    </picture>
  </a>
  <p align="center">
    Enterprise-ready auth that is secure by default, truly multi-tenant, and ungated for small businesses.
  </p>
  <p align="center">
    <b>
      <a href="https://wristband.dev">Website</a> • 
      <a href="https://docs.wristband.dev/">Documentation</a>
    </b>
  </p>
</div>

<br/>

---

<br/>

# Wristband TypeScript Session SDK

Secure, encrypted cookie-based session management for TypeScript applications.

<br>

## Overview

This SDK provides enterprise-grade session management with:

- **🎯 Framework Agnostic** - Express, Next.js, Remix, and more
- **🌐 Universal Runtime Support** - Node.js, Cloudflare Workers, Vercel Edge, and more
- **📦 Zero Dependencies** - Pure TypeScript with web standards
- **🔒 Secure Encryption** - AES-256-GCM encryption with Web Crypto API
- **🔄 Secret Key Rotation** - Seamless secret rotation without invalidating sessions
- **⚡ High Performance** - Deferred mode prevents redundant encryption in Node.js
- **🛡️ CSRF Protection** - Optional token-based CSRF protection

**Use it standalone** for any TypeScript application, or **pair with [Wristband](https://wristband.dev)** for a complete multi-tenant authentication solution.

<br>

## Cookie-Based Sessions Explained

This SDK uses encrypted cookie-based sessions - a lightweight approach where session data is stored in the browser as an encrypted cookie rather than on the server.

### How It Works

This SDK uses **encryption** (AES-256-GCM) rather than just **signing** (like signed JWTs) to keep your session data completely private.

1. **Server encrypts** session data using AES-256-GCM
2. **Browser stores** the encrypted cookie (max 4KB)
3. **Server decrypts** the cookie on each request
4. **No database required** - session data lives in the cookie

### Why Use Cookie-Based Sessions?

**Perfect for modern web applications:**
- ✅ **Zero infrastructure** - No Redis or databases required
- ✅ **Scales effortlessly** - No session state to sync across servers
- ✅ **Edge-compatible** - Works in serverless, Workers, and Edge runtimes
- ✅ **Low latency** - No database lookup on every request

### When NOT to Use Cookie-Based Sessions

Consider server-side sessions (Redis, database) if you need:
- **Large session data** (>3KB) - Store shopping carts with 100+ items, extensive user profiles
- **Instant cross-device logout** - Admin needs to immediately revoke all of a user's sessions

### The 4KB Limit

Browser cookies are limited to 4KB total (per RFC 6265). After encryption overhead and cookie attributes, you have **~3KB for actual session data**.

**What fits in ~3KB:**
```typescript
// ✅ This fits comfortably
{
  userId: "user_abc123",
  tenantId: "tenant_xyz789", 
  accessToken: "eyJhbGc...", // JWT (~500-1000 bytes)
  email: "user@example.com",
  role: "admin",
  preferences: { theme: "dark", language: "en" },
  lastLogin: 1735689600000
}
```

**What doesn't fit:**
```typescript
// ❌ Too large
{
  shoppingCart: [...100 items...],        // Too much data
  userHistory: [...months of activity...], // Too much data
  profileData: { ...extensive user info...} // Too much data
}
```

**Solution for large data:** Store a reference ID in the session, fetch full data from database when needed:

```typescript
// ✅ Store reference in session
session.cartId = "cart_abc123";

// ✅ Fetch full cart from database when needed
const cart = await db.getCart(session.cartId);
```

<br>

---

<br>

## Table of Contents

- [Installation](#installation)
- [Basic Usage](#basic-usage)
  - [Node.js / Express](#nodejs--express)
  - [Edge Runtimes](#edge-runtimes-nextjs-cloudflare-workers-deno)
- [Platform Examples](#platform-examples)
  - [Express](#express-nodejs)
  - [Next.js](#nextjs)
  - [Cloudflare Workers](#cloudflare-workers)
- [API Reference](#api-reference)
  - [getSession()](#getsession)
  - [getSessionSync()](#getsessionsync)
  - [SessionOptions](#sessionoptions)
  - [Direct Session Data Access](#direct-session-data-access)
  - [Session Methods](#session-methods)
    - [Core Methods (All Runtimes)](#core-methods-all-runtimes)
      - [get(key)](#getkey)
      - [set(key, value)](#setkey-value)
      - [delete(key)](#deletekey)
      - [toJSON()](#tojson)
    - [Node.js Methods](#nodejs-methods)
      - [save()](#save)
      - [destroy()](#destroy)
      - [enableDeferredMode()](#enabledeferredmode)
      - [flush()](#flush)
      - [flushSync()](#flushsync)
    - [Edge Runtime Methods](#edge-runtime-methods)
      - [saveToResponse(response)](#savetoresponseresponse)
      - [destroyToResponse(response)](#destroytoresponseresponse)
    - [Next.js Server Actions Methods](#nextjs-server-actions-methods)
      - [getCookieDataForSave()](#getcookiedataforsave)
      - [getCookieDataForDestroy()](#getcookiedatafordestroy)
    - [Wristband-Specific Methods](#wristband-specific-methods)
      - [fromCallback(callbackData, customFields?)](#fromcallbackcallbackdata-customfields)
      - [getSessionResponse(metadata?)](#getsessionresponsemetadata)
      - [getTokenResponse()](#gettokenresponse)
  - [SessionOptions](#sessionoptions)
- [Error Handling](#error-handling)
- [Advanced Topics](#advanced-topics)
  - [Deferred Mode (Node.js Performance)](#deferred-mode-nodejs-performance)
  - [CSRF Protection](#csrf-protection)
  - [Secret Rotation](#secret-rotation)
  - [Rolling Sessions](#rolling-sessions)
  - [TypeScript Support](#typescript-support)
  - [Security Considerations](#security-considerations)
- [Wristband Integration](#wristband-integration)
  - [Auth Callback Integration](#auth-callback-integration)
  - [Session Endpoint](#session-endpoint)
  - [Token Endpoint](#token-endpoint)
- [Using with Wristband Auth SDKs](#using-with-wristband-auth-sdks)
- [Questions](#questions)

<br>

---

<br>

## Installation

```bash
# With npm
npm install @wristband/typescript-session

# Or with yarn
yarn add @wristband/typescript-session

# Or with pnpm
pnpm add @wristband/typescript-session
```

<br>

---

<br>

## Basic Usage

> **Using with Wristband?**
> 
> See [Wristband Integration](#wristband-integration) for auth-specific examples.

**How it works:**

- Call `getSession()` to read the encrypted cookie from the request (returns either existing session data or an empty session if no cookie exists yet)
- Read/write session data using the session object
- Call `save()` or `destroy()` to persist changes
- Your application handles what to do based on whether the session contains data or not

### Node.js / Express

For Node.js, pass `request`, `response`, and session options to `getSession()`. The SDK will write cookies directly to the response object.

**1: Add session middleware**

Create a middleware that adds a session to every request:

```typescript
// src/app.ts (Express)
import express from 'express';
import { getSession } from '@wristband/typescript-session';

const app = express();

// Add session to all requests
app.use(async (req, res, next) => {
  req.session = await getSession(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400, // 24 hours
  });
  next();
});
```

**2: Use sessions in your routes**

Save session data when users log in:

```typescript
app.post('/login', async (req, res) => {
  // Authenticate user (your logic here)
  // ...
  
  // Store user data in session
  req.session.userId = '123';
  req.session.loginTime = Date.now();
  
  await req.session.save(); // Encrypt and write cookie
  res.json({ success: true });
});
```

Destroy session when users log out:

```typescript
app.post('/logout', async (req, res) => {
  req.session.destroy(); // Destroy cookie
  res.json({ success: true });
});
```

> **💡 Performance Tip**
>
> For Express applications, consider using `getSessionSync()` with deferred mode to batch writes. See [Deferred Mode](#deferred-mode-nodejs-performance) for details.

<br>

### Edge Runtimes (Next.js, Cloudflare Workers)

For Edge runtimes, pass `request` and session options to `getSession()`. Instead of `save()` and `destroy()`, you'll use `saveToResponse()` or `destroyToResponse()` to clone your Response and append session cookies.

**Step 1: Create a login endpoint**

In Edge runtimes, you don't pass a response object to `getSession()`. Instead, create your Response and pass it to `saveToResponse()`, which clones it and adds the session cookie:

```typescript
// app/api/login/route.ts (Next.js App Router)
import { getSession } from '@wristband/typescript-session';

export async function POST(request: Request) {
  // Get session from request only (no response object)
  const session = await getSession(request, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400, // 24 hours
  });
  
  // Authenticate user (your logic here)
  // ...
  
  // Store user data in session
  session.userId = '123';
  session.loginTime = Date.now();
  
  // Return new Response with session cookie
  const response = Response.json({ success: true });
  return await session.saveToResponse(response);
}
```

**Step 2: Create a logout endpoint**

Use `destroyToResponse()` to destroy the session and return a Response with the deletion cookie:

```typescript
// app/api/logout/route.ts (Next.js App Router)
import { getSession } from '@wristband/typescript-session';

export async function POST(request: Request) {
  const session = await getSession(request, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400, // 24 hours
  });
  
  // Destroy session and return response with deletion cookie
  const response = Response.json({ success: true });
  return await session.destroyToResponse(response);
}
```

<br>

**Key Differences:**

**Node.js:**
- Pass `request`, `response`, and config options to `getSession()`
- Use `save()` to write cookies (mutates response object)
- Use `destroy()` to delete cookies (mutates response object)
- Cookies are written directly to the response via `res.setHeader()`

**Edge Runtimes:**
- Pass only `request` and config options to `getSession()` (no response)
- Use `saveToResponse(response)` to clone and add cookies
- Use `destroyToResponse(response)` to clone and add deletion cookies
- Returns a new Response object with cookies appended to headers

<br>

> **💡 Generating Secure Secrets**
>
> Your session secret must be at least 32 characters for security. Generate one using:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
> ```
>
> **Best practice:** Store secrets in environment variables, never commit them to source control.

<br>

---

<br>

## Platform Examples

### Express (Node.js)

**Basic setup with middleware:**

```typescript
import express from 'express';
import { getSession } from '@wristband/typescript-session';

const app = express();

// Session middleware
app.use(async (req, res, next) => {
  req.session = await getSession(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  next();
});

// Login route
app.post('/login', async (req, res) => {
  // Your auth logic...
  const user = await authenticateUser(req.body.email, req.body.password);
  
  req.session.userId = user.id;
  req.session.email = user.email;
  
  await req.session.save();
  res.json({ success: true });
});

// Protected route
app.get('/dashboard', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.render('dashboard', { user: req.session });
});

// Logout route
app.post('/logout', async (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});
```

> **Performance Optimization**
> 
> For production Express apps, consider using `getSessionSync()` with deferred mode to batch session writes. See [Deferred Mode](#deferred-mode-nodejs-performance) for details.

<br>

### Next.js

**App Router - Route Handlers**
```typescript
// app/api/login/route.ts
import { getSession } from '@wristband/typescript-session';

export async function POST(request: Request) {
  const session = await getSession(request, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  // Your auth logic
  const { email, password } = await request.json();
  const user = await authenticateUser(email, password);
  
  // Save to session
  session.userId = user.id;
  session.email = user.email;
  
  const response = Response.json({ success: true });
  return await session.saveToResponse(response);
}
```

```typescript
// app/api/logout/route.ts
import { getSession } from '@wristband/typescript-session';

export async function POST(request: Request) {
  const session = await getSession(request, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  const response = Response.json({ success: true });
  return session.destroyToResponse(response);
}
```

**Middleware (Route Protection):**

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@wristband/typescript-session';

export async function middleware(request: NextRequest) {
  const session = await getSession(request, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  // Protect dashboard routes
  if (!session.userId && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/dashboard/:path*',
};
```

**Server Actions:**

Server Actions can't return Response objects, so you need to manually manage cookies via [Next.js's cookies() API](https://nextjs.org/docs/app/api-reference/functions/cookies). You can build helper functions that use `getCookieDataForSave()` and `getCookieDataForDestroy()`:

```typescript
// lib/session-helpers.ts
import { cookies } from 'next/headers';
import { 
  getSession, 
  Session,
  SessionOptions, 
  SessionData 
} from '@wristband/typescript-session';

// Next.js cookie store interface (duck-typed)
interface NextJsCookieStore {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: any): void;
}

// Get session for Server Actions
export async function getSessionForServer<T extends SessionData = SessionData>(
  cookieStore: NextJsCookieStore,
  options: SessionOptions
): Promise<Session<T> & T> {
  const cookieName = options.cookieName || 'session'; // SDK Default
  const cookieValue = cookieStore.get(cookieName)?.value;

  // Create a real Web Request with the session cookie
  const request = new Request('https://placeholder.local', {
    headers: { cookie: cookieValue ? `${cookieName}=${cookieValue}` : '' },
  });

  return await getSession<T>(request, options);
}

// Save session for Server Actions
export async function saveSessionForServer<T extends SessionData = SessionData>(
  cookieStore: NextJsCookieStore,
  session: Session<T> & T
): Promise<void> {
  const cookieData = await session.getCookieDataForSave();
  for (const { name, value, options } of cookieData) {
    cookieStore.set(name, value, options);
  }
}

// Destroy session for Server Actions
export function destroySessionForServer<T extends SessionData = SessionData>(
  cookieStore: NextJsCookieStore,
  session: Session<T> & T
): void {
  const cookieData = session.getCookieDataForDestroy();
  for (const { name, value, options } of cookieData) {
    cookieStore.set(name, value, options);
  }
}
```

Then use the helpers in your Server Actions:

```typescript
// app/actions.ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  destroySessionForServer,
  getSessionForServer,
  saveSessionForServer
} from '@/lib/session';

const sessionOptions = {
  secrets: 'your-secret-key-min-32-characters-long',
  maxAge: 86400,
};

export async function loginAction(formData: FormData) {
  const cookieStore = await cookies();
  const session = await getSessionForServer(cookieStore, sessionOptions);
  
  // Your auth logic
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const user = await authenticateUser(email, password);
  
  // Save user to session
  session.userId = user.id;
  session.email = user.email;
  
  await saveSessionForServer(cookieStore, session);
  redirect('/dashboard');
}

export async function updatePreferences(theme: string) {
  const cookieStore = await cookies();
  const session = await getSessionForServer(cookieStore, sessionOptions);
  
  if (!session.userId) {
    redirect('/login');
  }
  
  // Update session
  session.preferences = { theme };
  
  await saveSessionForServer(cookieStore, session);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const session = await getSessionForServer(cookieStore, sessionOptions);
  
  destroySessionForServer(cookieStore, session);
  redirect('/login');
}
```

<br>

### Cloudflare Workers

```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    const session = await getSession(request, {
      secrets: 'your-secret-key-min-32-characters-long',
      maxAge: 24 * 60 * 60, // 24 hours
    });
    
    const url = new URL(request.url);
    
    if (url.pathname === '/login' && request.method === 'POST') {
      // Your auth logic
      const { email, password } = await request.json();
      const user = await authenticateUser(email, password);
      
      // Save to session
      session.userId = user.id;
      session.email = user.email;
      
      const response = Response.json({ success: true });
      return await session.saveToResponse(response);
    }
    
    if (url.pathname === '/dashboard') {
      if (!session.userId) {
        return Response.redirect(new URL('/login', request.url));
      }
      
      return Response.json({
        message: 'Welcome to dashboard',
        user: { id: session.userId, email: session.email },
      });
    }
    
    if (url.pathname === '/logout' && request.method === 'POST') {
      const response = Response.json({ success: true });
      return session.destroyToResponse(response);
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
```

> **💡 Learn More**
>
> For more documentation on `getCookieDataForSave()` and `getCookieDataForDestroy()`, see the [Next.js Server Actions Methods](#nextjs-server-actions-methods) section in the API Reference.

<br>

---

<br>

## API Reference

### getSession()

Retrieves an existing session or creates a new empty session. This is the primary function for session management.

**Signature:**

```typescript
// Node.js (with response object)
function getSession<T extends SessionData = SessionData>(
  request: IncomingMessage | Request,
  response: ServerResponse | Response,
  options: SessionOptions
): Promise<Session<T> & T>

// Edge Runtimes (without response object)
function getSession<T extends SessionData = SessionData>(
  request: Request,
  options: SessionOptions
): Promise<Session<T> & T>
```

**Parameters:**

- `request` - The incoming HTTP request (Node.js `IncomingMessage`, `NextApiRequest`, Express `Request`, or Web `Request`)
- `response` - The HTTP response object (Node.js only; not needed in Edge runtimes)
- `options` - Session configuration (see [SessionOptions](#sessionoptions))

**Returns:**

`Promise<Session<T> & T>` - A promise resolving to a session instance that provides both session management methods and direct access to the underlying data.

**Throws:**

[`SessionError`](#error-handling) if configuration is invalid or request type is unsupported

**Example:**

```typescript
// Node.js / Express
const session = await getSession(req, res, {
  secrets: 'your-secret-key-min-32-characters-long',
  maxAge: 86400,
});

// Edge Runtime (Next.js, Cloudflare Workers, etc.)
const session = await getSession(request, {
  secrets: 'your-secret-key-min-32-characters-long',
  maxAge: 86400,
});
```

<br>

### getSessionSync()

Synchronous version of `getSession()` for Node.js environments. Used primarily with deferred mode in Express for better performance.

**Signature:**

```typescript
function getSessionSync<T extends SessionData = SessionData>(
  request: IncomingMessage | Request,
  response: ServerResponse | Response,
  options: SessionOptions
): Session<T> & T
```

**Parameters:**

Same as `getSession()`

**Returns:**

`Session<T> & T` - A session instance that provides both session management methods and direct access to the underlying data.

**Example:**

```typescript
import { getSessionSync } from '@wristband/typescript-session';

app.use((req, res, next) => {
  req.session = getSessionSync(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  req.session.enableDeferredMode();
  
  const prevWriteHead = res.writeHead.bind(res);
  res.writeHead = function(...args) {
    if (!res.headersSent) {
      req.session.flushSync();
    }
    return prevWriteHead(...args);
  };
  
  next();
});
```

See [Deferred Mode](#deferred-mode-nodejs-performance) for more details.

<br>

### SessionOptions

These SDK configuration options control how sessions are created, encrypted, and stored in cookies. All cookie-related options follow standard HTTP cookie specifications.

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `secrets` | `string` or `string[]` | Yes | N/A | Secret key(s) used for encrypting and decrypting session cookie data. <br><br>**Single string:** Used for both encryption and decryption. <br><br>**Array of strings:** First key encrypts new sessions, all keys tried for decryption (enables key rotation). Example: `[process.env.NEW_SECRET, process.env.OLD_SECRET]` <br><br>Secrets must be at least 32 characters for security. Use cryptographically random strings (e.g., from a secure password generator). |
| `cookieName` | `string` | No | `'session'` | The name of the session cookie to set in the response. |
| `maxAge` | `number` | No | `3600` (1 hour) | Session expiration time in seconds. Determines how long a session remains valid. After this time, the session cookie expires and users must re-authenticate. Example: `86400` for 24 hours, `604800` for 7 days. |
| `path` | `string` | No | `'/'` | Cookie path attribute. Specifies which URL paths can access the cookie. Default `'/'` means all paths. |
| `secure` | `boolean` | No | `true` | Cookie Secure flag. If `true`, cookie is only sent over HTTPS connections. <br><br>**Security recommendation:** Always use `true` in production. Only set to `false` for local development over HTTP. |
| `sameSite` | `'Strict'`, `'Lax'`, or `'None'` | No | `'Lax'` | Cookie SameSite setting. Controls whether cookies are sent on cross-site requests. <br><br>**`'Strict'`:** Cookies only sent for same-site requests (recommended, when possible). <br><br>**`'Lax'`:** Cookies sent for same-site requests plus top-level navigation GET requests (good balance). <br><br>**`'None'`:** Cookies sent for all requests (requires `secure: true`; use with CSRF token protection enabled; use only if you know what you are doing). |
| `domain` | `string` | No | `undefined` | Cookie domain attribute. Controls which domains can access the cookie. <br><br>**`undefined`:** Cookie only sent to current domain. <br><br>**`'.example.com'`:** Cookie sent to example.com and all subdomains. <br><br>**`'app.example.com'`:** Cookie only sent to app.example.com. |
| `enableCsrfProtection` | `boolean` | No | `false` | Enable CSRF protection by generating and validating CSRF tokens. <br><br>**Recommendation:** Only enable if you use `sameSite: 'None'` or want defense-in-depth. The default `sameSite: 'Lax'` (or `'Strict'`) provides sufficient CSRF protection for most cases. <br><br>**When enabled:** CSRF token is automatically generated after authentication (via any `save()` function), stored in both session and a separate cookie, and must be included in request headers for server validation. <br><br>**When disabled:** No CSRF tokens or cookies are generated. |
| `csrfCookieName` | `string` | No | `'CSRF-TOKEN'` | Name of the CSRF cookie. Only used if `enableCsrfProtection` is `true`. |
| `csrfCookieDomain` | `string` | No | `undefined` | Domain for CSRF cookie. Follows same rules as `domain` option. Falls back to `domain` value if not specified. Only used if `enableCsrfProtection` is `true`. |

<br>

### Direct Session Data Access

The session object supports direct property access for reading and writing data. Direct access is fully type-safe when using TypeScript with a custom session data type.

```typescript
// Reading data
const userId = session.userId;        // Same as session.get('userId')
const theme = session.theme;          // Same as session.get('theme')

// Writing data
session.userId = '123';               // Same as session.set('userId', '123')
session.theme = 'dark';               // Same as session.set('theme', 'dark')

// Deleting data
delete session.theme;                 // Same as session.delete('theme')
```

You can also use any of the methods below to update your session data.

<br>

### Session Methods

Once you have a session object, you can use these methods:

#### Core Methods (All Runtimes)

##### `get(key)`

Type-safe getter for session data.

```typescript
const userId = session.get('userId'); // string | undefined
const theme = session.get('theme');   // 'light' | 'dark' | undefined
```

**Parameters:**

- `key: keyof T` - The session data key

**Returns:**

`T[key] | undefined`

<br>

##### `set(key, value)`

Type-safe setter for session data.

```typescript
session.set('userId', '123');
session.set('theme', 'dark');
session.set('lastVisit', Date.now());
```

**Parameters:**

- `key: keyof T` - The session data key
- `value: T[key]` - The value to set

**Returns:**

`void`

**Throws:**

[`SessionError`](#error-handling) if session has been destroyed

<br>

##### `delete(key)`

Delete a key from session data.

```typescript
session.delete('theme');
session.delete('lastVisit');
```

**Parameters:**

- `key: keyof T` - The session data key to delete

**Returns:**

`void`

**Throws:**

[`SessionError`](#error-handling) if session has been destroyed

<br>

##### `toJSON()`

Returns the session data as a plain object. This method is automatically called by `JSON.stringify()` and enables clean serialization of the session.

```typescript
const sessionData = session.toJSON();
console.log(sessionData); // { userId: '123', theme: 'dark', ... }

// Also called automatically by JSON.stringify()
const json = JSON.stringify(session);
console.log(json); // '{"userId":"123","theme":"dark",...}'
```

**Parameters:**

None

**Returns:**

`T` - A plain object containing all session data fields

<br>

#### Node.js Methods

These methods work in Node.js environments (Express, Next.js Pages Router, etc.):

##### `save()`

Encrypts session data and writes the cookie (mutates the response object). If 	`enableCsrfProtection` is `true` in the SDK configuration, a CSRF token is generated, stored in `session.csrfToken`, and written to the CSRF cookie.

> 💡 For Edge runtimes, use `saveToResponse()`.

```typescript
await session.save();
```

**Returns:**

`Promise<void>`

**Throws:**

[`SessionError`](#error-handling) if:

- Session has been destroyed
- No response object available
- Encryption fails

<br>

##### `destroy()`

Deletes the underlying session data as well as the session cookie from the response (mutates the response object).  If `enableCsrfProtection` is `true` in the SDK configuration, then the CSRF cookie is deleted as well.

> 💡 For Edge runtimes, use `destroyToResponse()`.

```typescript
session.destroy();
```

**Returns:**

`void`

<br>

##### `enableDeferredMode()`

Enables deferred mode to batch cookie writes. Call this before any `save()` operations, then use `flush()` or `flushSync()` to write cookies at the end of the request.

See [Deferred Mode](#deferred-mode-nodejs-performance) for more details.

```typescript
session.enableDeferredMode();
session.set('userId', '123');
await session.save();  // Marks for save (doesn't write yet)
await session.flush(); // Actually writes cookies
```

**Returns:**

`void`

<br>

##### `flush()`

Asynchronously flush pending session changes. Used with deferred mode.

```typescript
await session.flush();
```

**Returns:**

`Promise<void>`

**Throws:**

[`SessionError`](#error-handling) if:

- Deferred mode is not enabled
- No response object available
- Encryption fails

<br>

##### `flushSync()`

Synchronously flush pending session changes using Node.js crypto. Used with deferred mode.

```typescript
session.flushSync();
```

**Returns:**

`void`

**Throws:**

[`SessionError`](#error-handling) if:

- Deferred mode is not enabled
- No response object available
- Encryption fails
- Node.js crypto is not available

<br>

#### Edge Runtime Methods

These methods work in Edge runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy, etc.):

##### `saveToResponse(response)`

Encrypts session data and returns a new Response with the session cookie appended. If `enableCsrfProtection` is `true` in the SDK configuration, a CSRF token is generated, stored in `session.csrfToken`, and written to the CSRF cookie.

> 💡 For Node.js runtimes, use `save()`.

```typescript
session.userId = '123';
const response = new Response('Success');
return await session.saveToResponse(response);
```

**Parameters:**

- `response: Response` - The response to clone and append cookies to

**Returns:**

`Promise<Response>` - A Promise that resolves to a new Response object with session cookies

<br>

##### `destroyToResponse(response)`

Destroys the session and returns a new Response with deletion cookies appended. If `enableCsrfProtection` is `true` in the SDK configuration, then the CSRF cookie is deleted as well.

> 💡 For Node.js runtimes, use `destroy()`.

```typescript
const response = new Response('Logged out');
return session.destroyToResponse(response);
```

**Parameters:**

- `response: Response` - The response to clone and append deletion cookies to

**Returns:**

`Response` - A new Response object with deletion cookies

<br>

#### Next.js Server Actions Methods

These are low-level methods for framework adapters that require manual cookie management. Next.js Server Actions can't return Response objects, so you can't use `saveToResponse()` or `destroyToResponse()`. Instead, these methods return cookie data that can be set via Next.js's `cookies()` API.

> 💡 Looking for examples?
> See the [Next.js Platform Examples](#nextjs) section for complete helper patterns and usage examples with Server Actions.

##### `getCookieDataForSave()`

Returns prepared cookie data for manual cookie setting (e.g., Next.js `cookies().set()`). If `enableCsrfProtection` is `true`, it will automatically generate a CSRF token and include the CSRF cookie data.

```typescript
'use server';
import { cookies } from 'next/headers';

export async function loginAction() {
  const session = await getSession(/* ... */);
  session.set('userId', '123');
  
  const cookieData = await session.getCookieDataForSave();
  const cookieStore = await cookies();
  
  for (const { name, value, options } of cookieData) {
    cookieStore.set(name, value, options);
  }
}
```

**Returns:**

`Promise<Array<{ name: string; value: string; options: CookieOptions }>>` - 
A Promise that resolves to an array of cookie objects, where each object contains:

- name (string): The cookie name (e.g., `'session'` or `'CSRF-TOKEN'`)
- value (string): The encrypted session data (for session cookie) or CSRF token value (for CSRF cookie)
- options (`CookieOptions`): Cookie configuration object with the following properties:

  - maxAge (number): Cookie expiration time in seconds
  - domain (string | undefined): Cookie domain attribute
  - path (string): Cookie path attribute (default: '/')
  - secure (boolean): Requires HTTPS when true (default: true)
  - httpOnly (boolean): Prevents JavaScript access when true (default: true)
  - sameSite ('Strict' | 'Lax' | 'None'): Controls cross-site request behavior (default: 'Lax')

The returned array will contain:

- Always: 1 session cookie object
- Conditionally: 1 CSRF cookie object (if `enableCsrfProtection` is `true`)

**Throws:**

[`SessionError`](#error-handling) if:

- Session has been destroyed
- Encryption fails

<br>

##### `getCookieDataForDestroy()`

Returns prepared cookie deletion data for manual cookie deletion. Returns cookies with empty values and expiration dates in the past. If `enableCsrfProtection` is `true`, includes CSRF cookie deletion data.

```typescript
const cookieData = session.getCookieDataForDestroy();
const cookieStore = await cookies();

for (const { name, value, options } of cookieData) {
  cookieStore.set(name, value, options);
}
```

**Returns:**

`Array<{ name: string; value: string; options: CookieOptions }>` - An array of cookie deletion objects with the same structure as `getCookieDataForSave()`, but with:

- value: Empty string ('')
- options.maxAge: Set to 0 to expire the cookie immediately

The returned array will contain:

- Always: 1 session cookie deletion object
- Conditionally: 1 CSRF cookie deletion object (only if `enableCsrfProtection` is `true`)

<br>

#### Wristband-Specific Methods

These methods are only relevant when using Wristband authentication for the [Backend Server Integration Pattern](https://docs.wristband.dev/docs/backend-server-integration):

##### `fromCallback(callbackData, customFields?)`

Populates session from Wristband authentication callback data.

```typescript
const callbackResult = await wristbandAuth.callback(req);
session.fromCallback(callbackResult.callbackData, {
  preferences: { theme: 'dark' },
  lastLogin: Date.now(),
});
await session.save();
```

**Parameters:**

- `callbackData: CallbackData` - Data from Wristband auth callback
- `customFields?: Record<string, any>` - Optional custom fields to merge (must be JSON-serializable)

**Returns:**

`void`

**Throws:**

[`SessionError`](#error-handling) if:

- Session has been destroyed
- `callbackData` is missing or invalid
- `customFields` are not JSON-serializable

<br>

##### `getSessionResponse(metadata?)`

Returns formatted session response for Wristband frontend SDKs.

```typescript
app.get('/api/v1/session', async (req, res) => {
  const session = await getSession(req, res, { secrets: process.env.SESSION_SECRET });
  const response = session.getSessionResponse({
    name: session.fullName,
    preferences: session.preferences,
  });
  res.json(response);
});
```

**Parameters:**

- `metadata?: Record<string, any>` - Optional metadata to include

**Returns:**

`{ tenantId: string; userId: string; metadata?: Record<string, any> }`

**Throws:**

[`SessionError`](#error-handling) if session is not authenticated

<br>

##### `getTokenResponse()`

Returns formatted token response for Wristband frontend SDKs.

```typescript
app.get('/api/v1/token', async (req, res) => {
  const session = await getSession(req, res, { secrets: process.env.SESSION_SECRET });
  const response = session.getTokenResponse();
  res.json(response);
});
```

**Returns:**

`{ accessToken: string; expiresAt: number }`

**Throws:**

[`SessionError`](#error-handling) if session is not authenticated or missing token data

<br>

---

<br>

## Error Handling

The SDK uses a structured error system with specific error codes for different failure scenarios. All errors thrown by the SDK are instances of `SessionError` with a `code` property for programmatic error handling.

### Error Types
```typescript
import { SessionError, SessionErrorCode } from '@wristband/typescript-session';

try {
  await session.save();
} catch (error) {
  if (error instanceof SessionError) {
    console.error('Error code:', error.code);
    console.error('Message:', error.message);
    
    // Optional: inspect underlying cause for debugging
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  }
}
```

### Error Codes Reference

**Session Lifecycle Errors**

| Code | Description | Common Causes |
|------|-------------|---------------|
| `SESSION_DESTROYED` | Attempted to modify or save a destroyed session | Calling `set()`, `save()`, or other mutation methods after `destroy()` |
| `SESSION_SAVE_FAILED` | Failed to save session | Encryption failure, cookie size exceeded, serialization error |

**Configuration Errors**

| Code | Description | Common Causes |
|------|-------------|---------------|
| `INVALID_CONFIGURATION` | Invalid session configuration | Missing/invalid secrets, unsupported request type, attempting to override session methods |
| `MISSING_RESPONSE` | No response object available for cookie operations | Calling `save()` in Edge runtime (use `saveToResponse()` instead), missing response parameter |

**Deferred Mode Errors**

| Code | Description | Common Causes |
|------|-------------|---------------|
| `DEFERRED_MODE_NOT_ENABLED` | Attempted to flush without enabling deferred mode | Calling `flush()` or `flushSync()` without calling `enableDeferredMode()` first |

**Wristband-Specific Errors**

| Code | Description | Common Causes |
|------|-------------|---------------|
| `CALLBACK_DATA_INVALID` | Invalid or missing callback data | Missing `callbackData` or `callbackData.userinfo` in `fromCallback()` |
| `CUSTOM_FIELDS_NOT_SERIALIZABLE` | Custom fields cannot be serialized to JSON | Passing non-serializable values (functions, circular references) to `fromCallback()` |
| `SESSION_NOT_AUTHENTICATED` | Operation requires authenticated session | Calling `getSessionResponse()` or `getTokenResponse()` on unauthenticated session |

### Common Error Scenarios

#### 1. Invalid Configuration
```typescript
try {
  const session = await getSession(req, res, {
    secrets: 'short' // ❌ Too short (must be 32+ chars)
  });
} catch (error) {
  if (error instanceof SessionError && error.code === SessionErrorCode.INVALID_CONFIGURATION) {
    console.error('Configuration error:', error.message);
    // "Secrets must be at least 32 characters long for security"
  }
}
```

#### 2. Using save() in Edge Runtime
```typescript
// ❌ Wrong - save() requires response object
const session = await getSession(request, { secrets: env.SESSION_SECRET });
session.set('userId', '123');
await session.save(); // Throws MISSING_RESPONSE

// ✅ Correct - use saveToResponse() in Edge runtimes
const session = await getSession(request, { secrets: env.SESSION_SECRET });
session.set('userId', '123');
const response = new Response('Success');
return session.saveToResponse(response);
```

#### 3. Modifying Destroyed Session
```typescript
const session = await getSession(req, res, { secrets: process.env.SESSION_SECRET });
session.destroy();

try {
  session.set('userId', '123'); // ❌ Throws SESSION_DESTROYED
} catch (error) {
  if (error instanceof SessionError && error.code === SessionErrorCode.SESSION_DESTROYED) {
    console.error('Cannot modify destroyed session');
  }
}
```

#### 4. Invalid Callback Data
```typescript
try {
  session.fromCallback(null); // ❌ Missing callback data
} catch (error) {
  if (error instanceof SessionError && error.code === SessionErrorCode.CALLBACK_DATA_INVALID) {
    console.error('Invalid callback data:', error.message);
  }
}
```

#### 5. Flushing Without Deferred Mode
```typescript
const session = await getSession(req, res, { secrets: process.env.SESSION_SECRET });
session.set('userId', '123');

try {
  await session.flush(); // ❌ Throws DEFERRED_MODE_NOT_ENABLED
} catch (error) {
  if (error instanceof SessionError && error.code === SessionErrorCode.DEFERRED_MODE_NOT_ENABLED) {
    console.error('Must enable deferred mode first');
  }
}

// ✅ Correct usage
session.enableDeferredMode();
await session.save(); // Just marks for save
await session.flush(); // Actually saves
```

### Debugging Tips

#### 1. Inspect Error Details and Cause Chain
```typescript
try {
  await session.save();
} catch (error: unknown) {
  if (error instanceof SessionError) {
    console.error('Session save failed:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
      cause: error.cause ?? 'No underlying cause'
    });
  } else {
    // Unexpected error type
    console.error('Unexpected error during session save:', error);
  }
}
```

#### 2. Validate Configuration Early
```typescript
// Validate session config at startup
try {
  const testSession = await getSession(mockRequest, {
    secrets: process.env.SESSION_SECRET,
    maxAge: 3600
  });
  console.log('Session configuration valid ✓');
} catch (error) {
  if (error instanceof SessionError && error.code === SessionErrorCode.INVALID_CONFIGURATION) {
    console.error('Invalid session configuration:', error.message);
    process.exit(1);
  }
}
```

<br>

---

<br>

## Advanced Topics

### Deferred Mode (Node.js Performance)

> **ℹ️ Note on Deferred Mode**
>
> For most applications, the default behavior (encrypt on `save()`) is perfectly fine. Only use deferred mode if you're modifying sessions multiple times per request or profiling shows encryption is a bottleneck. Start simple, optimize only if needed.

**The problem:**

By default, calling `save()` encrypts session data immediately. If you modify the session multiple times per request, each change triggers encryption:

```typescript
session.userId = '123';
await session.save();                    // Encrypts

session.lastActivity = Date.now();
await session.save();                    // Encrypts again
```

This can become inefficient at scale for applications that modify sessions frequently.

**The solution: Deferred Mode**

Deferred Mode batches all saved session changes and encrypts once when you explicitly flush:

```typescript
session.enableDeferredMode(); // Saves now only track if data has changed

session.userId = '123';
await session.save();   // Session knows to encrypt all changes upon flush

session.pageViews = 5;
await session.save();   // Behaves the same as the first save() call

await session.flush();  // Finally encrypts just once with all changes
```

**Express implementation:**

Express middleware runs synchronously, so you can use `getSessionSync()` and `flushSync()` to avoid async operations in the middleware chain. Hook into the response lifecycle to flush automatically before headers are sent:

```typescript
import { getSessionSync } from '@wristband/typescript-session';

app.use((req, res, next) => {
  req.session = getSessionSync(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  req.session.enableDeferredMode();
  
  // Auto-flush before headers are sent
  const prevWriteHead = res.writeHead.bind(res);
  res.writeHead = function(...args) {
    if (!res.headersSent) {
      req.session.flushSync();  // Synchronous flush
    }
    return prevWriteHead(...args);
  };
  
  next();
});
```

Now your routes can modify the session without manual saves:

```typescript
app.get('/dashboard', (req, res) => {
  req.session.lastActivity = Date.now();
  req.session.pageViews = (req.session.pageViews || 0) + 1;
  req.session.save()  // Queued
  
  res.json({ views: req.session.pageViews });
  // Encryption happens automatically before response is sent
});
```

<br>

### CSRF Protection

This SDK includes optional CSRF token protection for defense-in-depth security against cross-site request forgery attacks.

**How it works:**

When enabled, this SDK implements the [Synchronizer Token Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#synchronizer-token-pattern), a widely-used CSRF defense recommended by OWASP. It works by the following:

1. **Token generation:** CSRF tokens are generated when calling `save()`, `saveToResponse()`, or `getCookieDataForSave()`
2. **Dual storage:** Tokens are stored in two places:
  - The session data (encrypted, in the `csrfToken` field)
  - A separate cookie (unencrypted, so frontend JavaScript can read it; e.g.: `CSRF-TOKEN`)
3. **Client includes token:** The frontend reads the token from the cookie and includes it in request headers (e.g., `X-CSRF-TOKEN`)
4. **Server validates:** The backend validates that the header token matches the session token
5. **Automatic cleanup:** When you destroy a session using `destroy()`, `destroyToResponse()`, or `getCookieDataForDestroy()`, both the session cookie and CSRF cookie are automatically deleted

This ensures that even if an attacker can trick a user's browser into making a request, they cannot read the token from the cookie (due to browser same-origin policy) and therefore cannot include it in the attack request.

For more details on CSRF prevention best practices, see the [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

> **⚠️ Implementation Required**
>
> This SDK handles token generation, storage, and cookie management. However, **you must implement**:
> - **Frontend:** Reading the CSRF cookie and including it in request headers
> - **Backend:** Validating the header token matches the session token
>
> See the "Example usage" section below for implementation patterns.

CSRF token protection is **disabled by default** (`enableCsrfProtection: false`). The SDK relies on `sameSite: 'Lax'` (or `'Strict'`) cookies for CSRF protection, which is sufficient for most applications.

**When to enable:**

You should enable CSRF tokens if:
- You need defense-in-depth for sensitive operations
- You're using `sameSite: 'None'` (e.g., embedded iframes)
- Your application requires additional CSRF guarantees beyond SameSite cookies

**Basic configuration:**

```typescript
const session = await getSession(req, res, {
  secrets: 'your-secret-key-min-32-characters-long',
  maxAge: 86400,
  enableCsrfProtection: true,  // Enables token-based protection
});
```

**Custom configuration:**

```typescript
const session = await getSession(req, res, {
  secrets: 'your-secret-key-min-32-characters-long',
  maxAge: 86400,
  enableCsrfProtection: true,
  csrfCookieName: 'MY_APP_CSRF',    // Default: 'CSRF-TOKEN'
  csrfCookieDomain: '.example.com', // Default: same as session cookie domain
});
```
**Example usage:**

The CSRF token is auto-generated when saving the session in the backend:

```typescript
session.isAuthenticated = true;
await session.save(); // Generates and saves csrfToken
```

The frontend reads that token from CSRF cookie:

```typescript
// Get token from the cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('CSRF-TOKEN='))
  ?.split('=')[1];

// Send token in request header
fetch('/api/protected', {
  method: 'POST',
  headers: { 'X-CSRF-TOKEN': csrfToken },
  body: JSON.stringify({ data: 'bodyData' }),
});
```

The backend validates the token value in the request header matches the `csrfToken` value in the session data:

```typescript
app.post('/api/protected', async (req, res) => {
  const session = await getSession(req, res, sessionOptions);
  
  if (!session.isAuthenticated) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Validate CSRF token
  const headerToken = req.headers['X-CSRF-TOKEN'];
  if (session.csrfToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  // Process request...
});
```

**CSRF cleanup on logout:**

When you destroy a session using any of the `destroy()` functions, both the session cookie and CSRF cookie are deleted:

```typescript
app.post('/logout', async (req, res) => {
  const session = await getSession(req, res, sessionOptions);
  
  session.destroy(); // Clears session data AND deletes CSRF cookie
  
  res.json({ success: true });
});
```

Both cookies are removed from the browser, ensuring complete cleanup of session state.

<br>

### Secret Rotation

The SDK supports seamless secret rotation without invalidating existing sessions.

**How it works:**

```typescript
const session = await getSession(req, res, {
  secrets: [
    'new-secret-key-min-32-characters-long',  // Used for NEW sessions
    'old-secret-key-min-32-characters-long',  // Used to DECRYPT old sessions
  ],
  maxAge: 86400000,
});
```

**Encryption:** Always uses the **first secret** (`secrets[0]`)

**Decryption:** Tries each secret in order until one works:
1. Try `new-secret-key` → Success? Done
2. Try `old-secret-key` → Success? Done  
3. All failed → Return empty session

**Rotation strategy:**

1. **Add new secret first** in array: `['new', 'old']`
2. **Deploy** - Old sessions still work (decrypted with old key), new sessions use new key
3. **Wait** for `maxAge` duration (all old sessions expire naturally)
4. **Remove old secret**: `['new']`

This allows zero-downtime secret rotation. Use up to 3 secrets to support gradual rollout across multiple deployments.

<br>

### Rolling Sessions

Sessions automatically roll on every save, meaning the session expiration time resets to the current time plus `maxAge`. This keeps active users logged in without requiring re-authentication.

**How it works:**
```typescript
// 1) Session created at 1:00 PM, expires at 2:00 PM
const session = await getSession(req, res, {
  secrets: 'your-secret-key-min-32-characters-long',
  maxAge: 3600, // 1 hour
});

// 2) User makes a request at 1:30 PM...
session.lastActivity = Date.now();
await session.save();

//
// 3) Session now expires at 2:30 PM (1:30 PM + 1 hour)
//
```

**All save operations roll the session:**
```typescript
// All save-related functions reset expiration from current time
session.save()
session.saveToResponse()
session.getCookieDataForSave()  
```

<br>

### TypeScript Support

The SDK is built with full TypeScript support and type safety. The `SessionData` interface includes optional Wristband fields, but you can extend it with any custom fields you want:

```typescript
interface SessionData {
  // Wristband fields (optional; can be used without Wristband)
  isAuthenticated?: boolean;
  userId?: string;
  tenantId?: string;
  tenantName?: string;
  tenantCustomDomain?: string;
  identityProviderName?: string;
  accessToken?: string;
  expiresAt?: number;
  refreshToken?: string;
  csrfToken?: string;
  
  // Your custom fields
  [key: string]: any;
}
```

#### Custom Session Data Types

To add custom fields to your session for full Typescript support, do the following:

**1: Create a type that extends `SessionData`**

```typescript
// src/types.ts
import { SessionData } from '@wristband/typescript-session';

interface MySessionData extends SessionData {
  cartId?: string;
  theme?: 'light' | 'dark';
  lastVisit?: number;
}
```

**2: Initialize sessions with your type**

```typescript
import { getSession } from '@wristband/typescript-session';
import { MySessionData } from './types';

const session = await getSession<MySessionData>(req, options);
```

**3: Use your session with full type safety**

```typescript
// TypeScript knows these fields exist and their types
session.cartId = '123';             // ✅ Valid
session.theme = 'dark';             // ✅ Valid
session.theme = 'potato';           // ❌ Type error
session.lastVisit = Date.now();     // ✅ Valid
  
await session.save();
```

> **Express: Typing `req.session`**
>
> If you're attaching the session to Express's `Request` object via middleware, you'll need to augment the module to type `req.session`:
>
> ```typescript
> // src/types.ts
> import '@wristband/typescript-session';
>
> declare module '@wristband/typescript-session' {
>   interface SessionData {
>     cartId?: string;
>     theme?: 'light' | 'dark';
>     lastVisit?: number;
>   }
> }
> ```
>
> This makes `req.session` fully typed throughout your Express app:
>
> ```typescript
> app.get('/cart', (req, res) => {
>   const cartId = req.session.cartId; // ✅ TypeScript knows this field exists
>   // ...
> });
> ```

<br>

### Security Considerations

**Best Practices**

1. **Secret Length:** Use secrets that are at least 32 characters long to ensure 256 bits of entropy
2. **HTTPS Only:** Always set `secure: true` in production to ensure cookies are only sent over HTTPS
3. **SameSite Cookies:** Use `sameSite: 'Lax'` (default) or `'Strict'` to prevent cross-site requests. Enable token-based CSRF protection via `enableCsrfProtection: true` for additional security.
4. **Short Sessions:** Set an appropriate `maxAge` based on your application's security requirements (e.g., 1 hour)
5. **Secret Rotation:** Rotate your secrets regularly for enhanced security (e.g., every 6 months)

**Threat Model**

| Attack Vector | Mitigation |
| ------------- | ---------- |
| Cookie theft (XSS) | ✅ HttpOnly prevents JavaScript access |
| Man-in-the-middle | ✅ Secure flag requires HTTPS |
| CSRF attacks | ✅ SameSite cookies + optional CSRF token protection |
| Session replay | ✅ Timestamp-based expiration |
| Cookie tampering | ✅ Authenticated encryption detects modifications |
| Brute force | ✅ 256-bit encryption provides strong protection |

<br>

---

<br>

## Wristband Integration

When using with Wristband authentication, this SDK provides helper methods to simplify common auth workflows.

### Auth Callback Integration

After successful Wristband authentication, use `fromCallback()` in your Callback Endpoint to populate session data from the callback result:

```typescript
import { wristbandAuth } from './wristband-config';
import { getSession } from '@wristband/typescript-session';

app.get('/auth/callback', async (req, res) => {
  // Complete Wristband auth flow
  const callbackResult = await wristbandAuth.callback(req);
  
  // Get session
  const session = await getSession(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  // Populate session from Wristband callback data
  session.fromCallback(callbackResult.callbackData, {
    // Optional: Add custom fields
    preferences: { theme: 'dark' },
    lastLogin: Date.now(),
  });
  
  await session.save();
  res.redirect(callbackResult.callbackData.returnUrl || '/dashboard');
});
```

**What `fromCallback()` does:**

Extracts authentication data from the callback and stores it in the session:
- `isAuthenticated`: `true`
- `accessToken`: JWT access token
- `expiresAt`: Token expiration timestamp
- `userId`: User ID
- `tenantId`: Tenant ID
- `tenantName`: Tenant name
- `identityProviderName`: Identity provider
- `refreshToken`: Refresh token (if `offline_access` scope used)
- `tenantCustomDomain`: Tenant custom domain (if applicable)

Any custom fields you pass are merged with the core session data.

<br>

### Session Endpoint

The `getSessionResponse()` method returns session data in the format expected by Wristband frontend SDKs for your Session Endpoint:

```typescript
app.get('/api/v1/session', async (req, res) => {
  const session = await getSession(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  // Return formatted session response with optional custom metadata
  const response = session.getSessionResponse({
    name: session.fullName,
    email: session.email,
  });
  
  res.json(response);
});
```

**Response format:**
```json
{
  "tenantId": "tenant_abc123",
  "userId": "user_xyz789",
  "metadata": {
    "name": "John Doe",
    "preferences": { "theme": "dark" }
  }
}
```

<br>

### Token Endpoint

The `getTokenResponse()` method returns the access token and expiration time in the format expected by Wristband frontend SDKs for your Token Endpoint:

```typescript
app.get('/api/v1/token', async (req, res) => {
  const session = await getSession(req, res, {
    secrets: 'your-secret-key-min-32-characters-long',
    maxAge: 86400,
  });
  
  // Return formatted token response
  const response = session.getTokenResponse();
  res.json(response);
});
```

**Response format:**
```json
{
  "accessToken": "eyJhbGc...",
  "expiresAt": 1735689600000
}
```

Your frontend can use this token for direct API calls to Wristband or other services:

```typescript
const tokenResponse = await fetch('/api/v1/token');
const { accessToken } = await tokenResponse.json();

// Use token to call Wristband API
const userResponse = await fetch('https://your-app.wristband.dev/api/v1/users/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

<br>

---

<br>

## Using with Wristband Auth SDKs

This session SDK is embedded in the following Wristband authentication SDKs, providing both authentication and session management in a single dependency:

- **[@wristband/express-auth](https://github.com/wristband-dev/express-auth)**
- **[@wristband/nextjs-auth](https://github.com/wristband-dev/nextjs-auth)**
- **[@wristband/nestjs-auth](https://github.com/wristband-dev/nestjs-auth)**

If you're using Wristband for authentication, we recommend using one of these framework-specific SDKs instead of installing the session SDK separately. They provide a complete, integrated solution for both authentication and session management.

**Note:** You only need to install this standalone session SDK if:

- You're not using Wristband authentication
- You need session management for a framework without a dedicated Wristband auth SDK
- You're building a custom integration

<br>

---

<br>

## Questions

Reach out to the Wristband team at <support@wristband.dev> for any questions regarding this SDK.
