# Multi-app projects

**Purpose:** serve several applications from one project — a storefront and an admin, or a customer app, a staff app and a courier app — with **one server, one database and one set of schemas, actions, workflows, events, jobs and services**.
**When:** two or more audiences use the same data and rules but need their own screens, URLs, sign-in sessions and builds. Copying schemas between separate projects would duplicate the business logic; an app per audience in one project doesn't.

## Declaring apps

```json iwc:app
{
  "name": "Corner Shop",
  "iwc": 1,
  "auth": { "user": "user.schema.iwc" },
  "apps": {
    "shop": {
      "include": ["ui/shop/**", "api/shop/**", "tests/shop/**", "styles/shop.css"],
      "styles": ["styles/shop.css"]
    },
    "admin": {
      "name": "Back office",
      "include": ["ui/admin/**", "layouts/admin/**", "api/admin/**", "tests/admin/**", "styles/admin.css"],
      "path": "/admin",
      "host": { "env": "ADMIN_HOST" },
      "seo": { "index": false },
      "session": { "ttl": "8h" },
      "loginPage": "/login"
    }
  }
}
```

| `apps.<name>` key | Meaning |
| --- | --- |
| `include` | **Required.** Globs of the files this app owns. `*` matches within a folder, `**` any number of folders: `ui/admin/**` |
| `path` | The URL prefix the app is served under (default `/`). A literal path, or `{"env": "NAME"}` |
| `host` | Serve this app only for requests to this host (`admin.example.com`), and no other app there. Unset: any host |
| `name` | The app's display name (page titles, the native home-screen name) |
| `head`, `seo`, `notFound`, `navigation`, `styles`, `theme`, `performance`, `platforms` | The app's own value, replacing the project-wide one |
| `session.ttl` | Session lifetime in this app |
| `loginPage` | Where the app's protected screens send signed-out visitors (a route of this app) |

## Who owns what

- A file an app's `include` matches belongs to **that app only**. Screens, layouts, components, client state (`.state.iwc`), stylesheets, APIs and tests can belong to an app.
- A file no app includes is **shared by every app**: a shared sign-in API is served by each app at its own path.
- Schemas, actions, workflows, events, jobs, services and security files are **always shared**. An app's `include` matching one is an error.

Each app is compiled on its own, with its own files and the shared ones. So a reference across apps — a storefront screen linking to an admin route, or submitting to an admin API — is reported like any other unknown reference, naming the app:

```
ui/shop/sneaky.ui.iwc: error: in app "shop": … item-create.api.iwc not found
```

Two apps can each have a screen at `/`.

## Routing

One server runs every app. A request goes to:

1. the app whose `host` matches the request's host (case-insensitive, port ignored) — and only that app serves that host;
2. otherwise the app with the longest `path` prefix the request is under.

Within an app, routes and API paths are written as if the app were at the root: an admin screen at `"route": "/products"` answers `/admin/products`, and links, redirects and assets get the prefix automatically (the same mechanism as [`iwc start --base`](cli-commands.md)). A `next` parameter on sign-in redirects is app-relative.

`/_iwc/health` answers at the root.

## Sessions are per app

- Each app has its own cookies (`iwc_session_<app>`, `iwc_csrf_<app>`), so signing in to one app never signs the browser in to another.
- A session belongs to the app that created it: a cookie value or bearer token from one app is not a session in another (an API answers `401` with `WWW-Authenticate: Bearer error="invalid_token"`).
- Users, roles and permissions are shared: the same person may be a customer in one app and staff in another, signing in to each.

## What each app gets

| | Per app | Shared |
| --- | --- | --- |
| Screens, layouts, components, client state | ✓ | unclaimed files |
| Stylesheet bundle and runtime modules | ✓ (only what the app's screens use) | |
| APIs, OpenAPI document | ✓ | unclaimed APIs |
| `robots.txt`, `sitemap.xml`, CSP | ✓ | |
| Database, schemas, migrations, seeds | | ✓ (one migration for all apps) |
| Actions, workflows, events, jobs, services | | ✓ |
| Data cache and live updates | | ✓ (a write in one app refreshes every app) |
| Background workers | | ✓ (one set) |

## Commands

| Command | With apps |
| --- | --- |
| `iwc check` | Checks the shared root and every app, and prints one line per app |
| `iwc dev`, `iwc start` | One server, every app |
| `iwc test` | A test file an app owns runs against that app (its prefix, its sign-in API); shared test files run at the root |
| `iwc build` | One bundle; `--report` lists each app's routes under its prefix |
| `iwc build --android --app <name>` | That app's native build. Without `--app`, every app with the target is built |
| `iwc dev --platform ios --app <name>`, `iwc test --platform android --app <name>` | Likewise |

Native apps of a multi-app project are generated in `.iwc/native/<app>/<platform>` and copied to `build/<app>/<platform>`.

## A complete example

IWC's own test suite includes a `multiapp` reference project: a storefront at `/` and an admin at `/admin` with separate layouts, styles, APIs, sessions and tests.

## Mapped domains

An app can serve one of its paths on host names stored in a table — a tenant's shop at `/s/acme` answering on `shop.acme.com` or `acme.shops.example.com`:

```json
"apps": {
  "shop": {
    "include": ["ui/**"],
    "domains": { "schema": "store-domain.schema.iwc", "host": "host", "path": "path", "where": { "status": "active" } }
  }
}
```

- A request whose host matches a row (and the `where` conditions) is answered from that row's `path`: `shop.acme.com/products` is served by `/s/acme/products`.
- Links and redirects in the page lose the prefix, so visitors stay on the mapped host. `/api/`, `/assets/` and `/_iwc/` are never prefixed, so buttons and forms keep working.
- Host names an app claims in `host` are never remapped. Lookups are cached for 30 seconds (a newly activated domain starts working within that time).
- Point the domain's DNS at the server and terminate TLS in front of IWC (Caddy, nginx, a load balancer). Sessions are per host: a visitor signs in on each domain separately.
