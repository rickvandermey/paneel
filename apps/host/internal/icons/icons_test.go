package icons

import (
	"bytes"
	"context"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"testing"

	"github.com/paneel-nx/paneel/host/internal/assets"
)

func TestParseIconLinksPrefersLargest(t *testing.T) {
	page := `<html><head>
		<link rel="icon" href="/small.png" sizes="16x16">
		<link rel="shortcut icon" href="/favicon.ico">
		<link rel="apple-touch-icon" href="/touch.png">
		<link rel="icon" href="/big.png" sizes="32x32 192x192">
		<link rel="stylesheet" href="/style.css">
	</head><body><link rel="icon" href="/ignored.png"></body></html>`
	base, _ := url.Parse("https://example.com/path/page")
	found := parseIconLinks(strings.NewReader(page), base)
	var hrefs []string
	for _, item := range found {
		hrefs = append(hrefs, item.href)
	}
	want := []string{"https://example.com/big.png", "https://example.com/touch.png", "https://example.com/small.png", "https://example.com/favicon.ico"}
	if strings.Join(hrefs, ",") != strings.Join(want, ",") {
		t.Fatalf("got %v want %v", hrefs, want)
	}
}

func TestFaviconFallsBackToRootIco(t *testing.T) {
	var buf bytes.Buffer
	_ = png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 1, 1)))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			_, _ = w.Write([]byte(`<html><head><link rel="icon" href="/missing.png"></head></html>`))
		case "/favicon.ico":
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(buf.Bytes())
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	store, _ := assets.New(t.TempDir())
	resolver := NewResolver(store)
	icon, err := resolver.Favicon(context.Background(), server.URL+"/")
	if err != nil {
		t.Fatalf("favicon: %v", err)
	}
	if icon.Source != "asset" || icon.Hash == "" {
		t.Fatalf("icon = %+v", icon)
	}
}

func TestAppIconDarwin(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS only")
	}
	if _, err := exec.LookPath("qlmanage"); err != nil {
		t.Skip("qlmanage not available")
	}
	store, _ := assets.New(t.TempDir())
	resolver := NewResolver(store)
	icon, err := resolver.AppIcon(context.Background(), "Calculator")
	if err != nil {
		t.Fatalf("app icon: %v", err)
	}
	path, contentType, err := store.Open(icon.Hash)
	if err != nil || contentType != "image/png" {
		t.Fatalf("stored icon: path=%s type=%s err=%v", path, contentType, err)
	}
}
