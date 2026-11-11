# Expressions and page data

Pages can compute what they show: a price with tax, a badge only when stock runs out, a title from the record on the page, a list sorted by the URL. You write these as **expressions**, the same small language actions and workflows use ([actions → expressions](actions-and-workflows.md)). They run on the server while the page renders, so the browser receives finished HTML and no extra JavaScript.

```json iwc:element
{ "type": "text", "content": "=format(product.price * 1.2, 'currency', 'EUR')" }
```

A string that starts with `=` is an expression; every other string is literal text, exactly as before. Literal text can contain anything, including `{braces}` and `=` signs after the first character.

## Where expressions work

| Where | Example |
| --- | --- |
| Text: `content`, `label`, `alt`, `ariaLabel`, `author` | `"content": "=product.name"` |
| Links and media: `target`, `source`, `poster` | `"target": "='/c/' + product.category.slug"` |
| Classes: `className` | `"className": "='card' + (stock == 0 ? ' sold-out' : '')"` |
| Attributes: any value in `attributes` | `"attributes": {"aria-pressed": "=liked"}` |
| Visibility: `visible` | `"visible": "=product.stock > 0"` |
| Component props, state and api values | `"props": {"title": "=upper(product.name)"}` |
| Data sources: `source`, `filter`, `sort`, api `query` | `"filter": {"category": "=product.category"}` |
| The page itself: `title`, `description`, `canonical`, `meta`, `structuredData` | `"title": "=product.name"` |

An attribute whose expression gives `false` or `null` is left out, and `true` writes `"true"`. Every result is escaped like literal text, and link and media URLs pass the same safety check (`javascript:` and the like become `#`). An expression can't produce markup, an event handler or a script.

## The language

| | |
| --- | --- |
| Values | numbers, `'text'` or `"text"` (`\n` is a newline, `\t` a tab, `\'` a quote: `split(notes, '\n')` gives the lines of a textarea), `true`, `false`, `null` |
| Names | `product.price`, `item.name`, `tags[0]`, `list.length` |
| Arithmetic | `+ - * / %` (`+` joins text when either side is text) |
| Comparison | `== != < <= > >=` |
| Logic | `&& || !` |
| Choice | `cond ? a : b`, `a ?? b` (b when a is null or empty) |
| Lists | `sum avg min max count filter pluck` (the second argument is evaluated per item: `sum(lines, price * qty)`), `first last slice sortBy join split len contains` |
| Text | `lower upper trim concat replace startsWith endsWith truncate` |
| Values | `coalesce default if number string round floor ceil abs` |
| Dates | `now()`, `date(x)`, and `format(x, 'date-long')` |
| Display | `format(value, kind, currency?)`. Kinds: `number currency percent date datetime date-long date-short time` |

There are no loops, assignments or user-defined functions, and every evaluation has a step limit and an output-size limit. A page can describe a calculation; it can't run code.

An element with a `format` formats an expression's result too:

```json iwc:element
{ "type": "text", "content": "=price * (1 - discount)", "format": "currency", "currency": "USD" }
```

## What is in scope

Innermost first:

1. The **current record's fields** inside a data block (`name`, `price`), also as `item.name`.
2. **Component props** inside a component (`title`), also as `props.title`.
3. The page's **page data** by name (`product`, `related`). This is pages only: layouts and components are shared between pages, so they receive values through props.

And always:

| Name | Value |
| --- | --- |
| `params` | route parameters (`params.slug`) |
| `query` | query-string values (`query.sort`) |
| `user` | the signed-in user's public fields, or `null` |
| `auth` | `auth.signedIn` (boolean), `auth.role` |
| `page` | `page.path` |
| `app` | `app.name` |

Client state (`state.cart`) lives in the browser and isn't in scope. Show it with `"bind": "state.cart.count"`. Elements repeated from a `STATE.` source are rendered in the browser, so they use `bind` too. The compiler says so if you try an expression there.

## Page data

A page can load named data before it renders. Every section can read it, and so can the title, description and metadata:

```json iwc:ui
{
  "name": "Product",
  "route": "/products/:slug",
  "data": {
    "product": {
      "source": "DATABASE.products", "mode": "single", "required": true,
      "filter": { "slug": { "param": "slug" } },
      "include": { "category": {} }
    },
    "related": {
      "source": "DATABASE.products", "limit": 4,
      "filter": { "category": "=product.category.id", "slug": { "ne": { "param": "slug" } } }
    }
  },
  "title": "=product.name",
  "description": "=product.name + ' from ' + format(product.price, 'currency', 'USD')",
  "sections": [
    { "type": "text", "variant": "h1", "content": "=product.name" },
    { "type": "text", "content": "=count(related) + ' more in ' + product.category.name" },
    { "type": "list", "data": { "source": "=related" }, "item": { "type": "text", "content": "=name" } }
  ]
}
```

- Sources load **in the order written**, and each can read the ones before it.
- `"mode": "single"` gives one record (or `null`); otherwise the name holds a list.
- `"required": true` makes the page answer **404** (rendering your `notFound` screen) when nothing matches. The same happens when the visitor isn't allowed to read the record, so another tenant's record is simply not found.
- A page-data name can't reuse a reserved name (`item`, `props`, `params`, `query`, `user`, `auth`, `page`, `app`, `state`).

## Repeating a list from an expression

`"source": "=…"` repeats any list already in scope: page data, an include, a JSON field, or a computed list.

```json iwc:element
{ "type": "list", "data": { "source": "=sortBy(filter(order.lines, quantity > 0), 'name')" }, "item": { "type": "text", "content": "=name + ' × ' + quantity" } }
```

When the expression is a plain path to page data or an include (`"=product.reviews"`), the compiler knows the records' schema and checks the item's names against it.

## Related records: include

`include` attaches related records to every record of a `DATABASE` source, with **one extra query per include** whatever the number of records:

```json iwc:element
{
  "type": "list",
  "data": {
    "source": "DATABASE.posts",
    "include": {
      "author": {},
      "comments": { "source": "DATABASE.comments", "on": "post", "sort": { "field": "createdAt", "order": "desc" }, "limit": 3 },
      "mine": { "source": "DATABASE.likes", "on": "post", "filter": { "user": "=user.id" } }
    }
  },
  "item": { "type": "text", "content": "=author.handle + ': ' + body + ' (' + len(comments) + ' comments)'" }
}
```

- **A relation field** (`"author": {}`): attaches the record it points to, under the include's name. Use `"field"` to give the include another name (`"writer": {"field": "author"}`). When the name equals the field, the id is replaced by the record (`author.id` still has it).
- **Records pointing back** (`"source"` + `"on"`): attaches a list of the records whose `on` field holds this record's id. `limit` (1–100, default 100) caps each list; `filter`, `sort` and `columns` work as on any source.
- The related schema's **read rules and tenancy apply**: an include never shows a visitor a record they couldn't list directly (a user's own records stay theirs, another tenant's stay invisible).
- Reading `category.name` without including `category` is a compile error, because a relation field holds only an id.
- **Cost:** each include is one query for the whole list, however many records it shows (no query per record). A has-many include reads every matching child of the listed records (up to 5,000) and then keeps `limit` per record, so a `limit: 1` include over a large list still reads all of their children. Paginate the parent when lists are long.

## Filters and sort from the request

Filter values can be expressions, and operators can compare against references or expressions:

```json iwc:element
{
  "type": "grid",
  "data": {
    "source": "DATABASE.products",
    "filter": {
      "slug": { "ne": { "param": "slug" } },
      "startsAt": { "gt": "=now()" },
      "stock": { "gt": 0, "when": "=query.instock == '1'" }
    },
    "sort": { "field": "=query.sort", "order": "=query.dir", "allow": ["price", "name"], "default": "name" }
  },
  "item": { "type": "text", "content": "=name" }
}
```

- `"when"` applies a condition only while its expression is truthy, so one listing serves `/products` and `/products?instock=1`. (A `{"query": "x"}` reference still drops itself when `x` is absent, as before.)
- A sort field chosen by an expression must list the fields it may choose in `"allow"`. Anything else, including sensitive fields, falls back to `"default"`. `"order"` accepts `asc`/`desc` or an expression.
- **An expression with no value matches nothing.** `{"user": "=user.id"}` for a signed-out visitor shows no records. It does not show the records whose `user` is empty. To filter on an empty field, write a literal `null`: `{"parent": null}`. To make a condition optional, use `"when"`. Action `where` clauses follow the same rule, so an update or delete scoped to `=user.id` changes nothing for a signed-out visitor.
- Values are always passed to the database as parameters, never spliced into queries. Search terms are matched literally (`%` and `_` are not wildcards), and `?page=` values that aren't positive whole numbers mean page 1.

## Compile-time checks

`iwc check` (and `iwc dev`) parse every expression and check each name it reads against what will really be in scope at that point:

```
✗ ui/product.ui.iwc:14:30: error: unknown name "prodct" in this expression (in scope: auth, app, category, …, product, query, user)
✗ ui/product.ui.iwc:15:30: error: product.schema.iwc has no field "nmae"
✗ ui/product.ui.iwc:16:30: error: field "costPrice" is sensitive and is never sent to the browser
✗ ui/product.ui.iwc:17:30: error: category is a relation (it holds an id); load the record with "include": {"category": {}} to read category.name
! ui/product.ui.iwc:18:30: warning: name is a string field; arithmetic on it fails unless it holds a number
```

Route parameters, component props, columns, includes and page-data names are all checked. When an expression still fails at run time (dividing by zero, say), it renders as empty and the server logs a `render problem` with the page and the expression. The page itself still renders.

## Platform functions

Available in actions and pages alike (the time-zone functions use `app.iwc` `timeZone`):

| Function | Returns |
| --- | --- |
| `distanceKm(lat1, lng1, lat2, lng2)` | Great-circle distance in km (haversine, 3 decimals) |
| `geohash(lat, lng, precision?)` | The geohash cell (precision 1–12, default 7; 6 ≈ 1.2 × 0.6 km) |
| `geohashNeighbors(hash)` | The 8 surrounding cells |
| `pointInPolygon(lat, lng, polygon)` | Whether a point is inside a GeoJSON Polygon or a list of `[lng, lat]` pairs |
| `localTime(ts, zone?)`, `localDate(ts, zone?)`, `localDateTime(ts, zone?)` | `HH:MM`, `YYYY-MM-DD`, or an ISO time with offset, in the app's time zone (or `zone`) |
| `weekday(ts, zone?)` | 0 (Sunday) – 6 (Saturday) in that zone |
| `timeBetween(hhmm, from, to)` | Whether a time of day is in `[from, to)`; a window ending before it starts runs past midnight |
| `addMinutes(ts, n)`, `minutesBetween(a, b)` | Time arithmetic (UTC) |
| `sha256(text)`, `hmacSha256(key, text, encoding?)` | Hex (or `base64`) digests |
| `constantTimeEquals(a, b)` | Comparison that takes the same time whatever the input |
| `base64(text)`, `base64Decode(text)` | |
| `randomToken(bytes)` | A URL-safe random token (8–64 bytes of randomness) |
| `randomDigits(n)` | `n` uniform random digits (1–12), e.g. a one-time code |
| `parseCsv(text, delimiter?)` | The rows of a CSV text as `[{column: text}]`, columns named by the first row (at most 5,000 rows) |
| `money(minor, currency?)` | An amount held in minor units as display text, computed with integers: `money(129900, 'INR')` → `₹1,299`, `money(1250, 'USD')` → `$12.50`, `money(1500, 'JPY')` → `¥1,500`. Decimals follow ISO 4217; a whole amount drops `.00`; INR uses Indian grouping (`₹1,29,900`) |
| `padStart(value, width, fill?)` | `padStart(42, 6)` → `000042`: document numbers |
| `verifyEd25519(publicKey, message, signature)` | Whether `signature` (base64/base64url) is the Ed25519 signature of `message` by `publicKey` (base64): licence keys and payloads signed by a party that keeps its private key |

`hmacSha256Secret` and `verifyHmacSecret` use a declared secret and work only in actions: see [verifying signed webhooks](actions-and-workflows.md#verifying-signed-webhooks).

## Limits

- Expressions run on the server. They don't re-run in the browser when client state changes (that is Phase 2's client behaviour engine). Use `bind` for values that change in the browser.
- One level of include: an included record can't include more.
- A has-many include loads at most 5,000 rows per data block.
- Month names in `date-long`/`date-short` are English; times are UTC.
