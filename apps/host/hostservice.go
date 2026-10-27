package main

import (
	"encoding/base64"

	"github.com/paneel-nx/paneel/host/internal/assistant"
	"github.com/paneel-nx/paneel/host/internal/host"
)

// HostService is bound to the desktop UI through Wails bindings.
type HostService struct {
	host *host.Host
}

func NewHostService(instance *host.Host) *HostService {
	return &HostService{host: instance}
}

type HostStatus struct {
	Port        int      `json:"port"`
	Clients     int      `json:"clients"`
	PairingURLs []string `json:"pairingUrls"`
	QRCodePNG   string   `json:"qrCodePng"`
}

func (service *HostService) Status() HostStatus {
	status := HostStatus{
		Port:        service.host.Port(),
		Clients:     service.host.ClientCount(),
		PairingURLs: service.host.PairingURLs(),
	}
	if png, err := service.host.PairingQRPNG(256); err == nil {
		status.QRCodePNG = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
	}
	return status
}

// AssistantStatus tells the window which provider is set up, never the key itself.
func (service *HostService) AssistantStatus() assistant.Status {
	return service.host.AssistantStatus()
}

// SetAssistantKey stores or clears (empty key) an API key for "anthropic" or "openai".
func (service *HostService) SetAssistantKey(provider, key string) error {
	return service.host.SetAssistantKey(provider, key)
}
