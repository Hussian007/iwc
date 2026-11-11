# Access control: permissions and scopes

**Purpose:** decide *what* a signed-in person may do (permissions) and *which records* they may do it to (scopes), beyond one role per user.
**When:** your app has staff who work for some stores, clinics or teams and not others; administrators who should only do part of the job; or roles an administrator configures at run time.

Everything here is declared in [`.security.iwc`](authentication.md#securityiwc) and enforced on the server. Hiding a button is never the protection.

## Permissions

Declare every permission the app checks, with what it allows:

```json iwc:security
{
  "name": "Access",
  "permissions": {
    "orders.manage": "Work on a store's orders",
    "orders.read_all": "See every store's orders",
    "inventory.adjust": "Change stock levels",
    "refunds.approve": "Approve refunds"
  },
  "roles": {
    "admin": { "permissions": ["*"] },
    "manager": { "inherits": ["staff"], "permissions": ["inventory.*"] },
    "staff": { "permissions": ["orders.manage"] }
  }
}
```

A role's `permissions` may name a permission, a prefix (`inventory.*`) or everything (`*`). Inherited roles bring their permissions with them.

Require them where the work happens. Each list passes with **any one** of its entries, and when `roles` and `permissions` are both given, both must pass:

| Where | Key |
| --- | --- |
| API | `"security": {"auth": true, "permissions": ["refunds.approve"]}` |
| Action | `"permissions": ["inventory.adjust"]` |
| Workflow transition | `"permissions": ["orders.manage"]` |
| Screen | `"auth": "required", "permissions": ["reports.read"]` |
| Route area | `"routes": [{"path": "/reports/*", "auth": "required", "permissions": ["reports.read"]}]` |
| Any `roles` list | an entry `"perm:<permission>"` |

A misspelt or undeclared permission is a compile error.

## Roles and grants from the database

Two optional sources let administrators manage access at run time without a release:

```json iwc:security
{
  "name": "Grants",
  "permissions": { "refunds.approve": "Approve refunds", "support.manage": "Work on tickets" },
  "userRoles": { "schema": "user-role.schema.iwc", "user": "user", "role": "role" },
  "grants": { "schema": "role-permission.schema.iwc", "role": "role", "permission": "permission" }
}
```

- `userRoles`: rows giving a user extra roles (one row per user and role), on top of the role field of their user record.
- `grants`: rows granting a permission (or a prefix) to a role. A role may exist only in the database (`support_agent`), with only granted permissions.
- `where` (both): literal conditions a row must meet, e.g. `{"status": "active"}`.

Protect those schemas with a permission such as `roles.manage`. A user's roles and permissions are read at most once per request, and only by requests that check one.

## Scopes: which records

A scope gives each user the records their memberships name — the stores they work at:

```json iwc:security
{
  "name": "Stores",
  "scopes": {
    "store": { "schema": "store-member.schema.iwc", "user": "user", "target": "store", "where": { "status": "active" }, "bypass": ["admin"] }
  }
}
```

| Key | Meaning |
| --- | --- |
| `schema` | The membership schema |
| `user` | Its relation to the user |
| `target` | Its field holding the scoped record's id (`id` when the membership *is* the record) |
| `where` | Literal conditions a membership must meet |
| `bypass` | Roles (or `perm:<permission>`) that are in every record of the scope |

A schema says which of its fields each scope filters on, and its access rules use `scope:<name>`:

```json iwc:schema
{
  "name": "inventory",
  "fields": {
    "store": { "type": "relation", "to": "store.schema.iwc", "required": true },
    "sku": { "type": "string", "required": true },
    "available": { "type": "integer", "required": true, "min": 0 }
  },
  "scopes": { "store": "store" },
  "access": { "read": ["scope:store"], "create": ["scope:store"], "update": ["scope:store"] }
}
```

An access list passes with **any** entry: a role, `perm:<permission>` (every row), `owner` (the caller's own rows) or `scope:<name>` (rows in the caller's scope). `["owner", "scope:store", "perm:orders.read_all"]` on orders means: customers see their own, staff see their stores', support sees all.

What is enforced:

- **Reads** (`db.*` APIs and `DATABASE.*` data sources) are filtered in SQL. A record outside the scope looks exactly like a missing one (404), so ids can't be probed. Query parameters can only narrow the result, never widen it.
- **Creates** must land in one of the caller's scope records (or be their own row, when the rule also says `owner`): `403` otherwise.
- **Updates** can't move a row to a record outside the scope.
- **Workflow transitions from an API** use the resource's `access.update`, so a store manager can only move their stores' orders.

### Guards on APIs and actions

When the record comes from the URL rather than a row:

```json iwc:api
{
  "name": "adjust",
  "method": "POST",
  "path": "/stores/:storeId/adjust",
  "action": "adjust.action.iwc",
  "security": { "auth": true, "permissions": ["inventory.adjust"], "scope": { "store": "storeId" } }
}
```

The API answers `404` unless the caller's `store` scope includes the `storeId` path parameter (a query parameter or payload field works too). An action takes the same guard as an expression: `"scope": {"store": "=input.storeId"}`. Guards apply to calls made for a visitor; jobs and event handlers are trusted.

### The `scopes` variable

An action that mentions `scopes` gets each declared scope as `{all, ids}`: `scopes.store.ids` is the list of the caller's stores, `scopes.store.all` is true for a bypass role. For example `"where": {"rider": {"in": "=scopes.rider.ids"}}`.

### The `can` variable

An action that mentions `can` gets every declared permission as a boolean, for decisions inside one operation: a sale may carry a discount only for staff who hold `pos.discount`, without refusing the sale itself.

```json iwc:step
{ "operation": "require", "condition": "input.discountPct == 0 || can['pos.discount']", "status": 403, "error": "Discounts need a manager" }
```

Grants from the database and inherited roles count. Jobs and signed-out callers hold none.

## Checks at compile time

Undeclared permissions and scopes, `scope:` rules on a schema without a matching `scopes` field, missing membership fields, and API guards that read a field the API doesn't have are all errors with the file and position.

## A complete example

IWC's own test suite includes a `scoped` reference project for this pattern: two stores, managers, staff, a support agent whose role and permissions come from database rows, and 34 tests of who sees and changes what.
