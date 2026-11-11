# Widgets: your own browser code

A widget is JavaScript you write (or a third-party SDK you load) behind a declared security boundary: a map, a payment form, a video player, a rich-text editor, a chart library. One `.widget.iwc` file names the script, the SDKs it needs, what it may reach, and the props pages pass in. Pages without the widget keep IWC's strict default policy.

## Install a bundled widget

```sh
iwc add @iwc/richtext        # formatting editor that stores Markdown
iwc add @iwc/map             # Leaflet + OpenStreetMap, no key needed
iwc add @iwc/stripe-payment  # Stripe Payment Element (set STRIPE_PUBLISHABLE_KEY)
iwc add @iwc/video-player    # HLS streaming (Mux, Cloudflare Stream) with hls.js
```

The files are copied into `widgets/` and become yours to change. `iwc packages` lists them.

## Write one

```json iwc:widget
{
  "name": "chart",
  "script": "widgets/chart.js",
  "sdk": [
    { "src": "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js", "integrity": "sha384-9nhczxUqK87bcKHh20fSQcTGD4qq5GhayNYSYWqwBkINBhOfQLg/P5HG5lF1urn4" }
  ],
  "props": { "points": { "type": "array", "required": true } },
  "config": { "theme": "light" }
}
```

```js
// widgets/chart.js
IWC.widget('chart', {
  mount(el, ctx) {
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    const chart = new Chart(canvas, { type: 'line', data: { datasets: [{ data: ctx.props.points }] } });
    return () => chart.destroy();          // called when the router replaces the page
  }
});
```

Use it on a page, or as a form input whose value the widget sets:

```json iwc:element
{ "type": "widget", "use": "chart.widget.iwc", "props": { "points": "=stats.weekly" } }
```

```json iwc:input
{ "name": "body", "type": "widget", "use": "richtext.widget.iwc", "label": "Body" }
```

### `ctx`

| | |
| --- | --- |
| `props` | the page's props, resolved on the server (frozen) |
| `config` | the widget's public `config` |
| `value`, `setValue(v)` | form inputs: the current value and how to change it (sent as JSON) |
| `error(msg)` | show a message under the field |
| `emit(name, detail)` | dispatches `iwc:<name>` on the element |
| `api(name, body, opts)` | calls an api the widget lists in `apis`, with the session and CSRF token; resolves to `{ok, status, body}`. A `GET` api gets `body` as its query string. `opts.params` fills `:name` path segments, `opts.key` sends an `Idempotency-Key` (reuse it to retry the same operation safely) |
| `toast`, `reduced`, `dark` | status message; reduced motion; dark mode |

### Keys

| Key | |
| --- | --- |
| `script`, `style` | the widget's code and CSS, inside the project |
| `sdk`, `stylesheets` | third-party files, loaded in order over https. Give an `integrity` hash: the browser refuses a changed file. `iwc security` flags page widgets with unpinned SDKs (Stripe.js is the usual exception) |
| `csp` | `connect`, `img`, `media`, `frame`, `font`, `worker`, `style`, `script`: origins added to the Content-Security-Policy **of the pages that show this widget only** |
| `browser` | features such as `geolocation`, `camera`, `payment`, `fullscreen` (Permissions-Policy, on those pages) |
| `isolation` | `page` (default) or `frame` |
| `props` | the props pages may pass, with types and `required`; checked at compile time |
| `config` | values sent to the browser: literals, or `{"env": "NAME", "public": true}` |
| `apis` | apis `ctx.api` may call |

## Security rules

- **No secrets reach the browser.** `config` from the environment must be marked `public`; naming an integration credential, an app secret, the database URL or IWC's own keys is a compile error, a value that looks like a known key format refuses to start, and a script containing one fails `iwc check`.
- **Page widgets are first-party code**: they run with the page's privileges, like your own JavaScript. Load third-party code you don't control with `"isolation": "frame"`: it runs in a sandboxed iframe with an opaque origin, so it can't read the page, its cookies, storage or session, and can't call your apis. It receives its props and value by `postMessage` and can only send back its value, named events and its height.
- A page whose widgets need a different policy is always loaded as a new document (a document keeps the policy it was loaded with).
- Rich text is stored as **Markdown**, and shown with `"format": "markdown"` on a text element, rendered on the server from a safe subset. No HTML from users is ever passed through.
