<div align="center">
  <a href="https://wristband.dev">
    <picture>
      <img src="https://assets.wristband.dev/images/email_branding_logo_v1.png" alt="Github" width="297" height="64">
    </picture>
  </a>
  <p align="center">
    Migration instruction from version v0.x to version v1.x
  </p>
  <p align="center">
    <b>
      <a href="https://wristband.dev">Website</a> • 
      <a href="https://docs.wristband.dev/">Documentation</a> • 
      <a href="https://docs.wristband.dev/llms.txt">LLMs.txt</a>
    </b>
  </p>
</div>

<br/>

---

<br/>

# Migration instruction from version v0.x to version v1.x

**Legend:**

- (`-`) indicates the older version of the code that needs to be changed
- (`+`) indicates the new and correct version of the code for version 1.x

<br>

## Table of Contents

- [Minimum Node.js and npm Versions](#minimum-nodejs-and-npm-versions)
- [Automatic No-Cache Headers](#automatic-no-cache-headers)
- [Session Cookie Encoding Changes](#session-cookie-encoding-changes)
- [CallbackData, UserInfo, and UserInfoRole Exports Removed](#callbackdata-userinfo-and-userinforole-exports-removed)

<br>

## Minimum Node.js and npm Versions
 
The minimum supported Node.js version is now 22.0.0, and the minimum npm version is now 10.5.1. Node.js 20 reached end of life on April 30, 2026.
 
The SDK's `package.json` now declares:
 
**Before (v0.x):**
```json
"engines": {
- "node": ">=20.0.0",
- "npm": ">=9.6.0"
}
```
 
**After (v1.x):**
```json
"engines": {
+ "node": ">=22.0.0",
+ "npm": ">=10.5.1"
}
```
 
**Key Changes:**
1. Upgrade your app's runtime to Node.js 22 or later (Node.js 22.0.0 ships with npm 10.5.1, so upgrading Node covers npm too)
2. Update anything still pinned to Node.js 20, such as CI workflows, Dockerfiles, `.nvmrc` files, or hosting platform settings

<br>

## Automatic No-Cache Headers

Any response that writes or deletes a session cookie now automatically includes `Cache-Control: no-store` and `Pragma: no-cache`. This prevents browsers and shared caches (such as CDNs and proxies) from storing a response that carries a user's session cookie and serving it to someone else. In v0.x, apps were solely responsible for setting these headers. For security, the SDK now sets them itself, so a forgotten header can no longer leave a session cookie cacheable.

**Before (v0.x):**
```typescript
app.post('/login', async (req, res) => {
  req.session.userId = '123';
  await req.session.save();
- res.setHeader('Cache-Control', 'no-store');
- res.setHeader('Pragma', 'no-cache');
  res.json({ success: true });
});
```

**After (v1.x):**
```typescript
app.post('/login', async (req, res) => {
  req.session.userId = '123';
+ await req.session.save(); // Also sets Cache-Control and Pragma
  res.json({ success: true });
});
```

**Key Changes:**
1. `save()`, `destroy()`, `flush()`, and `flushSync()` set the headers on the response. `flush()` and `flushSync()` only set them when pending session cookies are written.
2. `saveToResponse()` and `destroyToResponse()` set the headers on the returned Response. The original Response is not modified.
3. `getCookieDataForSave()` and `getCookieDataForDestroy()` do not set any headers, since there is no response object. Next.js already sends `Cache-Control: no-store` on every Server Action response.
4. Manually set `Cache-Control` and `Pragma` headers can be removed only from routes that save or destroy the session on every request. Keep them on any route that only sometimes saves or destroys the session, or that never does (e.g. a route that only reads the session), since those responses do not get the headers automatically.

> **⚠️ Important:**
>
> Existing `Cache-Control` and `Pragma` values on the response are replaced, not merged. If your app sets a custom `Cache-Control` value on a response that also saves or destroys the session, that value is now replaced with `no-store`.

<br>

## Session Cookie Encoding Changes

Encrypted session cookie values are now base64url-encoded (RFC 4648, Section 5) with no padding, instead of standard base64. No code or config changes are needed.

**Key Changes:**
1. Cookie values no longer contain `+`, `/`, or `=`, so they are no longer percent-encoded when written to the `Set-Cookie` header
2. Session cookies created by v0.x are still decrypted by v1.x, so existing users stay logged in after the upgrade

> **⚠️ Important:**
>
> v0.x cannot read session cookies created by v1.x. Rolling back to v0.x after the upgrade, or sharing a session cookie with an app still on v0.x, logs out users with a new cookie once.

<br>

## CallbackData, UserInfo, and UserInfoRole Exports Removed

The `CallbackData`, `UserInfo`, and `UserInfoRole` types are no longer exported. They are only used by the Wristband-specific `fromCallback()` method, and the Wristband auth SDKs export their own versions. Runtime behavior is unchanged, and JavaScript apps are not affected.

**Before (v0.x):**
```typescript
- import type { CallbackData } from '@wristband/typescript-session';
```

**After (v1.x):**
```typescript
+ import type { CallbackData } from '@wristband/express-auth';
```

**Key Changes:**
1. Import these types from the Wristband auth SDK in use instead
2. The `callbackData` returned by an auth SDK's `callback()` can still be passed directly to `fromCallback()`
3. Apps that don't use Wristband authentication are not affected

<br>

## Questions

Reach out to the Wristband team at <support@wristband.dev> for any questions around migration.

<br/>
