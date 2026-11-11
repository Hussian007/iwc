# Styling and responsive design

IWC gives you four layers, from broadest to most specific:

1. **Theme tokens** in `app.iwc`: colours, fonts and radius as CSS variables.
2. **Stylesheets** (`styles/*.css`): plain CSS, unrestricted.
3. **Element styling** in JSON: `className`, `style`, `responsive`, `states`.
4. **Built-in element CSS**: thin defaults for layout mechanics and accessibility.

The built-in CSS sits in a CSS cascade layer (`@layer iwc`), so **any** rule you write wins over it, whatever its specificity. That cuts both ways: a broad rule like `a { color: green }` also overrides button-styled links. Prefer tokens (`color-link`) and classes.

## Theme tokens

```json iwc:app
{
  "name": "Shop",
  "theme": {
    "tokens": { "color-primary": "#4338ca", "color-on-primary": "#fff", "color-surface": "#f4f4f8", "radius": "12px", "font-body": "Inter, sans-serif", "space-section": "80px" },
    "dark": { "color-background": "#111318", "color-text": "#f3f4f6", "color-surface": "#1b1e26" },
    "fonts": [{ "family": "Inter", "google": true, "weights": [400, 600, 800] }]
  }
}
```

Use them everywhere: `"style": {"padding": "var(--space-section) 24px"}`, `.card { border-radius: var(--radius) }`. [App configuration](app-configuration.md#theme) lists the tokens the built-in elements read.

**Dark mode** is automatic when you provide `dark` overrides (they apply under the visitor's `prefers-color-scheme: dark`). Check every brand colour used *as text* on the background: dark-on-dark is the usual mistake. A good pattern is a separate ink token for that, e.g. `color-primary-ink`, lightened in `dark`.

## Stylesheets

```json iwc:app
{ "name": "Shop", "styles": ["styles/theme.css", "styles/main.css", "styles/responsive.css"] }
```

- `app.styles` load first, in order. Then every `styleSource` named by a layout, component, screen or element, once each.
- Everything is bundled into one file (`/_iwc/styles.<hash>.css`).
- In `iwc dev`, saving a `.css` file swaps the bundle without reloading the page.

### Hooks for your CSS

| Hook | Example |
| --- | --- |
| Your classes | `"className": "hero dark"` |
| Every element's type class | `.iwc-text`, `.iwc-button`, `.iwc-card`, `.iwc-navbar`, `.iwc-grid` |
| Variants | `.iwc-text-h1`, `.iwc-text-caption`, `.iwc-button-secondary` |
| Parts | `.iwc-card-media`, `.iwc-card-title`, `.iwc-card-price`, `.iwc-card-actions`, `.iwc-navbar-links`, `.iwc-dropdown-menu`, `.iwc-field`, `.iwc-field-error`, `.iwc-form-message`, `.iwc-pager`, `.iwc-search`, `.iwc-empty`, `.iwc-error` |
| Layout slots | `.iwc-slot-header`, `.iwc-slot-footer`, `.iwc-sticky` |
| States | `[aria-current="page"]`, `details[open]`, `.iwc-loading`, `[data-open]` (an open navbar), `.iwc-form-message[data-kind=error]` |
| Your attributes | `"attributes": {"data-tone": "dark"}` → `[data-tone=dark]` |

## Element styling in JSON

```json iwc:element
{
  "type": "card",
  "className": "product-card",
  "fields": { "title": "name", "image": "image" },
  "style": { "borderRadius": "var(--radius)", "background": "var(--color-surface)" },
  "states": { "hover": { "transform": "translateY(-4px)", "boxShadow": "0 18px 40px rgba(0,0,0,.12)" }, "focus": { "outline": "2px solid var(--color-primary)" } },
  "transition": "transform 200ms ease, box-shadow 200ms ease",
  "responsive": { "mobile": { "borderRadius": "0" } }
}
```

- `style` takes CSS properties in camelCase or kebab-case, and values as strings or numbers.
- Unsafe CSS (`expression(`, `javascript:`, `@import`, `</`) is dropped.
- Each element's generated CSS is scoped to that element with a unique class, emitted with the page, and protected by the CSP nonce.

## Responsive design

Breakpoints are **max-widths**: styles under `mobile` apply on screens up to 640px, `tablet` up to 1024px. Defaults are `{"mobile": 640, "tablet": 1024}`; add your own in `app.iwc` (`"breakpoints": {"wide": 1440}`). Design for desktop first, then override:

```json iwc:element
{
  "type": "section",
  "layout": { "direction": "row", "gap": "48px", "align": "center" },
  "responsive": {
    "tablet": { "flexDirection": "column", "gap": "24px", "textAlign": "center" },
    "mobile": { "padding": "32px 16px" }
  },
  "elements": [
    { "type": "text", "variant": "title", "content": "Light that feels like home." },
    { "type": "image", "source": "/assets/hero.svg", "alt": "A lamp", "style": { "maxWidth": "520px" } }
  ]
}
```

Grids change their column count with `responsiveColumns`:

```json iwc:element
{ "type": "grid", "columns": 4, "responsiveColumns": { "tablet": 2, "mobile": 1 }, "gap": "24px" }
```

Built-in responsive behaviour:

- **navbar** links fold behind a menu button below `collapseAt` (`mobile` or `tablet`).
- **layout slots**: `"mobile": "hidden" | "drawer" | "bottom"` in `structure`.
- **images and media** never overflow their container (`max-width: 100%`).
- **tables** scroll horizontally inside their wrapper on small screens.
- Text sizes are yours; use `clamp()` in CSS for fluid headings: `.iwc-text-title { font-size: clamp(2.4rem, 5vw, 4.2rem) }`.

A checklist that catches most layout bugs: view every page at 390px, 768px and 1440px wide, in light and dark mode, and confirm nothing scrolls sideways.

## Animation

```json iwc:element
{ "type": "column", "animation": { "name": "fade-up", "trigger": "visible", "duration": "700ms", "delay": "100ms" }, "elements": [{ "type": "text", "content": "Appears as it scrolls into view" }] }
```

Names: `fade`, `fade-up`, `fade-down`, `slide-left`, `slide-right`, `zoom`, `none`. `trigger: load` runs immediately. Visitors with reduced-motion settings see no movement.

## Utility frameworks

`className` accepts utility syntax (`md:grid-cols-2`, `max-w-[96rem]`, `bg-black/50`). If you compile a utility framework's CSS into `styles/`, you can use its classes. IWC doesn't run a CSS build step itself.
