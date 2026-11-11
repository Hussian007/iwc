# IWC Framework CLI

`iwc` is the command-line tool for **IWC**, a declarative full-stack framework: you describe screens, data, APIs and rules in `.iwc` files, and one binary runs them in development, tests them, and builds and deploys them for production.

This repository publishes the official release binaries. Every installation method below installs the same release from [Releases](https://github.com/Hussian007/iwc/releases).

## Install

**macOS and Linux (Homebrew)**

```sh
brew install hussian007/iwc/iwc
```

**Windows (Scoop)**

```powershell
scoop bucket add iwc https://github.com/Hussian007/scoop-iwc
scoop install iwc/iwc
```

**Installer script** (no package manager needed; verifies the SHA-256 checksum)

```sh
# macOS, Linux
curl -fsSL https://github.com/Hussian007/iwc/releases/latest/download/install.sh | sh
```

```powershell
# Windows PowerShell
irm https://github.com/Hussian007/iwc/releases/latest/download/install.ps1 | iex
```

**Direct download:** take the archive for your system from the [latest release](https://github.com/Hussian007/iwc/releases/latest), extract it and add its `bin/` folder to your PATH. Keep `lib/` next to `bin/` (it holds the Linux runtime `iwc deploy` uploads). Check the download against `checksums.txt`.

Then check it:

```sh
iwc --version
iwc about          # framework, release dates, environment and links
iwc doctor
```

After a successful install, the installers (and Homebrew and Scoop) print a short welcome confirming the version and showing how to start.

## Get started

```sh
iwc create my-app
cd my-app
iwc dev            # http://localhost:3000 with live reload
```

```sh
iwc check          # validate every file and reference
iwc test           # run the project's tests
iwc build          # production bundle in dist/
iwc start dist     # serve it
iwc --help         # every command
```

The full guide is built into every app: run `iwc dev` and open `/_iwc/docs`.

## Supported platforms

| OS | CPU | Archive |
| --- | --- | --- |
| macOS 11+ | Apple silicon, Intel | `iwc_<version>_darwin_arm64.tar.gz`, `…_darwin_amd64.tar.gz` |
| Linux (any distribution, glibc or musl) | x86_64, arm64 | `iwc_<version>_linux_amd64.tar.gz`, `…_linux_arm64.tar.gz` |
| Windows 10/11 | x64, arm64 | `iwc_<version>_windows_amd64.zip`, `…_windows_arm64.zip` |

The binaries are static: no Go, Node.js, database server or system libraries are needed to run IWC (SQLite is built in). Node.js is only used if you run the project's `npm run …` scripts.

## Upgrade

| Installed with | Upgrade |
| --- | --- |
| Homebrew | `brew upgrade iwc` |
| Scoop | `scoop update iwc` |
| Installer script | run the install command again |
| Archive | download the new archive and replace the folder |

`iwc doctor` prints the upgrade command for your installation.

## Uninstall

| Installed with | Uninstall |
| --- | --- |
| Homebrew | `brew uninstall iwc && brew untap hussian007/iwc` |
| Scoop | `scoop uninstall iwc && scoop bucket rm iwc` |
| install.sh | `curl -fsSL https://github.com/Hussian007/iwc/releases/latest/download/install.sh \| sh -s -- --uninstall` |
| install.ps1 | `$env:IWC_UNINSTALL=1; irm https://github.com/Hussian007/iwc/releases/latest/download/install.ps1 \| iex` |

Your projects and `~/.iwc` settings (plugins, deploy targets) are not removed.

## Notes

- **macOS browser downloads:** an archive downloaded with a web browser is quarantined, and macOS will refuse to run the unsigned binary. Homebrew and the installer script don't have this problem. For a browser download, run `xattr -d com.apple.quarantine bin/iwc` once.
- Each release is checked by [Verify install](.github/workflows/verify-install.yml), which installs it through Homebrew, Scoop and both installer scripts on clean macOS (Apple silicon and Intel), Linux (x64 and arm64) and Windows (x64 and arm64) machines, then creates, tests, runs and builds a new project with it.

## License

Free to use, including commercially. See [LICENSE](LICENSE).
