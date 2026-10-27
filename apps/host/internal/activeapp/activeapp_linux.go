//go:build linux

package activeapp

func Current() (App, error) { return App{}, ErrNotSupported }
