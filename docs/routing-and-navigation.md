# Routing and navigation

## Routes

Every `.ui.iwc` file has one `route`. There is no router file.

| Route | Matches | Parameters |
| --- | --- | --- |
| `/` | the home page | |
| `/products` | exactly `/products` | |
| `/products/:slug` | `/products/oak-stool` | `slug = "oak-stool"` |
| `/account/orders/:id` | `/account/orders/42` | `id = "42"` |
| `/docs/*` | `/docs/a/b/c` | |

- Static segments win over parameters: `/products/new` is matched before `/products/:slug`, whatever the file order.
- Two screens with the same route are a compile error.
- Query strings (`?page=2&category=x`) never affect matching. Read them with `{"query": "page"}` filters or `query.page` bindings.
- Trailing slashes are ignored.

### Using parameters

```json iwc:ui
{
  "name": "Order",
  "route": "/account/orders/:id",
  "auth": "required",
  "sections": [
    {
      "type": "section",
      "data": { "source": "DATABASE.orders", "mode": "single", "columns": ["total", "status"], "filter": { "id": { "param": "id" } } },
      "elements": [
        { "type": "text", "variant": "h1", "bind": "params.id", "prefix": "Order " },
        { "type": "badge", "bind": "status" }
      ],
      "empty": { "type": "text", "content": "We couldn't find that order." }
    }
  ]
}
```

Using a parameter the route doesn't have (`{"param": "slug"}` on `/account/orders/:id`) is a compile error.

## Links

| Write | Renders |
| --- | --- |
| `{"type": "link", "label": "Shop", "target": "/products"}` | `<a href="/products">` |
| `{"type": "button", "label": "Shop", "action": "navigate", "target": "/products"}` | a button-styled `<a>` |
| `"target": "/products/:slug"` | filled from the current record: `/products/oak-stool` |
| `"target": "/products?category=:id"` | query values filled too |
| `"target": "/#faq"` / `"#faq"` | an anchor on the page (give the element `"id": "faq"`) |
| `"target": "https://…", "newTab": true` | an external link in a new tab |
| `"target": "mailto:hi@example.com"` | email / `tel:` links |

Internal targets are checked: a path no screen matches is a warning (`no screen has the route /abuot`). `javascript:`, `data:` and `vbscript:` targets are errors.

## SPA navigation

IWC apps navigate like a single-page application, with no configuration. When a visitor follows an internal link, the runtime fetches the next screen from the server — the very response a refresh of that URL returns — and swaps it into the page:

- **The document is not reloaded.** The page content, its stylesheet, `<title>` and `<meta name="description">` change. Layout slots (header, footer, sidebar) whose server HTML is unchanged stay mounted: their open state, client-state badges (a cart count) and event listeners survive. A slot that differs — the header after signing in — is replaced on its own. A screen with another layout swaps the whole body.
- **History works.** Each navigation is a `pushState` entry; back and forward restore the screen and the scroll position it was left at. Following a link to the current page replaces the entry.
- **Every URL is a real route.** A direct visit or a refresh of `/products/oak-stool?page=2` is rendered by the server, in `iwc dev` and in `iwc start` alike, so there is no client-only route to 404 and no fallback to configure.
- **Guards still run on the server.** A protected screen answers the SPA request with its redirect; the browser address becomes `/login?next=…`, and signing in returns there — all without a reload. A 403 or 500 is shown as a normal page.
- **Parameters and queries** (`/products/:slug`, `?category=lamps`) are read by the server as usual. Search and filter forms (`method="get"`) navigate the same way.
- **Scrolling and focus**: a new screen starts at the top (or at its `#anchor`); focus moves to the content and the new title is announced to screen readers. Anchors within the current screen are left to the browser.
- **Loading and errors**: the attribute `data-iwc-navigating` is set on `<html>` while a screen loads, the content gets `aria-busy`, and a progress bar appears if it takes more than 120ms. If the network fails, a message says so and the current screen stays.
- **Speed**: a screen is prefetched when the pointer rests on its link (65ms), and a click, a prefetch and a double click share one request. Only the HTML of the next screen is fetched; the runtime script and the bundled stylesheet are loaded once. Any form or API write clears prefetched screens, so nothing stale is shown.

What navigates in place: `link` elements, `button` with `"action": "navigate"`, navbar/dropdown/nav items, card links, `success.navigate` and `success.redirect` after a form, an `api` button's `target`, `logout`, and the sign-in return to `?next=`.

What loads a new document, as usual: links to other origins, `newTab` links, `mailto:`/`tel:`, modified clicks (Cmd/Ctrl/Shift, middle button), downloads, `/api/…`, `/assets/…`, `/_iwc/…` (for example the guide at `/_iwc/docs/`), files such as `.pdf`, and any link inside an element with the attribute `data-iwc-reload`:

```json iwc:element
{ "type": "link", "label": "Legacy report", "target": "/reports/2025", "attributes": { "data-iwc-reload": "" } }
```

A new release (a changed runtime script or `.state.iwc` definitions) is picked up by a normal page load on the next navigation.

To turn it off for a whole app — every link then loads a new page — set `navigation` in `app.iwc`:

```json iwc:app
{ "name": "Shop", "navigation": { "mode": "document" } }
```

`"prefetch": false` keeps SPA navigation but fetches a screen only when it is clicked; for one link, give it `"attributes": { "data-iwc-prefetch": "false" }`.

## Menus

- **navbar** with `items` (and nested `items` for dropdowns) is the main menu. It folds behind a menu button below `collapseAt`, and closes when a link in it is followed. See [UI → navbar](ui-development.md#navbar).
- **dropdown** for any small menu (account, language).
- **nav** with `items` for plain link lists (sidebars, footers, account sections).
- **list** with `items` for footer columns.

The current page's link gets `aria-current="page"` in navbars and dropdowns, so you can style it: `.iwc-navbar-links a[aria-current] { font-weight: 700 }`.

```json iwc:component
{
  "name": "AccountNav",
  "root": {
    "type": "nav",
    "className": "account-nav",
    "ariaLabel": "Account",
    "items": [
      { "label": "Overview", "target": "/account" },
      { "label": "Order history", "target": "/account/orders" }
    ]
  }
}
```

## Protected pages

```json iwc:ui
{
  "name": "Admin",
  "route": "/admin",
  "auth": "required",
  "roles": ["admin"],
  "sections": [{ "type": "text", "variant": "h1", "content": "Admin" }]
}
```

- `"auth": "required"`: visitors who aren't signed in are redirected (303) to `app.auth.loginPage` (default `/login`) with `?next=/admin`. After signing in, the login form returns them there.
- `"roles"`: signed-in users without one of the roles get a 403 page.
- Whole areas can be protected at once in a [`.security.iwc`](authentication.md#securityiwc) file: `{"path": "/admin/*", "auth": "required", "roles": ["admin"]}`.

## The 404 page

```json iwc:ui
{
  "name": "Not found",
  "route": "/not-found",
  "layout": "main.layout.iwc",
  "title": "Page not found",
  "sections": [
    { "type": "text", "variant": "title", "content": "404" },
    { "type": "button", "label": "Back to the shop", "action": "navigate", "target": "/products" }
  ]
}
```

Point `app.iwc` at it with `"notFound": "not-found.ui.iwc"`. Unknown URLs then render this screen with status 404, inside your layout. Without it, IWC shows a plain 404 page. API paths (`/api/…`) always answer JSON errors.

## Web, Android and iOS

Routes are declared once, on screens (`"route": "/products/:id"`), and every target uses them:

| | Web | Android and iOS (server-driven) |
| --- | --- | --- |
| Where routes live | Screens' `route` | The same: the app asks the server for a path (`/_iwc/view?path=…`) |
| Moving | SPA navigation with browser history | A native back stack of paths: push on tap, pop on Back or edge swipe |
| Parameters | `params.id`, `query.page` | The same, filled by the server |
| Guards | `auth`, `roles`, `.security.iwc` areas | The same checks: a guarded path answers a redirect to sign-in with `?next=` |
| Unknown paths | The 404 screen | The same 404 screen |
| Dialogs, tabs, menus | Elements on the page | Bottom sheets; pinned headers and tab bars |
| Deep links | Any URL | `links.scheme` and verified `links.hosts` open the route ([native apps](native-apps.md#links)) |
| Restoring | The browser's history | The back stack survives the system ending the app |

There is no per-platform navigation file and nothing to keep in step: a new screen is reachable on all three as soon as it exists, and an element marked `"platforms": ["web"]` (or a screen's own `platforms`) is how one target differs. Because native screens come from the server, a route added or changed on the server reaches installed apps on their next screen load, with no store release.

## Reserved paths

| Path | Used by |
| --- | --- |
| `/api/…` | your APIs |
| `/assets/…` | files in `assets/` |
| `/_iwc/…` | the runtime: styles, script, live updates, uploads (`/_iwc/files/<id>`), `/_iwc/openapi.json`, `/_iwc/health`, `/_iwc/auth/logout`, and this guide at `/_iwc/docs/` (embedded in the `iwc` binary, so it always matches the version you run) |

These are matched before screens, so a screen whose route starts with one of them is never reached. The compiler doesn't warn about this yet.
