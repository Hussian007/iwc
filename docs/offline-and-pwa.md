# Installable apps and offline support

**Purpose:** make the web app installable (`pwa`) and make the web, Android and iOS apps work without a connection (`offline`).
**When:** people use the app on the move, in places with weak signal, or want it on their home screen.

Two capabilities, independent of each other:

| | `pwa` | `offline` |
| --- | --- | --- |
| What it gives | An installable web app: manifest, service worker, icons, splash, offline screen, cached app shell and assets, release updates, push | Offline data: stored screens and replies, a persistent queue of writes sent exactly once when the connection returns, conflict handling, sync status |
| Platforms | Web | Web, Android, iOS |
| Turn on | `iwc enable pwa` | `iwc enable offline` |

```sh
iwc enable pwa                  # installable web app
iwc enable offline              # offline data and sync (web, Android, iOS)
iwc enable pwa offline          # both
iwc enable                      # what is on
iwc disable pwa                 # turn one off
iwc enable pwa --icon /assets/icon.png
iwc push setup                      # push notifications (web and native)
```

`iwc support --pwa --offline` is accepted as the same command. `iwc enable` writes the settings into `app.iwc`, where you can see, review and adjust them; nothing else in the project changes. With only `pwa`, the app is installable and shows an offline screen when there is no network, but it stores no data; with only `offline`, the web app has the service worker and data, but browsers won't offer to install it.

## What you decide, and what IWC does

You declare three things. IWC does everything else on every platform.

1. **Which screens may be kept** (`.ui.iwc` `"offline"`). Screens opened signed out are kept by default. A screen showing a signed-in person's data is kept only when it says `"offline": "cache"`, and then privately (see [Sensitive data](#sensitive-data)). `"offline": "none"` keeps a screen off the device altogether.
2. **Which writes may wait for a connection** (`.api.iwc` `"offline": "queue"`). Every other write says it needs a connection when there is none, instead of failing or pretending.
3. **How a conflicting write is settled** (`"conflict"`), when the default (ask the person) isn't right.

```json iwc:api
{
  "name": "Update task",
  "method": "PATCH",
  "path": "/tasks/:id",
  "operation": "db.update",
  "resource": "task.schema.iwc",
  "request": { "payload": { "title": { "type": "string" }, "done": { "type": "boolean" } } },
  "offline": { "mode": "queue", "conflict": "manual", "label": "Update task" }
}
```

```json iwc:ui
{
  "name": "My tasks",
  "route": "/tasks",
  "auth": "required",
  "offline": "cache",
  "sections": [{ "type": "text", "variant": "h1", "content": "My tasks" }]
}
```

| `.api.iwc` `"offline"` | Meaning |
| --- | --- |
| `"queue"` | A write made without a connection is kept on the device and sent when it returns, exactly once |
| `"online"` | Needs a connection (the default for writes). Offline, the form says so; nothing is stored |
| `"cache"` | A `GET` reply may be shown offline (the last one received) |
| `{"mode": "queue", "conflict": …, "label": …}` | The same, with the conflict policy and the name the sync list shows (default: the api's name) |

| `"conflict"` | When the record changed on the server after the screen was opened |
| --- | --- |
| `"manual"` (default) | The write is held and marked; the person chooses **Keep mine** (write over it) or **Discard mine** |
| `"client-wins"` | Written anyway (last write wins). For things like a location ping or a counter of your own |
| `"server-wins"` | Dropped, and the person is told: "Update task was changed on the server, so your change was discarded" |

What IWC handles: the service worker and its caches, IndexedDB on the web, SQLite on Android and iOS, connectivity detection, the queue and its persistence across restarts, ordering, retries with backoff, idempotency keys, conflict detection on the server, background sync (Background Sync on the web, WorkManager on Android, `BGTaskScheduler` on iOS), the status bar and the sync list, and wiping private data on sign-out.

## Writes that are never queued

Some operations only mean something while the server answers the person. IWC refuses to queue them at compile time (`iwc check` fails with the reason), so an app can never say a payment went through while it is sitting on a phone:

- sign-in and account operations (`auth.*`: login, register, password reset, MFA…)
- uploads (`storage.*`). Queue the write that uses an uploaded file instead; files upload while online
- streaming apis and webhook-style apis (`rawBody`)
- any api whose action, directly or through `callAction`, calls `@iwc/payments` (create, capture, refund, payouts, transfers) or `@iwc/billing`. `getPayment`, `listPayments` and `verifyWebhook` are reads and don't count

```sh
✗ api/checkout.api.iwc: this api can't be queued: it calls payments.createPayment, which only the server
  can confirm while the person waits (it must never look done while offline). Leave it "online"
```

A queued write is never shown as done. Forms say *"Saved on this device. It will be sent when you're back online."* and don't follow their `success.navigate`; buttons say the same instead of *Done*. When the write reaches the server, the screen re-renders with the result.

## Exactly once

Every queued write carries an `Idempotency-Key` generated when it is made, and keeps it across retries, restarts and background syncs. Queued apis accept the header automatically (as if `security.idempotency` were `"optional"`). So:

- a reply lost on the way back (the write ran, the connection dropped) is answered from the first run when the device retries: `Idempotent-Replayed: true`, no second record
- a write interrupted mid-send (the app was killed) is sent again with the same key on the next start; if the server finished it, the stored answer comes back
- a write the server started but never finished (the server itself stopped) is answered `409 idempotency_outcome_unknown`: the device marks it **Not confirmed** and lets the person check before sending it again (with a new key)
- the browser tab and the service worker, or the app and its background task, never send the same write at the same time (they take the same lock)

For orders and payments, keep a unique constraint on your own idempotency column as well: the key protects retries for 24 hours.

## Conflicts

A queued write remembers the server time of the screen it was made on (`X-IWC-Base`). On an update or delete, the server refuses it (`409 edit_conflict`, with the current record) if the record was changed after that time, unless the api says `"client-wins"`. The check and the write are one SQL statement, so nothing can change in between. It works for `db.update` / `db.delete` apis and for `update`/`delete` steps in actions (the action's transaction rolls back). Several queued writes to the same record from the same device don't conflict with each other: after the first is sent, the next takes its server time as its base.

Timestamps are compared to the second on SQLite (the precision it stores) and exactly on Postgres.

## Sync status

With `offline.status` `"auto"` (the default) the app shows where it stands:

- **Offline · 2 changes waiting** while writes wait (green dot: syncing; grey: offline)
- **1 change needs your attention** for a conflict, a refused write (a validation error the server returned) or an unconfirmed one
- **You're offline · saved 10 min ago** on a stored screen

Tapping it opens **Changes on this device**: every waiting write with its state and its actions (*Keep mine*, *Discard mine*, *Send again*, *Discard*, *Send now*). A button with `"action": "sync"` opens the same list; an element with `data-iwc-sync-count` (`attributes`) shows the number waiting. On the web, `html[data-online="false"]` and `html[data-sync-pending]` are there for your CSS. Set `"status": "none"` to hide the built-in bar and place your own sync button.

```json iwc:element
{ "type": "button", "label": "Changes on this device", "action": "sync" }
```

## Sensitive data

- A signed-out screen is stored as it is (anyone can see it anyway).
- A signed-in person's screen is stored only with `"offline": "cache"`, in a separate private store tagged with an opaque per-person tag (`X-IWC-User`, a hash, never the user id). It is wiped on sign-out and when a different person signs in. On Android it is encrypted with an AES-256-GCM key held in the Android Keystore; on iOS with a key in the Keychain, in a file with data protection; on the web it is in the service worker's private cache.
- A public screen rendered for a signed-in person (it may greet them by name) is not stored.
- Writes are queued per person: a write made by one person is never sent while someone else is signed in (it waits until they sign in again).
- Schema fields marked `sensitive` are never sent to devices at all, so they can't be stored.
- `"offline": "none"` keeps any screen off the device.

## The installable web app

`iwc enable pwa` adds:

```json iwc:app
{
  "name": "Field Notes",
  "iwc": 1,
  "head": { "favicon": "/assets/icon.png" },
  "pwa": {
    "icon": "/assets/icon.png",
    "shortName": "Notes",
    "themeColor": "#5b4ff5",
    "update": "prompt",
    "shortcuts": [{ "name": "New note", "url": "/notes" }],
    "shareTarget": "/notes"
  },
  "offline": { "pages": "public" }
}
```

Every `pwa` key is optional: the names come from `app.iwc` `name`, the colours from the theme (`color-primary`, `color-background`), the icon from `head.favicon`.

| Key | Meaning |
| --- | --- |
| `name`, `shortName`, `description` | Shown by the install prompt and under the home-screen icon |
| `startUrl` | The screen the installed app opens on (default `/`) |
| `display` | `standalone` (default), `fullscreen`, `minimal-ui`, `browser` |
| `orientation` | `any`, `portrait`, `landscape` |
| `themeColor`, `backgroundColor` | The title bar and the launch splash (default: theme tokens) |
| `icon` | A square PNG of 512 px or more under `assets/` (an SVG works in Chromium browsers, but iOS needs a PNG) |
| `maskableIcon` | A PNG with its art inside the central 80%; default: `icon` on the background colour |
| `shortcuts` | Long-press shortcuts on the home-screen icon |
| `shareTarget` | The installed app appears in the system share sheet; shared text opens this screen with `?title=&text=&url=` |
| `update` | `prompt` (default): a new release shows *A new version is available — Reload*; `auto`: it takes over at the next navigation |
| `install` | The install card ([below](#the-installable-web-app)); `{"show": "off"}` turns it off |
| `push`, `vapidPublicKey` | Web push (below) |

What is served:

| Path | What |
| --- | --- |
| `/manifest.webmanifest` | The web app manifest, linked from every page with `theme-color` and the Apple home-screen tags |
| `/sw.js` | The service worker of this release |
| `/_iwc/pwa/icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png` | Drawn from `pwa.icon` at first request |
| `/_iwc/offline` | The offline screen (your own with `offline.fallback`) |

**Install.** Every PWA invites visitors to install it with a built-in card that looks like a native install sheet: the app icon, name and address, a short line, and **Install** / **Not now**. On phones it slides up from the bottom as a sheet; on wide screens it is a card in the bottom-right corner.

- In Chromium browsers (Chrome, Edge, Samsung Internet, on Android and desktop), the card appears once the browser says the app can be installed, and **Install** opens the browser's own install dialog.
- iPhone and iPad browsers have no install dialog, so there the card shows the two steps instead: *Share → Add to Home Screen*.
- It never appears in the installed app, after the app is installed, or for the snooze period after **Not now**, ✕, Escape or a declined dialog.
- Only one card is shown at a time: the [notifications card](push-notifications.md#asking-visitors) waits until the install card is gone. On an iPhone, a `notifications` button in a site that isn't on the Home Screen yet opens the install steps, because iOS only allows web push in Home Screen apps.

Every key is optional:

```json iwc:app
{
  "name": "Field Notes",
  "iwc": 1,
  "pwa": {
    "icon": "/assets/icon.png",
    "install": {
      "title": "Get the Field Notes app",
      "message": "One tap to your notes, even offline.",
      "install": "Add app",
      "later": "Maybe later",
      "delay": "10s",
      "visits": 2,
      "snooze": "14d",
      "position": "auto",
      "pages": ["/", "/notes/*"]
    }
  }
}
```

| Key | Meaning |
| --- | --- |
| `show` | `auto` (default) or `off`. With `off` there is no card: only your own buttons with `"action": "install"` offer installation |
| `title`, `message` | Default: *Install &lt;name&gt;* and `description` |
| `install`, `later` | The button labels (default *Install*, *Not now*) |
| `icon` | An image under `assets/` (default: the app icon) |
| `delay` | How long after a page loads it appears (default `4s`) |
| `visits` | Page views before it appears (default `1`) |
| `snooze` | How long *Not now* hides it (default `7d`) |
| `position` | `auto` (default: a bottom sheet on phones, a card bottom-right on wide screens), `bottom`, `bottom-left`, `bottom-right`, `top` |
| `pages` | The routes it may appear on, e.g. `["/", "/shop/*"]` (default every page) |
| `ios` | `auto` (default) shows the *Add to Home Screen* steps on iPhone and iPad; `off` doesn't show the card there |

**Your own look.** The card uses the theme's tokens (`color-surface` or `color-background`, `color-text`, `color-text-muted`, `color-border`, `color-primary`, `radius`) and the standard button styles, so it matches the app without any work. To restyle it, target its classes in your stylesheet: `.iwc-install` (the card; `[data-position]`, and `[data-ios]` on iPhone), `.iwc-install-icon`, `.iwc-install-title`, `.iwc-install-host`, `.iwc-install-message`, `.iwc-install-steps`, `.iwc-install-actions`, `.iwc-install-go`, `.iwc-install-later`, `.iwc-install-close`. Set `--iwc-install-radius` to change only its corners.

**Your own UI.** Set `"show": "off"` and place a button with `"action": "install"` wherever you like. It is hidden until the app can be installed (it gets `data-ready`), opens the browser's dialog, and on iOS opens the *Add to Home Screen* steps. The runtime also sends window events: `iwc:installable` (the browser can install the app), `iwc:install-shown`, `iwc:install-dismissed` and `iwc:installed`.

```json iwc:element
{ "type": "button", "label": "Install the app", "action": "install" }
```

Native apps never show the card or the button.

**Caching.** The service worker keeps the app shell (the offline screen and what it needs, the manifest, the icons) from the start. Runtime and stylesheet files have content-hashed names and are kept from first use; files no stored screen refers to are dropped when a new release activates. `assets/` files are shown from the cache at once and refreshed behind. Screens and api replies are fetched from the network first and taken from the store only when the network fails, or answers nothing within 4 seconds on a weak connection. A page loaded before the service worker took control hands over what it loaded, so the first visit already works offline afterwards.

**Releases.** The service worker's version is a hash of the runtime, the stylesheet, the PWA/offline settings and the icon, so every deploy that changes them ships a new one; the browser checks for it on every visit and when the app comes back to the screen.

**Push.** Run `iwc push setup`: it turns the PWA's push on (a Web Push key pair, `pwa.vapidPublicKey`, the sender), and IWC keeps the browsers that subscribe. A button with `"action": "notifications"` asks for permission and registers the browser; `push` steps send to it and `data.path` opens that screen when the notification is tapped. The whole flow, including testing from the CLI, is in [push notifications](push-notifications.md). (`iwc enable pwa --vapid --push /api/devices` still works for an app that keeps devices in its own api.)

## How it works on each platform

| | Web | Android | iOS |
| --- | --- | --- | --- |
| Stored screens | Cache Storage (service worker) | SQLite in app storage; private ones sealed with the Keystore key | SQLite in Application Support (data protection, excluded from backup); private ones sealed with a Keychain key |
| Write queue | IndexedDB, shared by the page and the service worker | SQLite | SQLite |
| Connection | `online`/`offline` events and failed requests | `ConnectivityManager` callbacks and failed requests | `NWPathMonitor` and failed requests |
| Sync while closed | Background Sync (Chromium), else on the next visit | WorkManager (network constraint, exponential backoff) | `BGProcessingTask` (needs network), else on the next launch |
| One sender | Web Locks | a mutex in the process (the worker and the app share it) | an actor |
| Sync status | Floating status button and dialog | Status bar under the system bar and a bottom sheet | Status bar and a sheet |

The server side is the same for all three: `X-IWC-Offline` / `X-IWC-Offline-Max-Age` / `X-IWC-User` say what a device may keep, `X-IWC-Base` carries a queued write's base time, `X-IWC-Time` stamps replies, and `GET /_iwc/csrf` also returns the person's offline tag so a background sync knows whose writes it may send.

Android ends background work for an app the person **force-stops** (Settings → Force stop): its waiting writes are sent the next time it is opened. Swiping it away from recents doesn't stop WorkManager.

## Settings

| `app.iwc` `"offline"` | Meaning |
| --- | --- |
| `pages` | `public` (default): signed-out screens are kept, signed-in ones only with `"offline": "cache"`. `declared`: only screens with `"offline": "cache"` |
| `fallback` | Your own offline screen (a route); default: a built-in one in the theme's colours |
| `maxAge` | How long a stored screen or reply may be shown (default `7d`) |
| `status` | `auto` (default) or `none` |
| `retry` | Attempts before a write that keeps failing (5xx, 429) is shown as failed (default 8, with backoff from 2 s to 5 min) |

## Testing it

- Chrome DevTools → Application shows the manifest, the service worker, Cache Storage and IndexedDB (`iwc-offline`); Network → *Offline* takes the tab offline.
- `iwc dev` registers the service worker too, but always tries the network first, so edits show at once.
- On an emulator, airplane mode (`adb shell cmd connectivity airplane-mode enable`) takes the app offline; on the iOS simulator, stop the server to test an unreachable server.
