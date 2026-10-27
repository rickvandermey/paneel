// Paneel desktop host: a tray application that turns a phone into a control panel.
package main

import (
	"context"
	"embed"
	"io/fs"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"github.com/paneel-nx/paneel/host/internal/host"
)

// The desktop UI (apps/desktop) builds into frontend/dist; the web deck client
// (apps/mobile) builds into static/deck. Both are embedded in the binary.
//
//go:embed all:frontend/dist
var desktopAssets embed.FS

//go:embed all:static/deck
var deckAssets embed.FS

func main() {
	deckFS, err := fs.Sub(deckAssets, "static/deck")
	if err != nil {
		log.Fatal(err)
	}
	instance, err := host.Start(host.Options{Static: deckFS})
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        "Paneel",
		Description: "Your phone as a control panel for your desk",
		Services: []application.Service{
			application.NewService(NewHostService(instance)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(desktopAssets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: false,
		},
	})

	window := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "Paneel",
		Width:            1100,
		Height:           720,
		BackgroundColour: application.NewRGB(17, 24, 39),
		URL:              "/",
	})

	tray := app.SystemTray.New()
	tray.SetLabel("Paneel")
	menu := app.Menu.New()
	menu.Add("Open Paneel").OnClick(func(ctx *application.Context) { window.Show(); window.Focus() })
	menu.AddSeparator()
	menu.Add("Quit").OnClick(func(ctx *application.Context) { app.Quit() })
	tray.SetMenu(menu)

	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(event *application.ApplicationEvent) {
		instance.Logger().Info("desktop app started", "port", instance.Port())
	})

	err = app.Run()
	ctx, cancel := context.WithTimeout(context.Background(), host.ShutdownTimeout)
	defer cancel()
	instance.Stop(ctx)
	if err != nil {
		log.Fatal(err)
	}
}
