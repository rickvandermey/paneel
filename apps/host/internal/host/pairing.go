package host

import (
	"fmt"

	"github.com/skip2/go-qrcode"

	"github.com/paneel-nx/paneel/host/internal/discovery"
)

// PairingURLs lists one connect URL per local IPv4 address.
func (host *Host) PairingURLs() []string {
	var urls []string
	for _, ip := range discovery.LocalIPv4s() {
		urls = append(urls, fmt.Sprintf("http://%s:%d/?token=%s", ip, host.Port(), host.store.Token()))
	}
	return urls
}

// PairingQRPNG renders the first pairing URL as a PNG for the desktop UI.
func (host *Host) PairingQRPNG(size int) ([]byte, error) {
	urls := host.PairingURLs()
	if len(urls) == 0 {
		return nil, fmt.Errorf("no network interface")
	}
	return qrcode.Encode(urls[0], qrcode.Medium, size)
}

// PairingQRTerminal renders the first pairing URL as ASCII for the headless binary.
func (host *Host) PairingQRTerminal() string {
	urls := host.PairingURLs()
	if len(urls) == 0 {
		return ""
	}
	code, err := qrcode.New(urls[0], qrcode.Low)
	if err != nil {
		return ""
	}
	return code.ToSmallString(false)
}
