# Paneel

Your phone as a control panel for your desk. Paneel is an open-source alternative to Stream Deck-style macro pads: your phone or tablet becomes a grid of keys that follows the app you are working in, and a small desktop app on your Mac, Windows PC or Linux machine runs the actions (hotkeys, launch apps, open URLs, shell commands, start a Claude or Codex session in a terminal). Phone and computer talk over your local Wi-Fi; no cloud, no subscription.

Status: **MVP, in daily use on macOS**; Windows and Linux compile but are untested on real machines. The plan, the decisions and the open items live in [PLAN.md](PLAN.md).

## What it does today

- **Android app**: the same deck as a Capacitor app, with in-app QR scanning, screen kept awake and a home-screen icon; the web deck also offers "Add to Home Screen" through its manifest.
- **Deck on the phone**: square keys sized to the viewport, swipe between sets and pages, folders, toggle keys with a second state and a lamp, haptics, wake lock, reconnect.
- **Editor on phone and desktop, in sync**: label, color, icon (installed app, website favicon, Phosphor, Simple Icons logos, emoji, upload), drag to reorder, multi-action buttons with delays, a Try button, themes and color palettes (built-in and your own).
- **Actions**: hotkey (optionally focusing an app first), type text, launch app, open URL, shell command, terminal command (Terminal, iTerm2, Windows Terminal; new tab or window, with a prompt for Claude or Codex), media keys, delay, and `appControl` for Spotify and Apple Music (shuffle, repeat, play/pause, next, previous) that scripts the app instead of sending keys (AppleScript on macOS, MPRIS on Linux).
- **Ready-made buttons**: a catalog of standard buttons by purpose (media, system, window, editing, browser, IDE, coding, meetings, your installed apps, websites) and "App buttons" with per-app sets for Spotify, Apple Music, Zoom, Teams, Meet, Discord, Claude (desktop and Claude Code), VS Code, Cursor, JetBrains IDEs, Slack, GitHub Desktop, Notion, Obsidian, Outlook, Figma, Photoshop, Lightroom Classic, DaVinci Resolve and YouTube. Page presets suggest pages based on what is installed.
- **Smart pages**: a page follows the focused app automatically.
- **Settings**: terminal app, port, pairing token rotation, logs, backup and restore of the whole config including icons, start clean.

## Stack

| Part         | Tech                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Desktop host | Go 1.27, [Wails v3](https://v3.wails.io) (tray + window), [robotgo](https://github.com/go-vgo/robotgo) for input, WebSocket + mDNS |
| Desktop UI   | Angular 22 in the Wails webview (`apps/desktop`)                                                                                   |
| Deck client  | Angular 22, served by the host as a web app and wrapped by Capacitor 8 as the Android app (`apps/mobile`)                          |
| Workspace    | Nx 24, pnpm 11, Node 24, Vitest, Playwright, ESLint, Prettier                                                                      |

## Prerequisites

- Node via nvm (`nvm use`), pnpm 11 (`corepack enable` or `npm i -g pnpm@11`)
- Go 1.27+, Xcode Command Line Tools (macOS) or MSVC build tools (Windows) for cgo
- Wails CLI: `go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0`
- golangci-lint (optional, for `nx lint host`)
- For the Android app: Android Studio (its bundled JDK 21 and the SDK with platform 36); set `JAVA_HOME` to `/Applications/Android Studio.app/Contents/jbr/Contents/Home` when the system Java is newer than Gradle supports

## Quick start

```bash
pnpm install

# Headless host + web deck: prints pairing URLs and a QR code in the terminal
pnpm nx serve-headless host

# Desktop app (tray + window) with the embedded web deck
pnpm nx serve host
```

Open the pairing URL on your phone (same Wi-Fi) or scan the QR code. The first press that simulates a keystroke on macOS triggers the Accessibility permission prompt; grant it under System Settings > Privacy & Security > Accessibility.

"Build a page with AI" in the menu turns a sentence into a page proposal you can add with one tap. It uses your own account: set an Anthropic or OpenAI-compatible API key in the desktop app (or `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` on the computer); a local model through Ollama or LM Studio works with the OpenAI-compatible provider and a base URL. The model only builds pages: it answers with a question, a plan or a decline, and the host checks every plan against the button catalog before you see it.

The host writes its log to `host.log` in the same folder (rotated at 1 MB, three files kept). The deck shows it under Settings > Show logs with Copy, Share and Download, and a Verbose switch adds debug lines; `hostd -verbose` does the same from the start. The log never contains the pairing token, typed text or prompts.

Configuration is stored in `~/Library/Application Support/paneel/config.json` (macOS), `%AppData%\paneel\config.json` (Windows) or `~/.config/paneel/config.json` (Linux). Delete it to regenerate the sample profile and a new pairing token.

## Everyday commands

```bash
pnpm nx run-many -t lint typecheck test     # everything
pnpm nx test host                           # Go tests
pnpm nx e2e deck-e2e                        # Gherkin scenarios (playwright-bdd) against a headless host on :48240
pnpm nx e2e deck-e2e --configuration=smoke  # only @smoke scenarios; platform tags (@mac, @windows, @linux) and @manual filter automatically
pnpm nx lint host                           # golangci-lint
pnpm nx package host                        # macOS app bundle in apps/host/bin
pnpm nx bindings host                       # regenerate TypeScript bindings after changing Go services
pnpm nx build host                          # production build via wails3 (bin/)
pnpm nx serve mobile                        # Angular dev server for the deck client on :4300
pnpm nx build-apk mobile                    # debug APK for sideloading, in apps/mobile/android/app/build/outputs/apk/debug
pnpm nx run-android mobile                  # build, sync and start the app on a connected phone or emulator
pnpm nx graph                               # project graph
node tools/scripts/generate-phosphor-names.mjs       # after upgrading @phosphor-icons/web
node tools/scripts/generate-simple-icons-names.mjs   # after upgrading simple-icons
node tools/scripts/render-check.mjs "<pairing url>"  # headless render check of the deck
```

### Running more than one host

The desktop window and the headless host are the same host, so by default they share your config and port 48220 and cannot run at the same time. For development there is a `sandbox` configuration of both targets with its own port and config folder under `tmp/` (ignored by git), so any combination runs side by side:

```bash
pnpm nx serve host                                    # desktop window, your config, :48220
pnpm nx serve host --configuration=sandbox            # desktop window, tmp/sandbox-desktop, :48221
pnpm nx serve-headless host                           # headless, your config, :48220
pnpm nx serve-headless host --configuration=sandbox   # headless, tmp/sandbox-headless, :48222
```

A sandbox starts with the sample page and its own pairing token, so pair the phone again with the URL it prints. Underneath, both binaries read `PANEEL_PORT` and `PANEEL_CONFIG_DIR`; `hostd` also takes `-port` and `-config-dir`, which win over the environment. A port that is already taken stops the host with a message that says so instead of silently moving, because paired decks carry the port in their pairing URL.

For manual tests you can also start a host by hand from `apps/host`:

```bash
go run ./cmd/hostd -port 48230 -config-dir /some/dir
go run ./cmd/hostd -port 48230 -config-dir /some/dir -record-actions /some/dir/actions.jsonl
```

With `-record-actions` the host validates every action and appends it as a JSON line to the file instead of running it (delays are skipped). The e2e suite runs this way, so pressing a Spotify or Zoom key in a test never reaches the apps on the machine.

## Layout

```
apps/host       Go host: core, actions, appcontrol (Spotify/Music scripting), activeapp, WebSocket server, mDNS, Wails main
apps/desktop    Angular UI shown in the Wails window (builds into apps/host/frontend/dist)
apps/mobile     Angular deck client (builds into apps/host/static/deck, embedded and served by the host; apps/mobile/android wraps the same build as the Android app)
libs/protocol   Message and model types shared with the Go host
libs/host-client WebSocket client with reconnect, exposed as Angular signals
libs/deck-ui    Deck grid, keys, swipe and drag-to-reorder
libs/editor     Shared shell: menu, button editor, icon picker, catalog, app buttons, page presets, pages, themes, settings
libs/styles     Design tokens (themes.css) and the Tailwind entry with the shared sd-* utilities
apps/deck-e2e   Playwright suite for the web deck against a real headless host
```

## License

MIT, see [LICENSE](LICENSE).
