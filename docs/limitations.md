# Limitations

What IWC does **not** do today, found while building the store, the cookbook and a class-booking app written from scratch. Each entry says what to do instead. Nothing here is faked anywhere in the examples.

## Capability map

Where IWC stands against the kinds of applications it is meant for. **Built in** means declared in `.iwc` files with no code; **through services** means an `http` service plus actions (no IWC-specific code, but you wire the provider's API yourself); **not yet** means there is no way to do it in IWC today.

| Area | Status | What exists |
| --- | --- | --- |
| Pages, components, layouts, routing | Built in | Server-rendered screens, components with props and slots, layouts with persistent slots, SPA navigation, guards, 404 |
| Forms and validation | Built in | Server-authoritative validation shown per field; uploads |
| Database, relations, migrations | Built in | SQLite / PostgreSQL, relations with `onDelete`, indexes, unique constraints, additive migrations, seeds |
| Business logic and transactions | Built in | Actions (15 step types, expressions, atomic increments, `expect`), one transaction per action |
| Record lifecycles | Built in | Workflows (state machines) with role- and row-scoped transitions |
| Background work | Built in | Durable jobs with retries, schedules (`every`), events with handlers |
| Auth, roles, ownership | Built in | Email + password, sessions, bearer tokens, role inheritance, owner rules, protected route areas |
| Multi-tenant SaaS | Built in | `app.tenancy` + `"tenant": true` scopes every read and write to the user's tenant |
| Permissions and record scopes | Built in | Declared permissions, roles and grants from the database, membership scopes (a manager sees their stores' rows), API/action guards. See [access control](access-control.md) |
| Several apps, one backend | Built in | [Multi-app projects](multi-app.md): per-app screens, URLs, hosts, cookies, builds; shared schemas and logic |
| Retries and abuse | Built in | Idempotency keys on writes, rate limits per IP, user or request value, optionally shared through the database |
| Security defaults | Built in | CSRF, strict CSP with nonces, rate limits, CORS allow-list, SSRF-guarded outbound calls, sensitive fields never leave the server, field encryption at rest, secrets refused in files and builds and redacted from logs, `iwc security` audit. See [security](security.md) |
| Credentials | Built in | Encrypted development vault and `iwc secrets`; production reads the environment |
| Live updates | Partial | Server push (SSE) re-renders `live` data blocks and announces broadcast events by name. `@iwc/realtime` publishes to Pusher/Ably channels and authorises private ones; a [widget](widgets.md) can load their browser SDKs to subscribe |
| Client state | Partial | Stores with fixed mutations (`set push upsert remove increment clear`) and `derived` sums/counts; persisted locally |
| Payments, refunds | Built in | [`@iwc/payments`](integrations-and-packages.md#taking-a-payment): Stripe, Razorpay, PayPal, Cashfree hosted checkout, status, capture, refunds, verified webhooks |
| Subscriptions, payouts, marketplace splits | Built in | `@iwc/payments` subscriptions, `listPayments` for reconciliation, connected accounts and transfers (Stripe Connect, Razorpay Route, PayPal payouts), Stripe destination charges |
| Webhooks | Built in | `request.rawBody` + declared headers, and `verifyHmacSecret` with secrets declared in `app.iwc` (hex/base64 HMAC-SHA256, constant-time). See [verifying signed webhooks](actions-and-workflows.md#verifying-signed-webhooks) |
| Third-party APIs | Through services | Declarative `http` services with auth headers, per-method headers (API versions), timeouts, retries with backoff, cached reads with request collapsing, simulated providers for development. No GraphQL helper (POST a query body), no pagination helper for external APIs |
| Email | Built in | [`@iwc/mail`](integrations-and-packages.md#the-packages): Resend, SendGrid, SES, Mailgun, Postmark, Brevo, SMTP; also delivers `notify` |
| SMS, WhatsApp, push | Built in | `@iwc/sms` (Twilio, Vonage, Plivo), `@iwc/whatsapp` (Meta, Twilio), [push notifications](push-notifications.md) to browsers, Android and iOS (devices kept by IWC, `push` step, `iwc push test`); `@iwc/push` (FCM, APNs, OneSignal, Web Push) |
| AI models | Built in | `@iwc/ai` (Claude, OpenAI, Gemini, OpenAI-compatible): streaming to the browser, tool calling (tools can be IWC actions, run as the user), JSON-Schema output, token usage |
| Search, maps, video | Built in | `@iwc/search` (Algolia, Meilisearch, Typesense), `@iwc/maps` (Google, Mapbox, OpenStreetMap; autocomplete), `@iwc/video` (Mux, Cloudflare Stream) |
| Shipping, bot protection, analytics | Built in | `@iwc/shipping` (Shiprocket, Delhivery, Shippo, EasyPost; normalised tracking), `@iwc/captcha` (Turnstile, hCaptcha, reCAPTCHA; server check only, the page's widget is yours), `@iwc/analytics` (PostHog, GA4, Segment, Mixpanel; server-side) |
| Not yet as packages | Not yet | Adyen, PayU; Blue Dart/DTDC direct (no self-serve API: use an aggregator); Cloudinary, Bunny; calendars, accounting, social media APIs; PDF generation; video calling |
| Phone sign-in (Firebase), refresh-token sessions, device list/revoke | Yes | [authentication](authentication.md#phone-sign-in-firebase) |
| Password reset, email verification | Built in | [authentication](authentication.md#password-reset-and-email-verification) |
| OAuth / social sign-in, multi-factor | Built in | [Google, Microsoft, Apple, GitHub, GitLab, Discord, Facebook, LinkedIn, any OIDC](authentication.md#social-sign-in) with account linking; [TOTP, email and SMS codes, recovery codes](authentication.md#two-factor-sign-in) |
| Custom client-side JavaScript | Built in | [Widgets](widgets.md): your own code and third-party SDKs (SRI-pinned) with a CSP widened only on the pages that use them, or sandboxed in an opaque-origin frame; bundled rich-text editor, map, Stripe Payment Element, HLS video player |
| Installable web app (PWA), offline data and sync | Built in | [`iwc enable pwa` / `iwc enable offline`](offline-and-pwa.md): manifest, service worker, push; stored screens, queued writes sent exactly once, conflicts, sync status on the web, Android and iOS |
| WebSockets | Built in | `/_iwc/ws` carries the live change events (web and native apps; SSE remains the fallback). Server → client only; your own messages over it are not yet supported |
| WebRTC, audio/video calling | Not yet | |
| Firebase and other realtime backends | Through services + widgets | REST APIs from actions; browser SDKs in a widget |
| File storage | Built in | Local disk or any S3-compatible bucket (S3, R2, MinIO…) behind the same `storage.*` APIs: uploads, presigned direct uploads checked on completion, signed downloads, delete, private files, per-endpoint type/size rules |
| Caching | Built in | Per-visitor data and API caches cleared by writes |
| Reports and summaries | Built in | [`aggregate`](actions-and-workflows.md#summaries-aggregate) in actions and [data sources](data-binding.md#summaries-aggregate): grouped sums, counts, averages, minimums and maximums computed by the database, date buckets in the app's time zone, under the same access rules; filter bars in the URL |
| Spreadsheets | Built in | [CSV responses](api-development.md#spreadsheets-csv-out-and-in) (formula-injection safe) and `parseCsv()` for imports; `createMany` for bulk inserts |
| Backup and restore | Built in | [`iwc backup` / `iwc restore`](cli-commands.md#backup-and-restore): one portable archive (data and uploads), consistent snapshot on PostgreSQL, restore in one transaction, SQLite ⇄ PostgreSQL |
| API documentation | Built in | [OpenAPI 3.1](api-development.md#api-documentation) (JSON and YAML) derived from the definitions, an interactive explorer with Try it out at `/_iwc/api-docs`, `iwc make --api docs` for files; versioned endpoints (`/api/v2/...`) |
| Logs, diagnostics | Built in | Structured logs, request log, audit of actions and transitions, `/_iwc/health`, `iwc logs`. No metrics or tracing export |
| Deployment | Built in | [`iwc deploy`](integrations-and-packages.md#deploying) to cPanel shared hosting (through cPanel's API, with rollback) or to your own Linux server over SSH (setup wizard, systemd service, nginx or Caddy with automatic HTTPS, atomic releases, rollback, logs, status), an HTTPS release host, and a zip for shared hosting. Servers need systemd; IWC installs Caddy (or certbot for nginx) on Debian, Ubuntu, Fedora and RHEL-like systems; other web servers on 80/443 need `"proxy": "none"`. One server per target (no multi-server rollout or load balancing) |
| Extending the CLI | Built in | [Plugins](cli-commands.md#plugins): `iwc-<name>` executables; `x-<vendor>` keys for other tools' data |
| Internationalisation | Not yet | One language per app (`head.lang`); no message catalogues or locale formats |
| SEO and sharing | Built in | [Server-rendered metadata](seo.md): dynamic titles, canonical, Open Graph/Twitter, JSON-LD, `robots.txt`, `sitemap.xml`, 404 for missing records |
| Performance | Built in | [Per-route runtime modules and size budgets](performance.md); a benchmark against Next.js and Angular (`bench/REPORT.md` in the IWC repository). No critical-CSS inlining or image pipeline yet |

## Pages and data

| Missing | Effect | Instead |
| --- | --- | --- |
| **Expressions in the browser** | [Expressions](expressions.md) run on the server. Elements repeated from client state (`STATE.` sources) and values that change in the browser can't use them | Use `bind` for client state; client-side expressions are the next roadmap phase |
| **Nested includes** | An [include](expressions.md#related-records-include) can't include more (a review's author's company) | A second page-data source filtered by the first, or store the value on the record |
| **Large has-many includes** | One include loads at most 5,000 rows per data block (100 per record by default) | Paginate the parent, or list the children on their own page |
| **Client-side form validation** | Errors appear after the server answers (quickly, but after a round trip) | Server validation is authoritative anyway |
| **Data sources inside STATE templates** | A cart line can't look up live stock | Read live data on the server pages (cart totals are re-checked at checkout) |
| **Localised dates** | `app.iwc` `timeZone` and `localTime`/`localDate`/`weekday` give local times in expressions, but the page `format`s (`date-long`, `time`…) still show UTC with English month names | Format with `localDate`/`localTime` in an expression |

## Layout and styling

| Missing | Notes |
| --- | --- |
| Layout `structure.side` and `sidebar` `side` | Accepted, but have no effect. Order slots or use `template` |
| Min-width breakpoints | `responsive` is desktop-first (max-width). Mobile-first needs your own CSS media queries |
| A CSS build step | No Sass or Tailwind compiler. Ship compiled CSS in `styles/` |
| Critical-CSS extraction | A stylesheet up to `performance.inlineStyles` (8KB gzipped by default) is written into the first page a visitor opens. A larger one is linked whole: one extra round trip before first paint (about 600 ms on a slow mobile network, see `bench/REPORT.md`). IWC doesn't split out the above-the-fold rules |
| Inlining's server cost | Gzipping the inlined stylesheet with every first-visit page roughly halves that response's throughput (`bench/REPORT.md`); navigations don't pay it. `"inlineStyles": "0B"` links instead |
| Image optimisation | No resizing, modern formats or `srcset`. Images load lazily unless marked `"loading": "eager"` or `"priority"` |
| Confirmation messages | A state change from a button ("Added") and an API button ("Done") always show IWC's status message; an app can't change the words or turn it off per button |

## Back end

| Missing | Notes |
| --- | --- |
| **Email without `@iwc/mail`** | `notify` steps are logged in development and fail (status `failed` in `_iwc_outbox`) in production until a mail integration is installed |
| Destructive migrations | Type changes, renames and drops aren't automatic (by design) |
| Database `CHECK` constraints | Field rules (`min`, `max`, `enum`) are enforced by IWC on every write, not by the database, so raw SQL can bypass them |
| Foreign keys closing a cycle on SQLite | Two tables that point at each other get the cycle-closing foreign key on PostgreSQL only; SQLite relies on IWC's relation checks for that field |
| A community package registry | The `@iwc/*` packages are compiled into the CLI; third parties can't publish packages yet (CLI [plugins](cli-commands.md#plugins) and `.service.iwc` files are the extension points) |
| Live-verified providers | Every `@iwc/*` provider (OAuth, billing and AI streaming included) is tested against a fake of its API and published signing examples, not against live accounts; `iwc integrations verify` checks yours |
| A QR code for authenticator setup | `auth.mfaSetup` returns the `otpauth://` URL; drawing it as a QR code is up to the page (a widget can) |
| MySQL | Databases are SQLite or PostgreSQL. On shared hosting the zip uses SQLite in `data/` |
| Screens under reserved prefixes | A route starting `/api/`, `/assets/` or `/_iwc/` is silently unreachable (no compile warning) |

## Development experience

| Missing | Notes |
| --- | --- |
| State-preserving hot reload for `.iwc` edits | `.css` edits swap in place; other edits reload the page (scroll position and persisted client state survive; unsaved form input does not) |
| A language server | Autocompletion and validation come from the JSON Schemas. Cross-file checks (references, bindings) run in `iwc check` / `iwc dev` |

## Native apps

Android (Jetpack Compose) and iOS (SwiftUI) apps come in two kinds, and neither ever draws a web view: [server-driven apps](native-apps.md#server-driven-apps) (`server` set) draw what the IWC server renders, with forms, records, sign-in, secure token storage, links, lock, share, photos, camera, location and push; apps built without a server compile a fixed set of screens into the app ([what they render](native-apps.md#what-native-targets-support)).

| Missing | Notes |
| --- | --- |
| Cashfree's in-app sheet on iOS | Cashfree publishes no versioned Swift package; on iOS its pay buttons use hosted checkout (Android has the sheet; Stripe and Razorpay have it on both) |
| Share target on iOS | iOS lists apps in the share sheet only through a Share Extension, which IWC doesn't generate yet (Android and installed web apps are share targets) |
| Social sign-in with a second factor in apps | An account that needs MFA after a social sign-in is asked to sign in with its password in the app |
| Background location on iOS when closed | Tracking continues in the background while the app is running (the blue indicator); iOS doesn't relaunch an app the person swiped away for it |
| Built-without-server apps | Forms, records, sign-in and interactive widgets need `server` |
| An iOS app icon from SVG | iOS needs a 1024 px PNG `icon` |
| Native hot reload | `iwc dev --platform …` rebuilds and relaunches on save (seconds), state is not kept |
| Building iOS off macOS | Apple's toolchain runs only on macOS; use a Mac or a macOS CI runner |
