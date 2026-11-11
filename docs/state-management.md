# State management: .state.iwc

**Purpose:** data that lives in the visitor's browser, not the database, such as a shopping cart, a recently viewed list or a dismissed banner. It is updated by `state` actions, shown with `state.*` bindings and `STATE.*` lists, and can be sent to the server with a form.
**When:** for anything that should work before sign-in and changes on every click. For anything that must be trusted (prices, stock, orders), the server reads its own database: client state is only ever a request.

## Structure

```json iwc:state
{
  "name": "cart",
  "persist": "local",
  "initial": { "items": [] },
  "mutations": {
    "add": { "op": "upsert", "path": "items", "key": "id", "count": "quantity" },
    "remove": { "op": "remove", "path": "items", "key": "id" },
    "clear": { "op": "clear", "path": "items" }
  },
  "derived": {
    "count": { "sum": "items", "field": "quantity" },
    "lines": { "count": "items" },
    "total": { "sum": "items", "multiply": ["price", "quantity"] }
  }
}
```

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | identifier | **yes** | How bindings, actions and forms refer to the store (`cart`), not the file name |
| `persist` | `local` \| `session` \| `none` | no | `local`: kept across visits and tabs (tabs stay in sync); `session`: until the tab closes; `none`: until the page changes |
| `initial` | object | no | Starting value. Every mutation `path` must be declared here |
| `mutations` | `{name: mutation}` | no | The only ways the store can change |
| `derived` | `{name: computation}` | no | Values computed from lists, always up to date |

### Mutations

| `op` | Changes `path` | `value` passed by the button |
| --- | --- | --- |
| `set` | replaces it | the new value |
| `push` | appends to a list | the item |
| `upsert` | adds an item, or updates the one with the same `key`. With `count`, increments that field instead (by the value's `count` field, or 1). **A count taken to 0 or below removes the item** | the item (needs `key`) |
| `remove` | removes items whose `key` matches | the key value, or an object with it |
| `increment` | adds `by` (default 1) to a number | none |
| `clear` | resets to `initial` (the whole store if `path` is omitted) | none |

`upsert` with a negative count is how a cart's "−" button works: `{"id": "item.id", "quantity": -1}`.

### Derived values

| Form | Computes |
| --- | --- |
| `{"count": "items"}` | number of entries |
| `{"sum": "items", "field": "quantity"}` | sum of a field |
| `{"sum": "items", "multiply": ["price", "quantity"]}` | sum of products (a subtotal) |
| `{"sum": "values"}` | sum of a list of numbers |

## Using a store

**Change it** with a button or link (`action: "state"`). Values starting with `item.` or `props.` are filled from the current record when the page renders:

```json iwc:element
{ "type": "button", "label": "Add to cart", "action": "state", "store": "cart", "mutation": "add", "value": { "id": "item.id", "slug": "item.slug", "name": "item.name", "price": "item.price", "image": "item.image", "quantity": 1 } }
```

Mutations whose name contains `add`, `upsert` or `push` show a short "Added" notice.

**Show a value** anywhere, updated live:

```json iwc:element
{ "type": "text", "variant": "span", "bind": "state.cart.count", "className": "cart-count" }
```

```json iwc:element
{ "type": "text", "bind": "state.cart.total", "format": "currency", "currency": "USD", "prefix": "Subtotal: " }
```

**List it** with a `STATE.<store>.<list>` source. See [data binding → STATE lists](data-binding.md#state-lists-client-rendered). A full cart with +/− buttons: [`examples/shop/ui/cart.ui.iwc`](../examples/shop/ui/cart.ui.iwc).

**Send it** with a form: `"include": ["STATE.cart.items"]` adds the list to the request body as `items`. On success, `"mutation": "cart.clear"` empties it. See [forms](forms-and-validation.md#sending-client-state).

## Rules and limits

- A server-rendered page can't read client state, so `state.*` values appear when the page's script runs (a fraction of a second). Pick neutral empty styling, e.g. `.cart-count:empty::before { content: "0" }`.
- Derived values cover counts and sums only. There is no per-item computed value (a line total of price × quantity) and no conditional display based on state. See [limitations](limitations.md).
- The browser can change client state freely, so never trust it: the store's checkout action reads prices and stock from the database, and quantities are validated by the API.

## Common mistakes

| Message | Fix |
| --- | --- |
| `path "lines" is not declared in "initial"` | Add `"lines": []` to `initial` |
| `upsert mutations need a "key" field to identify items` | Add `"key": "id"` |
| `state store "crat" not found` | `store` and `STATE.` use the store's `name` |
| `state store "cart" has no mutation "addd"` | Check `mutations` |
| `name the list to repeat, e.g. STATE.cart.items` | A store is an object; a list source needs its path |
