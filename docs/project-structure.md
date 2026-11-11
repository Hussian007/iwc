# Project structure

```text
my-website/
├── app.iwc                       the app: name, theme, styles, auth, 404 page   (required)
├── package.iwc                   package name, version, deploy targets
├── ui/          *.ui.iwc          screens: one route each
├── layouts/     *.layout.iwc      page frames (header, content, footer, sidebar)
├── components/  *.component.iwc   reusable pieces of UI with props
├── api/         *.api.iwc         HTTP endpoints under /api
├── database/    *.schema.iwc      tables: fields, validation, access rules, seed rows
├── actions/     *.action.iwc      server-side business logic (steps)
├── workflows/   *.workflow.iwc    state machines for records (pending → paid → shipped)
├── events/      *.event.iwc       things that happen, with handlers
├── jobs/        *.job.iwc         background and scheduled work
├── services/    *.service.iwc     external HTTP services (and simulated ones for dev)
├── state/       *.state.iwc       browser-side stores (a cart, a preference)
├── security/    *.security.iwc    roles, route rules, rate limits, CORS, headers
├── tests/       *.test.iwc        HTTP-level tests run by `iwc test`
├── styles/      *.css             your CSS, unrestricted
├── assets/                        static files served at /assets/…
├── .iwc/                          created by `iwc dev`: dev.db, uploads, logs (delete freely)
├── dist/                          created by `iwc build`
└── .vscode/                       editor settings + JSON Schemas for autocompletion
```

## The three rules

**1. A file's type comes from its extension.** A file is `<any-name>.<type>.iwc`. `ui/home.ui.iwc` is a screen because it ends in `.ui.iwc`. Folders are only a convention: `pages/home.ui.iwc` works the same. Two files of the same type may not share a file name, even in different folders, because references use the file name.

The types are `ui`, `layout`, `component`, `api`, `schema`, `action`, `workflow`, `security`, `service`, `state`, `event`, `job` and `test`. `app.iwc` and `package.iwc` have fixed names and live at the root.

**2. Files are strict JSON.** No comments, no trailing commas, no duplicate keys. Unknown keys are errors, with a "did you mean" suggestion. The one exception: keys that start with `x-` are kept and ignored, so you can annotate files (`"x-note": "remember to…"`).

**3. Files refer to each other by file name.**

| You write | It refers to |
| --- | --- |
| `"layout": "main.layout.iwc"` | `layouts/main.layout.iwc` (or anywhere else it lives) |
| `"use": "product-card.component.iwc"` | a component |
| `"api": "checkout.api.iwc"` | an API (forms, `action: "api"` buttons) |
| `"resource": "product.schema.iwc"` | a database schema |
| `"action": "checkout.action.iwc"` | an action (from an API, job, event or workflow) |
| `"styleSource": "styles/hero.css"`, `"styles": ["styles/main.css"]` | a stylesheet, by **path** from the project root |
| `"source": "/assets/hero.jpg"` | a file in `assets/`, by **URL** |

A reference may also be a project-relative path (`"layouts/main.layout.iwc"`); then the path must match too.

Some references use **names** instead of files:

| You write | It refers to |
| --- | --- |
| `"source": "DATABASE.products"` | a schema by `name` (`product`) or table name (`products`) |
| `"source": "API.products"` | an API by its `name` field |
| `"source": "STATE.cart.items"`, `"store": "cart"` | a state store by its `name` field |

The compiler resolves every reference. A wrong one is an error with a suggestion:

```text
✗ ui/home.ui.iwc:4:13: error: mian.layout.iwc not found (did you mean main.layout.iwc?)
```

## What happens when you run it

1. **Load.** Every `*.iwc` file is parsed and validated against its schema. Each error has `file:line:col`.
2. **Link.** References are resolved and cross-file rules are checked: a form must post to a non-GET API, a bound field must exist in the schema and in the data source's `columns`, a `roles` list needs `"auth": "required"`, and so on.
3. **Migrate.** Tables and columns are created to match the schemas. Only additive changes are automatic.
4. **Serve.** Pages are rendered on the server. A small runtime script adds the declared behaviour: menus, dialogs, forms, client state and live updates.

In `iwc dev`, steps 1–4 rerun on every save. Only changed files are re-parsed.

## A complete small project

The `basic` starter (`iwc create my-app`), with what each file does:

| File | Purpose |
| --- | --- |
| `app.iwc` | Name, theme tokens (colours, fonts, radius, dark mode), `styles/main.css`, page-title template, the 404 screen |
| `package.iwc` | `{"name": "my-app", "version": "0.1.0", "iwc": 1}` |
| `ui/home.ui.iwc` | `/`: the welcome page, with links to the guide at `/_iwc/docs/` |
| `ui/not-found.ui.iwc` | the 404 screen |
| `layouts/main.layout.iwc` | `PAGE_CONTENT` and a footer component |
| `components/footer.component.iwc` | the footer |
| `tests/smoke.test.iwc` | the welcome page renders and links the docs; unknown URLs get the 404 screen |
| `styles/main.css` | welcome page and footer styles |
| `assets/logo.svg` | the IWC logo, used as the favicon |

For larger examples, see the store (`iwc create my-store --template store`) and [`examples/cookbook`](examples/cookbook).
