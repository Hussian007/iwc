# Examples

Every example here is a complete, runnable IWC project that `go test ./...` compiles and tests.

## cookbook

```bash
cd docs/examples/cookbook
iwc dev --open          # sign in as ada@example.com / ada-pass-123 (admin)
iwc validate            # 24 tests
```

| Example | Route | Files |
| --- | --- | --- |
| Landing page | `/` | `ui/landing.ui.iwc`: hero with entrance animation, feature grid, live featured products, reviews, FAQ |
| Login and registration | `/login`, `/register` | `ui/login.ui.iwc`, `ui/register.ui.iwc`, `layouts/auth.layout.iwc`, `api/login.api.iwc`, `api/register.api.iwc`, `database/user.schema.iwc` |
| Dashboard | `/dashboard` | `ui/dashboard.ui.iwc`: grid-template layout with sidebar, stat components with a slot, admin-only chart, owner-scoped notes with create/edit/delete (`ui/note.ui.iwc`, `api/note-*.api.iwc`, `database/note.schema.iwc`) |
| Product listing | `/products` | `ui/products.ui.iwc`: category filter from `?kind=`, search, pagination, reusable `components/product-card.component.iwc` |
| Product details | `/products/:slug` | `ui/product.ui.iwc`: single-record source, carousel, tabs, add to cart |
| Shopping cart | `/cart` | `ui/cart.ui.iwc` + `state/cart.state.iwc`: client-rendered lines, +/−, remove, live subtotal |
| Checkout form | `/checkout` | `ui/checkout.ui.iwc`, `api/order.api.iwc`, `actions/place-order.action.iwc`: sign-in required, sends the cart, terms checkbox, server-side pricing and stock |
| API-connected page | `/api-demo` | `ui/api-demo.ui.iwc`: an `API.` source backed by an action and an external (simulated) service, plus a `db.list` API sorted by price |

## The store

The full e-commerce demo lives in [`../../examples/shop`](../../examples/shop). Create your own copy anywhere:

```bash
iwc create my-store --template store
cd my-store && iwc dev --open
# casey@lumen.test / casey-pass-123 · admin@lumen.test / admin-pass-123
```
