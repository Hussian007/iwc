# Layout development: .layout.iwc

**Purpose:** the frame shared by many screens, such as an announcement bar, header, page content, footer and sidebar.
**When:** one per distinct frame. A store typically has `main` (shop pages), `auth` (sign-in pages without navigation) and `admin` (sidebar). Screens choose one with `"layout": "main.layout.iwc"`.

## Structure

```json iwc:layout
{
  "name": "MainLayout",
  "slots": {
    "announcement": {
      "type": "container",
      "className": "announcement",
      "elements": [{ "type": "text", "variant": "span", "content": "Free shipping over $150" }]
    },
    "header": "header.component.iwc",
    "content": "PAGE_CONTENT",
    "footer": "footer.component.iwc"
  },
  "structure": {
    "header": { "position": "sticky" },
    "announcement": { "mobile": "hidden" }
  },
  "className": "site-root",
  "attributes": { "data-theme": "warm" }
}
```

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | name | **yes** | |
| `slots` | `{slotName: value}` | **yes** | The regions, **in display order**. A value is a component file, an inline element, or `"PAGE_CONTENT"`, which must appear exactly once and is where the screen's `sections` go |
| `structure` | `{slotName: options}` | no | Per-slot behaviour (below) |
| `template` | array of strings | no | CSS grid areas: each string is a row of slot names (`.` for an empty cell) |
| `style`, `className`, `styleSource`, `attributes` | | no | On the layout's root element |

Slot names are yours. Some get a semantic tag: `header`→`<header>`, `footer`→`<footer>`, `sidebar`→`<aside>`, and the `PAGE_CONTENT` slot→`<main id="iwc-main">`. Every slot also gets the class `iwc-slot-<name>` for styling. A "Skip to content" link for keyboard users is added for you.

### structure options

| Option | Values | Effect |
| --- | --- | --- |
| `position` | `normal` `sticky` `fixed` | `sticky` keeps a header in view while scrolling |
| `mobile` | `normal` `hidden` `drawer` `bottom` | Below the `mobile` breakpoint: hide the slot, turn it into a slide-in drawer (a ☰ button appears), or pin it to the bottom |
| `collapsible` | boolean | Adds a button that collapses the slot (sidebars) |
| `side` | `left` `right` | Accepted but **currently has no effect**. Place a sidebar by its order in `slots` or with `template` |
| `width` | CSS length | Fixed width, e.g. `"240px"` |
| `style` | CSS | Extra styles for the slot |

## A dashboard layout with a grid

```json iwc:layout
{
  "name": "DashboardLayout",
  "slots": {
    "header": "header.component.iwc",
    "sidebar": {
      "type": "nav",
      "className": "side-nav",
      "items": [
        { "label": "Overview", "target": "/dashboard" },
        { "label": "Products", "target": "/products" }
      ]
    },
    "content": "PAGE_CONTENT"
  },
  "template": ["header header", "sidebar content"],
  "structure": {
    "header": { "position": "sticky" },
    "sidebar": { "width": "220px", "mobile": "drawer" }
  },
  "style": { "gridTemplateColumns": "220px 1fr", "minHeight": "100vh" }
}
```

`template` names every slot it places. Size the columns with `style.gridTemplateColumns`.

## A minimal layout for sign-in pages

```json iwc:layout
{
  "name": "AuthLayout",
  "className": "auth-shell",
  "slots": {
    "brand": { "type": "link", "label": "Lumen & Oak", "target": "/" },
    "content": "PAGE_CONTENT"
  }
}
```

## References

- A string slot must be a `.component.iwc` file (or exactly `"PAGE_CONTENT"`).
- Screens refer to layouts by file name: `"layout": "auth.layout.iwc"`.

## Common mistakes

| Message | Fix |
| --- | --- |
| `a layout has exactly one slot set to "PAGE_CONTENT" (found 0)` | Add `"content": "PAGE_CONTENT"` |
| `structure names unknown slot "sidebar"` | `structure` keys must match `slots` keys |
| `template names unknown slot "nav"` | Every name in `template` must be a slot (or `.`) |
| `"header" must reference a .component.iwc file` | A string slot is a component file name |
