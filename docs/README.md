# IWC developer guide

IWC builds websites, web applications and native Android and iOS apps from JSON files. You describe screens, layouts, components, data, APIs, business rules and tests; the `iwc` command checks them, runs them, and builds them for production. You don't write JavaScript for ordinary work; when you need it, [widgets](widgets.md) add your own browser code behind a declared security policy.

This guide assumes no prior IWC knowledge. Every JSON example in it is validated against the compiler's own schemas, and the complete example projects under [`examples/`](examples/) compile and pass their tests.

## Start here

1. [Getting started](getting-started.md): install, create a project, run it, change it.
2. [Project structure](project-structure.md): the files in a project and how they refer to each other.
3. [CLI commands](cli-commands.md): `create`, `dev`, `check`, `validate`, `test`, `build`, `logs`, `doctor` and the rest.

## Building pages

| Guide | You will learn |
| --- | --- |
| [UI development](ui-development.md) | `.ui.iwc` screens and **every element type** with its properties |
| [Layout development](layout-development.md) | `.layout.iwc`: header/footer/sidebar frames, sticky and drawer slots |
| [Component development](component-development.md) | `.component.iwc`: reusable pieces with props and slots |
| [Data binding](data-binding.md) | Showing database, API, static and user data; `bind`, `binds`, scopes, formatting |
| [Expressions and page data](expressions.md) | Computed values, conditional rendering, page-level data, related records (`include`), sorting and filtering from the URL |
| [State management](state-management.md) | `.state.iwc`: browser-side stores such as a cart |
| [Forms and validation](forms-and-validation.md) | Inputs, submit, server-side validation, error display |
| [Routing and navigation](routing-and-navigation.md) | Routes, parameters, links, menus, 404, protected pages |
| [Styling and responsive design](styling-and-responsive-design.md) | Theme tokens, CSS, breakpoints, hover states, animation, dark mode |
| [Widgets](widgets.md) | Your own JavaScript and third-party SDKs (maps, payment forms, video, rich text) behind a per-page security policy |

## Building the back end

| Guide | You will learn |
| --- | --- |
| [API development](api-development.md) | `.api.iwc`: endpoints, request/response contracts, security |
| [Database development](database-development.md) | `.schema.iwc`: tables, fields, relations, access rules, seeds, migrations |
| [Authentication](authentication.md) | Sign-up, sign-in, sessions, roles, `.security.iwc` |
| [Access control](access-control.md) | Permissions, roles and grants from the database, record scopes (which stores a manager sees) |
| [Multi-app projects](multi-app.md) | Several apps (storefront, admin, staff, courier) from one project, one server and one database |
| [Actions and workflows](actions-and-workflows.md) | `.action.iwc` business logic, expressions, `.workflow.iwc`, `.event.iwc`, `.job.iwc` |
| [Integrations and packages](integrations-and-packages.md) | `iwc add` and the `@iwc/*` packages (mail, payments, storage, AI, SMS, WhatsApp, push, search, maps, realtime, video), `.service.iwc` external APIs, deployment |
| [Security](security.md) | What is protected by default, credentials and the vault, encrypted fields, webhooks, `iwc security`, a go-live checklist |
| [App configuration](app-configuration.md) | `app.iwc` in full |

## Shipping

| Guide | You will learn |
| --- | --- |
| [SEO and sharing](seo.md) | Titles, canonical links, Open Graph, structured data, `robots.txt`, `sitemap.xml`, status codes |
| [Performance and budgets](performance.md) | What each route loads, `iwc build --report`, size budgets, the benchmark |
| [Native apps](native-apps.md) | The same project as a native Android (Jetpack Compose) and iOS (SwiftUI) app: targets, platform-specific files, builds, toolchains, background work, payments, your own Kotlin/Swift |
| [Push notifications](push-notifications.md) | `iwc push setup`: notifications to browsers, Android and iOS; the `push` step; `iwc push test` from the terminal, locally or against the live site |
| [Installable apps and offline support](offline-and-pwa.md) | `iwc enable pwa` / `iwc enable offline`: manifest, service worker, install, push; stored screens, a queue of writes sent exactly once, conflicts and sync status on the web, Android and iOS |

## When things go wrong

- [Debugging](debugging.md): reading errors, the dev log, the error overlay, writing `.test.iwc` tests.
- [Limitations](limitations.md): what IWC does **not** do yet, so you don't go looking for it.
- [File reference](file-types.md): every file type on one page.
- [JSON Schemas](schemas/): the exact schema of each file type, for editors and tooling.

## Examples

- [`examples/cookbook`](examples/cookbook): landing page, login and registration, dashboard, product listing, product details, cart, checkout and an API-connected page. 38 files, 24 tests.
- [`../examples/shop`](../examples/shop): a complete e-commerce store with categories, cart, checkout, account, order history, admin dashboard, workflows, events and jobs. Create your own copy with `iwc create my-store --template store`.
