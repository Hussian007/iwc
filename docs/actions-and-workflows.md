# Actions, workflows, events and jobs

## .action.iwc: business logic

**Purpose:** server-side logic that is more than one table write: checkout, booking, approving, importing. An action is a list of **steps**, each one of a fixed set of operations. Nothing in an action is executed as code.
**When:** whenever an API must check rules, touch several tables, call a service, or compute values. APIs run actions (`"action": "checkout.action.iwc"`), as do jobs, events and workflow transitions.

```json iwc:action
{
  "name": "PlaceOrder",
  "description": "Prices come from the database; stock is checked and decremented atomically.",
  "auth": "required",
  "transaction": true,
  "input": {
    "items": { "type": "array", "required": true, "minItems": 1, "items": { "type": "object", "fields": { "id": { "type": "string", "required": true }, "quantity": { "type": "integer", "required": true, "min": 1 } } } },
    "address": { "type": "string", "required": true }
  },
  "steps": [
    { "operation": "set", "as": "lines", "value": [] },
    {
      "operation": "forEach", "items": "input.items", "as": "line",
      "steps": [
        { "operation": "find", "resource": "product.schema.iwc", "where": { "id": "=line.id" }, "as": "product", "required": true, "error": "A product in your cart no longer exists" },
        { "operation": "require", "condition": "product.stock >= line.quantity", "status": 409, "error": "=concat('Only ', product.stock, ' left of ', product.name)" },
        { "operation": "update", "resource": "product.schema.iwc", "where": { "id": "=product.id", "stock": { "gte": "=line.quantity" } }, "increment": { "stock": "=-line.quantity" }, "expect": 1 },
        { "operation": "set", "as": "lines", "append": { "productId": "=product.id", "price": "=product.price", "quantity": "=line.quantity" } }
      ]
    },
    { "operation": "set", "as": "total", "value": "round(sum(lines, price * quantity), 2)" },
    { "operation": "create", "resource": "order.schema.iwc", "as": "order", "values": { "items": "=lines", "total": "=total", "address": "=input.address" } },
    { "operation": "emit", "event": "order-placed.event.iwc", "payload": { "orderId": "=order.id", "email": "=user.email" } },
    { "operation": "return", "value": { "orderId": "=order.id", "total": "=total" } }
  ]
}
```

| Property | Required | Meaning |
| --- | --- | --- |
| `name` | **yes** | |
| `steps` | **yes** | The steps, in order |
| `input` | no | Field specs, validated before step 1 (the API's own payload is validated first too) |
| `auth` | no | `required` (401 when signed out), `optional`, `none` |
| `roles` | no | Required roles (needs `auth: required`); an entry may be `perm:<permission>` |
| `permissions` | no | Required [permissions](access-control.md) (any one) |
| `scope` | no | [Scope guards](access-control.md#guards-on-apis-and-actions): `{"store": "=input.storeId"}` fails with 404 unless the caller's scope includes it |
| `transaction` | no | Run every step in one database transaction: any failure undoes all writes, jobs and notifications |
| `description` | no | |

### Variables and expressions

Steps read and write named variables. At the start there are `input` (validated input: payload, query and path parameters) and `user` (the signed-in user's public fields, when signed in). Steps add more with `as`.

A string starting with `=` is an **expression**: `"=product.price * line.quantity"`. Any other string is literal. `condition`, `items` and a string `set.value` are always expressions, so they need no `=`.

| Expressions support | Examples |
| --- | --- |
| literals | `12`, `'text'`, `"text"`, `true`, `false`, `null` |
| field access | `input.address`, `order.items[0].name`, `line.quantity` |
| arithmetic | `+ - * / %` (`+` also joins text) |
| comparison | `== != < <= > >=` |
| logic | `&& \|\| !` |
| aggregates over a list (the second argument sees each item's fields) | `sum(lines, price * quantity)`, `avg(…)`, `min(…)`, `max(…)`, `count(lines, quantity > 1)`, `filter(lines, price > 10)`, `pluck(lines, name)` |
| maths | `round(x, 2)`, `floor`, `ceil`, `abs`, `number('12')` |
| text | `concat('Only ', n, ' left')`, `lower`, `upper`, `trim`, `len`, `contains(text, 'x')`, `string(x)` |
| logic helpers | `if(cond, a, b)`, `coalesce(a, b, 'default')` |
| time | `now()` (ISO UTC), `date(ts)` (`YYYY-MM-DD`) |

Expressions can't loop, define functions, or reach files or the network, and each has an evaluation budget. A syntax error is a compile error with the file position.

### Steps

| `operation` | Keys | Does |
| --- | --- | --- |
| `validate` | `condition`?, `error`, `status` | With a condition, the same as `require`. Without one, a no-op (input is already validated) |
| `require` | `condition`, `error`, `status` (default 422) | Fail unless the condition is true |
| `find` | `resource`, `where`, `as`, `required`, `sort` | One row (or `null`). With `required`, fail with 404 |
| `query` | `resource`, `where`?, `as`, `sort`, `limit` (default 500, at most 10,000), `offset`?, `total`? | A list of rows. `offset` skips rows (a number or an expression such as `"=(input.page - 1) * 24"`); `total` also stores how many rows match, ignoring `limit`/`offset`, for a pager. `sort.field` may be an expression (`"=input.sort"`) when `sort.allow` lists the fields it may choose; anything else uses `sort.default` |
| `create` | `resource`, `values`, `as`? | Insert. Sets `tenantId`, and `owner` to the signed-in user unless `values` names the owner (an action writing a row for someone else: a notification, a history entry) |
| `createMany` | `resource`, `items`, `as`, `values` | Insert one row per item of a list (up to 10,000), each validated; `as` names the item inside `values`. For snapshots, imports and copied documents past `forEach`'s 1,000 |
| `update` | `resource`, `where`, `values` and/or `increment`, `expect`, `as`? | Update matching rows. `increment` adds atomically (`"=-line.quantity"` subtracts). `expect`: fail (409) unless exactly that many rows changed. `as` gets the count |
| `delete` | `resource`, `where`, `expect`? | |
| `set` | `as`, `value` or `append` | Assign a variable, or append to a list variable |
| `forEach` | `items`, `as`, `steps` | Loop over a list (max 1,000 items) |
| `call` | `service`, `method`, `input`, `as` | Call an [external service](integrations-and-packages.md) |
| `emit` | `event`, `payload` | Fire an event |
| `enqueue` | `job`, `payload`, `delay`? | Queue a background job |
| `notify` | `to`, `subject`, `body` | Queue an email in the outbox (see the note below) |
| `push` | `to` (user ids or `"all"`) or `token`, `title`, `body`?, `path`?, `data`?, `platform`?, `as`? | Send a [push notification](push-notifications.md) to those people's devices; `as` gets `{devices, sent, failed, removed}` |
| `transition` | `workflow`, `transition`, `value` (record id), `as`? | Move a record through a workflow |
| `if` | `condition`, `then`, `else`? | Run the `then` steps when the condition is true, otherwise the `else` steps |
| `callAction` | `action`, `input`, `as`? | Run another action inside this one's transaction; its result goes in `as` (below) |
| `aggregate` | `resource`, `where`?, `groupBy`?, `measures`, `sort`?, `limit`?, `as` | Sums, counts, averages, minimums and maximums computed by the database, per group (below) |
| `return` | `value` | Stop and respond with this value (default response: `{"success": true}`) |

**Conditions in `where`.** A value is equality (`"status": "active"`), or operators: `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `contains`, and `containsAll` (every word of the text must appear, in any order: a search box). Several operators may share a field (`"price": {"gte": "=input.min", "lte": "=input.max"}`), and `"when": "=expr"` drops that field's conditions while the expression is false, so one step serves every combination of optional filters (`"rating": {"gte": "=input.rating * 10", "when": "=input.rating != null"}`). An expression with no value still matches nothing.

Besides `input`, steps can read `user` (the signed-in user), `integrations` (which [optional integrations](integrations-and-packages.md#optional-integrations) are usable), `scopes`/`can` ([access control](access-control.md)) and, for actions run by a request, `request`: `request.origin` (`https://shop.example.com`, with the app's base path), `request.host` and `request.path`, e.g. a payment `successUrl` of `"=concat(request.origin, '/orders/', order.id)"`. Jobs and event handlers have no `request`.

Every step also takes `id` (a label shown in logs and errors), `description`, and, where it can fail, `error` (the message, which may be an expression) and `status` (400–599).

`where` maps fields to values or to one operator: `{"stock": {"gte": "=line.quantity"}}`, with operators `eq ne lt lte gt gte in contains`.

**`notify` delivery:** notifications are written to an outbox and delivered by a background worker. The `iwc` CLI doesn't configure a mail transport yet, so delivery **only logs** "notification (log driver)" with the recipient and subject, in development and in production. To send real email, call an email provider's HTTP API through a [service](integrations-and-packages.md) instead.

### Errors

A failing step stops the action, rolls back its transaction, and answers with its `status` and `error`: `{"error": {"code": "conflict", "message": "Only 3 left of Oak Stool"}}`. Codes by status: 400 `bad_request`, 402 `payment_failed`, 403 `forbidden`, 404 `not_found`, 409 `conflict`, 422 `rule_failed`, 502 `upstream_failed`. Actions time out after 30 seconds.

### Branching and reuse

```json iwc:step
{ "operation": "if", "condition": "seen != null", "then": [{ "operation": "return", "value": { "duplicate": true } }], "else": [{ "operation": "set", "as": "fresh", "value": "true" }] }
```

```json iwc:step
{ "operation": "callAction", "action": "capture-payment.action.iwc", "input": { "reference": "=input.reference", "amountPaise": "=input.amountPaise" }, "as": "result" }
```

`callAction` runs another action **inside the caller's transaction**: if anything later fails, the called action's writes roll back too. When the caller has no transaction and the called action is `"transaction": true`, the called action runs in its **own** transaction: its writes commit together when it finishes (place an order, then call a payment provider outside any transaction). The called action checks its own `auth`, `roles` and `permissions` for the same visitor, and validates its `input`. Actions calling each other in a cycle are a compile error, and calls nest at most 8 deep.

### Summaries: aggregate

Totals for a report, a balance from a ledger, the value of stock on hand: the database adds them up and the action receives one row per group, however many records there are.

```json iwc:step
{ "operation": "aggregate", "resource": "sale.schema.iwc", "where": { "status": "completed", "createdAt": { "gte": "=input.from" } },
  "groupBy": ["branch", { "field": "createdAt", "bucket": "day", "as": "day" }],
  "measures": { "revenue": { "sum": "total" }, "sales": { "count": true }, "customers": { "countDistinct": "customer" } },
  "sort": { "field": "revenue", "order": "desc" }, "as": "daily" }
```

- `measures` name the values: `{"sum": field}`, `{"avg": field}`, `{"min": field}`, `{"max": field}`, `{"count": true}` (rows), `{"countDistinct": field}`. `"times": field` multiplies first, so `{"sum": "quantity", "times": "unitCost"}` is the value of stock.
- `groupBy` lists fields, or `{"field", "bucket", "as"}` to group a date or datetime by `hour`, `day`, `week` (keyed by its Monday), `month` or `year`. Datetimes are bucketed in the app's `timeZone`.
- With `groupBy`, `as` holds a list of rows (`[{"branch": "b1", "day": "2026-11-07", "revenue": 125000, …}]`, at most 5,000); without it, one row of totals. A sum or count of no rows is `0`; an average, minimum or maximum of none is `null`.
- `sort` names a group or measure. Tenancy applies, as for every action read. Sensitive and encrypted fields can't be aggregated, and every field is checked at compile time.

Sums of `integer` fields stay exact whole numbers, which is why money is best stored in minor units (cents, paise) as integers.

### Verifying signed webhooks

Payment and messaging providers sign their webhooks with a shared secret. Declare the secret in `app.iwc` (`"secrets": ["PAYMENTS_WEBHOOK_SECRET"]`, read from the environment), give the action the exact body and the signature header through the API (`request.rawBody`, `request.headers`, see [API development](api-development.md#webhooks-raw-body-and-headers)), and verify:

```json iwc:step
{ "operation": "require", "condition": "verifyHmacSecret('PAYMENTS_WEBHOOK_SECRET', input.rawBody, input.headers['x-signature'])", "status": 401, "error": "Invalid signature" }
```

`verifyHmacSecret(name, message, signature, encoding)` computes HMAC-SHA256 of the message with the named secret and compares it with the signature in constant time; `encoding` is `hex` (default, case-insensitive), `base64` or `base64url`. For a signature over a timestamp and the body, pass `input.headers['x-timestamp'] + input.rawBody`. `hmacSha256Secret(name, message, encoding)` returns the signature itself (to compare with a value from a redirect).

A secret is never a value an expression can hold, return or store: only these two functions read it, by a literal name declared in `secrets`. Using them anywhere but an action, or naming an undeclared secret, is a compile error, and production refuses to start while a declared secret is unset.

Deduplicate by the provider's event id (a unique field), and acknowledge a duplicate with success so the provider stops retrying: the `webhooks` archetype in the IWC repository is a complete example.

## .workflow.iwc: record lifecycles

**Purpose:** a state machine on a status field: which transitions exist, from which states, and who may make them.

```json iwc:workflow
{
  "name": "OrderLifecycle",
  "resource": "order.schema.iwc",
  "field": "status",
  "initial": "pending",
  "states": ["pending", "paid", "shipped", "delivered", "cancelled"],
  "transitions": [
    { "name": "pay", "from": ["pending"], "to": "paid" },
    { "name": "ship", "from": ["paid"], "to": "shipped", "roles": ["admin"], "action": "notify-shipped.action.iwc" },
    { "name": "deliver", "from": ["shipped"], "to": "delivered", "roles": ["admin"] },
    { "name": "cancel", "from": ["pending", "paid"], "to": "cancelled" }
  ]
}
```

| Property | Required | Meaning |
| --- | --- | --- |
| `name`, `resource`, `states`, `transitions` | **yes** | |
| `field` | no | The status field (default `status`); it must exist on the schema |
| `initial` | no | Documentation of the starting state (set the field's `default` to match) |
| `transitions[].name/from/to` | **yes** | `from` is a list of states |
| `transitions[].roles` | no | Who may run it |
| `transitions[].permissions` | no | [Permissions](access-control.md) that may run it (any one) |
| `transitions[].action` | no | An action run afterwards, in the same transaction, with input `{id, from, to}` |

Run a transition from an API (`"workflow": "order.workflow.iwc", "transition": "ship"`, path with `:id`) or an action step (`{"operation": "transition", …, "value": "=order.id"}`). It is an atomic compare-and-set: if the record isn't in a `from` state, or changed meanwhile, it fails with 409.

**From an API, two rules apply together.** The resource's `access.update` rule decides *which records* the caller may move: with `"update": ["admin", "owner"]`, members move only their own bookings and someone else's looks missing (404). The transition's `roles` decide *which moves* they may make: `attend` with `"roles": ["admin"]` is refused (403) to an owner. A resource whose `update` rule is `"none"` (the default without an `owner`) can't be moved through an API at all, and the compiler says so. The status change, the transition's `action` and everything that action writes commit together: if the action fails, the status is not changed. Event handlers and broadcasts the action triggers run only after that commit.

**From an action step**, the transition is trusted server code like every other action write: tenancy applies, row rules don't, and it joins the action's transaction.

## .event.iwc: something happened

```json iwc:event
{
  "name": "OrderPlaced",
  "payload": {
    "orderId": { "type": "string", "required": true },
    "email": { "type": "email", "required": true }
  },
  "handlers": [{ "job": "order-email.job.iwc" }, { "action": "update-stats.action.iwc" }],
  "broadcast": true
}
```

- `payload` is validated when emitted.
- Each handler names **one** of `action` or `job`. Job handlers are queued with the payload (inside the emitter's transaction). Action handlers run after the outermost transaction commits, also when the event is emitted from a nested action such as a transition's; their failures are logged and don't affect the emitter. If the transaction rolls back, they don't run.
- `broadcast: true` pushes the event's name to connected browsers.

## .job.iwc: background and scheduled work

```json iwc:job
{ "name": "OrderEmail", "action": "send-order-email.action.iwc", "retries": 5, "timeout": "30s" }
```

```json iwc:job
{ "name": "NightlyCleanup", "action": "cleanup.action.iwc", "schedule": { "every": "24h" } }
```

| Property | Required | Meaning |
| --- | --- | --- |
| `name`, `action` | **yes** | The action receives the payload as `input` |
| `retries` | no | 0–10 (default 3). Retries back off exponentially (2s, 4s, 8s…) |
| `timeout` | no | Per run (default 60s) |
| `schedule.every` | no | Run on an interval (`5m`, `1h`, `24h`; at least 1s) |

Jobs run with no signed-in user, so their action can't use `"auth": "required"` (a compile error). They are stored in the database, so they survive restarts, and a job queued in a rolled-back transaction never runs.

A complete chain from checkout → payment service → workflow → event → job → notification is in the store: `actions/checkout.action.iwc`, `workflows/order.workflow.iwc`, `events/order-placed.event.iwc`, `jobs/order-email.job.iwc`.
