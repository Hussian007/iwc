# Authentication and security

## Turning accounts on

1. A user schema with an identity field, a password field and (optionally) a role:

```json iwc:schema
{
  "name": "user",
  "fields": {
    "name": { "type": "string", "required": true, "maxLength": 80 },
    "email": { "type": "email", "required": true, "unique": true },
    "password": { "type": "password", "required": true },
    "role": { "type": "enum", "values": ["customer", "admin"], "default": "customer", "required": true }
  }
}
```

2. `auth` in `app.iwc`:

```json iwc:app
{
  "name": "Shop",
  "auth": {
    "user": "user.schema.iwc",
    "identity": "email",
    "password": "password",
    "role": "role",
    "defaultRole": "customer",
    "loginPage": "/login",
    "register": true,
    "session": { "ttl": "7d" }
  }
}
```

| `auth` key | Default | Meaning |
| --- | --- | --- |
| `user` | (required) | The user schema |
| `identity` | `email` | The field people sign in with |
| `password` | `password` | The password field |
| `role` | `role` | The field holding the role |
| `defaultRole` | the role field's `default` | The role given at registration. **Roles are never taken from a request** |
| `loginPage` | `/login` | Where protected pages send visitors |
| `register` | `true` | `false` closes registration (403 `registration_closed`) |
| `session.ttl` | `7d` | Cookie (web) session lifetime |
| `session.accessTtl`, `session.refreshTtl` | `15m`, `30d` | Token sessions (native apps): access and refresh token lifetimes |
| `providers` | — | Sign-in providers for `auth.exchange`. See [Phone sign-in](#phone-sign-in-firebase) |
| `activeWhen` | — | Field → value a user must hold to sign in and keep a session: `{"status": "active"}` |
| `allowRoles` | — | Only these roles may sign in. Checked against effective roles (database grants included); `perm:<permission>` entries allowed. Usually set per app |
| `signedInAt` | — | A datetime field stamped on every sign-in |

3. Three APIs:

```json iwc:api
{
  "name": "login",
  "method": "POST",
  "path": "/auth/login",
  "operation": "auth.login",
  "request": { "payload": { "email": { "type": "email", "required": true }, "password": { "type": "string", "required": true } } },
  "response": { "fields": { "success": "boolean", "user": "object" } }
}
```

```json iwc:api
{
  "name": "register",
  "method": "POST",
  "path": "/auth/register",
  "operation": "auth.register",
  "request": {
    "payload": {
      "name": { "type": "string", "required": true, "minLength": 2 },
      "email": { "type": "email", "required": true },
      "password": { "type": "string", "required": true, "minLength": 8 }
    }
  },
  "response": { "status": 201, "fields": { "success": "boolean", "user": "object" } },
  "security": { "rateLimit": true }
}
```

```json iwc:api
{ "name": "me", "method": "GET", "path": "/auth/me", "operation": "auth.me" }
```

4. Sign-in and registration screens with forms posting to them. See [`examples/cookbook/ui/login.ui.iwc`](examples/cookbook/ui/login.ui.iwc) and `register.ui.iwc`.

Signing out needs no API: a button with `"action": "logout"` posts to the built-in `/_iwc/auth/logout`. (An `auth.logout` API also exists for other clients.)

## What happens

- Registration validates the payload, refuses a taken identity (409), hashes the password, assigns `defaultRole`, signs the user in, and returns the user without the password.
- Sign-in compares in constant time and is rate-limited per IP and per account (10/minute by default; change it with `rateLimit.auth` in `.security.iwc`). Failures say "Invalid email or password" and never reveal which was wrong.
- Sessions are random tokens stored hashed in the database, in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production).
- Cookie-authenticated writes need the CSRF token, which IWC forms and buttons send for you, and a same-origin `Origin` header.
- `auth.login`/`auth.register` also produce a `token`. Declare `"token": "string"` in `response.fields` to give it to an app, which then sends `Authorization: Bearer <token>`. Bearer requests skip CSRF.

## Phone sign-in (Firebase)

Firebase sends the SMS and checks the code; IWC verifies the resulting Firebase ID token itself (RS256 signature against Google's published certificates, audience, issuer, expiry, `phone_number`) and signs the phone's user in. No Firebase SDK runs on the server, and the Firebase token is never stored. Passwordless: the user schema needs no password field.

```json iwc:app
{
  "name": "Library",
  "auth": {
    "user": "user.schema.iwc",
    "identity": "phone",
    "providers": {
      "firebase-phone": {
        "projectId": { "env": "FIREBASE_PROJECT_ID" },
        "web": { "apiKey": { "env": "FIREBASE_WEB_API_KEY" }, "authDomain": { "env": "FIREBASE_AUTH_DOMAIN" }, "appId": { "env": "FIREBASE_WEB_APP_ID" } }
      }
    },
    "register": { "role": "member" },
    "activeWhen": { "status": "active" }
  }
}
```

```json iwc:api
{ "name": "phone sign-in", "method": "POST", "path": "/auth/firebase", "operation": "auth.exchange", "provider": "firebase-phone", "security": { "auth": false } }
```

The body is `{"idToken": "<Firebase ID token>"}`. Any other identity field (`role`, `phone`, `id`) is refused with 422. A first sign-in creates the account only when `register` allows it, with `register.role`; otherwise, and for suspended (`activeWhen`) or disallowed (`allowRoles`) users, the answer is the same 403 `sign_in_refused`, so nobody learns which numbers have accounts.

On a web screen, the `phoneSignIn` element is the whole flow (number → code, resend cooldown, SMS autofill, error messages). It loads Firebase's SDK and reCAPTCHA on that page only; that page's CSP gains Google's origins and the router always enters and leaves it with a full page load:

```json iwc:ui
{
  "name": "Sign in",
  "route": "/login",
  "sections": [
    { "type": "phoneSignIn", "api": "phone-sign-in.api.iwc", "value": "+91", "target": "/account" }
  ]
}
```

`value` pre-fills the country code, `target` is where to go after signing in (a safe `?next=` wins).

### Development codes

**Local development without a Firebase project:** under `iwc dev`, when `projectId` resolves to nothing (no `FIREBASE_PROJECT_ID`) and no Auth Emulator is set, IWC stands in for the SMS provider. The sign-in screen (web, Android and iOS) shows *Development sign-in — your code is 123456* and fills it in; verifying it gives a short-lived token signed by this process only, which the same `auth.exchange` api turns into an ordinary session, so registration, roles and `allowRoles` behave exactly as in production. `IWC_DEV_OTP=1` forces it on in development even with a project configured, `IWC_DEV_OTP=0` turns it off, `IWC_DEV_OTP_CODE` picks another 6-digit code. A built app, `iwc start` and tests never answer `/_iwc/auth/dev-otp/*` and never accept these tokens.

**With the Auth Emulator instead:** run the Firebase Auth Emulator (`firebase emulators:start --only auth --project demo-<name>`), set `FIREBASE_PROJECT_ID=demo-<name>` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. Under `iwc dev` only, the server then accepts the emulator's unsigned tokens and the widget talks to the emulator (codes appear in the emulator log). `iwc start` never accepts them, whatever the environment says.

**Firebase console settings you must make:** enable the Phone provider; add your domains to Authorized domains; restrict SMS regions to the countries you serve; enable App Check. IWC can't rate-limit SMS sends (they go from the device to Firebase); it rate-limits the exchange per IP and per phone.

## Sessions

Every sign-in is a *login* (one browser, one phone). A login holds either:

- a **cookie session** (the default, for browsers), or
- a **token session**, when the sign-in body says `"session": "token"` (native apps, scripts): a short-lived access token (`Authorization: Bearer`) plus a single-use refresh token. Token sign-ins need no CSRF token and set no cookie.

Any sign-in operation (`auth.login`, `auth.register`, `auth.exchange`) accepts `"session"` and `"device": {"platform", "model", "appVersion", "name"}`.

| Operation | Method | Body | Does |
| --- | --- | --- | --- |
| `auth.refresh` | POST | `{"refreshToken"}` | New access + refresh token; the old pair stops working |
| `auth.sessions` | GET | — | The caller's logins in every app: `{id, app, kind, device, ip (truncated), createdAt, lastSeenAt, current}` |
| `auth.revoke` | POST | `{"id"}` or `{"others": true}` | Signs out one login, or every login but this one |
| `auth.logout` | POST | — | Ends this login, refresh token included |

- A refresh token presented twice (replayed by a thief, or a client bug) **ends the whole login**: both holders must sign in again. Clients must not refresh concurrently.
- A change of the user's `role`, or the user no longer matching `activeWhen` / `allowRoles`, ends their sessions on their next request.
- Only hashes of tokens are stored.

Tests: in a passwordless project, `"as": {"identity": "+15550000002"}` signs the user in directly (same rules). `"expect": {"signIn": "refused"}` asserts that `as` user may not sign in to the app; the request is then sent signed out.

## Password reset and email verification

```json iwc:app
{
  "name": "Ledger",
  "iwc": 1,
  "seo": { "siteUrl": { "env": "SITE_URL" } },
  "auth": {
    "user": "user.schema.iwc",
    "passwordReset": { "page": "/reset-password" },
    "emailVerification": { "page": "/verify-email", "field": "emailVerifiedAt", "required": true }
  }
}
```

| Operation | Body | Does |
| --- | --- | --- |
| `auth.requestPasswordReset` | `{"email"}` | Emails a reset link. The answer is the same whether or not the account exists, and the email is sent after the response (no timing difference) |
| `auth.resetPassword` | `{"token", "password"}` | Sets the password (validated like any write), **ends every session of the account**, and marks the address verified. A rejected password leaves the link usable |
| `auth.requestEmailVerification` | `{}` signed in, or `{"email"}` | Emails a verification link (sent automatically on registration) |
| `auth.verifyEmail` | `{"token"}` | Stamps the `field` (a `datetime` on the user schema) |

- The emailed link is `<seo.siteUrl><page>?token=…`. Your page reads `query.token` into a hidden input and posts it with the form. Links are built **only** from `seo.siteUrl`, never from the request's Host header (an attacker controls that: "password-reset poisoning"); production refuses to start without it. In development a loopback request's own address is used.
- Tokens are 32 random bytes, stored only as a SHA-256 hash, single-use (spent atomically), and expire (`ttl`: reset 30m, verification 48h by default). Requesting a new link voids the previous one. At most 3 emails per address per 15 minutes.
- `required: true`: registration signs no one in, and sign-in answers `403 email_unverified` until the link is opened.
- Emails go through the project's [`@iwc/mail`](integrations-and-packages.md#packages-iwc-add) integration; in development without one they are printed to the dev log. `emailField` names the address field when it isn't the sign-in identity; `subject` overrides a subject.

## Social sign-in

Install a provider (`iwc add @iwc/google-signin`, `@iwc/github-signin`, `@iwc/apple-signin`, `@iwc/microsoft-signin`, `@iwc/oidc` for Okta/Auth0/Keycloak…; the client secret goes into the vault or environment like any credential) and name it in `app.iwc`:

```json iwc:app
{
  "name": "Desk",
  "iwc": 1,
  "seo": { "siteUrl": { "env": "SITE_URL" } },
  "auth": {
    "user": "user.schema.iwc",
    "defaultRole": "member",
    "loginPage": "/login",
    "oauth": { "google": { "integration": "google.integration.iwc", "profile": { "name": "fullName" } } }
  }
}
```

A link to `/_iwc/auth/oauth/google/start?next=/inbox` signs in. Register `<seo.siteUrl>/_iwc/auth/oauth/google/callback` as the provider's redirect URI. Failures return to `loginPage?error=…`.

- The flow uses `state` (single use, bound to the browser by a cookie), PKCE and an OpenID nonce; the code is exchanged server-side and the ID token's issuer, audience, expiry and nonce are checked.
- A known identity signs its user in. Otherwise an account with the **same email the provider verified** is linked (`"linkVerifiedEmail": false` turns this off); unverified emails never link and never create accounts. New accounts get the default role, `profile` fields, and an unusable password (password reset sets one).
- `/_iwc/auth/oauth/<name>/start?link=1` connects a provider to the signed-in account after a confirmation page. `auth.identities` (GET) lists connections, `auth.unlink {"provider"}` removes one — never the last way in.
- In development, the `simulated` provider shows a local page where you sign in as any address.

## Two-factor sign-in

```json iwc:app
{
  "name": "Desk",
  "iwc": 1,
  "auth": {
    "user": "user.schema.iwc",
    "mfa": { "methods": ["totp", "email"], "requiredFor": ["admin"], "page": "/two-factor" }
  }
}
```

After the password (or social sign-in), a user with an authenticator app, or one whose role is in `requiredFor` (all users with `"required": true`), gets `{"mfaRequired": true, "methods": [...]}` and **no session**. The pending sign-in is an HttpOnly cookie (browsers) or `mfaToken` in the body (`"session": "token"` clients), valid 10 minutes, locked after 5 wrong codes.

| Operation | Body | Does |
| --- | --- | --- |
| `auth.mfaVerify` | `{"code"}` or `{"recoveryCode"}` | completes the sign-in |
| `auth.mfaChallenge` | `{"method": "email" \| "sms"}` | sends a 6-digit code (sent automatically when it is the only method) |
| `auth.mfaSetup` | `{}` | starts authenticator enrolment: `{secret, otpauthUrl}` (show `otpauthUrl` as a QR code) |
| `auth.mfaEnable` | `{"code"}` | confirms it; returns 10 one-time recovery codes |
| `auth.mfaDisable` | `{"code"}` (app or recovery code) | turns it off |
| `auth.mfaStatus` | GET | `{totp, methods, required, recoveryCodesLeft}` |

Authenticator codes follow RFC 6238 (30 s, ±1 step) and can't be replayed; secrets are encrypted with `IWC_ENCRYPTION_KEY`; recovery and message codes are stored hashed. `sms` needs `phoneField` and an `@iwc/sms` integration in `sms`. Required two-factor must include `email` or `sms` so users without an app can still sign in.

## Using the user

| Where | How |
| --- | --- |
| Show a field | `"bind": "user.name"` |
| Data source | `{"source": "USER", "mode": "single"}` |
| Filter by the user | `"filter": {"customer": {"user": "id"}}` |
| Show/hide | `"visible": {"auth": "signed-in"}`, `{"auth": "signed-out"}`, `{"roles": ["admin"]}` |
| Protect a screen | `"auth": "required"`, `"roles": ["admin"]` |
| Protect an API | `"security": {"auth": true, "roles": ["admin"]}` |
| Own records | schema `"owner": "author"` + `access: "owner"` |
| In an action | `user.id`, `user.email` in expressions; `"auth": "required"` on the action |

`visible` is decided on the server: hidden elements never reach the browser.

## .security.iwc

**Purpose:** project-wide rules: role inheritance, protected route areas, rate limits, CORS and headers.
**When:** once your app has more than one role, or whole sections to protect.

```json iwc:security
{
  "name": "Security",
  "roles": {
    "admin": { "inherits": ["editor"], "description": "Everything" },
    "editor": { "inherits": ["customer"] },
    "customer": {}
  },
  "routes": [
    { "path": "/admin/*", "auth": "required", "roles": ["admin"] },
    { "path": "/account/*", "auth": "required" }
  ],
  "rateLimit": { "api": "120/1m", "auth": "10/1m" },
  "cors": { "origins": ["https://app.example.com"] },
  "headers": { "frameAncestors": "'none'" }
}
```

| Key | Meaning |
| --- | --- |
| `roles.<role>.inherits` | Roles this role also has. `admin` above passes any check for `editor` or `customer` |
| `routes` | `{path, auth, roles}`. A trailing `/*` covers everything below. Applied in addition to each screen's own rules |
| `rateLimit.api` | Rate for APIs with `"rateLimit": true` (default `60/1m`) |
| `rateLimit.auth` | Rate for sign-in and registration (default `10/1m`) |
| `cors.origins` | Other origins allowed to call the APIs with credentials |
| `headers.contentSecurityPolicy` | Replace the default (strict, nonce-based) policy. Rarely needed |
| `headers.frameAncestors` | Who may frame the site (default `'self'`) |

## Always on

- Text and attributes are HTML-escaped. Link and media URLs are allow-listed (`javascript:` is impossible).
- A strict Content-Security-Policy with a per-request nonce, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS in production.
- Undeclared request fields are rejected, so there is no mass assignment. Undeclared response fields are stripped.
- Every database value is a bound parameter.
- Files containing credentials (`sk_live_…`, private keys, `postgres://user:pass@…`, AWS keys…) don't compile. Use `{"env": "NAME"}`.
- Audit records for sign-ins, writes, actions and workflow transitions are kept in an internal table, `_iwc_audit`.

## Multi-tenant apps

```json iwc:app
{ "name": "Team app", "auth": { "user": "user.schema.iwc" }, "tenancy": { "field": "organizationId" } }
```

With `tenancy`, the user schema's `organizationId` names each user's tenant, and every schema with `"tenant": true` gets a managed `tenantId` column. All its reads and writes, including from actions, are scoped to the caller's tenant.
