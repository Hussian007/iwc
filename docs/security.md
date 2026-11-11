# Security

IWC applications are secure by default: the protections below are on in every app, on the web, in native apps and in API-only projects, without code. This page lists them, the few settings that change them, and how to keep credentials safe.

## On by default

| Area | What IWC does |
| --- | --- |
| Passwords | PBKDF2-SHA256 with 600,000 iterations and a random salt; constant-time checks; the same timing for unknown accounts |
| Sessions | Random tokens stored hashed; `HttpOnly`, `SameSite=Lax`, `Secure` in production; token sessions with single-use refresh tokens and reuse detection (a replayed refresh token ends the whole sign-in) |
| Sign-in abuse | Per-IP and per-account rate limits on every `auth.*` operation |
| Authorization | Every read and write passes the schema's `access` rules, tenancy and record scopes; workflow transitions are row-scoped; relation writes to another tenant's record are refused |
| Validation | Every API and action input is validated on the server against its declared fields; unknown fields are refused. Client-side checks never replace it |
| SQL injection | All queries are parameterised; field names come from the compiled schema, never from requests |
| XSS | All output is HTML-escaped; no inline script; a strict Content-Security-Policy with a fresh nonce per response |
| CSRF | Double-submit token on every cookie-authenticated write; foreign `Origin` refused |
| Headers | CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, frame protection, HSTS in production |
| Uploads | Size limits; the type is sniffed from the bytes (the browser's claim is ignored); HTML, SVG and scripts are always refused; files are stored under random ids and served with `nosniff` |
| Outbound requests (SSRF) | Services and integrations use a guarded client that checks the address it actually connects to, after DNS: loopback, private networks and cloud metadata (169.254.169.254) are refused in production, and redirects are never followed |
| Credentials | A credential written into a project file doesn't compile; credentials are read from the environment, never shipped in a build, and never logged |
| Sensitive data | `sensitive` fields never leave the server; `encrypted` fields are encrypted at rest |
| Audit | Sign-ins, failures, refusals, resets, uploads, actions and transitions are recorded in `_iwc_audit` |

## Credentials and secrets

Credentials (API keys, webhook secrets, database URLs) never go in `.iwc` files. A file names an environment variable instead:

```json iwc:integration
{
  "package": "@iwc/mail",
  "provider": "postmark",
  "config": { "from": "Shop <orders@shop.example>" },
  "credentials": { "serverToken": { "env": "MAIL_POSTMARK_SERVER_TOKEN" } }
}
```

**In development** the values live in an encrypted vault outside the project, so they can't be committed or built:

```bash
iwc secrets set STRIPE_SECRET_KEY        # typed hidden (or piped on stdin)
iwc secrets list                         # what is stored, and what the project still needs
iwc secrets get STRIPE_SECRET_KEY        # masked; --reveal prints it
iwc secrets set IWC_ENCRYPTION_KEY --generate
```

The vault is `~/.iwc/vault/<project id>.json`, each value sealed with AES-256-GCM under `~/.iwc/vault/master.key` (mode 0600; `IWC_VAULT_KEY` overrides it, for CI). `iwc dev` loads the `development` environment; `--env production` keeps a separate set.

**In production** IWC reads only the server's environment: the vault is never consulted. Move values there with:

```bash
iwc secrets export --env production --out settings.env   # 0600; for a zip deploy, copy it beside iwc.cgi
```

A server refuses to start when a declared credential is missing, naming the variable.

**Never in a build.** `iwc build` scans everything it produces, including files copied from `assets/`, for recognisable credential formats (private keys, AWS keys, Stripe and other provider secrets) and for the actual values of the project's secrets, from the environment and every vault environment. If it finds one, no build is produced.

**Never in a log.** Every credential value IWC reads is registered with the logger, which replaces it with `[redacted]` wherever it appears, including in a provider's error message.

## Encrypting fields at rest

For identity numbers, health and financial records:

```json iwc:schema
{
  "name": "patient",
  "fields": {
    "name": { "type": "string", "required": true },
    "aadhaar": { "type": "string", "encrypted": true, "sensitive": true },
    "diagnosis": { "type": "text", "encrypted": true }
  },
  "access": { "read": ["doctor"], "create": ["doctor"], "update": ["doctor"] }
}
```

Values are stored as AES-256-GCM ciphertext bound to their table and column, so the database, its backups and anyone with SQL access see only ciphertext. IWC decrypts on read for callers the access rules allow. An encrypted field can't be filtered, sorted, searched, indexed or unique (each value has a fresh nonce); the compiler says so.

- The key is `IWC_ENCRYPTION_KEY`: 32 random bytes, base64. `iwc dev` creates one in the vault the first time; production refuses to start without one.
- **Rotating:** set the new key as `IWC_ENCRYPTION_KEY`, put the old one in `IWC_ENCRYPTION_KEYS_PREVIOUS` (comma-separated), run `iwc migrate --reencrypt`, then remove the old key.
- Existing plain values keep working and are encrypted when next saved or by `--reencrypt`.
- **Losing the key loses the data.** Keep it in your secret manager.

## Webhooks

A webhook API turns CSRF off (`"security": {"csrf": false}`), so its action **must** prove who sent it. The API passes the exact body and the signature header (`"request": {"rawBody": true, "headers": {"stripe-signature": "string"}}`); with an integration, checking them is one step that verifies the provider's signature (and timestamp, against replays) and fails with 401 otherwise:

```json iwc:step
{ "operation": "call", "integration": "payments.integration.iwc", "method": "verifyWebhook", "input": { "body": "=input.rawBody", "headers": "=input.headers" }, "as": "event" }
```

For other senders, use `verifyHmacSecret` ([actions](actions-and-workflows.md#verifying-signed-webhooks)). `iwc security` flags a webhook whose action checks no signature.

## Auditing a project

```bash
iwc security            # findings by severity; exits non-zero on a high one
iwc security --strict   # also fails on medium findings (for CI)
iwc security --json
```

It reports what the compiler can't refuse outright because it is sometimes intended: writes anyone can make, CSRF off without a signature check, personal data readable by anyone, secret-looking fields sent to clients, identity or health fields stored unencrypted, notifications with no mail transport, payments never confirmed server-side, loosened CSP or framing, plain-http CORS origins, very long sessions, and `.env`/`.iwc` missing from `.gitignore`.

## Checklist before going live

1. `iwc security --strict` and `iwc validate` pass.
2. Production credentials are in the server environment (`iwc secrets export`), and the vault's development keys are test-mode keys.
3. `app.iwc` `seo.siteUrl` is set (emailed links and canonical URLs use it, never the request's Host header).
4. The site is served over HTTPS (`iwc start` sets Secure cookies and HSTS).
5. `IWC_ENCRYPTION_KEY` is backed up, if the app has encrypted fields.
6. Every webhook verifies its signature, and orders are fulfilled only after `getPayment` or a verified webhook.
