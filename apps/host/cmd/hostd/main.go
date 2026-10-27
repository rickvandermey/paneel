// hostd runs the host without a window, for development, servers and the e2e suite.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/paneel-nx/paneel/host/internal/host"
)

func main() {
	os.Exit(run())
}

func run() int {
	staticDir := flag.String("static", "", "directory with the web deck client build (optional)")
	port := flag.Int("port", 0, "listen port; overrides and saves the configured port")
	configDir := flag.String("config-dir", "", "config folder instead of the per-user default")
	recordActions := flag.String("record-actions", "", "dry run: append pressed actions to this file instead of executing them")
	verbose := flag.Bool("verbose", false, "log debug lines (active app changes, terminal decisions, API calls)")
	fakeAssistant := flag.Bool("assistant-fake", false, "answer page-builder requests without a network, for tests and demos")
	flag.Parse()

	// Only for messages before the host log exists; the host logs through its own handler.
	startupLogger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	opts := host.Options{
		Port:          *port,
		ConfigDir:     *configDir,
		RecordActions: *recordActions,
		Verbose:       *verbose,
		FakeAssistant: *fakeAssistant,
	}
	if *recordActions != "" {
		startupLogger.Warn("dry run: actions are recorded, not executed", "file", *recordActions)
	}
	if *staticDir != "" {
		opts.Static = os.DirFS(*staticDir)
	}
	instance, err := host.Start(opts)
	if err != nil {
		startupLogger.Error("start failed", "err", err)
		return 1
	}
	fmt.Println("Pair your phone by opening one of these URLs (same Wi-Fi):")
	for _, url := range instance.PairingURLs() {
		fmt.Println("  " + url)
	}
	fmt.Println(instance.PairingQRTerminal())

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), host.ShutdownTimeout)
	defer cancel()
	instance.Stop(ctx)
	return 0
}
