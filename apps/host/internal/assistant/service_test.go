package assistant

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

func testRequest(message string) Request {
	return Request{
		Messages: []Message{{Role: "user", Content: message}},
		Catalog: []CatalogEntry{
			{Label: "Copy", Group: "Editing", Summary: "hotkey cmd+c"},
			{Label: "Paste", Group: "Editing", Summary: "hotkey cmd+v"},
			{Label: "Play / Pause", Group: "Media"},
			{Label: "Git status", Group: "Coding", Summary: "terminal git status"},
		},
		Pages:    []PageSummary{{ID: "p1", Name: "Start", Buttons: []string{"Copy"}}},
		Palettes: []string{"ocean", "mint"},
		Platform: "darwin",
	}
}

type scriptedProvider struct {
	replies []string
	calls   int
	seen    [][]Message
}

func (provider *scriptedProvider) Complete(_ context.Context, _ string, _ string, messages []Message, _ map[string]any) (string, Usage, error) {
	provider.seen = append(provider.seen, messages)
	reply := provider.replies[min(provider.calls, len(provider.replies)-1)]
	provider.calls++
	return reply, Usage{}, nil
}

func newTestService(t *testing.T, provider Provider, settings protocol.AssistantSettings) *Service {
	t.Helper()
	return New(Options{
		Settings:  func() protocol.AssistantSettings { return settings },
		Secrets:   NewSecrets(t.TempDir()),
		Providers: map[string]Provider{ProviderAnthropic: provider, ProviderOpenAI: provider},
	})
}

func TestPlanAcceptsCatalogPresetsAndNormalizesThem(t *testing.T) {
	provider := &scriptedProvider{replies: []string{`{"kind":"plan","message":"Editing keys.","plan":{"target":"new","name":"Editing","icon":null,"palette":"mint","apps":[],"buttons":[{"preset":"copy","label":null,"icon":null,"actions":null},{"preset":"Paste","label":"ignored","icon":null,"actions":null}]}}`}}
	service := newTestService(t, provider, protocol.AssistantSettings{})
	reply, err := service.Plan(context.Background(), testRequest("a page for editing"))
	if err != nil {
		t.Fatal(err)
	}
	if reply.Kind != KindPlan || reply.Plan == nil || len(reply.Plan.Buttons) != 2 {
		t.Fatalf("reply = %+v", reply)
	}
	if reply.Plan.Buttons[0].Preset != "Copy" || reply.Plan.Buttons[1].Label != "" {
		t.Fatalf("presets should be normalized to catalog labels and stripped: %+v", reply.Plan.Buttons)
	}
	if reply.Plan.Palette != "mint" {
		t.Fatalf("palette kept: %+v", reply.Plan)
	}
	if len(provider.seen) != 1 || !strings.Contains(provider.seen[0][0].Content, "<context>") || provider.seen[0][1].Content != "a page for editing" {
		t.Fatalf("context should precede the user's message: %+v", provider.seen)
	}
}

func TestUnknownAndRepeatedPresetsAreDroppedWhenOthersRemain(t *testing.T) {
	raw := `{"kind":"plan","message":"m","plan":{"target":"new","name":"Mix","icon":null,"palette":null,"apps":[],"buttons":[{"preset":"Copy","label":null,"icon":null,"actions":null},{"preset":"Teleport","label":null,"icon":null,"actions":null},{"preset":"copy","label":null,"icon":null,"actions":null},{"preset":"Paste","label":null,"icon":null,"actions":null}]}}`
	reply, err := parseReply(raw, testRequest("x"))
	if err != nil {
		t.Fatal(err)
	}
	if len(reply.Plan.Buttons) != 2 || reply.Plan.Buttons[0].Preset != "Copy" || reply.Plan.Buttons[1].Preset != "Paste" {
		t.Fatalf("buttons = %+v", reply.Plan.Buttons)
	}
}

func TestPlanRetriesOnceWhenTheReplyIsInvalid(t *testing.T) {
	provider := &scriptedProvider{replies: []string{
		`{"kind":"plan","message":"x","plan":{"target":"new","name":"Nope","icon":null,"palette":null,"apps":[],"buttons":[{"preset":"Teleport","label":null,"icon":null,"actions":null}]}}`,
		`{"kind":"plan","message":"Better.","plan":{"target":"new","name":"Media","icon":null,"palette":"nope","apps":[],"buttons":[{"preset":"Play / Pause","label":null,"icon":null,"actions":null}]}}`,
	}}
	service := newTestService(t, provider, protocol.AssistantSettings{})
	reply, err := service.Plan(context.Background(), testRequest("music"))
	if err != nil {
		t.Fatal(err)
	}
	if provider.calls != 2 {
		t.Fatalf("expected one retry, got %d calls", provider.calls)
	}
	last := provider.seen[1]
	if !strings.Contains(last[len(last)-1].Content, `preset "Teleport" is not in the catalog`) {
		t.Fatalf("the retry should name the problem: %q", last[len(last)-1].Content)
	}
	if reply.Plan.Palette != "" {
		t.Fatalf("unknown palette should be dropped, got %q", reply.Plan.Palette)
	}
}

func TestPlanGivesUpAfterTwoInvalidReplies(t *testing.T) {
	provider := &scriptedProvider{replies: []string{`not json at all`}}
	service := newTestService(t, provider, protocol.AssistantSettings{})
	if _, err := service.Plan(context.Background(), testRequest("music")); err == nil {
		t.Fatal("expected an error")
	}
}

func TestCustomButtonsNeedValidActions(t *testing.T) {
	request := testRequest("x")
	cases := map[string]string{
		"hotkey without key":     `{"kind":"hotkey","key":"","modifiers":["cmd"],"target":"","url":"","command":"","prompt":"","text":"","control":""}`,
		"url without scheme":     `{"kind":"url","key":"","modifiers":null,"target":"","url":"github.com","command":"","prompt":"","text":"","control":""}`,
		"disallowed kind":        `{"kind":"appControl","key":"","modifiers":null,"target":"","url":"","command":"","prompt":"","text":"","control":""}`,
		"empty terminal command": `{"kind":"terminal","key":"","modifiers":null,"target":"","url":"","command":" ","prompt":"","text":"","control":""}`,
	}
	for name, action := range cases {
		raw := `{"kind":"plan","message":"m","plan":{"target":"new","name":"P","icon":null,"palette":null,"apps":[],"buttons":[{"preset":null,"label":"Custom","icon":null,"actions":[` + action + `]}]}}`
		if _, err := parseReply(raw, request); err == nil {
			t.Fatalf("%s should be rejected when it is the only button", name)
		}
		withPreset := `{"kind":"plan","message":"m","plan":{"target":"new","name":"P","icon":null,"palette":null,"apps":[],"buttons":[{"preset":"Copy","label":null,"icon":null,"actions":null},{"preset":null,"label":"Custom","icon":null,"actions":[` + action + `]}]}}`
		reply, err := parseReply(withPreset, request)
		if err != nil || len(reply.Plan.Buttons) != 1 || reply.Plan.Buttons[0].Preset != "Copy" {
			t.Fatalf("%s should be dropped while the valid preset stays: %+v %v", name, reply.Plan, err)
		}
	}
	good := `{"kind":"plan","message":"m","plan":{"target":"current","name":"","icon":null,"palette":null,"apps":[],"buttons":[{"preset":null,"label":"Docs","icon":"book","actions":[{"kind":"url","key":"","modifiers":null,"target":"","url":"https://docs.example.com","command":"","prompt":"","text":"","control":""}]}]}}`
	reply, err := parseReply(good, request)
	if err != nil {
		t.Fatal(err)
	}
	if reply.Plan.Target != TargetCurrentPage || reply.Plan.Buttons[0].Actions[0].URL != "https://docs.example.com" {
		t.Fatalf("reply = %+v", reply.Plan)
	}
}

func TestQuestionAndDeclineDropAnyPlan(t *testing.T) {
	request := testRequest("x")
	reply, err := parseReply(`{"kind":"decline","message":"I can only help you build pages for your deck.","plan":{"target":"new","name":"Sneaky","icon":null,"palette":null,"apps":[],"buttons":[]}}`, request)
	if err != nil || reply.Plan != nil {
		t.Fatalf("decline must not carry a plan: %+v %v", reply, err)
	}
	if _, err := parseReply(`{"kind":"plan","message":"m","plan":null}`, request); err == nil {
		t.Fatal("plan without a plan body should fail")
	}
	if _, err := parseReply(`{"kind":"chat","message":"hi","plan":null}`, request); err == nil {
		t.Fatal("unknown kinds should fail")
	}
}

func TestFakeProviderWalksTheWholeFlow(t *testing.T) {
	service := New(Options{Fake: true, Secrets: NewSecrets(t.TempDir())})
	if status := service.Status(); !status.Configured || status.Provider != ProviderFake {
		t.Fatalf("fake should count as configured: %+v", status)
	}
	reply, err := service.Plan(context.Background(), testRequest("Make a page with Copy and Paste"))
	if err != nil {
		t.Fatal(err)
	}
	if reply.Kind != KindPlan || len(reply.Plan.Buttons) != 2 || reply.Plan.Buttons[0].Preset != "Copy" || reply.Plan.Name != "Copy" {
		t.Fatalf("reply = %+v plan=%+v", reply, reply.Plan)
	}
	declined, _ := service.Plan(context.Background(), testRequest("Tell me a joke"))
	if declined.Kind != KindDecline {
		t.Fatalf("off-topic should decline: %+v", declined)
	}
	question, _ := service.Plan(context.Background(), testRequest("What can you do?"))
	if question.Kind != KindQuestion {
		t.Fatalf("a question without a page should ask back: %+v", question)
	}
}

func TestNotConfiguredAndShareApps(t *testing.T) {
	service := New(Options{Secrets: NewSecrets(t.TempDir())})
	t.Setenv("ANTHROPIC_API_KEY", "")
	if status := service.Status(); status.Configured || status.Provider != ProviderAnthropic || status.Model != "claude-opus-5-5" {
		t.Fatalf("status = %+v", status)
	}
	if _, err := service.Plan(context.Background(), testRequest("x")); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
	provider := &scriptedProvider{replies: []string{`{"kind":"question","message":"Which apps?","plan":null}`}}
	withApps := newTestService(t, provider, protocol.AssistantSettings{ShareApps: false})
	request := testRequest("x")
	request.Apps = []string{"Spotify"}
	if _, err := withApps.Plan(context.Background(), request); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(provider.seen[0][0].Content, "Spotify") {
		t.Fatal("installed apps must stay home unless shareApps is on")
	}
}

func TestSecretsFileIsPrivateAndEnvWins(t *testing.T) {
	dir := t.TempDir()
	secrets := NewSecrets(dir)
	if err := secrets.Set(ProviderOpenAI, "sk-file"); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(dir, SecretsFile))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("secrets file should be 0600: %v %v", info, err)
	}
	t.Setenv("OPENAI_API_KEY", "sk-env")
	if secrets.Key(ProviderOpenAI) != "sk-env" {
		t.Fatal("environment should win")
	}
	t.Setenv("OPENAI_API_KEY", "")
	if secrets.Key(ProviderOpenAI) != "sk-file" {
		t.Fatal("file key should be used without the environment")
	}
	if err := secrets.Set(ProviderOpenAI, ""); err != nil || secrets.Key(ProviderOpenAI) != "" {
		t.Fatal("empty key should clear")
	}
}

func TestSchemaIsStrict(t *testing.T) {
	schema := ReplySchema()
	data, err := json.Marshal(schema)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`"additionalProperties":false`, `"required":["kind","message","plan"]`, `"enum":["question","plan","decline"]`} {
		if !strings.Contains(string(data), want) {
			t.Fatalf("schema should contain %s", want)
		}
	}
}

func TestContextMessageIsStableAndDelimited(t *testing.T) {
	request := testRequest("x")
	first, second := contextMessage(request), contextMessage(request)
	if first != second {
		t.Fatal("the context must render identically for caching")
	}
	if !strings.HasPrefix(first, "<context>") || !strings.HasSuffix(first, "</context>") {
		t.Fatalf("context should be delimited: %q", first)
	}
	if !strings.Contains(first, "Coding: Git status [terminal git status];") {
		t.Fatalf("catalog line missing: %q", first)
	}
}

func TestCustomButtonsThatMatchACatalogLabelBecomePresets(t *testing.T) {
	request := testRequest("x")
	raw := `{"kind":"plan","message":"m","plan":{"target":"new","name":"Media","icon":null,"palette":null,"apps":[],"buttons":[
		{"preset":null,"label":"play/pause","icon":"play","actions":[{"kind":"media","key":"","modifiers":null,"target":"","url":"","command":"","prompt":"","text":"","control":""}]},
		{"preset":"GIT STATUS","label":null,"icon":null,"actions":null},
		{"preset":null,"label":"Docs","icon":null,"actions":[{"kind":"url","key":"","modifiers":null,"target":"","url":"https://example.com","command":"","prompt":"","text":"","control":""}]}]}}`
	reply, err := parseReply(raw, request)
	if err != nil {
		t.Fatal(err)
	}
	buttons := reply.Plan.Buttons
	if buttons[0].Preset != "Play / Pause" || buttons[0].Actions != nil {
		t.Fatalf("label should resolve to the catalog preset: %+v", buttons[0])
	}
	if buttons[1].Preset != "Git status" {
		t.Fatalf("preset matching ignores case and punctuation: %+v", buttons[1])
	}
	if buttons[2].Preset != "" || buttons[2].Label != "Docs" {
		t.Fatalf("a real custom key stays custom: %+v", buttons[2])
	}
}

func TestMediaControlIsInferredFromTheLabel(t *testing.T) {
	request := testRequest("x")
	media := func(label string) string {
		return `{"preset":null,"label":"` + label + `","icon":null,"actions":[{"kind":"media","key":"","modifiers":null,"target":"","url":"","command":"","prompt":"","text":"","control":null}]}`
	}
	raw := `{"kind":"plan","message":"m","plan":{"target":"new","name":"Music","icon":null,"palette":null,"apps":[],"buttons":[` + media("Next song") + `,` + media("Volume up") + `]}}`
	reply, err := parseReply(raw, request)
	if err != nil {
		t.Fatal(err)
	}
	if reply.Plan.Buttons[0].Actions[0].Control != "next" || reply.Plan.Buttons[1].Actions[0].Control != "volumeUp" {
		t.Fatalf("controls = %+v", reply.Plan.Buttons)
	}
	if _, err := parseReply(`{"kind":"plan","message":"m","plan":{"target":"new","name":"Music","icon":null,"palette":null,"apps":[],"buttons":[`+media("Spotify Controls")+`]}}`, request); err == nil {
		t.Fatal("a label that says nothing about the control still fails when it is the only key")
	}
}
