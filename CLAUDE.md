# Paneel

Paneel turns a phone into a control panel for the desk: open source, no hardware, pages that follow the focused app. Nx monorepo: Go host (Wails v3) + Angular 22 desktop UI + Angular deck client (web now, Capacitor later). Read [PLAN.md](PLAN.md) for the product plan and decisions, [README.md](README.md) for commands.

## Setup

- Node `24.22.1` (`.nvmrc`), pnpm `11.20.0` (enforced via `devEngines`). pnpm only.
- Go 1.27 with cgo (robotgo). Wails CLI `wails3` on PATH (`go install github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0`).
- Go projects are wired through `go.work` and `nx:run-commands` targets in `apps/host/project.json`.

## Workflow rules

- Discuss proposed changes until the user says "start" or "go ahead"; never start implementation without approval.
- Discuss one point at a time.
- Stay inside the task scope; propose, don't silently widen.
- No time estimations.

## Code standards

- Angular: standalone components, signals, `input()`/`output()`, OnPush, `@if`/`@for` control flow. Prefix `sd`.
- Go: descriptive receiver and variable names (`server`, `runner`, not `s`, `r`); errors wrapped as `fmt.Errorf("doing x: %w", err)`; `golangci-lint` clean. One role per file, split by prefix (`handler_<area>.go`, `terminal_<os>.go`, `validate.go`, `errors` next to the code that returns them); stateless helpers get their own small package (`internal/atomicfile`).
- Editor lib: cross-cutting helpers live in `libs/editor/src/lib/shared` (platform, installed apps, app matching, storage, error messages, icons); pure data builders sit next to their component (`shell/page-builders.ts`, `assistant-panel/assistant-plan.ts`, `action-list/action-options.ts`). Load a draft from inputs in `ngOnInit`, never with `queueMicrotask` in the constructor. `libs/editor` exports only `Shell`.
- Comments only for WHY, no emojis in code or commits.
- Verify UI changes with the e2e suite or a Playwright script against a headless host started with `-port` and `-config-dir`; never test against the developer's own config.
- New UI behaviour gets a Gherkin scenario in `apps/deck-e2e/src/features/*.feature` with a step in `src/steps/*.steps.ts`; scenarios share one host, so start with `Given the host starts clean`. Tag platform-specific scenarios (`@mac`, `@windows`, `@linux`), human-only ones `@manual`, internet-dependent ones `@internet`, and the fast core `@smoke`.
- Styling: Tailwind 4 (`@tailwindcss/postcss`, root `.postcssrc.json`). `libs/styles/src/tailwind.css` imports Tailwind and `themes.css`, exposes the `--sd-*` design tokens through `@theme inline` (`bg-surface`, `text-muted`, `rounded-sd`, `shadow-sd`, `font-sd`, ...) and defines the shared utilities (`sd-input`, `sd-select`, `sd-hint`, `sd-section`, `sd-group-label`, `sd-heading`, `sd-btn-primary`, `sd-btn-secondary`, `sd-btn-danger`, `sd-icon-button`, `sd-chip`, `sd-back-link`, `sd-error`, `sd-surface-border`, `sd-glass-blur`, `sd-themed-bg`, `sd-grid-fill-[84px]`, `sd-font-inherit`). Component stylesheets start with `@reference '../../../../styles/src/tailwind.css'` and group utilities with `@apply` under the semantic class names the templates and the e2e suite use; use utilities directly in templates for one-offs. Plain CSS stays only for what Tailwind cannot express: container-query units and per-theme key tokens in `deck-ui`, `color-mix`, CSS-variable grids. Mind that `@apply` output is ordered by Tailwind, so a longhand that must beat a shorthand (`border-bottom: 0` after `sd-surface-border`) stays a plain declaration. No hardcoded colors, radii or fonts; a new theme is a new `[data-theme]` block in `themes.css` plus an entry in `libs/editor/src/lib/theme-panel/themes.ts`.
- Visual changes: compare screenshots before and after (the e2e host plus Playwright `toHaveScreenshot`); Tailwind's `text-sm`-style utilities also set a line-height, so prefer `text-[13px]` when matching an existing look.
- Generated lists: `node tools/scripts/generate-phosphor-names.mjs` and `node tools/scripts/generate-simple-icons-names.mjs` after upgrading those packages.
- Logging: the host logs through `slog` into `internal/logs` (ring buffer, `host.log` next to the config, stderr); decks send their own lines with a `log` message. Log labels, action kinds and commands, never the pairing token, typed text or prompts. Info for what a user did, debug for the noise (active app, terminal decisions, API calls).
- AI page builder (`internal/assistant`): the model answers in one fixed JSON shape (question, plan or decline) through structured outputs; the host validates every reply against the catalog the deck sent and never writes the config itself. Keys live in `secrets.json` next to the config, set from the desktop window or the environment, never from a deck. The `-assistant-fake` flag answers without a network; the e2e suite uses it.
- Protocol changes go to both `apps/host/internal/protocol/messages.go` and `libs/protocol/src/lib/protocol.ts`.
- After changing a Wails-bound Go service, run `pnpm nx bindings host` and commit the result (output `apps/desktop/src/bindings`, generated and ignored by lint and Prettier, but committed so CI and a checkout without Go can build the desktop app).
- Formatting follows hvs: tabs (4 wide), Prettier with `printWidth` 100, single quotes, the Angular parser for HTML, `prettier-plugin-gherkin` for feature files and `prettier-plugin-tailwindcss` for class order. Run `pnpm prettier --write .` before handing work over; generated files are listed in `.prettierignore`.
- Conventional Commits. No ticket prefix required.

## Commands

```bash
pnpm nx serve-headless host      # host without window, serves the web deck on :48220
pnpm nx serve host               # Wails desktop app (builds desktop + mobile first)
pnpm nx serve host --configuration=sandbox            # same, on :48221 with tmp/sandbox-desktop as config
pnpm nx serve-headless host --configuration=sandbox   # headless on :48222 with tmp/sandbox-headless
pnpm nx run-many -t lint typecheck test
pnpm nx test host                # go test ./...
pnpm nx lint host                # golangci-lint
pnpm nx e2e deck-e2e             # Gherkin e2e (playwright-bdd): apps/deck-e2e/src/features + steps; bddgen runs first
pnpm nx e2e deck-e2e --configuration=smoke   # @smoke only; @mac/@windows/@linux scenarios run on their platform, @manual never
go run ./cmd/hostd -port 48230 -config-dir /some/dir   # second host for manual tests without touching your config
```

## Gotchas

- Angular builds output straight into the Go embed folders (`apps/host/frontend/dist`, `apps/host/static/deck`); `go build` fails without them, so run the Angular builds first (the Nx targets do this).
- macOS: simulating keys needs Accessibility permission; the app cannot be sandboxed, so no Mac App Store.
- Windows: input to elevated windows is dropped silently (UIPI).
- The sample profile and pairing token live in the user config dir; delete the file to reset.
