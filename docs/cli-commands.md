# CLI commands

Every command takes the project directory as an optional first argument (default `.`). Flags can come before or after it.

| Command | What it does |
| --- | --- |
| `iwc create <name> [--template basic\|store]` | Scaffold a new project in `./<name>`; asks which targets (Web, Admin, Android, iOS) |
| `iwc create <name> --web --android --ios [--admin]` | Choose the targets up front ([native apps](native-apps.md)) |
| `iwc dev [dir] [--port N] [--host 127.0.0.1] [--open]` | Development server with live reload (default port 3000) |
| `iwc dev --platform android\|ios` (or `--android` / `--ios`) | Build, install and launch the native app on an emulator/simulator; rebuild on save. The app is pointed at the port this project's running `iwc dev` uses |
| `iwc check [dir] [--json]` | Validate every file and every reference |
| `iwc validate [dir]` | `check` + every test + a production build: the pre-ship check |
| `iwc test [dir]` | Run `tests/*.test.iwc` |
| `iwc test --platform android\|ios` (or `--android` / `--ios`) | Run the native smoke test on an emulator/simulator |
| `iwc build [dir] [--out dist]` | Production bundle |
| `iwc build --web\|--android\|--ios\|--all [--release]` | Build application targets; native outputs go to `build/<platform>/` ([native apps](native-apps.md#commands)) |
| `iwc build [dir] --zip [--folder name] [--arch amd64\|arm64]` | The bundle plus `<folder>.zip` to upload to shared hosting and extract ([deploying](integrations-and-packages.md#shared-hosting-upload-a-zip)) |
| `iwc start [dist] [--port 8080] [--data dir] [--base /path] [--trust-proxy loopback]` | Serve a production bundle (under a path prefix with `--base`; behind a reverse proxy, `--trust-proxy` takes visitors' addresses from `X-Forwarded-For`) |
| `iwc run-jobs [folder]` | Run due background jobs once in an uploaded site (for a cron job) |
| `iwc migrate [dir] [--dry-run]` | Plan and apply schema changes to the configured database |
| `iwc backup [dir\|dist] [--out file] [--keep N] [--data dir]` | Archive the app's data and uploaded files ([below](#backup-and-restore)) |
| `iwc restore <archive> [dir\|dist] [--replace] [--yes]` | Load a backup: migrate, then every row in one transaction |
| `iwc logs [-f] [--lines 200] [--json]` | The dev server's log |
| `iwc doctor [dir] [--port 3000] [--platform android\|ios]` | Check the installation, the project and its native toolchains |
| `iwc schema [--out .iwc/schemas]` | Write JSON Schemas for editors |
| `iwc make --api docs [dir] [--out api-docs] [--server url] [--format json\|yaml\|both] [--strict]` | Write the API reference: `openapi.json`, `openapi.yaml` and an interactive `index.html` ([below](#iwc-make---api-docs)) |
| `iwc deploy <target>` | Build and deploy. The first time, asks where — [cPanel hosting](integrations-and-packages.md#shared-hosting-with-cpanel-iwc-deploy) or [your own server](integrations-and-packages.md#your-own-server-iwc-deploy) — and sets it up; afterwards just deploys. (`iwc push <target>`, its old name, still deploys) |
| `iwc server setup\|status\|restart\|env\|forget <target>`, `iwc server list` | Manage an SSH target's server: provision again, health and releases, restart, the app's secrets, saved connections |
| `iwc rollback <target> [id]` | Put the previous (or a given) release back — servers and cPanel hosting; the database is kept |
| `iwc pull <target>` | Download the live release's source and build (server targets) |
| `iwc logs <target> [-f] [--system]` | The live app's log; `--system` for the service and proxy journal |
| `iwc host [--trust-proxy loopback]` | Run a release agent yourself (see [integrations](integrations-and-packages.md#deploying)) |
| `iwc add <package> [dir] [--provider id] [--set k=v]` | Install an `@iwc/*` package: choose a provider, enter credentials (hidden), verify the connection, write the integration ([packages](integrations-and-packages.md#packages-iwc-add)) |
| `iwc packages [package]` | List the packages, or show one's methods and provider settings |
| `iwc integrations [list\|verify [name]\|remove name [--purge]]` | The project's integrations: status, live connection test, uninstall |
| `iwc enable [pwa] [offline]`, `iwc disable …` | Turn whole-app capabilities on/off in `app.iwc`: an installable web app (`pwa`: `--icon`, `--vapid`, `--push`) and offline data with sync (`offline`). `iwc enable` alone lists them; `iwc support --pwa --offline` is the same. See [installable apps and offline support](offline-and-pwa.md) |
| `iwc push`, `iwc push setup\|test\|devices\|key` | Push notifications: what is set up and what is missing; the guided setup (web, Android/iOS through Firebase, production keys onto a deploy target with `--target`); a test notification (`--to all\|<email>\|<user id>`, `--token`, `--platform`, `--title`, `--body`, `--path`) to `iwc dev` or a deployed app (`--target`, `--site`, `--key`); the registered devices; the CLI's key (`--show`, `--rotate`). See [push notifications](push-notifications.md) |
| `iwc config [list\|get\|set\|unset\|test]` | Integration settings: switch provider (`set mail.provider postmark`), plain settings, credentials into the vault (hidden prompt or stdin), connection test. See [changing settings](integrations-and-packages.md#changing-settings-iwc-config) |
| `iwc secrets [list\|set\|get\|rm\|export\|import] [--env development]` | Credentials kept encrypted outside the project for development; `export` writes them for a server ([security](security.md#credentials-and-secrets)) |
| `iwc security [dir] [--strict] [--json]` | Audit the project's security configuration ([security](security.md#auditing-a-project)) |
| `iwc migrate [dir] --reencrypt` | After migrating, re-encrypt encrypted fields under the current key (key rotation) |
| `iwc plugins` | List installed plugins ([below](#plugins)) |
| `iwc <plugin> …` | Run a plugin |
| `iwc about [--json] [--offline]` | Framework identity, installed and latest release with their publish dates, release channel, environment and links ([below](#iwc-about)) |
| `iwc --version` | Version, platform, and the fingerprint of the source the binary was built from (`source 1a2b3c…`). Deploy runtimes must match it |

Exit status is `0` on success and `1` on any error, so every command works in scripts and CI.

## iwc create

```bash
iwc create my-app                       # asks which targets: Web, Admin, Android, iOS
iwc create my-app --web --android --ios # all three, no questions (--yes: web only)
iwc create shop-site --template store    # the full e-commerce example (web only)
```

The basic starter is a welcome screen with a shared counter (`state/counter.state.iwc`) and an About screen, written once and built for every chosen target. `--admin` adds a web-only, sign-in protected `/admin` area. Targets are recorded under `platforms` in `app.iwc` ([native apps](native-apps.md)).

Writes the project, a `.gitignore` (`.iwc/`, `dist/`, `build/`, `.env`), `.vscode/settings.json` and `.vscode/iwc-schemas/`. It refuses to overwrite an existing folder. The `store` template gets its own `package.iwc` and none of the example's deploy targets.

## iwc dev

```bash
iwc dev
iwc dev --open
iwc dev --port 3400
iwc dev --open --port 3400
iwc dev --port=3400 --open
```

```text
IWC Development Server

✓ Project validated
✓ Runtime initialized
✓ Port 3400 available
✓ Application compiled (17 files in 15ms · 8 screens · 1 apis · 2 schemas)
✓ Hot reload enabled

  Local:    http://localhost:3400
  Docs:     http://localhost:3400/_iwc/docs/
  Project:  /Users/you/Projects/my-app
  Logs:     .iwc/logs/dev.log  (iwc logs -f)

Watching for file changes... (Ctrl+C stops)
```

- Compiles the project and serves it at `http://localhost:3000` (or the port below). `--open` opens the browser at the URL actually in use.
- **Watches** every file in the project (except dot-folders, `dist/` and `node_modules/`) and recompiles on save. Unchanged files are not re-parsed.
- **Hot reload**: a `.css` change swaps the stylesheet in place; any other change re-renders the current screen in place, at the same scroll position, keeping client state and unchanged layout parts. A change to the runtime itself or to `.state.iwc` definitions reloads the page.
- **Errors**: when a file has an error, the terminal lists it and every page shows an overlay with the errors until you save a fix.
- **Logs** one line per page or API request, and under a failed API call, the reason:

```text
17:04:26 page GET    /contact                                 200 0ms
17:04:26 api  POST   /api/messages                            422 0ms
      ↳ validation_failed: Some fields are invalid (body is required; email must be a valid email address)
17:04:26 api  POST   /api/messages                            201 1ms
```

  Server errors (500s) print the underlying error. Requests for the runtime's own files and `/assets/` are hidden unless they fail.
- **Database**: SQLite in `.iwc/dev.db`, migrated on every compile and seeded when tables are empty. If `app.iwc` declares `database.url`, that environment variable is used when set. Otherwise `DATABASE_URL` is used when set; `iwc doctor` warns you when that happens.
- `--host 0.0.0.0` makes the server reachable from your phone on the same network.

### Ports

Before compiling, `iwc dev` checks whether the port is taken — on both `127.0.0.1` and `::1`, so a server listening on `*:3000` (a Node app, say) is noticed even though a plain bind would succeed — and asks whoever holds it whether it is an `iwc dev` server (`/_iwc/dev/info`). It never stops or interferes with another process.

| Situation | What happens |
| --- | --- |
| Default port (3000) is free | It is used |
| Default port is taken | Each busy port is reported with its owner, and the next free port (3001, 3002, …) is used |
| You passed `--port` and it is taken | An error that names the owner and suggests a free port: `Try: iwc dev --port 3401 --open`. Your choice is never silently changed |
| This same project is already running there | No second server is started (it would share `.iwc/dev.db`); the URL is printed, and `--open` opens it |
| `--port` outside 1–65535 | An error |

```text
! Port 3000 is already occupied (by another application).
✓ Found available port 3001
```

```text
Error: Port 3400 is already occupied (by the IWC project "Docs site" (/Users/you/docs-site)).

Try:
  iwc dev --port 3401 --open
```

Every URL the runtime uses (pages, APIs, assets, live reload, live data) is relative, so any port works, and independent projects can run side by side on different ports.

## iwc check

Validates schemas, references and cross-file rules. Warnings (a missing `alt`, a link to a route no screen has) don't fail the command.

```bash
iwc check --json     # {"ok": false, "files": 12, "diagnostics": [{"file": …, "line": 4, "col": 13, "severity": "error", "message": …}]}
```

## iwc validate

Runs three stages, stopping at the first failure:

```text
1/3 files and references
✓ 47 files · 13 screens · 9 apis · 5 schemas
2/3 tests
✓ 42 test(s) passed
3/3 production build
✓ lumen-oak 1.0.0 builds (13 pages, 9 apis)
```

Use it before every deploy, and in CI.

## iwc test

Runs every `.test.iwc` file. Each file gets a fresh in-memory database with seed rows. Set `IWC_TEST_DATABASE_URL` to a Postgres URL to run against Postgres instead (each run uses a throwaway schema). See [debugging → tests](debugging.md#writing-tests).


Cases in one file run in order against one database. A case can keep values from its response for the cases after it: `"save": {"orderId": "id"}` stores the response's `id` (any dot path, such as `items.0.id`), and later cases write `{{orderId}}` in their path, body, headers or expectations. A body value that is exactly `{{name}}` keeps the saved value's type (a number stays a number).

```json iwc:test
{ "name": "orders", "cases": [
  { "name": "create", "as": { "email": "mo@shop.test", "password": "pass-mo-123" }, "request": { "method": "POST", "path": "/api/orders", "body": { "note": "rush" } }, "expect": { "status": 201 }, "save": { "orderId": "id" } },
  { "name": "approve it", "as": { "email": "mo@shop.test", "password": "pass-mo-123" }, "request": { "method": "POST", "path": "/api/orders/{{orderId}}/approve" }, "expect": { "status": 200, "body": { "id": "{{orderId}}" } } }
] }
```

## iwc build and iwc start

`iwc build` writes `dist/`:

| File | Contents |
| --- | --- |
| `manifest.json` | the compiled project, including your stylesheets |
| `assets/` | your static files |
| `openapi.json`, `openapi.yaml` | an OpenAPI 3.1 document for every API ([API documentation](api-development.md#api-documentation)) |
| `migrations/sqlite.sql`, `migrations/postgres.sql` | the tables, as SQL for review |
| `release.json` | name, version, content hash, build time |
| `report.json` | what each route sends (runtime modules, JavaScript, CSS and HTML shell, raw and gzipped) and any route over its [budget](performance.md#budgets) |

`iwc build --report` prints that report as a table. Budgets are checked on every build: overruns are warnings, or errors that fail the build with `"performance": {"enforce": "error"}`.

`iwc build --zip` also writes `<folder>.zip` next to the project, for hosting where you can only upload files: see [Shared hosting](integrations-and-packages.md#shared-hosting-upload-a-zip).

`iwc start dist` serves it in production mode: Secure cookies and HSTS (use `--secure=false` or `IWC_INSECURE=1` for plain-HTTP testing), no seed rows, and simulated services refused. Data goes to `--data` (default `.iwc-data/` next to `dist/`), or to the database named by `database.url` / `DATABASE_URL` (`postgres://…`, or `sqlite` for the built-in file).

`--base /shop` serves the app under a path prefix, for a proxy that forwards `mydomain.com/shop/*` to it: requests arrive with the prefix, and every link, asset, redirect and cookie the app sends carries it. Write routes and links in your `.iwc` files without it (`/cart`, not `/shop/cart`); the prefix is applied only at the edge.

## iwc migrate

```bash
iwc migrate --dry-run     # print the SQL plan
iwc migrate               # apply it
```

Automatic: new tables, new columns, new indexes. Refused, with an explanation: changing a column's type, or adding a required column without a default to a table that has rows. Removed fields are left in the database, so their data is kept. IWC refuses to touch a database that already holds tables it did not create (set `IWC_ADOPT_DATABASE=1` to adopt one deliberately).

## Backup and restore

```bash
iwc backup dist --out /var/backups/shop-$(date +%F).iwcbak.tar.gz --keep 14
iwc restore /var/backups/shop-2026-11-07.iwcbak.tar.gz dist            # into an empty database
iwc restore /var/backups/shop-2026-11-07.iwcbak.tar.gz dist --replace  # over the current data (asks first)
```

Both work on a project folder (development data in `.iwc/`) or a production bundle (data in `--data`, default `<dist>/../.iwc-data`), against the database the app is configured for: SQLite or PostgreSQL.

- A backup is one `.tar.gz`: a manifest, every table of the app's schemas as JSON lines, IWC's audit trail, uploaded-file records, two-factor enrolments and linked sign-in accounts, and the files uploaded to the server's disk. On PostgreSQL it is read from one consistent snapshot while the app keeps running.
- Values are kept exactly as stored: password hashes stay hashes, and encrypted fields stay ciphertext, so the backup is as sensitive as the database and restoring it needs the same `IWC_ENCRYPTION_KEY`. Sessions aren't kept: after a restore, everyone signs in again.
- The format doesn't depend on the database: a SQLite backup restores into PostgreSQL and the other way round, which is also how to move an app between them.
- `restore` first applies the app's migrations, then writes everything in **one transaction**: if any row fails, nothing changes. It refuses a database that already holds data unless `--replace` is given. Tables and fields the backup has but the app no longer declares are reported or skipped, never guessed.
- Schedule `iwc backup` with cron; `--keep N` deletes all but the newest N archives in the output folder.

## iwc logs

```bash
iwc logs              # last 200 lines of .iwc/logs/dev.log, formatted like the terminal
iwc logs -f           # …and keep following
iwc logs --json       # raw JSON records (for grep/jq)
iwc logs prod         # a deploy target's log (needs its token)
```

The dev log is rotated when it passes 5 MB.

## iwc about

```bash
iwc about             # works from any folder; no project needed
iwc about --json      # the same, for scripts
iwc about --offline   # no network: cached or built-in release information only
```

Shows the framework (name, version, owner IonicWebCreator Private Limited, founder, website, documentation), the release (installed version and when it was published, channel `stable`/`beta`/`rc`/`development`, the latest stable release, the first official release), the environment (OS, architecture, where `iwc` is installed and how, the built-in compiler) and links (documentation, release notes, changelog, GitHub, support).

Release dates come from [GitHub Releases](https://github.com/Hussian007/iwc/releases), the official release record, and are cached for 6 hours in your user cache folder, so most runs make no network request. When GitHub can't be reached, `iwc about` uses the cached list (and says how old it is), or else the build date stamped into the release and a note that live information is unavailable. When a newer stable release exists, it shows both versions and the upgrade command for your installation. `IWC_RELEASES_URL` points it at another releases API (testing, mirrors).

The installers run `iwc about --welcome` once after a successful install, to print the short welcome. No other command shows it.

## iwc doctor

```text
IWC installation
  ✓ version                iwc 0.1.0 (darwin/arm64, source 3f9c2a7e1b04)
  ✓ binary                 /Users/you/.iwc/bin/iwc
  ✓ machine                Apple Silicon (arm64)
  ✓ PATH                   `iwc` resolves to this binary
  ✓ SQLite                 built in (no system library needed)
  ✓ port                   3000 is free for `iwc dev`
  ✓ browser                `iwc dev --open` can open your browser
  ✓ Go (optional)          not installed — not needed to use IWC
Project /Users/you/Projects/my-website
  ✓ files                  10 file(s), no problems
  ✓ contents               2 screens · 1 apis · 1 schemas · 1 tests
  ✓ database               SQLite in .iwc/dev.db
  ✓ data folder            .iwc/ is writable
  ✓ editor                 JSON Schemas in .vscode/iwc-schemas (refreshed by `iwc dev`)
```

It warns when an Intel binary runs on Apple Silicon, when `iwc` on your `PATH` is a different copy, and when `DATABASE_URL` will redirect your dev database.

## iwc schema

Writes one JSON Schema (draft 2020-12) per file type. The same schemas are in [`docs/schemas/`](schemas/).

## iwc make --api docs

Generates the API reference from your `.api.iwc` files without running anything: no server starts and no request is sent.

```bash
iwc make --api docs                      # → api-docs/openapi.json, openapi.yaml, index.html
iwc make --api docs --server https://api.example.com --out public/reference
iwc make --api openapi --format yaml     # the document only
```

| Flag | Meaning |
| --- | --- |
| `--api docs` | The OpenAPI document (JSON and YAML) and `index.html`, a self-contained interactive explorer that opens from disk |
| `--api openapi` | Only the document |
| `--out` | Output directory (default `api-docs/` in the project). Multi-app projects get one folder per app |
| `--server` | The server the document lists and the explorer sends requests to. Default: `app.iwc` `apiDocs.servers`, else `seo.siteUrl`, else `http://localhost:3000` |
| `--format` | `json`, `yaml` or `both` (default) |
| `--strict` | Fail when a definition's `examples.request` doesn't pass that API's own validation (they are always reported as warnings) |
| `--app` | Multi-app projects: only this app |

The explorer's **Try it out** calls the server from the page's origin, so that origin must be in `.security.iwc` `cors.origins` (for example `http://localhost:8080` when you serve the folder locally). A file opened straight from disk has no origin a server can allow: serve the folder, or use the live explorer at `/_iwc/api-docs` while `iwc dev` runs.

## Plugins

The CLI can be extended without changing it, the way git runs `git-<name>`: `iwc <name> args…` runs an executable called `iwc-<name>`, looked up in `$IWC_PLUGINS` (a path list), then `~/.iwc/plugins`, then `PATH`. Built-in commands always win. The plugin gets the terminal, the arguments after the name, and three variables: `IWC_BIN` (the iwc binary, so it can call `"$IWC_BIN" check`), `IWC_VERSION`, and `IWC_CWD` (where the user ran `iwc`). Its exit status becomes iwc's.

```bash
mkdir -p ~/.iwc/plugins
printf '#!/bin/sh\necho "hello from a plugin: $*"\n' > ~/.iwc/plugins/iwc-hello
chmod +x ~/.iwc/plugins/iwc-hello
iwc hello world        # → hello from a plugin: world
iwc plugins            # → iwc hello  ~/.iwc/plugins/iwc-hello
```

Plugins are how importers, exporters and generators for other systems connect to IWC. What they write into a project that IWC doesn't need goes under `x-<vendor>` keys (in any file, at any level), which IWC keeps and never interprets.
