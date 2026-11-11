# Database development: .schema.iwc

**Purpose:** one database table: its fields, their validation, relations, indexes, who may read and write it, and development seed rows.
**When:** for every kind of record the app stores (users, products, orders, messages).

IWC creates and migrates the tables for you: SQLite in development (`.iwc/dev.db`), and SQLite or Postgres in production. You never write SQL.

## Structure

```json iwc:schema
{
  "name": "product",
  "description": "Things we sell.",
  "fields": {
    "name": { "type": "string", "required": true, "maxLength": 120 },
    "slug": { "type": "string", "required": true, "unique": true, "pattern": "^[a-z0-9-]+$" },
    "description": { "type": "text", "maxLength": 4000 },
    "price": { "type": "number", "required": true, "min": 0 },
    "stock": { "type": "integer", "required": true, "min": 0, "default": 0 },
    "category": { "type": "relation", "to": "category.schema.iwc", "onDelete": "set null" },
    "status": { "type": "enum", "values": ["draft", "active", "retired"], "default": "draft", "index": true },
    "featured": { "type": "boolean", "default": false },
    "specs": { "type": "json" },
    "launchDate": { "type": "date" },
    "costPrice": { "type": "number", "sensitive": true, "description": "never sent to browsers" }
  },
  "indexes": [["status", "featured"]],
  "unique": [["category", "name"]],
  "access": { "read": "public", "create": ["admin"], "update": ["admin"], "delete": ["admin"] },
  "seed": [
    { "id": "p-lamp", "name": "Desk Lamp", "slug": "desk-lamp", "price": 59, "stock": 8, "status": "active" }
  ]
}
```

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | identifier | **yes** | The schema's name (`DATABASE.product`) |
| `fields` | `{name: field}` | **yes** | The columns |
| `table` | identifier | no | Table name. Default: `name` in snake_case, pluralised (`product`→`products`, `category`→`categories`) |
| `indexes` | array of field lists | no | Extra indexes |
| `unique` | array of field lists | no | Composite unique constraints |
| `partialUnique` | array of `{fields, where}` | no | Unique only among rows meeting literal conditions (below) |
| `scopes` | `{scope: field}` | no | Which field each [scope](access-control.md#scopes-which-records) filters on |
| `timestamps` | boolean | no | `createdAt`/`updatedAt` (default `true`) |
| `owner` | field name | no | A relation to the user schema, set to the signed-in user on create (a client can never set it; an action's `create` step may name another user); enables the `owner` access rule |
| `tenant` | boolean | no | Scope every row to the user's tenant (needs `app.tenancy`) |
| `access` | `{read, create, update, delete}` | no | Who may do what through APIs and data sources (below) |
| `seed` | array of rows | no | Inserted into **empty** tables in development and tests, never in production |
| `description` | string | no | |

Every table also gets `id` (a UUID unless a seed row gives one), and `createdAt`/`updatedAt` (ISO timestamps). You can't declare these yourself.

## Field types

| `type` | Stores | Validation |
| --- | --- | --- |
| `string` | short text | `minLength`, `maxLength` (default 10,000), `pattern` |
| `text` | long text | `maxLength` (default 1,000,000) |
| `integer`, `number` | numbers | `min`, `max`; integers must be whole |
| `boolean` | true/false | |
| `email` | text | valid address; stored lowercased |
| `url` | text | http(s) only |
| `password` | a PBKDF2-SHA256 hash | at least 8 characters unless `minLength` says otherwise. Hashed on every write, including seeds; always sensitive |
| `date` | `YYYY-MM-DD` | |
| `datetime` | ISO 8601 | |
| `enum` | text | one of `values` (required for enums) |
| `relation` | the id of a row in `to` | `to` (required), `onDelete`: `cascade`, `restrict` or `set null` |
| `json` | any JSON (objects, arrays) | |
| `file` | text: a file reference such as the `url` an upload API returns | `accept`/`maxSize` are accepted but not enforced. Upload limits come from `app.storage` |

Field options for every type: `required`, `unique`, `index`, `default` (a literal, or `"now"` for datetimes), `sensitive`, `description`.

**These rules are enforced on every write**: through APIs, and also from actions, so an action can't store an invalid row either.

## Access rules

| Rule | Means |
| --- | --- |
| `"public"` | anyone |
| `"auth"` | any signed-in user |
| `"owner"` | the user in the schema's `owner` field (reads/updates/deletes are filtered to their rows) |
| `"none"` | nobody, through generic APIs and data sources (actions still can) |
| `["admin", "editor"]` | users with one of these roles (role inheritance from `.security.iwc` applies) |
| `["admin", "owner"]` | either: admins see everything, others only their own rows |
| `["admin", "self"]` | on the **user schema**: admins see every user, everyone else only their own user row (the default for reads is `"self"` alone) |

**Defaults, when `access` is omitted:** `read` is public, except on the user schema, where each user can read only themselves. `create` needs sign-in. `update` and `delete` are owner-only when the schema has an `owner`, and otherwise not allowed at all.

Rules apply to `db.*` APIs and to `DATABASE.*` data sources. **Actions** are trusted server code: they check their own `auth`/`roles`, and their reads and writes ignore row-level rules (tenancy still applies).

```json iwc:schema
{
  "name": "note",
  "fields": {
    "author": { "type": "relation", "to": "user.schema.iwc", "required": true, "onDelete": "cascade" },
    "title": { "type": "string", "required": true, "maxLength": 120 },
    "body": { "type": "text" }
  },
  "owner": "author",
  "access": { "read": "owner", "create": "auth", "update": "owner", "delete": "owner" }
}
```

With this schema, `GET /notes` style data sources show each user their own notes only, and `POST /api/notes` stores the caller as `author` whatever the body says (an `author` in the payload is rejected unless the API declares it, and is overwritten if it does).

## Sensitive fields

`password` fields and fields with `"sensitive": true` are never selected for pages, never returned by APIs, and can't be filtered, sorted or searched from a page. Each attempt is a compile error. Use them for cost prices, internal notes and tokens.

## Encrypted fields

`"encrypted": true` stores a `string`, `text`, `email`, `url`, `json`, `date` or `datetime` field as AES-256-GCM ciphertext (key: `IWC_ENCRYPTION_KEY`). Reads through IWC return the plain value; the database and its backups hold only ciphertext. Encrypted fields can't be filtered, sorted, searched, indexed or unique. Combine with `sensitive` when the value must also never reach a browser. Keys, rotation and backups: [security](security.md#encrypting-fields-at-rest).

## Relations

A relation stores the related row's `id`. Read it in a page as a plain value (`"bind": "category"` shows the id; `"filter": {"category": "cat-lighting"}` filters by it), or attach the related record with an [include](expressions.md#related-records-include) to show its name.

Writes are checked: through `db.create`/`db.update` APIs, a relation must point at a record the caller could read. In an action, it must point at a record in the caller's tenant. Otherwise the write is refused with a 422 naming the field, and "doesn't exist" and "not yours" give the same answer. This keeps a member of one tenant from linking their rows to another tenant's records, which would let that tenant's `cascade` deletes, or its `restrict` rules, reach across. Jobs and event handlers (no visitor) aren't checked.

## Unique among some rows

"At most one *active* delivery per order" is a unique constraint over the rows in some states only:

```json iwc:schema
{
  "name": "assignment",
  "fields": {
    "order": { "type": "relation", "to": "order.schema.iwc", "required": true },
    "status": { "type": "enum", "values": ["offered", "accepted", "delivered", "rejected"], "default": "offered", "required": true }
  },
  "partialUnique": [{ "fields": ["order"], "where": { "status": { "in": ["offered", "accepted"] } } }]
}
```

The database enforces it (`CREATE UNIQUE INDEX … WHERE …` on PostgreSQL and SQLite), so two concurrent writes can't both succeed: the second gets `409 conflict`. Conditions are literal values: a value, `{"in": [...]}`, `{"ne": value}`, or `null`. Changing a condition creates a new index; the old one is left until you drop it.

## Tables that point at each other

An order points at its current delivery assignment, and the assignment at its order. Such a cycle can't be created in one pass, so IWC creates the tables first and then adds the foreign key that closes the cycle (`ALTER TABLE … ADD CONSTRAINT` on PostgreSQL). SQLite can't add a foreign key to an existing table, so there that one field is checked by IWC's relation checks only. Seed rows are inserted in the order their relations need, whatever order the tables were created in.

## Seeds

```json iwc:schema
{
  "name": "user",
  "fields": {
    "name": { "type": "string", "required": true },
    "email": { "type": "email", "required": true, "unique": true },
    "password": { "type": "password", "required": true },
    "role": { "type": "enum", "values": ["customer", "admin"], "default": "customer", "required": true }
  },
  "seed": [
    { "id": "u-admin", "name": "Avery Admin", "email": "admin@example.com", "password": "admin-pass-123", "role": "admin" }
  ]
}
```

Seed rows are inserted when a table is empty, at dev start and in every test run. Give them stable `id`s so other seeds can relate to them (`"category": "cat-lighting"`). To re-seed, delete `.iwc/dev.db`.

Seeds are development fixtures: production never receives them. When the rows are part of the app itself — categories, a catalogue, the examples on the default website — add `"seedInProduction": true`. `iwc start` (and a deploy host) then inserts them into the table when it is empty, once; rows already there are never touched. Never mark test users or passwords this way.

```json iwc:schema
{
  "name": "category",
  "table": "categories",
  "fields": { "name": { "type": "string", "required": true }, "slug": { "type": "string", "required": true, "unique": true } },
  "access": { "read": "public" },
  "seedInProduction": true,
  "seed": [{ "id": "cat-lighting", "name": "Lighting", "slug": "lighting" }]
}
```

## Migrations

Whenever the project compiles (in `iwc dev`, `iwc start`, `iwc migrate`), IWC compares the schemas with the database:

| Change | Result |
| --- | --- |
| new schema | table created |
| new field | column added |
| new `index`/`unique`/`indexes` | index created |
| new **required** field without `default`, table has rows | refused, with a message: add a `default` or make it optional first |
| changed field type | refused |
| removed field or schema | left in the database (data is kept), with a note |

`iwc migrate --dry-run` prints the SQL. `iwc build` writes it per database to `dist/migrations/`. IWC refuses to migrate a database (or Postgres schema) holding tables it didn't create, so pointing at the wrong database fails safely.

## Production database

```json iwc:app
{ "name": "Shop", "database": { "url": { "env": "SHOP_DATABASE_URL" } } }
```

With this, `iwc start` reads the Postgres URL (`postgres://user:pass@host/db`) from `SHOP_DATABASE_URL` and refuses to start without it. Without `database`, production uses SQLite in the data folder. Never put a database URL in a file: the compiler rejects files that contain credentials.

## Common mistakes

| Message | Fix |
| --- | --- |
| `"id" is managed by IWC and cannot be declared` | Remove `id`/`createdAt`/`updatedAt` |
| `enum field "status" needs "values"` | |
| `relation field "category" needs "to"` | |
| `owner "author" must be a relation field to the user schema` | |
| `access "owner" needs an "owner" field on the schema` | |
| `seed row 2: unknown field "colour"` | Seed keys must be fields (or `id`) |
| `table "products" is also used by …` | Two schemas resolve to one table; set `table` |
