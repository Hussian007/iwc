# Integrations, packages and deployment

## .service.iwc: external HTTP services

**Purpose:** declare an external API (payments, email, shipping, search, your own backend) once: its address, credentials and methods. Actions call it with a `call` step.
**When:** whenever your app talks to another system. During development, a **simulated** service stands in for one you don't have yet.

### An HTTP service

```json iwc:service
{
  "name": "Mailer",
  "provider": "http",
  "baseUrl": { "env": "MAILER_URL" },
  "auth": { "type": "bearer", "secret": { "env": "MAILER_TOKEN" } },
  "timeout": "10s",
  "methods": {
    "send": {
      "method": "POST",
      "path": "/v1/messages",
      "body": { "to": "=input.to", "subject": "=input.subject", "text": "=input.body" }
    },
    "status": {
      "method": "GET",
      "path": "/v1/status",
      "query": { "id": "=input.id" }
    }
  }
}
```

| Property | Required | Meaning |
| --- | --- | --- |
| `name`, `provider`, `methods` | **yes** | `provider`: `http` or `simulated` |
| `baseUrl` | http | An `https://` URL, or `{"env": "NAME"}` read at run time (https, or http to `localhost`/`127.0.0.1` only) |
| `auth` | no | `type` `bearer` / `basic` / `header` (with `header` naming it), and `secret: {"env": "NAME"}`. Literal secrets don't compile |
| `timeout` | no | Per call (default 10s) |
| `methods.<m>.method`, `.path` | http | Relative to `baseUrl` |
| `methods.<m>.body` | no | JSON body; values are expressions over `input` |
| `methods.<m>.query` | no | Query parameters; expressions; empty ones are left out |
| `methods.<m>.headers` | no | Headers sent with the call; expressions over `input`. An API version lives here: `{"Accept": "application/vnd.shop.v2+json"}` or `{"X-API-Version": "2026-01"}` |
| `methods.<m>.retry` | no | Retries of a transient failure (network error, 429, 502, 503, 504), with exponential backoff that honours `Retry-After`, all within `timeout`. Default **2 for GET, 0 for other methods**: a write is repeated only when the method says it is safe to |
| `methods.<m>.cache` | no | GET only: keep the answer this long (`"5m"`), shared by every identical call (same URL). Concurrent identical calls make one request |
| `allowInProduction` | no | Only for simulated services in demos |

Calling it from an action:

```json iwc:step
{ "operation": "call", "service": "mailer.service.iwc", "method": "send", "input": { "to": "=user.email", "subject": "Your order", "body": "=concat('Order ', order.id, ' is confirmed.')" }, "as": "sent", "status": 502, "error": "We couldn't send your email" }
```

A read-heavy method with an API version, caching and the default retries:

```json iwc:service
{
  "name": "Rates",
  "provider": "http",
  "baseUrl": { "env": "RATES_URL" },
  "auth": { "type": "header", "header": "X-Api-Key", "secret": { "env": "RATES_KEY" } },
  "methods": {
    "latest": { "method": "GET", "path": "/latest", "query": { "base": "=input.base" }, "headers": { "Accept": "application/vnd.rates.v2+json" }, "cache": "5m" }
  }
}
```

The parsed JSON response is stored in `as`. A non-2xx status, timeout or network error fails the step (502 by default). Redirects are not followed. Service origins are automatically allowed in the Content-Security-Policy for images, media and fonts, and as targets for a form's `success.redirect`.

### A simulated service

```json iwc:service
{
  "name": "Payments",
  "provider": "simulated",
  "methods": {
    "charge": {
      "respond": { "id": "=concat('pay_', input.reference)", "status": "succeeded", "amount": "=input.amount" },
      "fail": "input.amount > 5000"
    }
  }
}
```

`respond` is the response (expressions over `input`). When `fail` is true, the call fails with 402. Simulated services make the whole flow runnable locally, including the failure path. **Production refuses to start** with a simulated service unless it sets `"allowInProduction": true`, so a fake payment provider can't ship by accident.

### Reading external data into a page

Page → `API.<name>` data source → GET API → action → `call` step → service. See [`examples/cookbook`](examples/cookbook): `ui/api-demo.ui.iwc`, `api/quote.api.iwc`, `actions/get-quote.action.iwc`, `services/quotes.service.iwc`.

### Receiving webhooks

A webhook is an API with an action and `"security": {"csrf": false}` (allowed only when no sign-in is required). The action must verify the sender: an integration's `verifyWebhook`, or `verifyHmacSecret` for anyone else. See [security](security.md#webhooks).

## Packages: `iwc add`

IWC ships a set of **packages**: one capability (email, payments, storage…) each, with one IWC-native interface and several interchangeable providers behind it. The providers are part of the `iwc` binary (signed requests, OAuth tokens, SMTP and all), so nothing is downloaded and there is no third-party code in your app.

```bash
iwc packages                 # what is available
iwc packages @iwc/payments   # its methods, inputs and provider settings
iwc add @iwc/mail            # choose a provider, enter credentials (hidden), verify, configure
iwc add @iwc/stripe          # a shortcut: @iwc/payments with Stripe
```

`iwc add` asks for each setting, stores credentials **encrypted in the development vault** (never in the project), makes a real authenticated request to check them, and writes `integrations/<name>.integration.iwc`:

```json iwc:integration
{
  "package": "@iwc/payments",
  "provider": "razorpay",
  "config": { "keyId": "rzp_test_1DP5mmOlF5G5ag" },
  "credentials": {
    "keySecret": { "env": "PAYMENTS_RAZORPAY_KEY_SECRET" },
    "webhookSecret": { "env": "PAYMENTS_RAZORPAY_WEBHOOK_SECRET" }
  }
}
```

| Property | Meaning |
| --- | --- |
| `package` | The package, e.g. `@iwc/mail` |
| `provider` | A provider id (`iwc packages <package>`), or `simulated`: works with no account in development and tests, and refuses to start in production unless `allowInProduction` |
| `config` | Non-secret settings: a literal, or `{"env": "NAME"}` |
| `credentials` | Secret settings, always `{"env": "NAME"}`. A credential in `config` doesn't compile |

Actions use it with a `call` step. The compiler checks the method and its inputs against the package:

```json iwc:step
{ "operation": "call", "integration": "mail.integration.iwc", "method": "send", "input": { "to": "=user.email", "subject": "Your receipt", "text": "=concat('Order ', order.id, ' is confirmed.')" }, "as": "sent" }
```

Changing provider (Resend → Postmark, Stripe → Razorpay) changes only the `.integration.iwc` file (`iwc config set mail.provider postmark`, below). A provider's failure becomes a clean error for the client (its own words go to the server log, with credentials redacted). `iwc integrations` lists what is installed, `iwc integrations verify` re-tests the connections, `iwc integrations remove <name> [--purge]` uninstalls one.

### The packages

| Package | Providers | Methods |
| --- | --- | --- |
| `@iwc/mail` | Resend, SendGrid, Amazon SES, Mailgun, Postmark, Brevo, SMTP | `send`. Also delivers `notify` steps, password resets and email verification |
| `@iwc/payments` | Stripe, Razorpay, PayPal, Cashfree | `createPayment` (hosted checkout or `clientSecret` for the Stripe Payment Element widget; Stripe `destinationAccount`/`applicationFee`), `getPayment`, `capture`, `refund`, `verifyWebhook`, `createCustomer`, `createSubscription`, `getSubscription`, `cancelSubscription`, `listPayments`, `createConnectedAccount`, `getConnectedAccount`, `transfer` |
| `@iwc/storage` | Amazon S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, Wasabi, Google Cloud Storage, MinIO | `presignUpload`, `presignDownload`, `put`, `get`, `delete`, `head`; also backs `storage.upload` (below) |
| `@iwc/ai` | Anthropic (Claude), OpenAI, Google Gemini, any OpenAI-compatible server | `generate`: streaming, tool calling, JSON-Schema output, token usage |
| `@iwc/oauth` | Google, Microsoft, Apple, GitHub, GitLab, Discord, Facebook, LinkedIn, any OpenID Connect | `authorize`, `exchange`; used by [social sign-in](authentication.md#social-sign-in) |
| `@iwc/sms` | Twilio, Vonage, Plivo | `send` |
| `@iwc/whatsapp` | Meta Cloud API, Twilio | `sendText`, `sendTemplate`, `verifyWebhook` |
| `@iwc/push` | Firebase Cloud Messaging, Apple Push Notification service, OneSignal, Web Push (`webpush`: installed web apps, see [push](offline-and-pwa.md#the-installable-web-app)) | `send` (reports dead device tokens). Most apps use the built-in [`push` step](push-notifications.md) instead of calling it |
| `@iwc/search` | Algolia, Meilisearch, Typesense | `index`, `search`, `remove` |
| `@iwc/maps` | Google Maps Platform, Mapbox, OpenStreetMap (Nominatim + OSRM) | `geocode`, `reverseGeocode`, `route`, `autocomplete` |
| `@iwc/shipping` | Shiprocket, Delhivery, Shippo, EasyPost | `rates`, `createShipment`, `getLabel`, `track`, `cancel`, `schedulePickup`, `createReturn`, `verifyWebhook`; one set of [tracking statuses](#shipping) for every carrier |
| `@iwc/captcha` | Cloudflare Turnstile, hCaptcha, Google reCAPTCHA (v2, v3 scores) | `verify` (403 when the token isn't genuine) |
| `@iwc/analytics` | PostHog, Google Analytics 4, Segment, Mixpanel | `track`, `identify`, sent from the server |
| `@iwc/realtime` | Pusher Channels, Ably | `publish`, `authorize` (private/presence channels) |
| `@iwc/video` | Mux, Cloudflare Stream | `createUpload`, `getAsset`, `deleteAsset` |

Shortcuts such as `@iwc/stripe`, `@iwc/razorpay`, `@iwc/cashfree`, `@iwc/resend`, `@iwc/twilio`, `@iwc/s3`, `@iwc/shiprocket`, `@iwc/google-auth`, `@iwc/apple-auth`, `@iwc/auth0` (OpenID Connect), `@iwc/firebase` (push), `@iwc/socket` (realtime), `@iwc/turnstile`, `@iwc/posthog` and `@iwc/openai` install the package with that provider chosen.

### What each provider offers

Providers don't all do everything: Cashfree has no subscriptions, Shippo can't book a pickup. Methods only some providers offer are listed under **Capabilities** by `iwc packages <package>`:

```text
Capabilities  (✓ offered · – not offered: calling it is a compile error)
                         stripe      razorpay    paypal      cashfree
  createSubscription     ✓           ✓           ✓           –
  transfer               ✓           ✓           ✓           –
```

Calling a method the chosen provider lacks doesn't compile, so switching provider tells you at once what your app relies on.

### Changing settings: `iwc config`

Settings change without editing JSON, and work in scripts and CI:

```bash
iwc config                                # every integration, its provider and settings (secrets shown as set/missing)
iwc config set mail.provider postmark     # switch provider: shared settings kept, actions recompiled
iwc config set mail.from "Shop <hi@shop.com>"
iwc config set mail.server_token          # a credential: hidden prompt, stored encrypted in the vault
printf %s "$TOKEN" | iwc config set mail.server_token   # the same, non-interactively
iwc config get mail.from
iwc config unset mail.from
iwc config test mail                      # a live connection test
iwc integrations list                     # installed integrations and whether their credentials are present
iwc integrations verify                   # test them all
```

A credential given as a command-line argument is refused (it would land in shell history), a plain setting that looks like a credential is refused too, and no command prints a secret: list and get show `set (NAME, re_••••45)` at most. Keys may be written `serverToken` or `server_token`.

### Shipping

`@iwc/shipping` speaks grams, centimetres, minor units and one address shape (`{name, phone, email, line1, line2, city, state, postalCode, country}`) for every provider, and every `track` result and webhook carries one of the same statuses: `created`, `pickup_scheduled`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, `cancelled`, `returned`, `failed`, `unknown` (the carrier's own words stay in `statusText`). Ids a provider returns are opaque: store them and pass them back. Blue Dart, DTDC and other carriers without a self-serve API are reached through Shiprocket, Shippo or EasyPost.

```json iwc:step
{ "operation": "call", "integration": "shipping.integration.iwc", "method": "createShipment", "input": { "reference": "=order.id", "from": { "name": "Primary" }, "to": "=order.address", "items": "=order.lines", "weightGrams": "=order.weightGrams", "cod": "=order.payment == 'cod'" }, "as": "shipment" }
```

Shiprocket's token (exchanged from the API user's password) is cached and renewed by IWC; Delhivery and Shiprocket webhooks are checked against a shared token, EasyPost's against its HMAC signature, Shippo's against a token in the webhook URL.

**How they were verified.** Each provider is tested against a fake of its API that checks the exact request (paths, auth headers, bodies, signatures); request signing is checked against the providers' published examples (AWS Signature V4, Pusher channel auth); SMTP runs a real SMTP conversation. They have not all been exercised against live accounts: run `iwc integrations verify` with your own credentials before relying on one.

### Optional integrations

A product that supports several providers (Stripe *or* Razorpay *or* PayPal) shouldn't need all of them configured to start. Mark each one `"optional": true`:

```json iwc:integration
{
  "package": "@iwc/payments",
  "provider": "razorpay",
  "optional": true,
  "config": { "keyId": { "env": "RAZORPAY_KEY_ID" } },
  "credentials": { "keySecret": { "env": "RAZORPAY_KEY_SECRET" }, "webhookSecret": { "env": "RAZORPAY_WEBHOOK_SECRET" } }
}
```

- **Production** starts without it when its credentials are missing; a `call` to it answers `503 integration_not_configured`.
- **Development** uses the simulated provider until the credentials are set, so every flow works without accounts.
- Actions read **`integrations.<name>`**: `true` when a call can work now. Offer only the payment methods that are set up: `"visible": "=integrations.razorpay"` on data an action returns, or `require` before calling.

The simulated payment provider's `checkoutUrl` is a hosted page on your own origin (`/_iwc/simpay/<id>`) showing the amount with **Pay** and **Decline**: paying returns to `successUrl`, declining to `cancelUrl` (both with `?payment=<id>`), and `getPayment` then reports `succeeded` or `failed`, so failed-payment handling can be tested end to end. A payment whose page was never opened reports `succeeded`, as before.

### Taking a payment

1. An action creates the order (status `pending`), then `createPayment` with `amount` in minor units (paise, cents), `currency`, `reference` (the order id) and a `successUrl`; it returns `checkoutUrl`, where the form sends the customer (`success.redirect`). The provider's checkout domain is allowed automatically.
2. **Never mark an order paid because the customer came back.** On the success page's action, or in a webhook, call `getPayment` (or `verifyWebhook`) and fulfil only when `status` is `succeeded` and `amount`/`reference` match the order. `iwc security` flags payments that are never confirmed.
3. Webhooks: an API with `"request": {"rawBody": true, "headers": {"stripe-signature": "string"}}` and `"security": {"csrf": false}`, whose action starts with `verifyWebhook`.

Some methods are offered by some providers only (PayPal has no connected accounts or customers; Razorpay and PayPal have no destination charges). Calling one the configured provider lacks is a compile error naming the providers that have it.

### Subscriptions, reconciliation and marketplaces

- **Subscriptions**: `createSubscription` with the provider's `plan` id, your `reference` and a `successUrl` returns a hosted `checkoutUrl`. Grant access from `getSubscription` (`status`: `pending`, `trialing`, `active`, `past_due`, `paused`, `canceled`; `currentPeriodEnd`), refreshed by the provider's subscription webhooks through `verifyWebhook`. `cancelSubscription` takes `atPeriodEnd`.
- **Reconciliation**: a scheduled job calls `listPayments` (`from`, `to`, `cursor`) and compares `id`/`reference`/`amount`/`fee`/`net` with your orders.
- **Marketplaces**: `createConnectedAccount` (Stripe returns an `onboardingUrl`; Razorpay Route takes `details`), `getConnectedAccount` before paying out, then `transfer` (`account`, `amount`, `currency`, `reference`, optionally the `payment` it comes from). PayPal's `transfer` is a payout to a PayPal email.

### AI: streaming, tools and structured output

```json iwc:action
{
  "name": "Ask",
  "timeout": "2m",
  "input": { "question": { "type": "string", "required": true } },
  "steps": [
    { "operation": "call", "integration": "assistant.integration.iwc", "method": "generate", "stream": true, "as": "reply",
      "input": { "system": "You help customers with their orders.", "prompt": "=input.question",
                 "tools": [{ "name": "order_status", "action": "order-status.action.iwc" }] } },
    { "operation": "return", "value": { "answer": "=reply.text" } }
  ]
}
```

- **Streaming**: an api with `"stream": true` answers with Server-Sent Events: `delta` (text), `tool`, then `done` (the action's result) or `error`. Steps after the stream (saving the answer, metering `reply.usage`) run as usual. A form shows the text as it arrives with `"submit": {"api": "ask.api.iwc", "streamInto": "answer"}`. Streaming actions can't be `transaction`s (they would hold the database for the whole reply).
- **Tools**: `{name, description, input: JSON Schema}` tools come back as `toolCalls` for your steps to handle. A tool naming an `action` is run by IWC: the action's `input` becomes the tool's schema, it runs **as the signed-in user** (its auth, roles, scope guards and validation apply), and its result goes back to the model until it answers (`maxTurns`, default 6). `reply.steps` lists what ran.
- **Structured output**: `"schema": {JSON Schema}` makes the reply JSON; IWC checks it against the schema and returns it as `data`.
- The same input works with Claude, OpenAI, Gemini and OpenAI-compatible servers; the simulated provider streams too (`"use <tool>"` in a prompt makes it call that tool).

### Files in a bucket

Set `"storage": {"integration": "files.integration.iwc"}` in `app.iwc` and `storage.upload` writes to that bucket instead of the server's disk; the file's URL stays `/_iwc/files/<id>`, which redirects to a 5-minute presigned URL after the access check.

| Operation | |
| --- | --- |
| `storage.upload` (POST) | multipart upload through the server (to 64MB with a bucket); the type is sniffed from the bytes |
| `storage.presign` (POST `{name, contentType, size}`) | a presigned `PUT` straight to the bucket, for large files |
| `storage.complete` (POST `/:id`) | checks what arrived (exists, not larger than declared, sniffed type allowed) before the file can be used; anything else is deleted |
| `storage.download` (GET `/:id`) | the file, or `?as=url` for a signed URL as JSON |
| `storage.delete` (DELETE `/:id`) | the uploader, or callers of an api restricted to roles |

`"visibility": "private"` (app-wide or per api `upload`) limits reading to the uploader and `readRoles`; `"upload": {"accept": [...], "maxSize": "50MB"}` narrows one endpoint. A schema `file` field's `accept` and `maxSize` are enforced on write, and a generic api can't attach another user's upload.

## Reusing project files

Components, layouts and schemas are copied between projects (references are by file name, so they work wherever they land), started from a template (`iwc create my-store --template store`), or kept in a shared git repository. There is no registry for community packages yet.

`package.iwc` describes the project itself (name, version, deploy targets). See [app configuration](app-configuration.md#packageiwc).

## Deploying

One command deploys to shared hosting or to your own server:

```bash
iwc deploy prod
```

The first time, it asks where the site will run — **shared hosting with cPanel** or **your own server/VPS** — says where to find each thing it needs, and writes the target into `package.iwc` itself. After that, the same command just deploys. Any name works as a target (`prod`, `staging`, `client-a`), each set up separately.

### Shared hosting with cPanel: `iwc deploy`

Nothing to install on the hosting and no SSH: IWC uses cPanel's own API.

```text
IWC deploy  Setting up deploy target "prod" for shop.
  Where will the site run?
    1) Shared hosting with cPanel — most web hosting plans; no SSH needed
    2) My own server or VPS (SSH) — IWC installs the service, web server and HTTPS
  Choose [1]:
cPanel  Connect to your cPanel account. …
  cPanel address: what your browser shows when cPanel is open, e.g. https://example.com:2083
  cPanel username: in cPanel, right-hand column "General Information" → Current User
  API token: in cPanel open Security → Manage API Tokens → Create …
✓ connected to cPanel (home /home/acct)
Site  Where should the site go?
    1) https://example.com          folder public_html (main domain)
    2) A folder of one of these domains, e.g. https://example.com/test
    3) A new subdomain, e.g. https://test.example.com (recommended for a test site)
→ deploying 1.2.0 3f9c… to test.example.com
  • uploading the package (2 MB)
  • extracting it into test.example.com
✓ release 1.2.0 3f9c… is in place (database and settings.env kept)
✓ https://test.example.com answers 200 and the app's health check is ok
```

- **What a deploy does:** builds the [upload package](#shared-hosting-upload-a-zip), uploads it, extracts it over the site's folder, makes `iwc.cgi` executable, deletes the uploaded file, then loads the site and its health check. `data/` (database, uploads) and `settings.env` are never in the package, so updates keep them.
- **A folder already in use** (an old site in `public_html`): IWC lists what is there and asks first; its `.htaccess` is kept as `.htaccess.before-iwc`. A new subdomain is the safe choice for trying things out.
- **The login** — cPanel address and user in `~/.iwc/deploy/targets.json`, the API token encrypted in IWC's vault — stays on your computer, never in the project. Revoke the token in cPanel any time; the next deploy asks for a new one. `iwc server forget prod` removes it here.
- **Rollback:** every deploy's package is kept in `~/.iwc-releases/<site folder>/` in the hosting account — outside every web folder, so never downloadable — the last 5 per site. `iwc rollback prod` puts the previous release back; `iwc rollback prod <id or build hash>` a given one (also forward again). Only the code changes: the database and `settings.env` stay as they are, and fields a newer release added stay in the database, unused by older code.
- **Day to day:** `iwc server status prod` (live release, stored releases, live check), `iwc logs prod` (the app's log, `data/logs/app.log`). Secrets: edit `settings.env` in the site's folder with cPanel's File Manager.
- **Without a terminal (CI):** `IWC_CPANEL_TOKEN=… iwc deploy prod --host example.com --user acct` with `folder` and `site` in the target.
- Servers with an ARM CPU (rare on shared hosting) need `"arch": "arm64"`.

### Your own server: `iwc deploy`

Any Linux server (a VPS, a cloud instance) with SSH and systemd:

```bash
iwc deploy prod
```

Choose "My own server or VPS" in the wizard; it then asks only for what it doesn't know:

```text
  Domain: shop.example.com
IWC deploy  No server is set up for shop "prod" yet. Enter keeps the [default].
  Server address (IP or hostname): 203.0.113.10
  SSH user (a user with sudo rights; root also works): deploy
  SSH port [22]:
→ connecting to deploy@203.0.113.10

  203.0.113.10 is a server this machine has not connected to before. It presents:
    ssh-ed25519            SHA256:k3Yd…
  Compare with the fingerprint your hosting provider shows, or run this on the server's console:
    ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
  Do they match? Trust this server (y/N): y

  Key login to deploy@203.0.113.10 isn't set up yet.
    1) Install a key using the server's password, once (recommended)
  …
✓ connected to deploy@203.0.113.10 (Ubuntu 24.04.1 LTS, amd64)
→ setting up the server (first deploy)
→ building shop
→ uploading release 1.2.0 3f9c… (412 KB)
✓ release r20261109… is live
✓ https://shop.example.com answers 200, certificate from Let's Encrypt valid until 2027-02-07
```

Every later `iwc deploy prod` checks the connection and uploads a release — seconds, no questions.

**What the first deploy does on the server** (and again only when IWC or the target's settings change; `iwc server setup prod` forces it):

| | |
| --- | --- |
| Runtime | The IWC runtime for the server's CPU in `<dir>/bin/iwc` |
| Service | A systemd service `iwc-<package>-<target>`: starts at boot, restarts if it stops, runs as an unprivileged `iwc` user that can write only its directory, listens on 127.0.0.1 |
| Proxy and HTTPS | The web server already on ports 80/443 is shared, never replaced: **nginx** gets one more site file (`iwc-<package>-<target>.conf`) and a Let's Encrypt certificate through certbot; **Caddy** gets one file in `/etc/caddy/iwc/`. On a server with neither, Caddy is installed. Certificates renew automatically and HTTP redirects to HTTPS. Every configuration is checked (`nginx -t`, `caddy validate`) before it is loaded; a rejected one leaves the previous in place and nothing reloaded. Any other server on 80/443 stops the setup with an explanation. Without a `domain`, the site is plain HTTP on the server's address |
| Firewall | Opens 80 and 443 when ufw or firewalld is active. A cloud provider's firewall (security group) is yours to open |
| Settings | `<dir>/host.env` (the release agent's token, generated on the server and never sent anywhere) and `<dir>/settings.env` for the app's secrets |

**Updating** is atomic: the new release is unpacked beside the live one, its migrations run, and requests switch over only if they succeed; a failing release is rejected and the previous one keeps serving. `iwc rollback prod` switches back. Setup itself restarts the service, briefly, only when it changes something.

**Connection and security.**
- Host keys are checked strictly. A new server's fingerprint is shown for you to compare before anything is sent; a changed key stops the deploy (it means a reinstalled server — or an intercepted connection). Confirmed keys go to `~/.iwc/ssh/known_hosts`; keys you already trust in `~/.ssh/known_hosts` are honoured. For CI, pass `--fingerprint SHA256:…`.
- Logging in: whatever already works with `ssh` (keys, agent, `~/.ssh/config` aliases) is used as is. Otherwise IWC installs a key with one password login typed into ssh's own prompt — your key if it has no passphrase or is in the agent, else one it generates in `~/.iwc/ssh/id_ed25519` (mode 0600). Private keys are never printed, copied or uploaded. Servers that allow only keys: choose "show the public key" and add it through your provider's console.
- The connection (host, user, port, key path) is saved per developer in `~/.iwc/deploy/targets.json` (0600), separately for every project and target — never in the project, so nothing is committed. `~/.ssh/config` is never changed.
- Setting the server up needs root or passwordless sudo; deploying, logs and status don't (setup adds your user to the `iwc` group).
- The release agent has no public endpoint: deploy requests travel over SSH to `iwc host-call` on the server, which forwards them to 127.0.0.1.

**Day to day:**

```bash
iwc server status prod             # service, proxy, current release, the public URL from here
iwc logs prod                      # the app's log      (-f to follow)
iwc logs prod --system -f          # systemd and Caddy journal
iwc server env prod set STRIPE_KEY # a secret, asked without echo; restarts the app
iwc server env prod list           # names only
iwc rollback prod
iwc server list                    # saved connections; iwc server forget prod
```

Without a terminal (CI): `iwc deploy prod --host deploy@203.0.113.10 --key ci_key --fingerprint SHA256:…`. More targets on one server need distinct `port`s.

### Shared hosting: upload a zip

For hosting with only a control panel and a File Manager (cPanel and similar): no SSH, nothing to install.

```bash
iwc build --zip                 # → new.zip, beside the project
iwc build --zip --folder shop   # the folder (and so the URL path) is "shop"
```

1. In the File Manager, open `public_html`, upload the zip and **Extract** it. It holds one folder.
2. Open `https://yourdomain.com/<folder>/`. The database is created on the first visit.

That is the whole app — pages, sign-in, admin screens, APIs, uploads and jobs — not a static copy. The zip carries:

| Path | What it is |
| --- | --- |
| `iwc.cgi` | The IWC runtime built for Linux. The web server starts it for each request (CGI) |
| `.htaccess` | Sends every request to `iwc.cgi`; files under `assets/` are sent directly |
| `app/` | Your build (`manifest.json`, `assets/`, `migrations/`). Not served |
| `data/` | Created on the first visit: the SQLite database, uploads, `logs/app.log`. Not served. **Back it up** |
| `settings.example.env` | Copy to `settings.env` for secrets, `DATABASE_URL`, … (`KEY=value` lines) |
| `README.txt` | These steps, for whoever uploads it |

- **Address.** The app reads its folder from each request, so renaming the folder changes the URL. For the domain root, move the folder's contents (with the hidden `.htaccess`) into `public_html`; for a subdomain, point its document root at the folder.
- **Updating.** Extract the new zip over the old folder. `data/` and `settings.env` are not in the zip, so they are kept; the first visit after an update applies new tables and fields.
- **Database.** SQLite in `data/` by default. An app whose `database.url` env is required takes `NAME=sqlite` in `settings.env` for that file, or a `postgres://` URL. MySQL isn't supported.
- **Background jobs** run for a couple of seconds after each response. For scheduled jobs on a quiet site, add a cron job in the control panel: `/home/<user>/public_html/<folder>/iwc.cgi run-jobs`.
- **What differs from `iwc start`.** Each request is its own process (~50–100 ms), so live data is refreshed every 30 s instead of pushed; rate limits are kept in the database. HSTS isn't sent, since the app doesn't own the whole domain.
- **The host must run CGI programs** — standard on cPanel, LiteSpeed and DirectAdmin hosting. `iwc.cgi` and the folders must be `755` (not `777`). If a page says "This site could not start", the reason is in `data/logs/app.log`.

`--arch arm64` builds for ARM hosts. The zip carries the Linux runtime: on Linux, `iwc` uses its own binary for the same CPU; on macOS and Windows, install the matching `@iwc/linux-runtime` package once (`npm install -g @iwc/linux-runtime@<version>`, with the version `iwc --version` prints). `IWC_LINUX_RUNTIME` points the build at another copy. A runtime from a different IWC release than the `iwc` you run is never shipped silently: the build stops and names the version to install.

### Any server

```bash
iwc build                      # dist/
scp -r dist server:/srv/shop/
ssh server 'cd /srv/shop && SHOP_DATABASE_URL=postgres://… iwc start dist --port 8080'
```

Put a TLS-terminating proxy (Caddy, nginx) in front, and start with `--trust-proxy loopback` (or the proxy's address) so rate limits and logs see each visitor's address instead of the proxy's. `iwc start` sets Secure cookies and HSTS by default. Health check: `GET /_iwc/health`.

### A release agent you run yourself

`iwc deploy` sets this up for you over SSH. To run it yourself instead (behind your own proxy and TLS), on the server:

```bash
IWC_DEPLOY_TOKEN=<32+ random characters> iwc host --dir /srv/iwc-host --port 8080
```

Locally, with `"deploy": {"prod": {"url": "https://deploy.example.com", "tokenEnv": "IWC_DEPLOY_TOKEN"}}` in `package.iwc`:

```bash
iwc push prod          # build, upload; activated only if migrations succeed
iwc logs prod          # recent structured logs
iwc rollback prod      # reactivate the previous release
iwc pull prod copy/    # download the live source and dist (never secrets)
```

`.env` files are never uploaded. Set secrets in the server's environment.
