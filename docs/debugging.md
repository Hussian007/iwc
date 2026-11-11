# Debugging and testing

## Reading compile errors

Every problem the compiler finds has a file, line and column, and usually a fix:

```text
✗ ui/cart.ui.iwc:19:35: error: name the list to repeat, e.g. STATE.cart.items (a store is an object, not a list)
✗ ui/home.ui.iwc:12:47: error: unknown key "contnet" in "sections[0].elements[0]" (did you mean "content"?)
✗ api/x.api.iwc:1:1: error: an api names exactly one of "operation", "action" or "workflow"
! components/header.component.iwc:23:53: warning: no screen has the route /acount
```

- **error (✗)**: the project won't run. In `iwc dev`, every page shows the errors until you save a fix.
- **warning (!)**: it runs, but something looks wrong (a link to a missing route, an image without `alt`).
- The path in quotes (`sections[0].elements[0]`) locates the element inside the file: the first section's first element.
- `iwc check --json` gives the same diagnostics as JSON, for editors and CI.

Errors in one file never hide errors in others. When a file is invalid, links to it aren't reported as missing.

## While the app runs

`iwc dev` prints one line per page and API request. A failed API call shows why:

```text
17:11:38 api  POST   /api/checkout                            422 0ms
      ↳ validation_failed: Some fields are invalid (items[0].slug is not an accepted field)
17:20:02 api  POST   /api/checkout                            409 4ms
      ↳ conflict: Only 3 left of Oak Milking Stool
17:20:09 request failed error=… path=/api/report
```

| You see | Look at |
| --- | --- |
| `422 validation_failed` | The API's `request.payload` versus what the form or client sent (names, types, undeclared keys) |
| `403 csrf` | Not sent through an IWC form/button. Send `X-IWC-CSRF` or use a bearer token |
| `401 unauthenticated` | The API or action needs sign-in |
| `403 forbidden` | `roles`, or the schema's `access` rule |
| `409 conflict` | A unique value is taken, `expect` didn't match, or a workflow transition isn't allowed from the current state |
| `422 rule_failed` | An action's `require` step: its `error` text is shown |
| `500 internal_error` | A bug or outage: the red "request failed" line above it has the cause; the browser only gets a reference |
| A page section shows "This content could not be loaded." | Its data source failed: the log line says why (often an access rule or a failing API) |

Re-read the log any time:

```bash
iwc logs           # last 200 lines, formatted
iwc logs -f        # follow
iwc logs --json | grep '"status":500'
```

### In the browser

- Pages are plain server-rendered HTML: **View Source** shows exactly what was rendered.
- Every element has a stable class (`iwc-text i3f9c…`); its generated CSS is in the page's `<style>`.
- The **Network** tab shows API calls and their JSON errors.
- Client state is in `localStorage` under `iwc:<store>` (DevTools → Application). Delete the key to empty a cart.
- Every API is described at `/_iwc/openapi.json`.

### Resetting

```bash
rm -rf .iwc        # fresh dev database (re-seeded on next start), uploads and logs
```

## Common problems

| Symptom | Cause |
| --- | --- |
| `iwc: command not found` | Open a new terminal after installing, or `source ~/.zshrc`. `iwc doctor` explains |
| `cannot listen on 127.0.0.1:3000` | Another server is running; stop it or use `--port` |
| The page shows old content after a change | The terminal shows an error, so the old build is still running; or you edited a file outside the project |
| A `state.*` value is empty | The store `name` or path is wrong, or the page has no script (check the console) |
| A cart line shows a blank name | The template binds a field the stored item doesn't have; check what the add button's `value` stores |
| Images don't load from another site | Only `https:` (or declared service origins) are allowed by the CSP |
| Dev uses the wrong database | `DATABASE_URL` is set in your shell; `iwc doctor` warns. Declare `database.url` in `app.iwc` |

## Writing tests

`.test.iwc` files are HTTP-level tests: each case sends a request and checks the response. `iwc test` runs each file against a fresh in-memory database with seed rows. Cases in a file run in order and share that database, so a case can rely on what an earlier one created.

```json iwc:test
{
  "name": "shop",
  "cases": [
    {
      "name": "home page renders live products",
      "request": { "path": "/" },
      "expect": { "status": 200, "contains": ["Featured pieces", "Arc Floor Lamp"], "excludes": ["costPrice"] }
    },
    {
      "name": "checkout needs sign-in",
      "request": { "method": "POST", "path": "/api/checkout", "body": { "items": [{ "id": "p-moon", "quantity": 1 }] } },
      "expect": { "status": 401 }
    },
    {
      "name": "checkout prices from the database",
      "as": { "email": "casey@lumen.test", "password": "casey-pass-123" },
      "request": { "method": "POST", "path": "/api/checkout", "body": { "items": [{ "id": "p-moon", "quantity": 2, "price": 0.01 }], "shipName": "Casey", "address": "1 Mill Lane", "city": "York", "postalCode": "YO1 7HH" } },
      "expect": { "status": 200, "body": { "total": 298, "orderId": "*" } }
    },
    {
      "name": "protected pages redirect",
      "request": { "path": "/account" },
      "expect": { "status": 303 }
    }
  ]
}
```

| Key | Meaning |
| --- | --- |
| `cases[].name` | Shown in the output |
| `as` | Sign in as this user first (the session is reused by later cases with the same `as`) |
| `request.method` | Default `GET` |
| `request.path` | Page or API path, with query string |
| `request.body` | JSON body. CSRF is handled for you |
| `request.headers` | Extra headers |
| `expect.status` | Exact status. Redirects are not followed, so a protected page answers `303` |
| `expect.body` | A **subset** the JSON response must contain; `"*"` matches any value, and arrays match element by element |
| `expect.contains` / `excludes` | Text the raw response must / must not contain. HTML is escaped, so `isn't` appears as `isn&#39;t` |
| `expect.order` | Texts that must appear in this order, for checking a sorted listing |

```text
$ iwc test
  ✓ shop › home page renders live products
  ✗ shop › checkout prices from the database
      body mismatch at body.total — got {"orderId":"…","status":"paid","total":310}

1 passed, 1 failed
```

Test what matters: each page renders its key content, each API accepts good input and rejects bad input, access rules hold (another user can't see or change your data), and business rules hold (stock, prices, totals). The store has 42 tests and the cookbook 24 to copy from.

Before shipping, run everything at once:

```bash
iwc validate
```
