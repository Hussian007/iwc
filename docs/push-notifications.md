# Push notifications

Notifications that reach people when the app isn't open: in a browser (desktop and Android, and iPhone once the web app is added to the Home Screen), and in the [native Android and iOS apps](native-apps.md). IWC does the whole path:

1. **Registering.** The web app (a button with `"action": "notifications"`) and the native apps send their device token to IWC on their own. IWC keeps the devices, each one tied to the signed-in person, or to no one for a signed-out browser.
2. **Sending.** A `push` step in an action notifies a person, a list of people, everyone, or one device. IWC picks the right provider for each device (Web Push for browsers, Firebase Cloud Messaging for phones) and deletes devices that are gone.
3. **Testing.** `iwc push test` sends a real notification from your terminal, to `iwc dev` or to the deployed site.

You write no device table, no subscribe api and no sending loop.

## Set it up

```bash
iwc push setup
```

The guided setup asks only what it can't work out, and explains each answer:

| It does | Details |
| --- | --- |
| Turns push on | Adds `"push": {}` to `app.iwc` |
| Web | Makes the web app installable (`pwa`, needed for its service worker), creates a Web Push key pair in the development vault (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`), sets `pwa.vapidPublicKey`, and writes `integrations/webpush.integration.iwc`. It asks for a contact address the push services may write to (`mailto:you@example.com` or your site's `https://` address) |
| Android and iOS | Finds `google-services.json` / `GoogleService-Info.plist` (in `firebase/` or the project root) and sets `platforms.<p>.firebase`, asks for a Firebase **service account key**, checks it with Google, stores it encrypted (`PUSH_FCM_SERVICE_ACCOUNT`) and writes `integrations/fcm.integration.iwc` |
| Production | With `--target <name>` (or when you say yes), creates production keys in the vault and writes them into the server's `settings.env`: on cPanel through cPanel's API, on an SSH server with `iwc server env`. Other settings in the file are kept |

Without a terminal (CI), give the answers as flags:

```bash
iwc push setup --web --subject mailto:ops@example.com --yes
iwc push setup --android --ios --service-account ~/keys/firebase-adminsdk.json
iwc push setup --target prod          # production keys onto the deploy target
```

`iwc push` alone shows what is set up and the command that fixes anything missing:

```text
Web (browsers and installed web apps)
  ✓ installable web app (pwa) with a service worker
  ✓ browsers register at /_iwc/push/devices (IWC keeps the devices)
  ✓ Web Push key VAPID_PUBLIC_KEY for development
  ✓ sends with webpush.integration.iwc (webpush)
  ! a button that turns notifications on ("action": "notifications")
      add one to a screen: { "type": "button", "label": "Turn on notifications", "action": "notifications" }
```

### Where the Firebase files come from

| File | Where | Used for |
| --- | --- | --- |
| `google-services.json` | Firebase console → Project settings → Your apps → the Android app | Built into the Android app |
| `GoogleService-Info.plist` | the same, the iOS app | Built into the iOS app. Also upload an **APNs key** under Cloud Messaging, and set `platforms.ios.teamId` |
| Service account key (`.json`) | Project settings → Service accounts → Generate new private key | Sending, on your server only. Never put it in the project folder: setup keeps it in the vault |

**Websites need no Firebase account or file.** Browsers deliver web push through their own push services (Chrome through Google's, which is why a subscription's address is `fcm.googleapis.com`; Firefox through Mozilla's; Safari through Apple's). IWC encrypts each message for the browser and signs it with your VAPID key pair, which plays the part a Firebase project plays for apps. Firebase is only needed for the Android and iOS apps.

## Asking visitors

With push on, IWC asks visitors by itself. A few seconds after a page loads, a card slides in:

> **Turn on notifications?**
> Get a notification from *Your App* when there's something new. You can turn it off any time.
> `Not now` `Allow`

- **Allow** opens the browser's own permission dialog and registers the device. Browsers only show that dialog after a tap (Safari refuses otherwise, and Chrome quietly blocks sites that ask unprompted), which is why the card comes first.
- **Not now** hides it for 7 days.
- It never appears again once the visitor has allowed or blocked notifications, in a browser that can't show them, or on an iPhone before the site is added to the Home Screen (there a `notifications` button opens the PWA's [*Add to Home Screen* steps](offline-and-pwa.md#the-installable-web-app) instead). It also waits while the install card is on screen.

Change any part of it in `app.iwc`:

```json
"push": {
  "prompt": {
    "title": "Get order updates",
    "message": "We'll tell you when your order ships. No spam.",
    "allow": "Yes, notify me",
    "later": "Maybe later",
    "delay": "10s",
    "visits": 2,
    "snooze": "14d",
    "position": "bottom-right",
    "pages": ["/", "/shop/*"]
  }
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `show` | `auto` | `off`: no card; only buttons ask (below) |
| `title`, `message` | *Turn on notifications?* and a sentence with the app's name | The card's text |
| `allow`, `later` | `Allow`, `Not now` | The buttons |
| `icon` | the app icon | An image under `assets/` |
| `delay` | `5s` | How long after a page loads it appears |
| `visits` | `1` | Page views before it appears (`2`: not on the first page someone sees) |
| `snooze` | `7d` | How long *Not now* hides it |
| `position` | `bottom` | `bottom`, `bottom-left`, `bottom-right` or `top` |
| `pages` | every page | Routes it may appear on; `/blog/*` covers a section |

The card uses the theme's tokens (`color-background`, `color-text`, `color-border`, `radius`) and the standard button styles, so it matches the site. For your own look, style `.iwc-push-prompt` in your stylesheet.

**A button too, or instead.** Any button can ask as well, e.g. on an account page or after an order:

```json iwc:element
{ "type": "button", "label": "Turn on notifications", "action": "notifications" }
```

The device then moves with sign-in and sign-out by itself, so a notification for a person reaches only their devices. The native apps ask for permission after sign-in, with no card needed.

## Send from your app

Use the `push` step in any action, job or event handler:

```json iwc:step
{ "operation": "push", "to": "=order.customer", "title": "Your order has shipped",
  "body": "=concat('Order ', order.number, ' is on its way')", "path": "=concat('/orders/', order.id)", "as": "sent" }
```

| Key | Meaning |
| --- | --- |
| `to` | A user id, a list of user ids (or records with an `id`), or `"all"` for every registered device, signed-out browsers included |
| `token` | One device's token instead of `to` |
| `title` | **Required.** The notification's title |
| `body` | The text under it |
| `path` | The screen a tap opens (`/orders/42`), on the web and in the native apps |
| `data` | Extra key/values delivered to the app |
| `platform` | Only `web`, `android` or `ios` devices |
| `as` | Stores `{devices, sent, failed, removed}` |

A person with no devices is not an error (`devices: 0`). A device the provider reports as gone (unsubscribed, app uninstalled) is deleted and counted in `removed`. Sends go out eight at a time, up to 5,000 devices per step. For bigger audiences, run the step in a [job](actions-and-workflows.md#jobiwc-background-and-scheduled-work).

A typical place is an event handler, so the notification goes out after the order is saved:

```json iwc:action
{
  "name": "NotifyShipped",
  "input": { "orderId": { "type": "string", "required": true } },
  "steps": [
    { "operation": "find", "resource": "order.schema.iwc", "where": { "id": "=input.orderId" }, "as": "order", "required": true },
    { "operation": "push", "to": "=order.customer", "title": "Your order has shipped", "path": "=concat('/orders/', order.id)" }
  ]
}
```

## Test from the CLI

With `iwc dev` running and notifications allowed in a browser tab:

```bash
iwc push test                                   # every registered device
iwc push test --to ann@example.com              # one person (email, sign-in identity or user id)
iwc push test --platform android --title "Hi" --body "From the terminal" --path /orders
iwc push test --token <token> --platform android  # a token copied from a device's log
iwc push devices                                # what is registered, by whom, and the senders
```

The test goes through the running app (`POST /_iwc/push/send`), with the same providers, keys and device list a `push` step uses. The output says how many devices got it, which were removed, and when a provider is only *simulated* (nothing is delivered).

Against the deployed site:

```bash
iwc push test --target prod
iwc push devices --target prod      # or --site https://example.com
```

This needs `IWC_PUSH_KEY` on the server and in your production vault. `iwc push setup --target prod` puts it in both. `iwc push key` creates or shows it (`--show`, `--rotate`). Without the key on the server, the send endpoint answers 404. Under `iwc dev`, requests from your own machine need no key.

## Production

| Secret | Holds |
| --- | --- |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | The production Web Push key pair (separate from development) |
| `PUSH_FCM_SERVICE_ACCOUNT` | The Firebase service account JSON, on one line |
| `IWC_PUSH_KEY` | Lets `iwc push test/devices --target` reach the app |

`iwc push setup --target <name>` writes them. Elsewhere, set them in the server's environment (`iwc secrets export --env production`). Changing the Web Push key later invalidates existing browser subscriptions: people need to turn notifications on again.

The device list lives in the app's database (table `_iwc_push_devices`), so it is in your [backups](cli-commands.md#backup-and-restore).

## Configuration reference

`app.iwc`:

```json
"push": { "register": "public" }
```

| Key | Meaning |
| --- | --- |
| `register` | Who may register a device: `public` (default: signed-out browsers too, for announcements to every subscriber) or `auth` (signed-in people only) |
| `prompt` | The card that asks visitors ([above](#asking-visitors)); `{"show": "off"}` turns it off |
| `web`, `android`, `ios` | The integration that sends to that platform. Default: the `@iwc/push` integration with the best provider for it (web: `webpush`; Android: `fcm`; iOS: `fcm`, then `apns`; then `onesignal` or `simulated`) |

Endpoints (all under the app's base path):

| Endpoint | Used by |
| --- | --- |
| `POST /_iwc/push/devices` `{"token", "platform"}` | The web runtime and the native apps (CSRF-protected; native apps use their bearer token). A web token must be a subscription on a browser push service (Google, Mozilla, Apple, Microsoft); any other address is refused |
| `DELETE /_iwc/push/devices` `{"token"}` | Unsubscribing |
| `POST /_iwc/push/send`, `GET /_iwc/push/devices` | `iwc push test` / `iwc push devices`, with `Authorization: Bearer $IWC_PUSH_KEY` |

### Keeping devices yourself

Setting `pwa.push` or `platforms.<p>.push` to an api of your own still works as before. The app posts `{"token", "platform"}` there, and you send with a `call` step to the `@iwc/push` integration's `send` method. Those devices are yours: `push` steps and `iwc push test` don't see them. `iwc push setup` offers to switch to the built-in list.

## Common problems

| You see | Cause |
| --- | --- |
| `Notifications are not set up for this app` | No `pwa.vapidPublicKey`, or `VAPID_PUBLIC_KEY` isn't set where the app runs (`iwc push setup`; on the server `--target`) |
| `no devices are registered` | Nobody has allowed notifications yet, or the browser blocked them (site settings → Notifications). Run `iwc push devices`: a device whose *last seen* time is older than your test isn't the browser you're looking at |
| The prompt card never appears | You already chose: it only asks visitors who haven't allowed or blocked. To see it again, reset the site's notification permission (the icon left of the address bar) and clear the site's data, or use a private window |
| `went through a simulated provider` | The integration is `simulated`: run `iwc push setup` for that platform |
| `nothing sends to android devices` | No `fcm` integration: `iwc push setup --android --service-account key.json` |
| `Sending from the CLI is off on this server` | `IWC_PUSH_KEY` isn't set on the server: `iwc push setup --target prod` |
| A notification arrives on the phone, but not in the browser tab | Browsers show web push as a system notification. Check the OS's Focus / Do Not Disturb settings |
