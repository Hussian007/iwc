# Component development: .component.iwc

**Purpose:** a reusable piece of UI, such as a product card, page header, feature tile or stat box, with declared inputs (props).
**When:** as soon as the same arrangement of elements appears twice, or for anything a layout slot uses (header, footer).

## Structure

```json iwc:component
{
  "name": "ProductCard",
  "props": {
    "product": { "type": "object", "required": true, "description": "a product record" },
    "cta": { "type": "string", "default": "Add to cart" }
  },
  "root": {
    "type": "card",
    "className": "product-card",
    "fields": { "title": "props.product.name", "price": "props.product.price", "image": "props.product.image", "link": "/products/:product.slug" },
    "elements": [
      {
        "type": "button", "bind": "props.cta", "variant": "secondary",
        "action": "state", "store": "cart", "mutation": "add",
        "value": { "id": "props.product.id", "name": "props.product.name", "price": "props.product.price", "image": "props.product.image", "quantity": 1 }
      }
    ]
  },
  "styleSource": "styles/product-card.css"
}
```

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | name | **yes** | |
| `root` | element | **yes** | The one element the component renders (it can have children) |
| `props` | `{name: field}` | no | Inputs. Each is a [field spec](api-development.md#field-specs): `type`, `required`, `default`, `description`, … |
| `style`, `styleSource` | | no | CSS for the root; a stylesheet bundled with the component |

Inside the component, read props with `props.<name>` in `bind`, `binds`, `fields`, state `value`s and route targets (`/products/:product.slug` reads `props.product.slug`).

## Using a component

```json iwc:element
{ "type": "component", "use": "product-card.component.iwc", "props": { "product": { "id": "p-1", "name": "Lamp", "price": 89, "image": "/assets/lamp.svg", "slug": "lamp" }, "cta": "Buy" } }
```

Pass data from a list with `{"bind": "item"}` (the whole record) or `{"bind": "fieldName"}`:

```json iwc:element
{
  "type": "grid", "columns": 3, "gap": "24px",
  "data": { "source": "DATABASE.products", "columns": ["name", "slug", "price", "image"] },
  "item": { "type": "component", "use": "product-card.component.iwc", "props": { "product": { "bind": "item" } } }
}
```

A string prop value starting with `item.`, `props.` or `params.` is also bound: `"props": {"title": "item.name"}`.

The compiler checks every use: `product-card.component.iwc has no prop "colour"`, `product-card.component.iwc requires prop "product"`.

An instance may set `id`, `className` and `style`; these wrap the component in a `<div>` carrying them.

## Slots: passing children

A component with a `slot` element renders the instance's own `elements` there:

```json iwc:component
{
  "name": "Feature",
  "props": {
    "title": { "type": "string", "required": true },
    "text": { "type": "string" }
  },
  "root": {
    "type": "column",
    "className": "feature",
    "layout": { "direction": "column", "gap": "10px" },
    "elements": [
      { "type": "slot" },
      { "type": "text", "variant": "h4", "bind": "props.title" },
      { "type": "text", "bind": "props.text" }
    ]
  }
}
```

```json iwc:element
{ "type": "component", "use": "feature.component.iwc", "props": { "title": "Made to last", "text": "Solid wood and real brass." }, "elements": [{ "type": "icon", "name": "check" }] }
```

Slotted children see the data of the place where they were written, not the component's props.

## Nesting

Components can use other components to any depth. A component that ends up using itself (directly or through others) is a compile error: `circular component dependency: a.component.iwc → b.component.iwc → a.component.iwc`.

## Common mistakes

| Message | Fix |
| --- | --- |
| `props.title: props only exist inside components` | `props.` bindings only work in a component's `root` |
| `this component declares no prop "titel"` | Declare it in `props` (or fix the spelling) |
| `component elements need "use"` | `{"type": "component", "use": "x.component.iwc"}` |
