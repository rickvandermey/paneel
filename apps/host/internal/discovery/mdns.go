// Package discovery advertises the host on the local network via mDNS/DNS-SD.
package discovery

import (
	"fmt"
	"net"

	"github.com/grandcat/zeroconf"
)

const ServiceType = "_deckhost._tcp"

type Advertiser struct {
	server *zeroconf.Server
}

func Advertise(instance string, port int, hostID string) (*Advertiser, error) {
	server, err := zeroconf.Register(instance, ServiceType, "local.", port, []string{"hostId=" + hostID, "v=1"}, nil)
	if err != nil {
		return nil, fmt.Errorf("mdns register: %w", err)
	}
	return &Advertiser{server: server}, nil
}

func (advertiser *Advertiser) Close() {
	if advertiser != nil && advertiser.server != nil {
		advertiser.server.Shutdown()
	}
}

// LocalIPv4s lists the non-loopback IPv4 addresses, used for the pairing QR code.
func LocalIPv4s() []string {
	var result []string
	interfaces, err := net.Interfaces()
	if err != nil {
		return result
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP.To4() == nil {
				continue
			}
			result = append(result, ipNet.IP.String())
		}
	}
	return result
}
