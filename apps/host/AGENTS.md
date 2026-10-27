# Host (Go, Wails v3)

Desktop host that executes deck actions and serves the deck client. Port 48220 (configurable in the user config file).

## Commands

```bash
pnpm nx serve-headless host   # go run ./cmd/hostd -static static/deck
pnpm nx serve host            # go run . (Wails window + tray)
pnpm nx test host             # go test ./...
pnpm nx lint host             # golangci-lint run ./...
pnpm nx typecheck host        # go vet ./...
pnpm nx bindings host         # wails3 generate bindings -> apps/desktop/src/bindings
pnpm nx build host            # wails3 build -> bin/
```

## Packages

- `internal/protocol` message and model types (mirror of `libs/protocol`)
- `internal/config` JSON config in the user config dir, defaults with a sample profile
- `internal/actions` action runner; platform launchers in `launch_<os>.go`; input via robotgo
- `internal/server` WebSocket endpoint `/ws?token=`, `/api/info`, static SPA serving
- `internal/discovery` mDNS advertisement `_deckhost._tcp` and local IP listing
- `internal/host` wires everything; used by both `cmd/hostd` (headless) and `main.go` (Wails)
- `hostservice.go` service bound to the desktop UI

## Conventions

- Receivers and variables use full names (`server`, `runner`, `host`).
- Tests use the standard library; network tests run against `httptest`.
- Never execute real input actions in tests; use the delay action.
- `build/` and `Taskfile.yml` come from the Wails template; `build:frontend` delegates to Nx.
