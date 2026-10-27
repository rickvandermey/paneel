//go:build linux

package icons

import "context"

func appIconPNG(context.Context, string) ([]byte, error) {
	return nil, ErrNotSupported
}
