package icons

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9.+-]{1,64}$`)
var hexPattern = regexp.MustCompile(`^[0-9a-fA-F]{6}$`)

// Logo downloads a Simple Icons brand logo in one flat color and stores it as an asset. The deck
// only ever needs the few logos that were picked, so nothing is bundled.
func (resolver *Resolver) Logo(ctx context.Context, slug, color string) (*protocol.IconRef, error) {
	slug = strings.ToLower(strings.TrimSpace(slug))
	color = strings.TrimPrefix(strings.TrimSpace(color), "#")
	if !slugPattern.MatchString(slug) {
		return nil, fmt.Errorf("invalid logo slug %q", slug)
	}
	if color == "" {
		color = "ffffff"
	}
	if !hexPattern.MatchString(color) {
		return nil, fmt.Errorf("invalid logo color %q", color)
	}
	data, err := resolver.download(ctx, fmt.Sprintf("https://cdn.simpleicons.org/%s/%s", slug, color))
	if err != nil {
		return nil, fmt.Errorf("logo %s: %w", slug, err)
	}
	return resolver.saveAsIcon(data)
}
