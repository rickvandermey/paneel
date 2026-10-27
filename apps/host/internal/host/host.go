// Package host wires config, store, server, discovery, assets and actions together so both the
// headless binary and the Wails desktop app share one implementation.
package host

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/paneel-nx/paneel/host/internal/actions"
	"github.com/paneel-nx/paneel/host/internal/activeapp"
	"github.com/paneel-nx/paneel/host/internal/assets"
	"github.com/paneel-nx/paneel/host/internal/assistant"
	"github.com/paneel-nx/paneel/host/internal/config"
	"github.com/paneel-nx/paneel/host/internal/discovery"
	"github.com/paneel-nx/paneel/host/internal/icons"
	"github.com/paneel-nx/paneel/host/internal/logs"
	"github.com/paneel-nx/paneel/host/internal/protocol"
	"github.com/paneel-nx/paneel/host/internal/server"
	"github.com/paneel-nx/paneel/host/internal/store"
)

const (
	// restartDelay gives the HTTP response of a network change time to reach the requester
	// before the listener it came through goes away.
	restartDelay      = 300 * time.Millisecond
	activeAppInterval = time.Second
	// ShutdownTimeout is how long the binaries wait for open connections when they quit.
	ShutdownTimeout = 3 * time.Second
	// Ports below 1024 need root on Unix; above 65535 does not exist.
	minPort = 1024
	maxPort = 65535
	// mdnsInstanceIDLength is how much of the token the mDNS record carries to tell hosts apart.
	mdnsInstanceIDLength = 8
)

// AppVersion is shown in the "host started" log line. A packaged build may override it with
// -ldflags; nothing does so yet, so it stays at the placeholder.
var AppVersion = "0.0.1"

type Host struct {
	logger     *slog.Logger
	store      *store.Store
	serverOpts server.Options
	assistant  *assistant.Service
	secrets    *assistant.Secrets

	mu                 sync.Mutex
	server             *server.Server
	advertiser         *discovery.Advertiser
	port               int
	stopActiveAppWatch context.CancelFunc
}

type Options struct {
	Static fs.FS
	// Verbose starts at debug level; the setting of the same name takes over afterwards.
	Verbose bool
	// Port overrides and persists the configured port when non-zero.
	Port int
	// ConfigDir replaces the per-user config folder when set.
	ConfigDir string
	// RecordActions turns every press into a dry run that appends to this file; for test suites.
	RecordActions string
	// FakeAssistant answers page-builder requests without a network; for test suites and demos.
	FakeAssistant bool
}

// Start loads the config, opens the log, builds the services and starts listening.
func Start(opts Options) (*Host, error) {
	applyEnvDefaults(&opts)
	configDir, err := config.Dir()
	if err != nil {
		return nil, fmt.Errorf("resolving config dir: %w", err)
	}
	logHandler, err := logs.New(logs.Options{Dir: configDir, Stderr: os.Stderr, Verbose: opts.Verbose})
	if err != nil {
		return nil, err
	}
	logger := slog.New(logHandler)
	file, err := loadConfig(opts.Port)
	if err != nil {
		return nil, err
	}
	assetsDir, err := config.AssetsDir()
	if err != nil {
		return nil, err
	}
	assetStore, err := assets.New(assetsDir)
	if err != nil {
		return nil, fmt.Errorf("opening assets: %w", err)
	}
	configStore := store.New(file, config.Save)
	host := &Host{logger: logger, store: configStore}
	host.secrets = assistant.NewSecrets(configDir)
	host.assistant = assistant.New(assistant.Options{
		Settings: func() protocol.AssistantSettings { return configStore.Settings().Assistant },
		Secrets:  host.secrets,
		Logger:   logger,
		Fake:     opts.FakeAssistant,
	})
	host.serverOpts = host.newServerOptions(opts, assetStore, logHandler)
	// A -verbose flag wins at startup; otherwise the saved setting decides.
	if !opts.Verbose {
		logHandler.SetVerbose(configStore.Settings().VerboseLogging)
	}
	if err := host.listen(); err != nil {
		return nil, err
	}
	host.watchActiveApp()
	path, _ := config.Path()
	logger.Info("host started", "version", AppVersion, "os", runtime.GOOS+"/"+runtime.GOARCH,
		"port", host.Port(), "config", path, "revision", configStore.Revision(), "verbose", logHandler.Verbose())
	return host, nil
}

// applyEnvDefaults fills in what the flags left empty from the environment both binaries share.
func applyEnvDefaults(opts *Options) {
	if opts.ConfigDir == "" {
		opts.ConfigDir = ConfigDirFromEnv()
	}
	if opts.Port == 0 {
		opts.Port = PortFromEnv()
	}
	if opts.ConfigDir != "" {
		config.SetDir(absolute(opts.ConfigDir))
	}
	opts.FakeAssistant = opts.FakeAssistant || FakeAssistantFromEnv()
}

// loadConfig reads or creates the config file; a port override is saved right away because
// paired decks carry the port.
func loadConfig(portOverride int) (*config.File, error) {
	file, err := config.LoadOrCreate(config.Defaults)
	if err != nil {
		return nil, fmt.Errorf("loading config: %w", err)
	}
	if portOverride != 0 && portOverride != file.Port {
		file.Port = portOverride
		if err := config.Save(file); err != nil {
			return nil, fmt.Errorf("saving config: %w", err)
		}
	}
	return file, nil
}

func (host *Host) newServerOptions(opts Options, assetStore *assets.Store, logHandler *logs.Handler) server.Options {
	hostName, _ := os.Hostname()
	return server.Options{
		Port:     host.store.Port(),
		Token:    host.store.Token(),
		HostName: hostName,
		Store:    host.store,
		Assets:   assetStore,
		Icons:    icons.NewResolver(assetStore),
		Runner: actions.NewRunner(actions.Options{
			Terminal:   host.store.Settings().Terminal,
			RecordFile: opts.RecordActions,
			Logger:     host.logger,
		}),
		Static:    opts.Static,
		Logger:    host.logger,
		Logs:      logHandler,
		Assistant: host.assistant,
		Network:   host.applyNetwork,
	}
}

// Logger is the host log: file, buffer and stderr.
func (host *Host) Logger() *slog.Logger { return host.logger }

// AssistantStatus is what the desktop window shows about the page builder.
func (host *Host) AssistantStatus() assistant.Status { return host.assistant.Status() }

// SetAssistantKey stores an API key on this computer; the desktop window is the only caller, so
// a key never travels over the network.
func (host *Host) SetAssistantKey(provider, key string) error {
	trimmedKey := strings.TrimSpace(key)
	if err := host.secrets.Set(provider, trimmedKey); err != nil {
		return fmt.Errorf("storing assistant key: %w", err)
	}
	host.logger.Info("assistant key updated", "provider", provider, "set", trimmedKey != "")
	return nil
}

// listen starts the HTTP server and mDNS advertisement on the configured port.
func (host *Host) listen() error {
	host.serverOpts.Port = host.store.Port()
	host.serverOpts.Token = host.store.Token()
	newServer := server.New(host.serverOpts)
	port, err := newServer.Start()
	if err != nil {
		return describeListenError(host.serverOpts.Port, err)
	}
	instanceID := host.store.Token()[:mdnsInstanceIDLength]
	advertiser, err := discovery.Advertise("Paneel on "+host.serverOpts.HostName, port, instanceID)
	if err != nil {
		host.logger.Warn("mdns disabled", "err", err)
	}
	host.mu.Lock()
	host.server = newServer
	host.advertiser = advertiser
	host.port = port
	host.mu.Unlock()
	return nil
}

// applyNetwork persists a new port or token. Clients are dropped so they pair again; a port
// change restarts the listener shortly after.
func (host *Host) applyNetwork(request server.NetworkRequest) (server.NetworkInfo, error) {
	port := host.store.Port()
	if request.Port != 0 {
		if request.Port < minPort || request.Port > maxPort {
			return server.NetworkInfo{}, fmt.Errorf("port must be between %d and %d", minPort, maxPort)
		}
		port = request.Port
	}
	token := host.store.Token()
	if request.RotateToken {
		token = config.NewToken()
	}
	if port == host.store.Port() && token == host.store.Token() {
		return server.NetworkInfo{Port: port, Token: token}, nil
	}
	if err := host.store.SetNetwork(port, token); err != nil {
		return server.NetworkInfo{}, err
	}
	host.mu.Lock()
	previousServer := host.server
	previousPort := host.port
	host.mu.Unlock()
	previousServer.SetToken(token)
	go host.restartAfterNetworkChange(previousServer, previousPort, port)
	return server.NetworkInfo{Port: port, Token: token}, nil
}

// restartAfterNetworkChange drops the paired decks and, when the port changed, moves the
// listener to the new port.
func (host *Host) restartAfterNetworkChange(previousServer *server.Server, previousPort, newPort int) {
	time.Sleep(restartDelay)
	previousServer.CloseClients("pairing changed")
	if newPort == previousPort {
		return
	}
	host.logger.Info("restarting on new port", "port", newPort)
	host.mu.Lock()
	advertiser := host.advertiser
	host.mu.Unlock()
	advertiser.Close()
	ctx, cancel := context.WithTimeout(context.Background(), ShutdownTimeout)
	defer cancel()
	_ = previousServer.Shutdown(ctx)
	if err := host.listen(); err != nil {
		host.logger.Error("restart failed", "err", err)
	}
}

// watchActiveApp forwards focus changes to whichever server instance is current.
func (host *Host) watchActiveApp() {
	ctx, cancel := context.WithCancel(context.Background())
	host.stopActiveAppWatch = cancel
	go func() {
		err := activeapp.Watch(ctx, activeAppInterval, func(app activeapp.App) {
			host.mu.Lock()
			currentServer := host.server
			host.mu.Unlock()
			host.logger.Debug("active app", "name", app.Name, "id", app.ID)
			currentServer.SetActiveApp(app.Name, app.ID)
		})
		if err != nil {
			host.logger.Info("active app detection disabled", "err", err)
		}
	}()
}

func (host *Host) Stop(ctx context.Context) {
	if host.stopActiveAppWatch != nil {
		host.stopActiveAppWatch()
	}
	host.mu.Lock()
	advertiser, currentServer := host.advertiser, host.server
	host.mu.Unlock()
	advertiser.Close()
	_ = currentServer.Shutdown(ctx)
}

func (host *Host) Port() int {
	host.mu.Lock()
	defer host.mu.Unlock()
	return host.port
}

func (host *Host) Token() string { return host.store.Token() }

func (host *Host) ClientCount() int {
	host.mu.Lock()
	defer host.mu.Unlock()
	return host.server.ClientCount()
}
