# Performance and budgets

IWC renders every page on the server and sends each route **only the client code it uses**. Because a project is fully declared, the compiler knows every element a route can render (its sections, its layout and every component they use), so it never has to guess.

## What a route loads

The browser runtime is a small core plus modules:

| Module | Loaded when the route has | gzip |
| --- | --- | --- |
| core | any module below, or development mode | 1.4KB |
| `nav` | SPA navigation (`navigation.mode` is `spa`, the default) | 4.1KB |
| `state` | `bind: "state.…"`, `STATE.` sources, `action: "state"`, forms that include or change state | 2.0KB |
| `ui` | navbars, dropdowns, modals, drawers, tabs, carousels, animations, `open`/`close`/`toggle`/`scroll`/`api`/`logout` actions, drawer or collapsible layouts | 1.6KB |
| `forms` | forms | 1.3KB |
| `live` | `live` or `refresh` data | 0.9KB |

Each route gets one script file holding exactly its modules. A route with nothing interactive under `"navigation": {"mode": "document"}` gets **no script at all**. When SPA navigation reaches a screen that needs a module the current document hasn't loaded, the router fetches just that module before showing the screen.

## iwc build --report

```
$ iwc build --report
✓ built bench-catalog 1.0.0 (48b6ab157b9437d2) → dist in 11ms

  route                        runtime modules            js (gz)  css (gz) html (gz)
  /                            core+nav+state               7.0KB     3.5KB     1.5KB
  /products                    core+nav+state               7.0KB     3.5KB     1.0KB
  /products/:slug              core+nav+state               7.0KB     3.5KB     1.0KB

  html is each route's shell, without records; dist/report.json has raw sizes too.
  ✓ every route is within its budget
```

- **js**: the route's script, gzipped as served.
- **css**: the shared stylesheet (IWC's base styles, the theme, your stylesheets) plus the route's generated styles. A `*` means the stylesheet is written into the page on a first visit (below).
- **html**: the route rendered without data. Records add to it at run time, so measure real pages with the benchmark harness (`bench/`).

Every build writes `dist/report.json` with the same numbers in bytes, raw and gzipped.

## Budgets

```json iwc:app
{
  "name": "Shop",
  "performance": {
    "enforce": "error",
    "budgets": { "js": "12KB", "css": "20KB", "html": "16KB", "scripts": 1 },
    "routes": { "/checkout": { "js": "16KB" } },
    "inlineStyles": "8KB"
  }
}
```

| Property | Meaning |
| --- | --- |
| `budgets` | Limits for every route: `js`, `css`, `html` (gzipped sizes such as `12KB`, `1.5MB`, `900B`) and `scripts` (script files) |
| `routes` | Per-route overrides, keyed by route pattern |
| `enforce` | `warn` (default) prints overruns; `error` fails `iwc build`, `iwc validate` and `iwc push` |
| `inlineStyles` | The largest stylesheet (gzipped) written into the page on a first visit instead of linked. Default `8KB`; `0B` always links |

Apps without budgets get generous defaults (`js 16KB`, `css 32KB`, `html 64KB`, `scripts 1`), which flag a route only when something has grown well past normal.

## Performance defaults you get without configuring anything

- Server-side rendering of every page, with no hydration step.
- Per-route runtime modules (above), minified, gzip-precompressed and served with `immutable` caching under content-hashed names.
- Compression for HTML, JSON and CSS.
- SPA navigation that keeps persistent layouts mounted, prefetches on hover and touch, and restores scroll.
- **The stylesheet arrives with the page.** A linked stylesheet blocks the first paint for another round trip (on a slow phone network that is about half a second). When the bundled stylesheet is small (`inlineStyles`, 8KB gzipped by default) a first visit gets it inside the HTML. The router says which stylesheet the page already has (`X-IWC-Styles`), so SPA navigations get the cached link instead and don't carry the text again. Development always links it, so stylesheet edits swap in place.
- Images load lazily and decode asynchronously, except those marked `"loading": "eager"` or `"priority"` (use one of these for the picture visitors see first, usually the largest paint).
- Hover styles of buttons and menus apply only on devices that can hover (`@media (hover: hover)`), so a tap on a phone doesn't paint a hover state, and it doesn't stick after the tap.

## Measuring against other frameworks

`bench/` holds a reference catalogue app built three ways (IWC, Next.js, Angular) and a Chrome DevTools Protocol harness that measures each under the same throttled mobile and desktop conditions. `bench/REPORT.md` has the method, the numbers and what they do and don't show. Run it with `bench/run.sh`. `bench/check.sh` is the automated performance check for IWC itself.

## Not yet

- Critical-CSS extraction: a stylesheet over `inlineStyles` is linked whole (one render-blocking round trip); IWC does not split it into above-the-fold and the rest.
- Image resizing, modern formats and `srcset`.
- Streaming and deferred blocks.
