// Package assistant turns a short conversation into a page proposal. The model never edits the
// configuration: it answers in one fixed shape (a question, a plan, or a decline), the host
// validates that shape against the catalog the deck sent, and the deck applies an accepted plan
// through the ordinary commands. Nothing but page building fits through this interface.
package assistant

import "github.com/paneel-nx/paneel/host/internal/protocol"

// Providers the user can pick.
const (
	ProviderAnthropic = "anthropic"
	ProviderOpenAI    = "openai"
	ProviderFake      = "fake"
)

// Message is one conversation turn as the deck keeps it: user text, or the assistant's JSON reply.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CatalogEntry is a ready-made button the deck offers; the model refers to it by label.
type CatalogEntry struct {
	Label   string `json:"label"`
	Group   string `json:"group"`
	Summary string `json:"summary,omitempty"`
}

// PageSummary is what the model may know about an existing page.
type PageSummary struct {
	ID      string   `json:"id"`
	Name    string   `json:"name"`
	Buttons []string `json:"buttons"`
}

// Request is what the deck sends for one turn.
type Request struct {
	Messages    []Message      `json:"messages"`
	Catalog     []CatalogEntry `json:"catalog"`
	Pages       []PageSummary  `json:"pages"`
	CurrentPage string         `json:"currentPage,omitempty"`
	Apps        []string       `json:"apps,omitempty"`
	Palettes    []string       `json:"palettes"`
	Platform    string         `json:"platform"`
}

// Reply kinds.
const (
	KindQuestion = "question"
	KindPlan     = "plan"
	KindDecline  = "decline"
)

// Reply is the only shape the model may answer in.
type Reply struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
	Plan    *Plan  `json:"plan"`
}

// Plan targets.
const (
	TargetNewPage     = "new"
	TargetCurrentPage = "current"
)

type Plan struct {
	Target  string       `json:"target"`
	Name    string       `json:"name"`
	Icon    string       `json:"icon"`
	Palette string       `json:"palette"`
	Apps    []string     `json:"apps"`
	Buttons []PlanButton `json:"buttons"`
}

// PlanButton is either a catalog preset (by label) or a custom button with explicit actions.
type PlanButton struct {
	Preset  string       `json:"preset"`
	Label   string       `json:"label"`
	Icon    string       `json:"icon"`
	Actions []PlanAction `json:"actions"`
}

// PlanAction is the subset of the action model the assistant may produce; the deck turns it into
// a protocol.Action. Fields that do not apply to a kind stay empty.
type PlanAction struct {
	Kind      string   `json:"kind"`
	Key       string   `json:"key"`
	Modifiers []string `json:"modifiers"`
	Target    string   `json:"target"`
	URL       string   `json:"url"`
	Command   string   `json:"command"`
	Prompt    string   `json:"prompt"`
	Text      string   `json:"text"`
	Control   string   `json:"control"`
}

// Status tells the deck what the computer is set up with; never the key itself.
type Status struct {
	Provider   string `json:"provider"`
	Model      string `json:"model"`
	BaseURL    string `json:"baseUrl,omitempty"`
	Configured bool   `json:"configured"`
	ShareApps  bool   `json:"shareApps"`
}

// Usage is what one turn cost, for the log.
type Usage struct {
	InputTokens     int
	CacheReadTokens int
	OutputTokens    int
	// ValidationRetry is set when the first reply was off-schema and a corrective turn ran.
	ValidationRetry bool
}

// allowedActionKinds is what a custom button may do; delays, profile switches and app controls
// are left to the editor.
var allowedActionKinds = map[string]bool{
	protocol.ActionHotkey: true, protocol.ActionText: true, protocol.ActionLaunch: true,
	protocol.ActionURL: true, protocol.ActionShell: true, protocol.ActionTerminal: true,
	protocol.ActionMedia: true,
}
