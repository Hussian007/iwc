# API development: .api.iwc

**Purpose:** an HTTP endpoint under `/api`, with a request contract (what it accepts), a response contract (what it returns), security, and exactly one implementation: a built-in operation, an action, or a workflow transition.
**When:** for every form submission, every data source that isn't a direct table read, and anything a mobile app or another system calls.

## Structure

```json iwc:api
{
  "name": "products",
  "method": "GET",
  "path": "/products",
  "description": "The public catalogue.",
  "operation": "db.list",
  "resource": "product.schema.iwc",
  "request": {
    "query": {
      "category": { "type": "string" },
      "sort": { "type": "string", "enum": ["name", "price", "-price"] },
      "q": { "type": "string", "maxLength": 60 },
      "page": { "type": "integer", "min": 1 },
      "limit": { "type": "integer", "min": 1, "max": 100 }
    }
  },
  "response": { "type": "list", "fields": { "id": "string", "name": "string", "price": "number", "image": "string" } },
  "security": { "auth": false, "rateLimit": "120/1m" },
  "cache": "30s"
}
```

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | name | **yes** | Used by `API.<name>` data sources and as the OpenAPI operation id |
| `method` | `GET` `POST` `PUT` `PATCH` `DELETE` | **yes** | |
| `path` | route | **yes** | Mounted under `/api`: `"/products/:id"` is `/api/products/:id`. Method + path is unique |
| `operation` / `action` / `workflow` | | **exactly one** | The implementation (below) |
| `resource` | schema file | for `db.*` | The table |
| `transition` | name | with `workflow` | Which transition |
| `request.payload` | field specs | writes | The accepted JSON body. Undeclared keys are rejected |
| `request.query` | field specs | no | Accepted query parameters (validated; unrelated ones are ignored) |
| `request.headers` | `{name: description}` | no | Headers the API reads: an action receives them as `input.headers` (lower-case names) |
| `request.rawBody` | boolean | no | The action receives the exact request body as `input.rawBody` (for webhook signatures) |
| `response.fields` | `{name: type or field}` | no | **The only fields returned.** Everything else is stripped |
| `response.type` | `object` \| `list` | no | With `list`, `fields` applies to each entry of `items` |
| `response.status` | 200–299 | no | Success status (default 200, or 201 for creates and registration) |
| `security.auth` | `true` \| `false` \| `required` \| `optional` \| `none` | no | `true`/`required`: 401 unless signed in |
| `security.roles` | role list | no | 403 unless the user has one (needs `auth: true`) |
| `security.permissions` | permission list | no | 403 unless the user has one ([access control](access-control.md)) |
| `security.scope` | `{scope: field}` | no | 404 unless the record the field names is in the caller's scope |
| `security.rateLimit` | `true` (60/1m), `"10/1m"`, or `{"rate", "per"}` | no | Per client IP, or per user / per request value (below) |
| `security.idempotency` | `required` \| `optional` | no | `Idempotency-Key` handling for writes (below) |
| `security.csrf` | boolean | no | Set `false` to waive CSRF on a write that needs no sign-in (webhooks) |
| `cache` | duration | GET | Cache responses per user; writes to the resource clear it |
| `description` | string | no | In the API documentation |
| `version` | `v1`…`v999` | no | Serve under `/api/<version>`: `"version": "v2"` with `"path": "/orders"` is `/api/v2/orders`. One method + path once per version ([versions](#versions)) |
| `summary`, `tags`, `deprecated` | | no | How the endpoint appears in the [API documentation](#api-documentation): a one-line title, groups (default: the first path segment), and a deprecation mark (it is still served) |
| `docs` | boolean | no | `false` leaves the endpoint out of the documentation (it is still served and still protected by its `security`) |
| `examples` | object | no | `request` (a body), `query` (parameters) and `response` shown in the documentation instead of generated ones |

## Implementations

### Built-in operations

| `operation` | Method | Does |
| --- | --- | --- |
| `db.list` | GET | Lists `resource` rows: `{"items": [...], "total", "page", "pages"}`. Understands `?page`, `?limit` (max 100), `?sort=field` / `?sort=-field`, `?q=` (searches text fields), and `?<field>=value` filters for declared query fields |
| `db.get` | GET | One row by `:id` (path must contain `:id`), or 404 |
| `db.create` | POST | Inserts the validated payload. Needs `request.payload`; each key must be a schema field. Sets the schema's `owner` field to the user |
| `db.update` | PATCH/PUT | Updates the payload fields of row `:id` |
| `db.delete` | DELETE | Deletes row `:id` |
| `auth.register` | POST | Creates a user and signs them in. See [authentication](authentication.md) |
| `auth.login` | POST | Signs in |
| `auth.logout` | POST | Signs out |
| `auth.me` | GET | The signed-in user, or 401 |
| `auth.exchange` | POST | Signs in with a provider's credential (Firebase phone ID token); needs `provider`. See [phone sign-in](authentication.md#phone-sign-in-firebase) |
| `auth.refresh` | POST | Rotates a token session's refresh token |
| `auth.sessions` | GET | The caller's signed-in devices |
| `auth.revoke` | POST | Signs out one device, or all others |
| `storage.upload` | POST | Stores an uploaded file (below) |

Every `db.*` operation applies the schema's [access rules](database-development.md#access-rules), so `db.update` on an owner-only table can only touch the caller's rows. Someone else's row looks exactly like a missing one (404), so ids can't be probed.

### An action

```json iwc:api
{
  "name": "checkout",
  "method": "POST",
  "path": "/checkout",
  "action": "checkout.action.iwc",
  "request": {
    "payload": {
      "items": { "type": "array", "required": true, "minItems": 1, "items": { "type": "object", "fields": { "id": { "type": "string", "required": true }, "quantity": { "type": "integer", "required": true, "min": 1 } } } },
      "address": { "type": "string", "required": true, "maxLength": 200 }
    }
  },
  "response": { "fields": { "orderId": "string", "total": "number" } },
  "security": { "auth": true, "rateLimit": "10/1m" }
}
```

The action receives the payload, the query parameters and the path parameters as `input`. Its `return` value is the response. See [actions](actions-and-workflows.md).

### A workflow transition

```json iwc:api
{
  "name": "shipOrder",
  "method": "POST",
  "path": "/orders/:id/ship",
  "workflow": "order.workflow.iwc",
  "transition": "ship",
  "security": { "auth": true, "roles": ["admin"] }
}
```

Moves record `:id` through the transition. It answers 409 if the record is not in a `from` state.

## Idempotency keys

A phone that loses its connection mid-checkout retries. With `"idempotency": "required"`, every request must carry an `Idempotency-Key` header (8–128 letters, digits, `-`, `_`; a fresh random value per operation, reused for its retries):

```json iwc:api
{
  "name": "checkout",
  "method": "POST",
  "path": "/checkout",
  "action": "checkout.action.iwc",
  "request": { "payload": { "note": { "type": "string" } } },
  "security": { "auth": true, "idempotency": "required" }
}
```

| A request with a key that… | gets |
| --- | --- |
| hasn't been used | runs; its response is stored for 24 hours |
| was used for the same request | the stored response, without running again (`Idempotent-Replayed: true`) |
| was used for a different request | `422 idempotency_key_reused` |
| belongs to a request still running | `409 request_in_progress` with `Retry-After` |
| belongs to a request whose server stopped mid-way | `409 idempotency_outcome_unknown`: check the result before retrying with a new key |

Keys are scoped to the app, the API and the signed-in user. A 5xx response isn't stored, so a retry runs again. `"optional"` applies all this only when the header is present. For operations that must never happen twice even across a server crash, also store the key on the record with a unique constraint (an order's `idempotencyKey`).

## Rate limits per user or per value

```json iwc:api
{
  "name": "otp",
  "method": "POST",
  "path": "/otp/check",
  "action": "otp.action.iwc",
  "request": { "payload": { "phone": { "type": "string", "required": true } } },
  "security": { "auth": false, "rateLimit": { "rate": "5/10m", "per": ["ip", "=input.phone"] } }
}
```

Each `per` entry is its own bucket, and all must allow the request: `ip`, `user` (signed-out callers count per IP), or an expression over `input` and `user`. Values are stored hashed, and an entry whose value is empty doesn't apply. With `"rateLimit": {"store": "database"}` in `.security.iwc`, counters live in the database, so every server instance shares them.

## Webhooks: raw body and headers

Signatures are computed over the exact bytes a provider sent, which re-encoding the parsed JSON wouldn't reproduce:

```json iwc:api
{
  "name": "paymentWebhook",
  "method": "POST",
  "path": "/webhooks/payments",
  "action": "payment-webhook.action.iwc",
  "request": {
    "rawBody": true,
    "headers": { "X-Signature": "HMAC-SHA256 of the body" },
    "payload": { "eventId": { "type": "string", "required": true }, "amountPaise": { "type": "integer", "required": true } }
  },
  "security": { "auth": false, "csrf": false }
}
```

The action receives `input.rawBody` and `input.headers['x-signature']`; they can't be supplied through the payload. Verify them with [`verifyHmacSecret`](actions-and-workflows.md#verifying-signed-webhooks), or an integration's `verifyWebhook` ([packages](integrations-and-packages.md#taking-a-payment)).

A provider's event (Stripe, Razorpay, WhatsApp…) is large, nested and differs by type. Leave `payload` out and the API accepts any body: the action then gets **only** `input.rawBody` and the declared headers, so nothing unverified becomes an input field. `verifyWebhook` returns the parsed event once the signature holds.

## Spreadsheets: CSV out and in

An API whose answer is a list can answer it as a CSV download instead of JSON:

```json iwc:api
{
  "name": "exportProducts",
  "method": "GET",
  "path": "/products.csv",
  "action": "export-products.action.iwc",
  "response": {
    "format": "csv",
    "filename": "products.csv",
    "columns": ["sku", { "field": "name", "label": "Product" }, { "field": "category.name", "label": "Category" }, { "field": "price", "label": "Price" }]
  },
  "security": { "auth": true, "permissions": ["products.export"] }
}
```

`columns` sets the order and headings (a field, or `{field, label}` with a dot path into nested values); without it every field is a column, alphabetically. A cell that a spreadsheet would run as a formula (starting `=`, `+`, `-`, `@`, a tab or a carriage return) gets a leading apostrophe, so text a visitor typed can't run in whoever opens the file. Numbers are written as numbers. An action can read up to 10,000 rows with a `query` step's `limit`.

To import, send the file's text in a JSON field (a [widget](widgets.md) can read a file the visitor picks) and parse it with `parseCsv(text, delimiter?)`: the first row names the columns, each later row becomes `{column: text}` (trimmed; blank lines skipped; at most 5,000 rows). Inside a `"transaction": true` action, one bad row rolls the whole import back:

```json iwc:step
{ "operation": "forEach", "items": "parseCsv(input.csv)", "as": "row", "steps": [
  { "operation": "require", "condition": "number(row.price) > 0", "error": "=concat('Row ', row.sku, ': the price must be positive')" },
  { "operation": "create", "resource": "product.schema.iwc", "values": { "sku": "=row.sku", "name": "=row.name", "price": "=number(row.price)" } }
] }
```

## Field specs

The same shape is used for `request.payload`, `request.query`, action `input`, event `payload` and component `props`:

```json iwc:field
{ "type": "string", "required": true, "minLength": 2, "maxLength": 80, "pattern": "^[A-Za-z ]+$", "trim": true, "description": "Display name" }
```

| Key | Meaning |
| --- | --- |
| `type` | **Required.** `string` `email` `url` `date` `datetime` `number` `integer` `boolean` `object` `array` `any` |
| `required`, `default` | |
| `min`, `max` | number bounds |
| `minLength`, `maxLength` | string length (default max 10,000) |
| `pattern` | regular expression (checked at compile time) |
| `enum` | allowed values |
| `minItems`, `maxItems`, `items` | arrays; `items` is a field spec |
| `fields` | objects: nested field specs |
| `trim` | trim strings (default `true`) |
| `nullable` | accept an explicit `null`: an optional field is cleared (a `PATCH` that sends `"note": null` empties it), and a required one may be sent as `null` |
| `description` | documentation |
| `example` | an example value for the [API documentation](#api-documentation) (never used as a value) |

Query parameters arrive as strings and are converted (`"2"` becomes `2` for an integer, `"true"` becomes `true`).

## Errors

Every error has one shape:

```json
{ "error": { "code": "validation_failed", "message": "Some fields are invalid", "fields": { "email": "is required" } } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_json`, `bad_request` | Unparseable body |
| 401 | `unauthenticated`, `invalid_credentials` | Not signed in / wrong password |
| 403 | `forbidden`, `csrf` | Missing role or access rule / missing CSRF token |
| 404 | `not_found` | No such route or row |
| 405 | `method_not_allowed` | Path exists, method doesn't |
| 409 | `conflict`, `invalid_transition` | Unique value taken, record changed, stock rule |
| 413, 415 | `too_large`, `unsupported_media_type` | Body over 1 MB / not JSON |
| 422 | `validation_failed`, `rule_failed` | Invalid input / an action's `require` failed |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | A bug or outage. The message carries a reference; the details are in the server log |

## Calling APIs

- From **forms** (`submit.api`), **buttons** (`action: "api"`) and **data sources** (`API.<name>`), IWC handles sessions and CSRF for you.
- From **other clients**: send JSON, and either a session cookie plus the `X-IWC-CSRF` header, or `Authorization: Bearer <token>` with the `token` returned by `auth.login`/`auth.register` (bearer requests need no CSRF token). Declare `token` in the login API's `response.fields` to return it. A bearer token that is expired, revoked or from another [app](multi-app.md) gets `401` with `WWW-Authenticate: Bearer error="invalid_token"`, so the client knows to sign in again.
- A client that doesn't render pages (a phone app, a script, an API-only project) gets its CSRF token from **`GET /_iwc/csrf`** → `{"csrf": "…"}`, which also sets the cookie the token pairs with. Send both on the next write, typically the sign-in. Pages on other origins can't read this response.

```bash
jar=$(mktemp); tok=$(curl -s -c $jar localhost:3000/_iwc/csrf | sed 's/.*"csrf":"\([^"]*\)".*/\1/')
curl -s -b $jar -H "X-IWC-CSRF: $tok" -H 'Content-Type: application/json' \
  -d '{"email":"maya@example.com","password":"…"}' localhost:3000/api/auth/login
```
- Every API is documented at **`/_iwc/openapi.json`** (OpenAPI 3.1) and explorable at **`/_iwc/api-docs`** in development ([below](#api-documentation)).
- A client on another origin needs that origin in `.security.iwc` `cors.origins`. It may then send `Content-Type`, `Authorization`, `X-IWC-CSRF`, `Idempotency-Key` and every header an API declares in `request.headers`, and read `Retry-After`, `Idempotent-Replayed`, `WWW-Authenticate` and `Content-Disposition` in answers.

```bash
curl -s localhost:3000/api/products?sort=-price&limit=2
```

## File uploads

```json iwc:api
{ "name": "upload", "method": "POST", "path": "/uploads", "operation": "storage.upload", "security": { "auth": true } }
```

The form (or client) sends `multipart/form-data` with the file in a field named `file`:

```json iwc:element
{ "type": "form", "inputs": [{ "name": "file", "type": "file", "label": "Photo", "accept": "image/*" }], "submit": { "api": "upload.api.iwc", "label": "Upload" } }
```

The response is `{"id", "url", "name", "mime", "size"}`; the file is served at `url` (`/_iwc/files/<id>`). The size limit and allowed types come from `app.storage`. The type is detected from the file's bytes, not its name, and scriptable types (HTML, SVG, JavaScript) are always refused.

## Versions

Two versions of an endpoint can be served side by side while clients move over:

```json iwc:api
{
  "name": "getOrderV2",
  "version": "v2",
  "method": "GET",
  "path": "/orders/:id",
  "operation": "db.get",
  "resource": "order.schema.iwc",
  "response": { "fields": { "id": "string", "status": "string", "total": "number" } },
  "security": { "auth": true }
}
```

This is `/api/v2/orders/:id`; an API without `version` keeps its plain `/api/...` address, so adding versions never moves existing clients. Mark the old one `"deprecated": true` to say so in the documentation. Forms, buttons and data sources that name a versioned API call its versioned address.

## API documentation

IWC documents every API from its definition. Nothing is written twice: the request contract, validation rules, response fields, status codes and security come from the same declarations the server enforces, and the request-body rules are produced by the very function that validates requests.

| Where | What |
| --- | --- |
| `/_iwc/api-docs` | An interactive explorer: endpoints grouped by tag, expandable details, parameter and JSON body editors prefilled with examples, **Try it out** against the running server (with your browser session, a CSRF token fetched for you, or a bearer token), and the real status, headers, body and per-field validation errors. Served in development; set `apiDocs.ui` to `always` to serve it in production |
| `/_iwc/openapi.json`, `/_iwc/openapi.yaml` | The OpenAPI 3.1 document, for Postman, client generators, gateways and contract tests. Served always unless `apiDocs.spec` says otherwise |
| `iwc make --api docs` | The same as files: `openapi.json`, `openapi.yaml` and a self-contained `index.html` ([CLI](cli-commands.md#iwc-make---api-docs)) |
| `iwc build` | `dist/openapi.json` and `dist/openapi.yaml` |

What the document says, and where it comes from:

| In the document | From |
| --- | --- |
| Path, method, path parameters, version | `path`, `method`, `version` |
| Summary, description, tags, deprecated | `summary` (default: the name), `description`, `tags` (default: the first path segment), `deprecated` |
| Query parameters and headers | `request.query` with every rule; `request.headers`; `Idempotency-Key` (required when `security.idempotency` is `required`) and `X-IWC-CSRF` where they apply |
| Request body | `request.payload`, or the body a built-in operation accepts (sign-in, password reset, two-factor…); `additionalProperties: false` because undeclared keys are refused. Uploads are `multipart/form-data`; an opaque webhook takes any body |
| Types and rules | `type`, `required` (a field with a `default` isn't), `nullable`, `default`, `enum`, `min`/`max`, `minLength`/`maxLength` (strings default to at most 10,000 characters), `pattern`, `minItems`/`maxItems`, nested `fields` and `items` |
| Success response | `response.fields` (the only fields returned), else the table's row for `db.*` operations (sensitive fields never appear), the transition result for workflows, the stored file for uploads. An action without `response.fields` is documented as having an undocumented shape: declare the fields to document it |
| Error responses | Only the answers this endpoint can give: 400/413/415 with a body, 401, 403 with roles, permissions, access rules or CSRF, 404 with an id or scope, 409 for workflows, unique values, idempotency or offline conflicts, 422, 429 with a rate limit, 500. All share the `Error` shape |
| Security | `security.auth` (session cookie or bearer token; optional sign-in listed as optional), roles and permissions (`x-iwc-roles`, `x-iwc-permissions` and in words), scopes, rate limit and cache in the description |
| Examples | `examples` when declared, else built from the rules (a declared field `example` or `default` first). `iwc make` warns when a declared request example would be refused |

Nothing secret is included: no sensitive fields, credentials, environment values, action steps or provider settings.

Configure it in `app.iwc`:

```json iwc:app
{
  "name": "Atlas",
  "apiDocs": {
    "title": "Atlas API",
    "description": "Orders, catalogue and accounts.",
    "version": "2.1.0",
    "servers": [{ "url": "https://api.atlas.example", "description": "Production" }],
    "tags": { "orders": "Placing and tracking orders" },
    "contact": { "email": "api@atlas.example" },
    "spec": "always",
    "ui": "development"
  }
}
```

`spec` and `ui` take `always`, `development` or `never`. Without `servers`, the live document lists the server that answered (with its base path) and `iwc make` uses `--server`, `seo.siteUrl` or `http://localhost:3000`.

## Common mistakes

| Message | Fix |
| --- | --- |
| `an api names exactly one of "operation", "action" or "workflow"` | A response schema alone implements nothing |
| `db.get needs an :id path parameter` | `"path": "/products/:id"` |
| `db.create is served with POST` | Match the method to the operation |
| `db.create needs a declared "request.payload"` | Only declared fields are ever written |
| `product.schema.iwc has no writable field "id"` | `id`, `createdAt`, `updatedAt` are managed |
| `field "password" is sensitive and is never returned by an api` | Remove it from `response.fields` |
| `GET apis take "query" parameters, not a payload` | |
| `"roles" requires "auth": true` | |
