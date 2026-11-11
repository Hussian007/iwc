# App configuration: app.iwc and package.iwc

## app.iwc

**Purpose:** the application itself: its name, look (theme), global stylesheets, `<head>` defaults, authentication, database, uploads, multi-tenancy and the 404 screen.
**When:** exactly one per project, at the root. `iwc create` writes it. A project without it does not compile.

### Complete example

```json iwc:app
{
  "name": "Lumen & Oak",
  "iwc": 1,
  "description": "Handmade lighting and furniture.",
  "theme": {
    "tokens": {
      "color-primary": "#1f3a2e",
      "color-on-primary": "#fdfbf7",
      "color-text": "#1b1b18",
      "color-background": "#fdfbf7",
      "color-surface": "#f3efe6",
      "color-border": "#e4ddcf",
      "color-link": "#1f3a2e",
      "radius": "14px",
      "font-body": "'DM Sans', system-ui, sans-serif",
      "font-heading": "'Fraunces', Georgia, serif",
      "section-pad": "96px"
    },
    "dark": {
      "color-text": "#f3efe6",
      "color-background": "#141412",
      "color-link": "#9fd3b4"
    },
    "fonts": [
      { "family": "DM Sans", "google": true, "weights": [400, 500, 700] },
      { "family": "Brand Serif", "source": "/assets/fonts/brand.woff2", "weight": "700" }
    ]
  },
  "breakpoints": { "mobile": 640, "tablet": 1024 },
  "styles": ["styles/theme.css", "styles/main.css"],
  "head": { "title": "%s · Lumen & Oak", "description": "Made by hand.", "favicon": "/assets/favicon.svg", "lang": "en" },
  "auth": {
    "user": "user.schema.iwc",
    "identity": "email",
    "password": "password",
    "role": "role",
    "defaultRole": "customer",
    "loginPage": "/login",
    "register": true,
    "session": { "ttl": "7d" }
  },
  "database": { "url": { "env": "STORE_DATABASE_URL" } },
  "storage": { "maxUploadSize": "2MB", "allow": ["image/png", "image/jpeg", "image/webp"] },
  "notFound": "not-found.ui.iwc"
}
```

### Properties

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string, 1–80 chars | **yes** | The app's name (OpenAPI title, default page title) |
| `iwc` | integer, `1` | no | Project format version |
| `description` | string | no | Free text |
| `theme` | object | no | Design tokens, dark-mode overrides, fonts (below) |
| `breakpoints` | `{name: px}` | no | Named max-widths for `responsive` styles. Defaults `{"mobile": 640, "tablet": 1024}`; yours are merged in |
| `styles` | array of paths | no | Global stylesheets, loaded in this order before any `styleSource` |
| `head` | object | no | `title` (template; `%s` is the page title), `description`, `favicon`, `lang` (default `en`) |
| `auth` | object | no | Turns on accounts. See [authentication](authentication.md). `user` is required inside it |
| `database` | object | no | `url: {"env": "NAME"}`: the variable holding the production database URL |
| `storage` | object | no | Uploads: `maxUploadSize` (`512KB`, `5MB`), `allow` (MIME types, `image/*` allowed) |
| `tenancy` | object | no | `field`: the user field naming the tenant (e.g. `organizationId`). Schemas with `"tenant": true` are scoped to it |
| `notFound` | ui file | no | The screen rendered (with status 404) for unknown URLs |
| `navigation` | object | no | `mode`: `spa` (default; internal links swap the screen in place) or `document` (every link loads a new page). `prefetch`: fetch a screen when the pointer rests on its link (default `true`). See [routing → SPA navigation](routing-and-navigation.md#spa-navigation) |
| `seo` | object | no | `siteUrl`, `siteName`, `image`, `twitter`, `index`, `sitemap`, `robots`, `structuredData`. See [SEO and sharing](seo.md) |
| `performance` | object | no | Size budgets per route (`budgets`, `routes`) and `enforce` (`warn`/`error`). See [performance and budgets](performance.md) |
| `timeZone` | string | no | IANA zone (`Asia/Kolkata`) local times are shown in; stored times stay UTC (default UTC) |
| `secrets` | array | no | Environment variables actions may use as signing keys (`verifyHmacSecret`); production refuses to start while one is unset |
| `push` | object | no | Push notifications to browsers and the native apps; IWC keeps the devices. `prompt` (the card that asks visitors: text, delay, visits, pages, or `"show": "off"`), `register` (`public`/`auth`) and per-platform senders (`web`, `android`, `ios`). Set up with `iwc push setup`. See [push notifications](push-notifications.md) |
| `apps` | object | no | Several applications served by one project: see [multi-app projects](multi-app.md) |
| `apiDocs` | object | no | The generated API documentation: `title`, `description`, `version`, `servers`, `tags` (descriptions), `contact`, `license`, and when it is served: `spec` (`always` by default) and `ui` (`development` by default). See [API documentation](api-development.md#api-documentation) |

### theme

- **`tokens`**: any names you like, emitted as CSS custom properties on `:root`. `"color-primary": "#1f3a2e"` becomes `var(--color-primary)`, usable in every stylesheet and every `style`. The built-in elements read these tokens:

  | Token | Used for |
  | --- | --- |
  | `color-primary`, `color-on-primary` | primary buttons, active tabs, charts |
  | `color-text`, `color-background` | the page |
  | `color-surface`, `color-border` | cards, inputs, tables, dropdowns |
  | `color-link` | links (default: the text colour) |
  | `color-danger` | field errors |
  | `color-rating` | review stars |
  | `radius` | buttons, cards, inputs |
  | `font-body`, `font-heading` | body text and `h1`–`h6` |
  | `carousel-gap` | space between carousel slides |

- **`dark`**: token overrides applied when the visitor's system is in dark mode (`prefers-color-scheme: dark`). Override at least the background and text, and any brand colour used as text on the background (a dark green link is unreadable on a near-black page).
- **`fonts`**: each is `{family, google, weights}` (loaded from Google Fonts) or `{family, source, weight, style}` (a file under `assets/`, emitted as `@font-face`). Refer to the family in a token, e.g. `"font-body": "'DM Sans', sans-serif"`.

### Common mistakes

| Error | Fix |
| --- | --- |
| `app.iwc is missing` | Run commands from the project root, or pass the directory |
| `stylesheet styles/x.css not found` | `styles` entries are paths from the project root, ending in `.css` |
| `"auth" is missing required key "user"` | `auth` needs the user schema file |
| `"secret" holds a literal secret` | Never put credentials in files; use `{"env": "NAME"}` |

## package.iwc

**Purpose:** packaging metadata and deploy targets.

```json iwc:package
{
  "name": "lumen-oak",
  "version": "1.2.0",
  "iwc": 1,
  "deploy": {
    "prod": { "domain": "lumen-oak.com", "aliases": ["www.lumen-oak.com"], "email": "ops@lumen-oak.com" },
    "staging": { "domain": "staging.lumen-oak.com", "port": 8081 },
    "legacy": { "url": "https://deploy.example.com", "tokenEnv": "IWC_DEPLOY_TOKEN" }
  }
}
```

You rarely write targets by hand: `iwc deploy <name>` asks and writes them. `"type": "cpanel"` is shared hosting reached through cPanel's API ([cPanel](integrations-and-packages.md#shared-hosting-with-cpanel-iwc-deploy)); a target with a `url` is an `iwc host` you run yourself, reached over HTTPS with a token; any other target is a server reached over SSH and set up by `iwc deploy` ([your own server](integrations-and-packages.md#your-own-server-iwc-deploy)). The connection itself — address, user, port, key — is kept per developer in `~/.iwc/deploy/`, never in the project; write `"ssh": "deploy@203.0.113.10"` only to share one address with the whole team.

| Deploy target key | Meaning |
| --- | --- |
| `type` | `cpanel`, `ssh` or `agent` (inferred when absent: `agent` with a `url`, else `ssh`) |
| `folder`, `site` | cPanel: the site's folder in the account (`public_html`, `public_html/shop`, `shop.example.com`) and its public address |
| `arch` | cPanel: `amd64` (default) or `arm64` |
| `url`, `tokenEnv` | An HTTPS release agent and the environment variable holding its token |
| `ssh` | Optional shared address: `user@host`, `user@host:port` or a `~/.ssh/config` alias |
| `domain`, `aliases` | The site's domains; served over HTTPS with certificates obtained and renewed automatically. Without a domain: plain HTTP on the server's address |
| `email` | Contact address for the certificate authority |
| `port` | The app's local port behind the proxy (default `8080`; give each target on one server its own) |
| `dir` | Where releases, data and logs live (default `/srv/iwc/<package>-<target>`) |
| `proxy` | `auto` (default: the nginx or Caddy already on the server, else Caddy is installed), `caddy`, `nginx`, or `none` (the app listens on `port` itself, plain HTTP) |

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | lowercase-with-dashes | **yes** | Package name (release names, `iwc build` output) |
| `iwc` | `1` | **yes** | Format version |
| `version` | `1.2.3` | no | Your release version |
| `deploy` | `{target: {…}}` | no | Targets for `iwc deploy/pull/logs/rollback` and `iwc server` (keys below). `url` must be https except for localhost |
| `x-<vendor>` | any | no | Data for other tools (an exporter's provenance, an editor's ids). Allowed in every `.iwc` file at any level; IWC keeps it and never interprets it |

If `package.iwc` is missing, the project still runs, as `app 0.0.0`.
