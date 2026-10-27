package actions

import (
	"testing"

	"github.com/paneel-nx/paneel/host/internal/activeapp"
)

func TestMatchesAppIgnoresCaseAndExtensions(t *testing.T) {
	cases := []struct {
		current activeapp.App
		target  string
		want    bool
	}{
		{activeapp.App{Name: "Spotify", ID: "com.spotify.client"}, "Spotify.app", true},
		{activeapp.App{Name: "zoom.us", ID: "us.zoom.xos"}, "zoom.us", true},
		{activeapp.App{Name: "Spotify", ID: "Spotify.exe"}, `C:\Users\me\Spotify.exe`, true},
		{activeapp.App{Name: "Microsoft Teams", ID: "com.microsoft.teams2"}, "Teams", true},
		{activeapp.App{Name: "Finder", ID: "com.apple.finder"}, "Spotify", false},
		{activeapp.App{}, "Spotify", false},
	}
	for _, testCase := range cases {
		if got := matchesApp(testCase.current, testCase.target); got != testCase.want {
			t.Errorf("matchesApp(%+v, %q) = %v, want %v", testCase.current, testCase.target, got, testCase.want)
		}
	}
}
