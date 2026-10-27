package icons

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/net/html"

	"github.com/paneel-nx/paneel/host/internal/assets"
	"github.com/paneel-nx/paneel/host/internal/protocol"
)

const (
	// maxPageBytes bounds how much of a page is read for its <link> tags; the head comes first.
	maxPageBytes = 512 << 10
	userAgent    = "paneel/1.0"
	// appleTouchIconSize is the size Apple specifies for touch icons that declare none.
	appleTouchIconSize = 180
	// anySizeRank sorts an icon declared as sizes="any" (usually an SVG) above every bitmap.
	anySizeRank = 1024
)

// iconCandidate is one icon a page declares, with its largest declared size for ranking.
type iconCandidate struct {
	href string
	size int
}

// Favicon fetches the page, prefers the largest declared icon, and falls back to /favicon.ico.
func (resolver *Resolver) Favicon(ctx context.Context, pageURL string) (*protocol.IconRef, error) {
	base, err := url.Parse(pageURL)
	if err != nil || (base.Scheme != "http" && base.Scheme != "https") {
		return nil, fmt.Errorf("%w: invalid url", ErrNoIcon)
	}
	candidates := resolver.declaredIcons(ctx, base)
	fallback := *base
	fallback.Path, fallback.RawQuery, fallback.Fragment = "/favicon.ico", "", ""
	candidates = append(candidates, iconCandidate{href: fallback.String()})
	for _, candidate := range candidates {
		data, err := resolver.download(ctx, candidate.href)
		if err != nil {
			continue
		}
		if icon, err := resolver.saveAsIcon(data); err == nil {
			return icon, nil
		}
	}
	return nil, ErrNoIcon
}

// declaredIcons reads the page's <link> tags; any failure simply means no declared icons.
func (resolver *Resolver) declaredIcons(ctx context.Context, base *url.URL) []iconCandidate {
	response, err := resolver.get(ctx, base.String())
	if err != nil {
		return nil
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return nil
	}
	// response.Request.URL follows redirects, so relative hrefs resolve against the final page.
	return parseIconLinks(io.LimitReader(response.Body, maxPageBytes), response.Request.URL)
}

// parseIconLinks extracts <link rel="icon"> style references, largest first. Reading stops at
// <body>, because icon links belong in the head.
func parseIconLinks(reader io.Reader, base *url.URL) []iconCandidate {
	tokenizer := html.NewTokenizer(reader)
	var found []iconCandidate
	for {
		tokenType := tokenizer.Next()
		if tokenType == html.ErrorToken {
			break
		}
		if tokenType != html.StartTagToken && tokenType != html.SelfClosingTagToken {
			continue
		}
		token := tokenizer.Token()
		if token.Data == "body" {
			break
		}
		if candidate, ok := iconLinkFrom(token, base); ok {
			found = append(found, candidate)
		}
	}
	sort.SliceStable(found, func(a, b int) bool { return found[a].size > found[b].size })
	return found
}

// iconLinkFrom turns a <link> token into a candidate when it declares an icon.
func iconLinkFrom(token html.Token, base *url.URL) (iconCandidate, bool) {
	if token.Data != "link" {
		return iconCandidate{}, false
	}
	var rel, href, sizes string
	for _, attr := range token.Attr {
		switch strings.ToLower(attr.Key) {
		case "rel":
			rel = strings.ToLower(attr.Val)
		case "href":
			href = attr.Val
		case "sizes":
			sizes = attr.Val
		}
	}
	if href == "" || !isIconRel(rel) {
		return iconCandidate{}, false
	}
	resolved, err := base.Parse(href)
	if err != nil {
		return iconCandidate{}, false
	}
	size := parseSize(sizes)
	if strings.Contains(rel, "apple-touch-icon") && size == 0 {
		size = appleTouchIconSize
	}
	return iconCandidate{href: resolved.String(), size: size}, true
}

func isIconRel(rel string) bool {
	for _, part := range strings.Fields(rel) {
		if part == "icon" || part == "apple-touch-icon" || part == "apple-touch-icon-precomposed" {
			return true
		}
	}
	return false
}

// parseSize reads the largest width out of a sizes attribute such as "16x16 32x32".
func parseSize(sizes string) int {
	best := 0
	for _, entry := range strings.Fields(strings.ToLower(sizes)) {
		if entry == "any" {
			best = max(best, anySizeRank)
			continue
		}
		parts := strings.Split(entry, "x")
		if len(parts) != 2 {
			continue
		}
		if value, err := strconv.Atoi(parts[0]); err == nil {
			best = max(best, value)
		}
	}
	return best
}

func (resolver *Resolver) download(ctx context.Context, href string) ([]byte, error) {
	response, err := resolver.get(ctx, href)
	if err != nil {
		return nil, err
	}
	defer func() { _ = response.Body.Close() }()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", response.StatusCode)
	}
	// One byte over the limit is read on purpose, so an oversized icon is reported as such.
	data, err := io.ReadAll(io.LimitReader(response.Body, assets.MaxSize+1))
	if err != nil {
		return nil, err
	}
	if len(data) > assets.MaxSize {
		return nil, assets.ErrTooLarge
	}
	return data, nil
}

// get performs a GET with the host's user agent; the caller closes the body.
func (resolver *Resolver) get(ctx context.Context, href string) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, href, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", userAgent)
	return resolver.client.Do(request)
}
