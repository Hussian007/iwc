# Data binding

Any element can show data. Give it a **`data`** source. A list source repeats its **`item`** element once per record; a single-record source shows its children once with the record in scope. Inside that scope, **`bind`** puts a field's value in the text, **`binds`** puts values in attributes (image `source`, link `target`), and card **`fields`** map a record onto a card.

```json iwc:element
{
  "type": "grid",
  "columns": 3,
  "gap": "24px",
  "data": {
    "source": "DATABASE.products",
    "columns": ["name", "slug", "price", "image"],
    "filter": { "active": true },
    "sort": { "field": "name", "order": "asc" },
    "limit": 12
  },
  "item": {
    "type": "column",
    "elements": [
      { "type": "image", "binds": { "source": "image", "alt": "name" } },
      { "type": "link", "bind": "name", "target": "/products/:slug" },
      { "type": "text", "bind": "price", "format": "currency", "currency": "USD" }
    ]
  },
  "empty": { "type": "text", "content": "No products yet." },
  "error": { "type": "text", "content": "The catalogue is unavailable." }
}
```

Everything is rendered on the server: the browser receives finished HTML. The exception is `STATE` sources, which the browser renders from a client store.

## Sources

| `source` | Reads | Notes |
| --- | --- | --- |
| `DATABASE.<name>` | a schema's table, by schema `name`, its table name, or the plural of its name (`DATABASE.product` = `DATABASE.products`, even when the table is renamed) | The schema's `access.read` rule applies to the visitor. Supports `columns`, `filter`, `sort`, `search`, `paginate`, `limit`, `cache`, `live`, `refresh` |
| `API.<name>` | a GET API, by its `name` | The API runs internally with the visitor's session, with all its validation and security. Takes `query` |
| `STATIC` | the inline `items` array | Content you keep in the file. Objects become records; plain values become `{"value": …}` |
| `USER` | the signed-in user | Public fields only (never the password). Nothing when signed out. Needs `auth` in `app.iwc` |
| `STATE.<store>.<list>` | a list in a client [state store](state-management.md) | Rendered in the browser and re-rendered on every change. E.g. `STATE.cart.items` |

## data properties

| Property | Type | Applies to | Meaning |
| --- | --- | --- | --- |
| `source` | see above | all | **Required** |
| `mode` | `list` (default) \| `single` | all | `single` binds the first record to the children (and `item`) |
| `limit` | 1–500 | all | Maximum records |
| `columns` | array of field names | DATABASE | The only fields selected (`id` is always included). Binding to a field not listed is a compile error, because it would never load |
| `filter` | `{field: value}` | DATABASE | Conditions, ANDed (below) |
| `sort` | `{field, order: asc\|desc}` | DATABASE | Ordering (`createdAt`/`updatedAt` allowed) |
| `search` | `{param, fields}` | DATABASE | Adds a search box. The query parameter `param` (default `q`) is matched against `fields` |
| `paginate` | `{param, size}` | DATABASE | Pages of `size` (default 12, max 200), the page number in `?page=` (or `param`), and Previous/Next links |
| `items` | array | STATIC | The records |
| `query` | `{param: value}` | API | Query parameters for the API (literal or `{param\|query\|props}`). Each must be declared by the API |
| `cache` | duration (`30s`) | DATABASE | Cache results per visitor; any write to the table clears it |
| `live` | boolean | DATABASE | Re-render in open browsers when the table changes (server push) |
| `refresh` | duration (`30s`) | DATABASE, API | Re-render on a timer (at least 2s): a live order status, a dashboard |
| `as` | identifier | single | Also name the record: with `"as": "product"`, both `name` and `product.name` work |

### Filters

```json iwc:element
{
  "type": "stack",
  "data": {
    "source": "DATABASE.orders",
    "columns": ["total", "status", "createdAt"],
    "filter": {
      "customer": { "user": "id" },
      "status": { "in": ["paid", "shipped"] },
      "total": { "gte": 10 },
      "city": { "query": "city" }
    }
  },
  "item": { "type": "text", "bind": "status" }
}
```

| Value | Means |
| --- | --- |
| a literal (`true`, `"paid"`, `5`) | equals |
| `{"param": "slug"}` | the route parameter `:slug` (the route must have it; checked) |
| `{"query": "category"}` | the URL query parameter `?category=`. **When absent, the condition is dropped**, so one page serves both `/products` and `/products?category=x` |
| `{"user": "id"}` | a field of the signed-in user. When signed out, the result is empty |
| `{"props": "kind"}` | a component prop (inside components) |
| `{"eq"\|"ne"\|"lt"\|"lte"\|"gt"\|"gte": value}` | comparison with a **literal** value |
| `{"in": [..]}`, `{"contains": "text"}` | one of a list; substring match |

Comparison operators take literal values only: `{"ne": {"param": "slug"}}` does not resolve the parameter.

Sensitive fields (`password`, `"sensitive": true`) can never be filtered, sorted, searched, selected or bound. The compiler refuses.

### Instant search

A search box with `"instant": true` searches again as the visitor types (after a short pause). Typing anywhere (a header search) goes to the box's `target` screen; later keystrokes patch that screen in place, without a history entry or a scroll jump, and the box keeps its focus and text. Without script it is still a plain GET form.

```json iwc:element
{ "type": "search", "instant": true, "target": "/search", "placeholder": "Search products, brands and more" }
```

### Filter forms

A `search` element with `inputs` is a filter bar: a GET form whose fields (text, number, date, select, radio, checkbox, hidden) go in the URL's query, each showing the value the URL holds now. Data sources then read them with `{"query": "from"}` or `"=query.from"`:

```json iwc:element
{ "type": "search", "label": "Show", "inputs": [
  { "name": "from", "type": "date", "label": "From" },
  { "name": "to", "type": "date", "label": "To" },
  { "name": "branch", "type": "select", "label": "Branch", "options": [{ "label": "All branches", "value": "" }], "optionsFrom": { "source": "DATABASE.branches", "label": "name" } }
] }
```

A value from the URL is shown as text: it is never looked up or evaluated, even when it starts with `=`.

### Summaries: aggregate

A `DATABASE` source with `aggregate` lists groups instead of records: the database computes them, under the same read rules, scopes and `filter` as a plain listing, so a member's report sums only the rows they may read.

```json iwc:element
{
  "type": "table",
  "data": {
    "source": "DATABASE.sales",
    "filter": { "status": "completed" },
    "aggregate": {
      "groupBy": [{ "field": "createdAt", "bucket": "month", "as": "month" }],
      "measures": { "revenue": { "sum": "total" }, "sales": { "count": true } }
    },
    "sort": { "field": "month", "order": "desc" },
    "limit": 12
  },
  "cells": [{ "field": "month", "label": "Month" }, { "field": "sales", "label": "Sales" }, { "field": "revenue", "label": "Revenue" }]
}
```

Groups and measures are written as for the [aggregate step](actions-and-workflows.md#summaries-aggregate). Each record holds the group values and measures by name; `sort` names one of them. An `include` attaches the record a grouped relation field points at (`"groupBy": ["branch"]` with `"include": {"branch": {}}` shows `branch.name`). Without `groupBy`, use `"mode": "single"` (or page data) for one row of totals. `columns`, `search` and `paginate` don't apply.

## Bindings

### bind: text

| Path | Reads |
| --- | --- |
| `name`, `price` | a field of the current record (inside a data scope) |
| `item.name` | the same, explicitly |
| `category.name` | a nested value (dot path into JSON fields / objects) |
| `props.title` | a component prop |
| `user.name` | the signed-in user (needs `auth`) |
| `params.slug` | a route parameter of the current screen |
| `query.q` | a URL query parameter |
| `state.cart.total` | a client store value, including `derived` values. Updated live in the browser |

Bindings are checked: a field missing from the schema, missing from `columns`, sensitive, or a route parameter the route doesn't have is a compile error.

`bind` works on `text`, `link`, `button`, `badge`, `rating` and containers. Combine it with `format`, `currency`, `prefix` and `suffix`:

```json iwc:element
{ "type": "text", "variant": "label", "bind": "createdAt", "format": "date", "prefix": "Placed " }
```

### binds: attributes

```json iwc:element
{ "type": "image", "binds": { "source": "image", "alt": "name" }, "ratio": "1/1", "fit": "contain" }
```

`binds` maps an attribute to a data path: `source` and `alt` (media), `target` (links/buttons), `author` and `rating` (reviews).

### Route patterns

A `target` written as a route pattern is filled from the current record, in the path and in the query string:

```json iwc:element
{ "type": "link", "bind": "name", "target": "/products?category=:id" }
```

`/products/:slug`, `/account/orders/:id` and `/products?category=:id` all work, in server-rendered lists and in client-rendered `STATE` lists.

### Card fields

```json iwc:element
{ "type": "card", "fields": { "title": "name", "price": "price", "image": "image", "link": "/products/:slug", "badge": "label" } }
```

## Single-record pages

> A page about one record usually wants its data at the **page** level instead: then the title, description and sharing tags can use it, and a missing record answers 404. See [page data](expressions.md#page-data). Values can also be computed, with [expressions](expressions.md) (`"content": "=price * quantity"`).

```json iwc:ui
{
  "name": "Product",
  "route": "/products/:slug",
  "sections": [
    {
      "type": "section",
      "data": { "source": "DATABASE.products", "mode": "single", "columns": ["name", "price"], "filter": { "slug": { "param": "slug" } } },
      "elements": [
        { "type": "text", "variant": "h1", "bind": "name" },
        { "type": "text", "bind": "price", "format": "currency" }
      ],
      "empty": { "type": "text", "content": "That product doesn't exist." }
    }
  ]
}
```

## Scopes

Each data block opens a scope, and bare names read from the **nearest** one. Inside a component, bare names read the component's scope; use `props.` for its inputs. `user.`, `params.`, `query.` and `state.` read from anywhere.

```json iwc:element
{
  "type": "section",
  "data": { "source": "USER", "mode": "single" },
  "elements": [
    { "type": "text", "bind": "name", "prefix": "Hello, " },
    {
      "type": "stack",
      "data": { "source": "DATABASE.orders", "columns": ["total"], "filter": { "customer": { "user": "id" } } },
      "item": { "type": "text", "bind": "total", "format": "currency" }
    }
  ]
}
```

Inside the inner stack, `total` is the order's field. `user.name` would still read the user.

## Loading, empty and error states

- **empty**: rendered when a list has no records, or a single source finds none. Default: "Nothing here yet."
- **error**: rendered when the source fails (an API error, a database problem, or access denied). Default: "This content could not be loaded." The failure is logged on the server and shown in the dev terminal.
- **loading**: pages arrive complete from the server, so there is nothing to wait for on first load. Elements re-fetched by `live`/`refresh` get the class `iwc-loading` while they update, so you can style that state. Forms disable their submit button while sending.

## STATE lists (client-rendered)

```json iwc:element
{
  "type": "stack",
  "data": { "source": "STATE.cart.items" },
  "item": {
    "type": "row",
    "elements": [
      { "type": "image", "binds": { "source": "image", "alt": "name" } },
      { "type": "link", "bind": "name", "target": "/products/:slug" },
      { "type": "text", "bind": "quantity", "prefix": "× " },
      { "type": "button", "label": "Remove", "action": "state", "store": "cart", "mutation": "remove", "value": "item.id" }
    ]
  },
  "empty": { "type": "text", "content": "Your cart is empty." }
}
```

The `item` is sent as a template and filled in the browser for each entry. Inside it, these bind: text, link, badge and button `bind` (with `format`/`prefix`/`suffix`), image `binds.source`, link `binds.target` and route patterns, and `item.*` inside state `value`s. Data sources nested inside a STATE item are not supported.

## API sources

```json iwc:element
{
  "type": "column",
  "data": { "source": "API.quote", "mode": "single", "query": { "topic": { "query": "topic" } } },
  "elements": [
    { "type": "text", "variant": "quote", "bind": "text" },
    { "type": "text", "variant": "caption", "bind": "author", "prefix": "— " }
  ],
  "error": { "type": "text", "content": "The quote service is unavailable." }
}
```

The API must be `GET`. It receives the route's parameters, any of its declared query parameters present in the page URL, and the block's `query` (which wins). A response `{"items": [...]}` (as `db.list` returns) or an array is a list; an object is a single record. Behind the API can be an action that calls an [external service](integrations-and-packages.md), which is how a page shows live data from another system.

Complete example: [`examples/cookbook/ui/api-demo.ui.iwc`](examples/cookbook/ui/api-demo.ui.iwc).
