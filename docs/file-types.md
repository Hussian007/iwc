# IWC file types and syntax

A one-page reference. The [developer guide](README.md) explains each type in depth with examples.

Every file is strict JSON: no comments, no trailing commas, no duplicate keys. A file named `<name>.<type>.iwc` is a resource of that type. Unknown keys are errors (with "did you mean" suggestions). The one exception is keys starting with `x-`, which are preserved and never interpreted. `iwc schema` writes the exact JSON Schema for each type so editors can autocomplete.

Three conventions recur:

- **References** name files: `"use": "product-card.component.iwc"`.
- **Bindings** name data paths. In `bind`, `binds` and `fields`, a bare name is a field of the current record. The roots `props.`, `user.`, `params.`, `query.` and `state.<store>.` read from elsewhere. Link targets written as routes (`/products/:slug`, `/products?category=:id`) are filled from the current record.
- **Expressions** appear only in actions, workflows and simulated services. A string starting with `=` is evaluated, for example `"total": "=round(sum(lines, unitPrice * quantity), 2)"`. `condition`, `items` and string `set.value` are always expressions. The language is closed: arithmetic, comparison, `&& || !`, field access, and the functions `sum avg min max count filter pluck round floor ceil abs len lower upper trim concat coalesce if contains number string now date`.

## app.iwc and package.iwc

```json iwc:app
{ "name": "Lumen & Oak", "iwc": 1,
  "theme": { "tokens": { "color-primary": "#1f3a2e", "radius": "14px" },
             "dark": { "color-background": "#141412" },
             "fonts": [{ "family": "DM Sans", "google": true, "weights": [400, 700] }] },
  "breakpoints": { "mobile": 640, "tablet": 1024 },
  "styles": ["styles/main.css"],
  "head": { "title": "%s · Lumen & Oak", "favicon": "/assets/favicon.svg" },
  "auth": { "user": "user.schema.iwc", "defaultRole": "customer", "loginPage": "/login" },
  "database": { "url": { "env": "DATABASE_URL" } },
  "notFound": "not-found.ui.iwc" }
```

`database.url` names the environment variable holding the database URL; when it is declared, `iwc dev`, `start` and `migrate` read that variable instead of `DATABASE_URL`, and a production start refuses to run without it.

Tokens become CSS custom properties: `var(--color-primary)`. The runtime's own defaults read `color-primary`, `color-on-primary`, `color-text`, `color-background`, `color-surface`, `color-border`, `radius`, `font-body` and `font-heading`. `package.iwc` holds `name`, `version`, `iwc` and `deploy` targets (`{"prod": {"url": "https://…", "tokenEnv": "IWC_DEPLOY_TOKEN"}}`).

## .ui.iwc — screens

`name`, `route` (`/products/:slug`), `layout`, `title`, `description`, `auth` (`required|optional|none`), `roles`, `sections` (elements), `style`, `styleSource`, `className`.

### Elements

Every element takes `type`, `id`, `className`, `style` (any CSS property), `responsive` (`{"mobile": {…}}`), `states` (`hover|focus|active`), `animation` (`fade|fade-up|fade-down|slide-left|slide-right|zoom`, `trigger: load|visible`, `duration`, `delay`), `transition`, `visible` (`{"auth": "signed-in"}`, `{"roles": ["admin"]}`), `ariaLabel` and `styleSource`.

- `className` accepts any class token a stylesheet can select, including utility-framework syntax (`md:grid-cols-2`, `max-w-[96rem]`, `bg-black/50`); tokens are HTML-escaped.
- `tag` renders a container or text element as another inert HTML tag: `div span p section article aside header footer nav main figure figcaption ul ol li dl dt dd blockquote address time small strong em b i s u mark cite q abbr sub sup del ins code pre kbd label hgroup h1–h6 details summary button`. Anything else falls back to the element's own tag.
- `attributes` adds HTML attributes that only stylesheets and assistive technology read: `data-*`, `aria-*`, `role`, `title`, `lang`, `dir`, `width`, `height`, `hidden`. Names the runtime uses (`data-iwc*`, `data-anim*`, `data-bind*`) and anything else are ignored. Layouts take `attributes` too (on their root).
- Form inputs take `className` (on the control itself) and `submit.className` (on the submit button, replacing its variant styling).

| Types | Main keys |
| --- | --- |
| `container section box main aside header footer nav sidebar` | `elements`, `layout` (`direction align justify gap wrap`) |
| `row column stack grid` | `layout`, `columns` (number or CSS), `responsiveColumns`, `gap` |
| `text` | `content` or `bind`. `variant`: `title h1–h6 heading subheading paragraph caption label quote code eyebrow span`. Also `format` (`currency number percent date datetime`), `currency`, `prefix`, `suffix` |
| `image video audio svg icon placeholder` | `source` (or `binds.source`), `alt`, `fit`, `ratio`, `poster`, `autoplay loop muted controls`; `icon` takes `name` |
| `button link` | `label`, `action` (`navigate open close toggle scroll state api logout`), `target`, `newTab`. For state: `store`, `mutation`, `value`. For `api`: `api` |
| `card` | `fields` (`title subtitle text price image badge link`) plus `elements` for actions |
| `list table chart` | `items`, `cells` (`field label format`), `chart` (`kind: bar|line, x, y`) |
| `form` | `inputs` (`name type label required options …`), `submit` (`api`, `include: ["STATE.cart.items"]`, `success: {navigate|redirect|message|reset|mutation|reload}`). `redirect` names a response field holding the URL to go to: a path on this site, or an address on one of the project's http service origins (anything else is refused) |
| `navbar dropdown modal drawer tabs accordion carousel slider review rating` | `items`, `tabs`, `side`, `autoplay`, `interval`, `open` |
| menus (`navbar`, `dropdown`) | `items` nest: an item with its own `items` is a submenu, to any depth; items take `newTab`. `opensOn: click|hover` (hover falls back to click on touch screens). A `dropdown` also holds any `elements`, which makes mega panels. Navbars take `collapse: links|all` (what folds behind the menu button; `all` keeps the first element, the brand, visible) and `collapseAt: mobile|tablet` |
| `component` | `use`, `props` (a value `{"bind": "item"}` passes data), `elements` (rendered by the component's `slot`) |

### Data

Any container can declare `data`. Static and dynamic UI share the same elements.

```json iwc:element
{ "type": "grid", "columns": 3,
  "data": { "source": "DATABASE.products", "columns": ["name", "price", "image"],
            "filter": { "active": true, "slug": { "param": "slug" } },
            "sort": { "field": "createdAt", "order": "desc" },
            "search": { "fields": ["name"] }, "paginate": { "size": 12 },
            "limit": 12, "cache": "30s", "live": true },
  "item": { "type": "component", "use": "product-card.component.iwc", "props": { "product": { "bind": "item" } } },
  "empty": { "type": "text", "content": "Nothing yet" },
  "error": { "type": "text", "content": "Unavailable" } }
```

Sources are `DATABASE.<schema>`, `API.<name>` (GET), `STATIC` (`items`), `USER` and `STATE.<store>.<list>` (rendered in the browser from a client store, e.g. `STATE.cart.items`). An `API` source passes the route's parameters and the page's query to the api, plus its own `query` (`{"source": "featured", "ref": {"param": "slug"}}`), which wins; each key must be a query parameter the api declares. With an action and an http service behind it, this is how a section reads live data from another system. `mode: "single"` binds one record to the children. Filter values may reference `{param|query|user|props}` or use operators `{eq ne lt lte gt gte in contains}`. Declared `columns` are the only fields selected. Sensitive fields are never selectable.

## .layout.iwc

`slots` maps names to a component file, an inline element, or `"PAGE_CONTENT"` (exactly once). `structure.<slot>` takes `position` (`normal|fixed|sticky`), `collapsible`, `width`, `mobile` (`drawer|hidden|bottom`) and `style`. `template` (`["header header", "sidebar content"]`) turns slots into CSS grid areas.

## .component.iwc

`name`, `props` (field specs; `required` is checked at every use), `root` (one element), `style`, `styleSource`. Circular use is a compile error.

## .schema.iwc

```json iwc:schema
{ "name": "product", "table": "products",
  "fields": { "name": { "type": "string", "required": true, "maxLength": 120 },
              "slug": { "type": "string", "unique": true, "pattern": "^[a-z0-9-]+$" },
              "category": { "type": "relation", "to": "category.schema.iwc" },
              "costPrice": { "type": "number", "sensitive": true } },
  "indexes": [["active", "featured"]], "owner": "customer", "tenant": false,
  "access": { "read": "public", "create": ["admin"], "update": ["admin", "owner"], "delete": "none" },
  "seed": [{ "id": "p-1", "name": "Lamp", "slug": "lamp" }] }
```

Field types are `string text integer number boolean email url password date datetime json enum relation file`. `id`, `createdAt`, `updatedAt` (and `tenantId`) are managed for you. Access rules are `public`, `auth`, `owner`, `none` or a role list, which may include `"owner"`. Migrations add tables, columns and indexes automatically. They refuse type changes, and adding a required column without a default to a table that has rows. Removed fields keep their data. Seeds load only in development and tests.

## .api.iwc

`name`, `method`, `path` (mounted under `/api`), `request` (`payload` and `query` field specs), `response` (`status`, `type: object|list`, `fields`), and `security` (`auth`, `roles`, `rateLimit: true|"10/1m"`, `csrf`). Each API names exactly one implementation:

- `operation`: `db.list db.get db.create db.update db.delete` with `resource`, `auth.register auth.login auth.logout auth.me`, or `storage.upload`
- `action`: an action file
- `workflow` plus `transition`

`db.list` understands declared `page`, `limit`, `sort` (`-price`), `q`, and filters on declared query fields. Every API is listed at `/_iwc/openapi.json`.

## .action.iwc

`name`, `auth`, `roles`, `input` (field specs), `transaction`, `steps`. Each step has an `operation`:

`validate` (optional `condition`) · `require` (`condition`, `status`, `error`) · `find` (`resource`, `where`, `as`, `required`) · `query` · `create` (`values`) · `update` (`where`, `values`, `increment`, `expect`) · `delete` · `set` (`as`, `value` or `append`) · `forEach` (`items`, `as`, `steps`) · `call` (`service`, `method`, `input`) · `emit` (`event`, `payload`) · `enqueue` (`job`, `payload`, `delay`) · `notify` (`to`, `subject`, `body`) · `transition` (`workflow`, `transition`, `value` = record id) · `return` (`value`).

`where` values may use operators: `"stock": {"gte": "=line.quantity"}`. Error messages may be expressions. See `examples/shop/actions/checkout.action.iwc`.

## Other types

- **.workflow.iwc**: `resource`, `field` (default `status`), `initial`, `states`, `transitions` (`name from[] to roles action`). Transitions are atomic compare-and-set.
- **.security.iwc**: `roles` (with `inherits`), `routes` (`path` with `/*`, `auth`, `roles`), `rateLimit` (`api`, `auth`), `cors.origins`, `headers` (`contentSecurityPolicy`, `frameAncestors`).
- **.service.iwc**: `provider: http` (`baseUrl`: an https URL or `{"env": "NAME"}`, which must resolve to https, or http to a loopback host; `auth.secret: {"env"}`; `methods.<m>`: `method path query body`, where `query` values are expressions and empty ones are left out) or `simulated` (`respond`, `fail`). A production start refuses an http service whose base URL does not resolve. Service origins are allowed for images, media and fonts in the content security policy. Simulated services are refused in production unless `allowInProduction` is set.
- **.state.iwc**: client stores. `persist` is `local`, `session` or `none`. Also `initial`, `mutations` (`set push upsert remove increment clear`) and `derived` (`{"sum": "items", "multiply": ["price", "quantity"]}`).
- **.event.iwc**: `payload`, `handlers` (`action` or `job`), and `broadcast` to push to connected browsers.
- **.job.iwc**: `action`, `retries`, `timeout`, `schedule.every`. Retries use exponential backoff.
- **.test.iwc**: `cases` of `request` (`method path body headers`), `expect` (`status`, `body` subset with `"*"` wildcards, `contains`, `excludes`, `order`), and `as` (sign in first).
