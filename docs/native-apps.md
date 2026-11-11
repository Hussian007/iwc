# Native apps: Android and iOS

**Purpose:** build the same IWC project as a web app, a native Android app and a native iOS app.
**When:** you want an app in the stores as well as (or instead of) a website, from one set of `.iwc` files.

Native targets are genuine native applications. Android is drawn with **Jetpack Compose** (Kotlin), iOS with **SwiftUI** (Swift). There is no web view, React Native or Flutter layer: every build checks its output and fails if the app's code constructs a `WebView`/`WKWebView` or ships a web/JavaScript UI runtime.

This is the first phase: native targets render a deliberately small set of elements and client state. Anything else is reported as an error naming the element, never rendered in a web view behind your back. See [what native targets support](#what-native-targets-support).

## Turning targets on

`iwc create` asks which targets to include, or take them as flags:

```sh
iwc create my-app                          # asks: Web, Admin, Android, iOS
iwc create my-app --web --android --ios    # all three, no questions
```

The choice is written to `app.iwc`. Add or remove a platform there at any time:

```json iwc:app
{
  "name": "My app",
  "iwc": 1,
  "platforms": {
    "web": {},
    "android": { "id": "com.example.myapp", "minSdk": 26, "versionCode": 1 },
    "ios": { "id": "com.example.myapp", "deploymentTarget": "17.0", "build": "1" }
  }
}
```

| Key | Meaning |
| --- | --- |
| `web` | The server-rendered web app. Projects without `platforms` are web-only, as before |
| `android.id` | The application id (Play Store identity); never change it after publishing |
| `android.minSdk` | Oldest Android API level supported (default 26, Android 8.0) |
| `android.versionCode` | Raise it for every release you upload |
| `ios.id` | The bundle identifier |
| `ios.deploymentTarget` | Oldest iOS version supported (default and minimum 17.0) |
| `ios.build` | `CFBundleVersion`, raised for every upload |
| `ios.teamId` | Your Apple developer team; needed to sign device and App Store builds |

The app's version is `package.iwc`'s `version`; its name is `app.iwc`'s `name`; its icon on Android is `head.favicon` when that is an SVG under `assets/`.

## One definition, three targets

A native app is compiled from the same files as the web app:

| `.iwc` file | Web | Android | iOS |
| --- | --- | --- | --- |
| `ui/*.ui.iwc` screens | HTML pages | Compose screens | SwiftUI views |
| `layouts`, `components` | HTML around the page | inlined around each screen | inlined around each screen |
| `state/*.state.iwc` | `state.js` in the browser | the IWC Kotlin runtime | the IWC Swift runtime |
| `app.iwc` `theme.tokens` / `theme.dark` | CSS variables | Material colour scheme | SwiftUI colours (light and dark) |
| `assets/*.svg` / `.png` / `.jpg` | files | vector drawables / drawables | asset catalog images |

Client state is shared logic, not re-implemented UI: the store's definition is embedded in the app and executed by a small runtime on each platform with the same rules as the web (`set`, `push`, `upsert`, `remove`, `increment`, `clear`; derived `count` and `sum`). A button that runs `counter.increment` does the same thing everywhere:

```json iwc:element
{ "type": "button", "label": "Increment", "action": "state", "store": "counter", "mutation": "increment" }
```

```json iwc:element
{ "type": "text", "variant": "h2", "bind": "state.counter.count", "prefix": "Count: " }
```

Each platform keeps its own presentation: Android shows a Material top app bar with a back arrow and answers the system Back gesture; iOS uses a `NavigationStack` with the native back button. CSS (`className`, `styles/`) is web-only; native targets draw elements from their meaning and the theme tokens.

## Platform-specific definitions

The resolution rule, applied per file and per element:

1. A file under `platforms/<platform>/` replaces the shared file at the same path for that platform: `platforms/ios/ui/home.ui.iwc` replaces `ui/home.ui.iwc` on iOS only. A file with no shared counterpart exists only on that platform.
2. Otherwise the shared file is used.
3. An element or screen with `"platforms"` is built only for the platforms listed:

```json iwc:element
{ "type": "button", "label": "Read the documentation", "action": "navigate", "target": "/_iwc/docs/", "platforms": ["web"] }
```

```json iwc:ui
{
  "name": "Admin",
  "route": "/admin",
  "auth": "required",
  "roles": ["admin"],
  "platforms": ["web"],
  "sections": [{ "type": "text", "variant": "h1", "content": "Admin" }]
}
```

4. Whatever remains must have a native equivalent. If it doesn't, the build stops with an error naming the file, the element and the fixes (an equivalent element, a platform file, or `"platforms"`). A native target **never** falls back to a web view.

`app.iwc` and `package.iwc` can't be replaced per platform; platform settings live under `platforms` in `app.iwc`. Only `.iwc` files can be platform-specific for now.

## Commands

| Command | What it does |
| --- | --- |
| `iwc check` | Checks the web project **and** compiles it for every native target, reporting anything a native target can't render |
| `iwc build --android` | Debug APK → `build/android/<name>-debug.apk` |
| `iwc build --android --release` | Minified release APK and App Bundle (`.aab`); signed when `IWC_ANDROID_KEYSTORE`, `IWC_ANDROID_KEYSTORE_PASSWORD`, `IWC_ANDROID_KEY_ALIAS` and `IWC_ANDROID_KEY_PASSWORD` are set, unsigned otherwise |
| `iwc build --ios` | Simulator app → `build/ios/<Name>.app` |
| `iwc build --ios --release` | Device archive (`.xcarchive`); signed, plus an App Store `.ipa`, when `platforms.ios.teamId` is set |
| `iwc build --web` | The web bundle in `dist/` (as plain `iwc build`) |
| `iwc build --all` | Every target in `app.iwc` |
| `iwc dev --platform android` | Build, start an emulator if none is connected, install, launch; rebuild and relaunch on every save |
| `iwc dev --platform ios` | Build, boot (or create) an iPhone simulator, install, launch; rebuild on every save |
| `iwc test --platform android` | Run the app's smoke test on an emulator/device over adb |
| `iwc test --platform ios` | Run the same smoke test as an XCUITest in the simulator |
| `iwc doctor` | Also checks each native target's toolchain, with how to fix what's missing |

The smoke test is derived from the app definition itself: the `/` screen shows its heading and bound values; each state button changes the bound text to what the store's rules predict; each button to another screen opens it and Back returns.

The generated projects live in `.iwc/native/android` (Gradle; open it in Android Studio) and `.iwc/native/ios` (Xcode). They are rewritten on every build — change the `.iwc` files, not them.

## Toolchains

| Target | Needs |
| --- | --- |
| Android | The Android SDK with platform 36 (Android Studio installs it), a JDK 17–24, and an emulator (Android Studio → Device Manager) or a phone with USB debugging. Gradle comes with the generated project (the wrapper downloads it once) and Kotlin is a Gradle plugin, so neither is installed separately. The first build downloads Compose and its dependencies from Google's Maven repository |
| iOS | **macOS with Xcode** (16 or later) — Apple's compilers and the Simulator run nowhere else — and Xcode's iOS platform for its SDK version (Xcode → Settings → Components). Devices and the App Store also need an Apple developer team (`platforms.ios.teamId`) |

`iwc doctor` checks all of it and prints the fix for each problem.

## What native targets support

| Supported | Notes |
| --- | --- |
| `section`, `container`, `box`, `column`, `stack`, `main`, `header`, `footer`, `nav`, `aside`, `row` | Columns and rows with `layout.align`, `justify`, `gap` (px/rem) and `wrap` |
| `text` | Literal `content`, or `bind: "state.<store>.<value>"`; variants map to the platform's type scale |
| `button`, `link` | `action: "navigate"` to another screen, or to an `https:`/`mailto:`/`tel:` address (opened by the system); `action: "state"` with a literal `value` |
| `image`, `icon`, `svg` | Pictures from `assets/` (SVG converted to an Android vector drawable) |
| `spacer`, `divider`, `component` | Components are inlined; `props` work in `bind`/`=props.x` |
| `.state.iwc` | Every mutation and derived value; `persist: "local"` keeps a store across launches (SharedPreferences / UserDefaults) |

This table is for apps built **without** a `server`, whose screens are compiled into the app. A [server-driven app](#server-driven-apps) draws whatever the server renders, forms, records, sign-in and expressions included, and has the [device features](#device-features) below.

Not yet on native targets built without a server (errors, never a web view): forms, records from the server (`data`, page `data`, route parameters), sign-in, expressions other than `=props.x`, `visible`, carousels, tabs, modals and the other interactive widgets, named icons, remote images, custom fonts and inline `style`. See [limitations](limitations.md#native-apps).

## Launch screen

Every native app opens on a splash: from the tap until its first screen is drawn, so it never flashes an empty white window or a spinner. By default it is the app icon on the theme's `color-background`, with the app's name under it and a spinner at the bottom (see [Designed splash](#designed-splash)). Set your own per platform:

```json
"platforms": {
  "android": { "id": "com.example.shop", "splash": { "image": "/assets/brand/icon-1024.png", "background": "#4f46e5", "backgroundDark": "#1e1b4b" } },
  "ios": { "id": "com.example.shop", "splash": { "image": "/assets/brand/icon-1024.png", "background": "#4f46e5" } }
}
```

| Key | Meaning |
| --- | --- |
| `image` | A square PNG/JPG under `assets/` (SVG works on Android), ideally 1024 px with its own padding. Default: the app icon |
| `background` | Hex colour. Default: the theme's `color-background` |
| `backgroundDark` | Dark mode. Default: `background`, or the theme's dark `color-background` |

Android uses the system launch screen (Android 12's, backported to older versions by `androidx.core:core-splashscreen`). The picture is drawn at 136 dp, inside the circle the system masks it with. A server-driven app holds it until the first screen from the server is drawn, then fades it out; if the server can't be reached it lets go with the offline message, and never waits longer than 8 seconds. iOS gets a `UILaunchScreen` from the same colour and picture (scaled to 136 pt at build time), and the app repeats it until its first screen arrives, so the hand-over is seamless.

### Designed splash

The system launch screens only allow a colour and one small picture, shown while the app's process starts. Every app then hands over, at its first frame, to a splash it draws itself from the same colour with the picture at the same spot, so nothing jumps. Without any keys that is the picture, the app's name and a spinner; these keys design it (`"designed": false` keeps the system launch screen alone):

```json
"platforms": {
  "android": { "id": "com.example.shop", "server": "http://10.0.2.2:3000",
    "splash": {
      "image": "/assets/brand/mark.png",
      "background": "#0c831f", "gradient": "#06551a",
      "imageSize": 168,
      "title": "$name", "tagline": "Groceries in 10 minutes",
      "footer": "Fresh · Fast · Local",
      "animation": "scale", "spinner": true, "minDuration": 1200
    }
  }
}
```

| Key | Meaning |
| --- | --- |
| `gradient` | A second hex colour: the background runs from `background` (top) to it (bottom). `gradientDark` for dark mode |
| `backgroundImage` | A full-screen PNG/JPG under `assets/`, cover-fitted over the background |
| `imageSize` | The picture's side once the app takes over, 48–320 dp/pt (default 136, the launch screen's). It grows into place from 136 |
| `designed` | `false`: no app-drawn splash, only the system launch screen. Default `true` |
| `title` | A heading under the picture. `$name` is the app's name. Default `"$name"`; `""` for none |
| `tagline` | A line under the title |
| `footer` | Small text at the bottom of the screen (a company name, a version) |
| `color` | Text and spinner colour. Default: black or white, whichever reads on the background. `colorDark` for dark mode |
| `animation` | `fade` (default: texts fade in), `scale` (the picture bounces in, the splash zooms out as it goes), `slide` (texts rise in), `pulse` (the picture breathes while loading), `none` |
| `spinner` | A progress indicator while the first screen loads. Default `true`. On Android it is the platform spinner, which keeps turning on the render thread while the first screen is built |
| `minDuration` | Keep the splash up at least this many ms (0–5000, default 0). After that it goes as soon as the first screen is in |

The splash finishes arriving before the app builds its first screen under it (that first build can hold the main thread for most of a second in a debug build, which would freeze the entrance). It leaves when the first screen is drawn (server-driven apps) or after `minDuration` (built-in screens), fading out over a third of a second; it never stays more than 8 seconds past `minDuration`. Set it per platform; to share one design, put the same object under `android` and `ios`. Bad values (an unknown animation, an out-of-range size or duration, an SVG background picture) are build errors pointing at the key.

## Server-driven apps

An app whose screens read server data (records, sign-in, forms, API buttons) builds as a **server-driven** native app: set `server` on its platform.

```json
"platforms": {
  "android": { "id": "com.example.shop", "server": "http://10.0.2.2:3000", "icon": "/assets/brand/icon-1024.png" },
  "ios": { "id": "com.example.shop", "server": "http://127.0.0.1:3000", "icon": "/assets/brand/icon-1024.png" }
}
```

The server renders every screen through the same pipeline as the web (data, expressions, `visible`, access rules, sign-in) and answers `GET /_iwc/view?path=/route` with a view tree: the app's stylesheets are resolved for a phone-sized screen into plain style values. The generated app is one generic renderer, Jetpack Compose on Android and SwiftUI on iOS (never a web view), which draws the tree and runs taps natively: navigation with a back stack, API buttons with their `success` behaviour, forms with server validation, dialogs as bottom sheets, pinned headers and tab bars, `refresh` intervals, the device location input, and `phoneSignIn` (token sessions with refresh rotation). Nothing is lowered at build time, so a server change reaches installed apps on their next screen load.

A site footer is web furniture, so server-driven apps leave it out by default: the layout's `footer` slot and every `footer` element are web-only (the app has its tab bar and screens instead), with no change to the project. A footer that should appear in the app names the platform: `{ "type": "footer", "platforms": ["web", "android", "ios"], … }`. Any other element marked `"platforms": ["web"]` is left out of the view tree the same way; the web page renders all of them as before.

`IWC_NATIVE_SERVER` overrides `server` at build time. `iwc dev --android|--ios` finds this project's running `iwc dev` and builds the app for the port it really uses (it moves past 3000 when another program holds it): a `server` of `http://10.0.2.2:3000`, `http://127.0.0.1:3000` or `localhost` gets that port; any other address is kept. Plain `http` servers are for development (cleartext and App Transport Security exceptions are added only for them).

Layout the view tree carries beyond plain boxes: mixed grid tracks (`84px minmax(0, 1fr)`), equal-height grid rows, `min-height`, `max-width` (points or %), `margin-top: auto` footers, `white-space: nowrap` and one-line buttons that never wrap, and positioned children with their offsets (`right: -10%`, `left: 8px`) and translate-centring. A positioned child never sizes its box and may overflow it (clipped by the box's radius), as on the web.

A flex row that wraps keeps the browser's line breaks: an item with `flex-basis: 100%` (a phone header's search box) gets a line of its own, and `order` is applied. Native apps can't draw SVG pictures; when a screen shows `/assets/x.svg` and `/assets/x.png` exists beside it, the view tree sends the PNG (a wordmark logo's `<text>` has no vector form, so export a PNG twin at 3×).

### Status bar

The status bar (the clock, signal and battery at the top) shows the top of each screen: by default its background is the screen's pinned header colour (else the page background), and the clock and icons turn dark on a light colour and light on a dark one. A yellow header runs up under the clock, a dark one gets white icons, with nothing to set. To fix it for every screen:

```json
"android": { "id": "com.example.shop", "server": "…", "statusBar": { "background": "#fff6d6", "style": "dark" } }
```

| Key | |
| --- | --- |
| `background` | `auto` (default): each screen's top colour; or one hex colour for every screen |
| `style` | `dark` (dark clock and icons, for light backgrounds), `light` (for dark backgrounds), or `auto` (default): whichever reads on the background |

Set it per platform (`android`, `ios`). On iOS the window takes the matching appearance for the bar while screens keep their light colours.

Icons follow the web's fill: an icon with a CSS `fill` (a wishlisted heart, `.on .iwc-icon { fill: currentColor }`) is drawn solid, otherwise as an outline. A fixed-size button with centred content (a 40 px round icon button) drops side padding that would leave its icon no room — on the web the icon overflows its padding and stays centred, so it looks the same. Negative margins overlap neighbours (stacked thumbnails), as on the web. A bar pinned to the bottom with no background of its own (a floating cart pill above the tab bar) is drawn over the content, 10 points above the bars below it, instead of taking a band of its own; give the page bottom padding for it, as on the web.

A test or script can open an app straight on a screen: `adb shell am start -n <id>/.MainActivity --es path /c/fruits` on Android, `xcrun simctl launch booted <id> -iwcPath /c/fruits` on iOS.

### Phone sign-in and the Firebase SDK

`phoneSignIn` on a native screen picks its provider in this order:

1. **Development codes** under `iwc dev` with no Firebase project configured: the server issues the code and the screen shows it (see [authentication](authentication.md#development-codes)).
2. **The Firebase SDK**, when the platform sets `firebase` (below): a real SMS with Firebase's app verification.
3. **Firebase's REST API**: the Auth Emulator (`FIREBASE_AUTH_EMULATOR_HOST`) and Firebase test numbers.

```json
"android": { "id": "com.example.shop", "server": "https://shop.example.com",
             "firebase": "firebase/google-services.json" },
"ios":     { "id": "com.example.shop", "server": "https://shop.example.com", "teamId": "ABCDE12345",
             "firebase": "firebase/GoogleService-Info.plist" }
```

`firebase` is the config file you download from the Firebase console (Project settings → Your apps), a path in the project; `IWC_FIREBASE_ANDROID` / `IWC_FIREBASE_IOS` override it at build time so the file can stay out of git. The build checks the file belongs to the app's id. With it:

- **Android** applies the `google-services` Gradle plugin and links `firebase-auth` and `firebase-messaging` (Firebase BoM). Register the app's SHA-1/SHA-256 fingerprints in the Firebase console (debug and release keys) so Play Integrity can verify it; otherwise Firebase falls back to a reCAPTCHA check. That check is Google's SDK page, the one web view the build's audit allows (only inside `com.google.android.recaptcha` / `gms` / `firebase` classes; the app's own UI never uses one).
- **iOS** adds the `firebase-ios-sdk` Swift package (FirebaseAuth, FirebaseMessaging), bundles the plist, registers its URL schemes (`REVERSED_CLIENT_ID` and the encoded app id) for the reCAPTCHA fallback, and forwards the APNs token to Firebase Auth. Upload an APNs key in the Firebase console (Cloud Messaging) for silent-push verification and notifications; the first build downloads the Swift package (a few GB of disk).
- **Push notifications:** with `"push"` in `app.iwc` (`iwc push setup`), the app asks for permission, registers its token with IWC after sign-in, and shows messages that arrive while it is open (a `data.path` opens that screen). `push` steps send to it through Firebase Cloud Messaging, and `iwc push test` sends a test. See [push notifications](push-notifications.md). Push on iOS needs `teamId` (the build adds the `aps-environment` entitlement) and an APNs key uploaded to Firebase. `platforms.<p>.push` set to an api of yours sends the token there instead.

## Device features

Everything here is on by default in a server-driven app, or switched on with one setting in `app.iwc`. There is no Kotlin or Swift to write.

```json iwc:app
{
  "name": "Shop",
  "iwc": 1,
  "platforms": {
    "web": {},
    "android": {
      "id": "com.example.shop", "server": "https://shop.example.com",
      "links": { "scheme": "shop", "hosts": ["shop.example.com"], "fingerprints": ["AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89"] },
      "lock": "biometric",
      "permissions": { "camera": "Photograph your receipts" }
    },
    "ios": {
      "id": "com.example.shop", "server": "https://shop.example.com", "teamId": "ABCDE12345",
      "links": { "scheme": "shop", "hosts": ["shop.example.com"] },
      "permissions": { "location": "Your location finds the nearest store" }
    }
  }
}
```

### Sign-in and secure storage

A sign-in form (one posting to an `auth.login` or `auth.register` api) asks for a **token session** on a device: the app sends `"session": "token"` and a `device` description, keeps the access and refresh tokens, sends `Authorization: Bearer` on every request, and renews an expired access token once (refresh tokens rotate; a reused one ends the session). After signing in it opens the page the sign-in was for (`?next=`). Phone sign-in works the same way. A wrong password shows the form's error instead of bouncing to the sign-in page.

Tokens never sit in plain storage:

- **Android**: sealed with AES-256-GCM under a key held in the Android Keystore (hardware-backed where the device has it, never exportable). Preferences hold only ciphertext, and a backup restored on another device can't be opened there (that device signs in again).
- **iOS**: the Keychain, `WhenUnlockedThisDeviceOnly`, so they are readable only while the phone is unlocked and never move to another device.

Tokens an older build stored in the clear are moved on first launch. A login api's declared `response.fields` never strips the tokens a token sign-in asked for (a cookie sign-in's token is the cookie and never appears in the body).

A signed-out app can still post to public apis (a contact form, a guest cart): its requests carry `X-IWC-Client: native`, which with no session and no browser `Origin` stands in for the CSRF token. A web page on another site can't send that header (CORS refuses the preflight).

### Navigation on a device

The app holds a back stack of **paths**, the same routes as the web. A tap on a link pushes the path, Back (the system button or gesture on Android, edge swipe on iOS) pops it, and the server renders each path through the same pipeline as the browser: `auth: "required"` pages redirect to sign-in with `?next=`, roles give 403, unknown paths give the app's 404 screen, and `redirect` answers replace the top of the stack. Route and query parameters arrive as they do on the web. Dialogs (`modal`/`dialog` elements opened by `action: "open"`) are bottom sheets, a layout's pinned header and bottom tab bar stay put while the body scrolls, and `success.navigate`/`reload` behave as in the browser.

The stack **survives the system ending the app** in the background (Android saved state, iOS scene storage): reopening returns to the same screen with Back still leading where it did. Closing the app on purpose starts fresh, as users expect.

### Links

`links.scheme` makes `shop://products/7` open `/products/7`; `links.hosts` makes `https://shop.example.com/products/7` open the app on that route (Android App Links, iOS universal links), and falls back to the website where the app isn't installed. A link opened while the app runs pushes the screen; one that starts the app is its first screen.

Verified links need the site to vouch for the app, and IWC serves the files: `/.well-known/assetlinks.json` (the package and `fingerprints`, the SHA-256 of your signing certificates from `keytool -list -v` or Play Console → App integrity) and `/.well-known/apple-app-site-association` (`teamId` + bundle id). The iOS build adds the associated-domains entitlement only when `teamId` is set, since universal links need a signed app.

### Lock

`"lock": "biometric"` covers a signed-in app, at launch and after five minutes in the background, until the person passes the fingerprint, face or device passcode check (Android BiometricPrompt, iOS LocalAuthentication). A signed-out app isn't locked, and a device with no screen lock at all can't be protected this way, so it opens.

### Sharing, photos and the camera

- A button with `"action": "share"` opens the system share sheet with `target` (default: the current page; a path becomes `seo.siteUrl` + path) and `value` as the message. On the web it uses the browser's share sheet where there is one, else copies the link.
- An [image input](forms-and-validation.md) offers **Choose photo** (the system photo picker, which needs no storage permission) and **Take photo** (the camera), uploads the file at once to its `storage.upload` api and keeps the returned url, as on the web. A field that accepts documents opens the file chooser instead.
- `permissions` sets the sentences in the system prompts (`location`, `camera`, `biometric` for Face ID). IWC supplies plain defaults.

### Networking

There is no API client to write per platform: every screen, form and button goes to the IWC server with the same requests the web makes (JSON, idempotency keys on retried writes, the server's validation errors shown per field), plus bearer tokens and token renewal. Calls to third-party APIs run on the server (`.service.iwc` with timeouts, retries and caching, or an `@iwc/*` package), so their credentials never ship inside an app. See [Integrations](integrations-and-packages.md).

### Offline and sync

With `iwc enable offline`, server-driven apps keep the screens the server allows on the device (SQLite; a signed-in person's screens sealed with a Keystore / Keychain key), open them without a connection under a *You're offline · saved 10 min ago* bar, and keep writes to apis marked `"offline": "queue"` in a queue that is sent, exactly once and in order, when the connection returns — by the open app, or by WorkManager (Android) / `BGTaskScheduler` (iOS) when it is closed. A screen never stored shows an offline screen with *Try again*. Conflicts, the status bar and the list of waiting changes work as on the web. See [installable apps and offline support](offline-and-pwa.md).

### Live updates

A screen with live data (`"live": true` on a data block) holds a WebSocket to `/_iwc/ws` while it is open (OkHttp on Android, `URLSessionWebSocketTask` on iOS); a change to one of its resources re-renders it in place, usually within a second. The socket reconnects with backoff, and closes when no open screen needs it.

### Background location and tasks

```json
"android": { "id": "com.example.rider", "server": "https://rider.example.com",
             "background": { "location": { "api": "/api/rider/location", "interval": "30s", "distance": 25, "notification": "Sharing your location with the store" },
                             "tasks": [{ "api": "/api/rider/heartbeat", "every": "30m" }] } }
```

- **Location**: buttons with `"action": "tracking"` and `"value": "start"` / `"stop"` turn it on and off (the app asks for the location permission, and on Android 13+ for notifications). While on, each position is posted to the api as `{lat, lng, accuracy, speed, heading, at}` — also with the app in the background: a foreground service with a notification on Android, background location updates (with the system's location indicator) on iOS. If the api is `"offline": "queue"`, positions taken without a connection are queued (with `client-wins`). A button may name its own `api` instead. On the web, the same button sends positions while the page is open.
- **Tasks**: each api is called (POST, signed in) about every `every` (at least 15 minutes; the system chooses the moment) — WorkManager periodic work on Android, background app refresh on iOS.

### Payments in the app

```json
"android": { "id": "com.example.shop", "server": "https://shop.example.com", "payments": ["razorpay", "stripe", "cashfree"] },
"ios":     { "id": "com.example.shop", "server": "https://shop.example.com", "payments": ["razorpay", "stripe"] }
```

```json iwc:element
{ "type": "button", "label": "Pay now", "action": "pay", "api": "pay-order.api.iwc", "confirm": "confirm-payment.api.iwc", "value": { "orderId": "=order.id" }, "success": { "navigate": "/orders" } }
```

A pay button posts `value` plus `{"client": "android" | "ios" | "web"}` to `api`, whose action creates the payment with `@iwc/payments` `createPayment` (without `successUrl` for an in-app sheet) and returns its result. When the app links that provider's sheet — Razorpay Checkout, Stripe PaymentSheet, Cashfree drop-in — it opens it natively; otherwise it opens `checkoutUrl` (hosted checkout) in the browser. Then it posts `{id, provider, paymentId, signature, orderId, status}` to `confirm`, whose action checks the payment with the provider (`getPayment`, signature checks) before it answers 2xx. Only then does the screen run `success`: the app never decides on its own that something was paid. Cancelling says *Payment cancelled*; coming back from a hosted checkout asks `confirm` how it went. On the web, `pay` follows `checkoutUrl`. The first iOS build with `stripe` clones Stripe's Swift package, several GB of git history (Xcode keeps it in `~/Library/Caches/org.swift.swiftpm`); later builds reuse it.

The providers' SDKs show their own bank pages (3-D Secure, UPI, net banking), which is the one place a web view may appear: the build's audit allows it only inside `com.razorpay`, `com.stripe` and `com.cashfree` classes, and fails if the app's own code creates one.

### Social sign-in

Links to `/_iwc/auth/oauth/<provider>/start` (a *Continue with Google* button on a sign-in screen) open the provider in the system's browser session — Custom Tabs on Android, `ASWebAuthenticationSession` on iOS — never an in-app web view, which providers refuse. The app sends a PKCE challenge; the server, instead of setting a browser cookie, returns a one-time code to the app's scheme (`links.scheme`, else the application id) that only the app holding the verifier can trade at `POST /_iwc/auth/app/exchange` for a token session. On iOS the browser session catches that redirect itself; on Android, Chrome won't follow a server redirect into an app, so the sign-in ends on a *You're signed in — Return to <App>* page whose button opens the app (one tap). Nothing to configure beyond `auth.oauth`; the scheme is registered when `auth.oauth` is set.

### Files and the share sheet

- A link to a file (`/_iwc/files/…`, or any link with `"attributes": {"download": ""}`) is downloaded with the app's session and handed to the system: *Open with* / *Save* on Android, the share sheet (*Save to Files*) on iOS.
- `"shareTarget": "/notes/new"` lists the Android app in the system share sheet; shared text opens that screen with `?title=&text=&url=` (the same as `pwa.shareTarget` on the web).

### Your own native code

Put Kotlin under `native/android/` and Swift under `native/ios/`, one extension per file, named after the file, and call it from a button:

```kotlin
// native/android/Scanner.kt
import org.json.JSONObject

object Scanner : IwcExtension {
    override suspend fun call(method: String, args: JSONObject, ctx: IwcExtensionContext): JSONObject = when (method) {
        "scan" -> JSONObject().put("code", "4006381333931")   // your code: a camera, an SDK, a sensor…
        else -> throw IllegalArgumentException("no method $method")
    }
}
```

```swift
// native/ios/Scanner.swift
final class Scanner: IwcExtension {
    required init() {}
    func call(_ method: String, _ args: [String: Any], _ ctx: IwcExtensionContext) async throws -> [String: Any] {
        guard method == "scan" else { throw IwcExtensionError("no method \(method)") }
        return ["code": "4006381333931"]
    }
}
```

```json iwc:element
{ "type": "button", "label": "Scan a barcode", "action": "native", "target": "Scanner.scan", "value": { "format": "ean13" }, "api": "add-item.api.iwc", "success": { "reload": true } }
```

`value` arrives as `args`; the returned object is posted to `api` (queued offline when it is `"queue"`), or, without `api`, the button just runs `success`. A thrown error's message is shown. `ctx` gives the activity and session (`ctx.permission(...)`, `ctx.launch(intent)` for an activity result on Android; `ctx.presenter` on iOS). Declare what the code needs in `app.iwc`:

```json
"android": { "id": "com.example.shop", "server": "https://shop.example.com",
             "extensions": { "dependencies": ["com.google.mlkit:barcode-scanning:17.3.0"], "permissions": ["android.permission.CAMERA"] } },
"ios":     { "id": "com.example.shop", "server": "https://shop.example.com",
             "extensions": { "packages": [{ "url": "https://github.com/example/scanner-kit", "version": "2.1.0", "products": ["ScannerKit"] }],
                             "plist": { "NSCameraUsageDescription": "Scan barcodes" } } }
```

On the web the button says *This works in the app*; mark it `"platforms": ["android", "ios"]` to leave it out there. Extension code is compiled with the app and goes through the same audit: a web view in it fails the build.

