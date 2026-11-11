# Getting started

## 1. Install

IWC is a single native program, `iwc`. Every method below installs the same official release from [GitHub Releases](https://github.com/Hussian007/iwc/releases). You don't need Go, Node.js or a copy of the IWC source.

**macOS and Linux (Homebrew):**

```bash
brew install hussian007/iwc/iwc
```

**Windows (Scoop):**

```powershell
scoop bucket add iwc https://github.com/Hussian007/scoop-iwc
scoop install iwc/iwc
```

**Without a package manager:** the install script downloads the release for your system, checks its SHA-256 checksum, and puts `iwc` in `~/.iwc/bin` (`%LOCALAPPDATA%\iwc\bin` on Windows) on your `PATH`.

```bash
curl -fsSL https://github.com/Hussian007/iwc/releases/latest/download/install.sh | sh     # macOS, Linux
```

```powershell
irm https://github.com/Hussian007/iwc/releases/latest/download/install.ps1 | iex          # Windows PowerShell
```

**Direct download:** every release has an archive per system (`iwc_<version>_darwin_arm64.tar.gz`, `…_darwin_amd64`, `…_linux_amd64`, `…_linux_arm64`, `…_windows_amd64.zip`, `…_windows_arm64.zip`) and a `checksums.txt`. Extract it and add `bin/` to your `PATH`, keeping `lib/` beside it (it holds the Linux runtime `iwc deploy` uploads).

When the install finishes, IWC introduces itself:

```text
   ___ __        __  ____
  |_ _|\ \      / / / ___|
   | |  \ \ /\ / / | |
   | |   \ V  V /  | |___
  |___|   \_/\_/    \____|

  IWC Framework 0.2.0 installed successfully.
  IonicWebCreator Private Limited  |  Founder: Jakir Hussian
  https://ionicwebcreator.com

  Get started
    iwc create my-app
    cd my-app
    iwc dev

  Run iwc about for framework, release and environment details.
```

Check the installation:

```bash
iwc --version      # iwc 0.2.0 (darwin/arm64, source …)
iwc about          # framework, release dates, environment, links
iwc doctor
```

`iwc doctor` checks the binary, how it was installed (and the upgrade command for that), your CPU, `PATH`, the built-in SQLite, the dev port and your browser. Inside a project, it also checks the project. Every line is ✓ (fine), ! (a warning, with what to do about it) or ✗ (a problem).

| Installed with | Upgrade | Uninstall |
| --- | --- | --- |
| Homebrew | `brew upgrade iwc` | `brew uninstall iwc && brew untap hussian007/iwc` |
| Scoop | `scoop update iwc` | `scoop uninstall iwc; scoop bucket rm iwc` |
| install.sh | run the install command again | `curl -fsSL https://github.com/Hussian007/iwc/releases/latest/download/install.sh \| sh -s -- --uninstall` |
| install.ps1 | run the install command again | `$env:IWC_UNINSTALL=1; irm https://github.com/Hussian007/iwc/releases/latest/download/install.ps1 \| iex` |

Supported systems: macOS 11+ (Apple silicon, Intel), Linux x64/arm64 (any distribution), Windows 10/11 x64/arm64. The binary is static; SQLite is built in.

## 2. Create a project

```bash
iwc create my-app
cd my-app
```

`iwc create` asks which targets to build: Web (on by default), an Admin area, a native Android app and a native iOS app. Answer with flags instead to skip the questions: `iwc create my-app --web --android --ios`. Native targets are explained in [native apps](native-apps.md); everything below is about the web target.

You get a minimal starter: a welcome screen with a shared counter, an About screen, a 404 page, a layout with a footer, light and dark themes, and a few tests. It has no product content to delete: every file is an ordinary `.iwc` or `.css` file meant to be changed or replaced. The project's `README.md` lists what every file does. There are two templates:

| Command | Starts you with |
| --- | --- |
| `iwc create my-app` | `basic` (the default): the welcome starter described above: 3 screens, a state store, layout, footer, 6 tests |
| `iwc create my-store --template store` | `store`: the full e-commerce demo (13 screens, cart, checkout, accounts, order history, admin) |

Project names use lowercase letters, digits and dashes.

## 3. Run it

```bash
iwc dev --open     # or: npm run dev (package.json scripts call iwc)
```

```text
IWC Development Server

✓ Project validated
✓ Runtime initialized
✓ Port 3000 available
✓ Application compiled (7 files in 3ms · 2 screens · 0 apis · 0 schemas)
✓ Hot reload enabled

  Local:    http://localhost:3000
  Docs:     http://localhost:3000/_iwc/docs/
  Project:  /Users/you/Projects/my-app
  Logs:     .iwc/logs/dev.log  (iwc logs -f)

Watching for file changes... (Ctrl+C stops)
```

`--open` opens your browser at the URL actually used. If port 3000 is taken, `iwc dev` says by what and uses the next free one; a port you choose yourself (`--port 3400`) is never swapped, see [CLI commands → ports](cli-commands.md#ports). The IWC guide you are reading is served by your app at `/_iwc/docs/`.

The development database is SQLite, in `.iwc/dev.db`, created for you. Rows listed under `seed` in your schemas are inserted into empty tables. Delete `.iwc/` at any time to start from a clean database.

## 4. Change something

Open `ui/home.ui.iwc`, find the "Welcome to IWC" title and change its `content`:

```json iwc:element
{ "type": "text", "variant": "title", "content": "Hello, world" }
```

Save. The page re-renders where you are: the footer, your scroll position and any client state stay as they were. Editing a `.css` file swaps the stylesheet in place.

Now make a mistake: rename `"content"` to `"contnet"` and save. The terminal and the browser both show:

```text
✗ ui/home.ui.iwc:18:51: error: unknown key "contnet" in "sections[0].elements[0].elements[2]" (did you mean "content"?)
```

The page stays on that error until you save a fix.

## 5. Add a page

Create `ui/about.ui.iwc`. It needs no registration: its route comes from the file.

```json iwc:ui
{
  "name": "About",
  "route": "/about",
  "layout": "main.layout.iwc",
  "title": "About us",
  "sections": [
    {
      "type": "section",
      "className": "narrow",
      "elements": [
        { "type": "text", "variant": "h1", "content": "About us" },
        { "type": "text", "content": "We make things with care.\nThis is a second paragraph line." }
      ]
    }
  ]
}
```

Then link to it from the home page. In `ui/home.ui.iwc`, add `{ "type": "link", "label": "About", "target": "/about" }` to the `elements` of the row of buttons. For a navigation bar on every page, add a `header` slot to `layouts/main.layout.iwc` (see [Layout development](layout-development.md)).

## 6. Check, test, build

```bash
iwc check       # every file against its schema, every reference resolved
iwc test        # tests/*.test.iwc against a fresh in-memory database
iwc validate    # check + test + a production build: your pre-ship check
iwc build       # dist/: the production bundle
```

## Where to next

- [Project structure](project-structure.md): what each file is for.
- [UI development](ui-development.md): every element you can put on a page.
- The `store` template and [`examples/cookbook`](examples/cookbook): working code to copy from.

### Editor setup (VS Code)

New projects include `.vscode/settings.json`. It associates `*.iwc` with JSON and maps each file type to a JSON Schema in `.vscode/iwc-schemas/`, so you get autocompletion, hover descriptions and red underlines as you type. `iwc dev` keeps those schemas in step with your installed `iwc`. For an older project, run `iwc schema --out .vscode/iwc-schemas` and copy `.vscode/settings.json` from a new project.
