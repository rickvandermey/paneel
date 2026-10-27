// Package icons turns actions into icon assets: app icons from the OS and favicons from the web.
package icons

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/paneel-nx/paneel/host/internal/assets"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

var ErrNoIcon = errors.New("no icon available")
var ErrNotSupported = errors.New("not supported on this platform")

// fetchTimeout bounds one web request; a slow site should not hold up the button editor.
const fetchTimeout = 8 * time.Second

type Resolver struct {
	assets *assets.Store
	client *http.Client
}

func NewResolver(assetStore *assets.Store) *Resolver {
	return &Resolver{assets: assetStore, client: &http.Client{Timeout: fetchTimeout}}
}

// ForAction returns an icon for actions that carry one (launch, url); ErrNoIcon otherwise.
func (resolver *Resolver) ForAction(ctx context.Context, action protocol.Action) (*protocol.IconRef, error) {
	switch action.Kind {
	case protocol.ActionLaunch:
		return resolver.AppIcon(ctx, action.Target)
	case protocol.ActionURL:
		return resolver.Favicon(ctx, action.URL)
	default:
		return nil, ErrNoIcon
	}
}

// ForButton picks the first action that yields an icon.
func (resolver *Resolver) ForButton(ctx context.Context, button protocol.Button) (*protocol.IconRef, error) {
	for _, action := range button.Actions {
		icon, err := resolver.ForAction(ctx, action)
		if err == nil {
			return icon, nil
		}
	}
	return nil, ErrNoIcon
}

func (resolver *Resolver) AppIcon(ctx context.Context, target string) (*protocol.IconRef, error) {
	data, err := appIconPNG(ctx, target)
	if err != nil {
		return nil, err
	}
	return resolver.saveAsIcon(data)
}

// saveAsIcon stores the image bytes as an asset and returns the reference a button carries.
func (resolver *Resolver) saveAsIcon(data []byte) (*protocol.IconRef, error) {
	hash, err := resolver.assets.Put(data)
	if err != nil {
		return nil, err
	}
	return &protocol.IconRef{Source: protocol.IconAsset, Hash: hash}, nil
}
