# UI development: screens and elements

## .ui.iwc: a screen

**Purpose:** one page of the site, at one route.
**When:** create one file per URL pattern (`/`, `/products`, `/products/:slug`). No registration is needed.

```json iwc:ui
{
  "name": "Products",
  "route": "/products",
  "layout": "main.layout.iwc",
  "title": "All products",
  "description": "Everything we make.",
  "auth": "optional",
  "className": "page-products",
  "styleSource": "styles/products.css",
  "style": { "background": "var(--color-surface)" },
  "sections": [
    { "type": "section", "elements": [{ "type": "text", "variant": "h1", "content": "All products" }] }
  ]
}
```

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | name (letters, digits, space, `-`, `_`) | **yes** | Shown in tooling; the page title when `title` is missing |
| `route` | `/path/:param/*` | **yes** | The URL. `:name` captures a segment; `*` matches the rest. Unique across screens |
| `sections` | array of elements | **yes** | The page content, top to bottom |
| `layout` | layout file | no | The frame around the page. Without one, content goes in a bare `<main>` |
| `title` | string | no | `<title>`, through `app.head.title` (`"%s · Shop"`) |
| `description` | string | no | `<meta name="description">` (default `app.head.description`) |
| `auth` | `required` \| `optional` \| `none` | no | `required` redirects visitors who aren't signed in to the login page, with `?next=` |
| `roles` | array of role names | no | Only these roles (needs `"auth": "required"`); others get 403 |
| `className`, `style`, `styleSource` | | no | Classes, CSS and a stylesheet for the page's content wrapper |

## Elements

Everything inside `sections` is an **element**: a JSON object with a `type`. Elements nest through `elements`. The full list:

| Group | Types |
| --- | --- |
| Containers | `container` `section` `box` `row` `column` `stack` `grid` `header` `footer` `nav` `main` `aside` `sidebar` `spacer` `divider` |
| Content | `text` `image` `video` `audio` `svg` `icon` `placeholder` `badge` `rating` `review` |
| Actions | `button` `link` |
| Data | `card` `list` `table` `chart` (and any container with `data`) |
| Forms | `form` (see [forms](forms-and-validation.md)) |
| Interactive | `navbar` `dropdown` `modal` `drawer` `tabs` `accordion` `carousel` `slider` |
| Composition | `component` `slot` (see [components](component-development.md)) |

Unknown types are errors. A property that doesn't apply to a type is an error too: `"source" does not apply to text elements (it is used by: image, video, audio, svg, icon)`.

### Properties every element accepts

| Property | Type | Meaning |
| --- | --- | --- |
| `type` | one of the types above | **Required** |
| `id` | letters, digits, `-`, `_` | HTML id: the target of `open`/`close`/`toggle`/`scroll` actions and `#anchor` links |
| `className` | string | Extra CSS classes. Any token is allowed, including utility syntax (`md:grid-cols-2`) |
| `style` | `{property: value}` | CSS, camelCase or kebab-case: `{"padding": "24px", "maxWidth": "60ch"}` |
| `responsive` | `{breakpoint: style}` | CSS applied at or below a breakpoint's width: `{"mobile": {"padding": "12px"}}` |
| `states` | `{hover, focus, active}` | CSS for `:hover`, `:focus-visible`, `:active` |
| `transition` | string | CSS transition, e.g. `"transform 200ms ease"` |
| `animation` | object | Entrance animation: `name` (`fade` `fade-up` `fade-down` `slide-left` `slide-right` `zoom` `none`), `trigger` (`visible`, the default, or `load`), `duration`, `delay` (`600ms`, `1s`). Respects reduced-motion settings |
| `visible` | object | Render only for `{"auth": "signed-in"}`, `{"auth": "signed-out"}` or `{"roles": ["admin"]}`. Decided on the server: hidden elements are never sent |
| `ariaLabel` | string | Accessible name (icon-only buttons need one) |
| `tag` | HTML tag | Render a container or text as another inert tag: `ul li article figure h1–h6 nav time strong …` |
| `attributes` | `{name: value}` | Extra HTML attributes: `data-*`, `aria-*`, `role`, `title`, `lang`, `dir`, `width`, `height`, `hidden`. Others are ignored |
| `styleSource` | path | A stylesheet to include with this element |
| `data`, `item`, `empty`, `error` | | Make the element data-driven. See [data binding](data-binding.md) |

## Containers

```json iwc:element
{
  "type": "section",
  "id": "features",
  "className": "band",
  "layout": { "direction": "row", "align": "center", "justify": "between", "gap": "24px", "wrap": true },
  "responsive": { "tablet": { "flexDirection": "column" } },
  "elements": [
    { "type": "text", "variant": "h2", "content": "Features" },
    { "type": "spacer", "style": { "height": "24px" } },
    { "type": "divider" }
  ]
}
```

| Type | Renders | Notes |
| --- | --- | --- |
| `container`, `box`, `main` | `<div>` | Generic wrappers |
| `section`, `header`, `footer`, `nav`, `aside` | that tag | `nav` also takes `items` (`[{label, target}]`) and renders them as links |
| `sidebar` | `<aside>` | |
| `row` | flex row | Children side by side |
| `column`, `stack` | flex column | Children stacked |
| `grid` | CSS grid | Use `columns` |
| `spacer` | empty `<div>` | Size it with `style` |
| `divider` | `<hr>` | |

Container properties:

- **`layout`**: flexbox. `direction` (`row` `column` `row-reverse` `column-reverse`), `align` (`start` `center` `end` `stretch` `baseline`), `justify` (`start` `center` `end` `between` `around` `evenly`; note `between`, not `space-between`), `gap` (`"16px"`), `wrap` (boolean).
- **`columns`**: on any container, makes it a grid. A number is that many equal columns; a string is a CSS `grid-template-columns` (`"2fr 1fr"`).
- **`responsiveColumns`**: columns per breakpoint, `{"tablet": 2, "mobile": 1}`.
- **`gap`**: gap between grid or flex children.
- **`content`** / **`bind`**: containers may also hold text directly.

```json iwc:element
{
  "type": "grid",
  "columns": 4,
  "responsiveColumns": { "tablet": 2, "mobile": 1 },
  "gap": "24px",
  "elements": [
    { "type": "box", "className": "tile", "content": "One" },
    { "type": "box", "className": "tile", "content": "Two" },
    { "type": "box", "className": "tile", "content": "Three" },
    { "type": "box", "className": "tile", "content": "Four" }
  ]
}
```

## Text

```json iwc:element
{ "type": "text", "variant": "h1", "content": "Hello" }
```

| Property | Meaning |
| --- | --- |
| `content` | Literal text. Line breaks (`\n`) are kept. HTML is escaped, never interpreted |
| `bind` | Text from data instead: `"name"`, `"user.name"`, `"props.title"`, `"params.slug"`, `"query.q"`, `"state.cart.total"` (see [data binding](data-binding.md)) |
| `variant` | `title`→`h1`, `h1`…`h6`, `heading`→`h2`, `subheading`→`h3`, `paragraph`→`p` (default), `caption`→`small`, `label`→`span`, `span`, `eyebrow`→`p`, `quote`→`blockquote`, `code`→`pre`. Each also adds the class `iwc-text-<variant>` |
| `format` | `text` `number` (`1,234`) `currency` (`$1,234.00`) `percent` (`0.25`→`25%`) `date` (`2026-11-05`) `datetime` |
| `currency` | ISO code for `format: currency` (`USD` `EUR` `GBP` `INR` `JPY` `AUD` `CAD` have symbols; others print the code) |
| `prefix`, `suffix` | Added around the value: `"prefix": "Total: "` |

A text element needs `content` or `bind`.

```json iwc:element
{ "type": "text", "variant": "subheading", "bind": "price", "format": "currency", "currency": "EUR", "prefix": "From " }
```

## Media

```json iwc:element
{ "type": "image", "source": "/assets/hero.jpg", "alt": "A brass lamp in a reading corner", "ratio": "4/3", "fit": "cover" }
```

| Type | Properties |
| --- | --- |
| `image` | `source` (an `/assets/…` path, an `https://` URL, or a non-SVG `data:image/…`), `alt` (warning if missing), `fit` (`cover` `contain` `fill` `none`), `ratio` (`16/9`). Bound images use `"binds": {"source": "image", "alt": "name"}`. Images load lazily; `loading`: `eager` loads at once, `priority` also asks for it first (the picture visitors see first) |
| `video`, `audio` | `source`, `poster` (video), `autoplay` (also mutes, as browsers require), `loop`, `muted`, `controls` (audio shows controls unless autoplaying) |
| `svg` | `source`: an SVG file shown as an image (SVG is never inlined) |
| `icon` | `name`: one of `alert arrow-left arrow-right award basket bell book briefcase calendar camera cart chart check check-circle chevron-down chevron-left chevron-right chevron-up clock close compare copy cpu credit-card download dumbbell edit external eye file filter footprints gem gift globe grid headset heart heart-outline help home image info list lock log-out mail map-pin menu minus more package percent phone plus printer refresh search settings share shield shirt sliders sofa sort sparkles star store tag thumbs-up trash trending truck upload user users wallet x-circle zap`; or `source`: your own image file. Add `ariaLabel` if the icon carries meaning. `name` may be an expression (`"=done ? 'check' : 'package'"`); a literal name that isn't in the set is a compile error |
| `placeholder` | A neutral block for media you don't have yet |

Asset paths are checked at compile time: `asset /assets/hero.jpg not found`.

## Buttons and links

```json iwc:element
{
  "type": "row",
  "layout": { "gap": "12px" },
  "elements": [
    { "type": "button", "label": "Shop now", "action": "navigate", "target": "/products" },
    { "type": "button", "label": "Size guide", "variant": "secondary", "action": "open", "target": "size-guide" },
    { "type": "link", "label": "Read the docs", "target": "https://example.com/docs", "newTab": true }
  ]
}
```

| Property | Meaning |
| --- | --- |
| `label` | The text (or use `content`/`bind`, or child `elements` for icon buttons) |
| `variant` | Buttons: `primary` (default), `secondary`, `ghost`; any other word adds the class `iwc-button-<word>` |
| `action` | What happens on click (below). A `link` without an action just navigates to `target` |
| `target` | A route (`/products`, filled from data: `/products/:slug`), URL, `#anchor`, `mailto:`, `tel:`, or an element `id` |
| `newTab` | Open in a new tab (with `rel="noopener noreferrer"`) |
| `store`, `mutation`, `value` | For `action: "state"` |
| `api`, `value` | For `action: "api"` |

| `action` | Effect | Needs |
| --- | --- | --- |
| `navigate` | Go to `target` (renders as a real link) | `target` |
| `open` | Open the dialog/element with id `target` | `target` |
| `close` | Close it (or the dialog the button is in, without `target`) | |
| `toggle` | Open/close it | `target` |
| `scroll` | Smooth-scroll to the element with id `target` | `target` |
| `state` | Run a client-state mutation, e.g. add to cart | `store`, `mutation`, optional `value` |
| `api` | Call an API with `value` as the JSON body; on success go to `target` or show "Done", on failure show the error | `api` |
| `logout` | Sign out, then go to `target` (default `/`) | |

Links in a page are checked: a target route that no screen has is a warning; `javascript:` URLs are compile errors.

```json iwc:element
{ "type": "button", "variant": "ghost", "ariaLabel": "Remove", "action": "api", "api": "note-delete.api.iwc", "target": "/dashboard", "elements": [{ "type": "icon", "name": "trash" }] }
```

The `api` action fills `:id`-style path parameters from the current record, so a delete button inside a list deletes its own row.

## Badges, ratings and reviews

```json iwc:element
{
  "type": "column",
  "elements": [
    { "type": "badge", "content": "New" },
    { "type": "rating", "rating": 4.5 },
    { "type": "review", "rating": 5, "content": "Beautifully made.", "author": "Maya, Bristol" },
    { "type": "review", "items": [
      { "rating": 5, "content": "Worth every penny.", "author": "Tom" },
      { "rating": 4, "content": "Lovely, slow delivery.", "author": "Priya" }
    ] }
  ]
}
```

`rating` takes a number (0–5) or `bind`. `review` takes `rating`, `content` and `author` (or `binds` for each), or `items` for several.

## Cards

A card lays out a record: media, badge, title, subtitle, text, price, plus child `elements` (actions) below.

```json iwc:element
{
  "type": "card",
  "fields": { "title": "name", "subtitle": "maker", "text": "summary", "price": "price", "image": "image", "badge": "label", "link": "/products/:slug" },
  "currency": "USD",
  "elements": [{ "type": "button", "label": "Add to cart", "variant": "secondary", "action": "state", "store": "cart", "mutation": "add", "value": { "id": "item.id", "name": "item.name", "price": "item.price", "quantity": 1 } }]
}
```

Each `fields` value is a data path; `link` may be a route pattern filled from the record.

## Lists, tables and charts

```json iwc:element
{ "type": "list", "items": [{ "label": "Shipping", "target": "/help/shipping" }, { "label": "Returns", "target": "/help/returns" }, { "label": "Plain text item" }] }
```

`list` renders `<ul>`: `items` (with optional `target` links), or `elements` (each in an `<li>`), or a `data` source with an `item`.

```json iwc:element
{
  "type": "table",
  "data": { "source": "DATABASE.orders", "columns": ["total", "status", "createdAt"], "sort": { "field": "createdAt", "order": "desc" }, "limit": 20 },
  "cells": [
    { "field": "createdAt", "label": "Placed", "format": "date" },
    { "field": "status", "label": "Status" },
    { "field": "total", "label": "Total", "format": "currency" }
  ],
  "currency": "USD",
  "empty": { "type": "text", "content": "No orders yet." }
}
```

```json iwc:element
{ "type": "chart", "chart": { "kind": "bar", "x": "name", "y": "stock", "height": 220 }, "data": { "source": "DATABASE.products", "columns": ["name", "stock"] } }
```

Tables need `cells` and `data`; charts need `chart` (`kind`: `bar` or `line`, `x`, `y`, `height`) and `data`. Charts are inline SVG drawn on the server. `scale` multiplies values for display and `format`/`currency` write them (`"scale": 0.01, "format": "currency", "currency": "EUR"` shows amounts stored in cents); the top of the scale is labelled.

## Interactive elements

### navbar

```json iwc:element
{
  "type": "navbar",
  "className": "site-header",
  "opensOn": "hover",
  "collapseAt": "tablet",
  "elements": [
    { "type": "link", "label": "Brand", "target": "/", "className": "brand" },
    { "type": "link", "label": "Sign in", "target": "/login", "visible": { "auth": "signed-out" } }
  ],
  "items": [
    { "label": "Shop", "items": [
      { "label": "All", "target": "/products" },
      { "label": "Lighting", "target": "/products?category=lighting" }
    ] },
    { "label": "About", "target": "/about" }
  ]
}
```

- `elements` are always visible (brand, account, cart). `items` are the menu links. An item with its own `items` becomes a dropdown, nested to any depth.
- Below the `collapseAt` breakpoint (`mobile`, the default, or `tablet`), the links fold behind a menu button. `collapse: "all"` folds every element except the first (the brand) as well.
- `opensOn`: `click` (default) or `hover`. Hover falls back to click on touch screens.
- The link matching the current page gets `aria-current="page"`.

### dropdown

```json iwc:element
{
  "type": "dropdown",
  "label": "Account",
  "opensOn": "click",
  "items": [{ "label": "Profile", "target": "/account" }, { "label": "Orders", "target": "/account/orders" }],
  "elements": [{ "type": "button", "label": "Sign out", "variant": "ghost", "action": "logout" }]
}
```

`items` are links, and `elements` can hold anything, including whole panels for a mega menu. Escape or a click outside closes it.

### modal and drawer

```json iwc:element
{
  "type": "column",
  "elements": [
    { "type": "button", "label": "Size guide", "action": "open", "target": "size-guide" },
    { "id": "size-guide", "type": "modal", "elements": [{ "type": "text", "variant": "h3", "content": "Size guide" }, { "type": "text", "content": "Floor lamps are 150–190cm." }] },
    { "type": "button", "label": "Filters", "action": "toggle", "target": "filters" },
    { "id": "filters", "type": "drawer", "side": "right", "elements": [{ "type": "text", "content": "Filter options" }] }
  ]
}
```

Both render a native `<dialog>` with a close button; Escape closes them. `drawer` takes `side` (`left` default, `right`, `top`, `bottom`).

### tabs and accordion

```json iwc:element
{
  "type": "tabs",
  "tabs": [
    { "label": "Details", "elements": [{ "type": "text", "content": "Solid oak." }] },
    { "label": "Shipping", "elements": [{ "type": "text", "content": "Ships in 2 days." }] }
  ]
}
```

```json iwc:element
{
  "type": "accordion",
  "open": true,
  "items": [
    { "title": "Delivery", "content": "2–3 days." },
    { "title": "Returns", "elements": [{ "type": "link", "label": "Read the policy", "target": "/returns" }] }
  ]
}
```

`open: true` opens the first panel.

### carousel / slider

```json iwc:element
{
  "type": "carousel",
  "autoplay": true,
  "interval": "6s",
  "elements": [
    { "type": "image", "source": "/assets/slide-1.jpg", "alt": "Workshop" },
    { "type": "image", "source": "/assets/slide-2.jpg", "alt": "Showroom" }
  ]
}
```

Each child is a slide, with previous/next buttons and swipe. Autoplay pauses on hover and focus, and is off for visitors who prefer reduced motion. `slider` is the same element.

## A full page

See [`examples/cookbook/ui/landing.ui.iwc`](examples/cookbook/ui/landing.ui.iwc): a hero with an entrance animation, a feature grid, featured products from the database, reviews and an FAQ accordion. The store's [`ui/home.ui.iwc`](../examples/shop/ui/home.ui.iwc) adds a carousel, a modal with tabs, static and live product grids, and stats.

## Common mistakes

| Message | Cause |
| --- | --- |
| `text elements need "content" or "bind"` | A text with neither |
| `button elements need a "label"` | Give `label`, `content`, `bind` or child `elements` |
| `action "open" needs a "target"` | `open/close/toggle/scroll/navigate` need `target` |
| `"layout" must be an object, got string` | In an element, `layout` is flexbox settings. The page's layout file goes on the screen, not the element |
| `"justify" must be one of … got "space-between" (did you mean "between"?)` | Use `between`, `around`, `evenly` |
| `a list data source needs an "item" element to repeat` | Data containers need `item` (or `mode: "single"`) |
| `slot elements only appear inside components` | `slot` is for component roots |
| `image has no "alt" text` (warning) | Describe the image, or use `"alt": ""` for decoration |
