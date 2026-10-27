// Package protocol defines the JSON messages and models exchanged between host and clients.
// The TypeScript mirror lives in libs/protocol; keep both in sync.
package protocol

import "encoding/json"

const Version = 2

// Client -> host message types.
const (
	TypeHello   = "hello"
	TypePress   = "press"
	TypeRun     = "run"
	TypePing    = "ping"
	TypeCommand = "command"
	TypeSync    = "sync"
	TypeLog     = "log"
	// TypeRelease is no longer sent: hold-to-repeat lives in the deck. The host still accepts it
	// from older decks without complaint.
	TypeRelease = "release"
)

// Host -> client message types.
const (
	TypeWelcome       = "welcome"
	TypeConfig        = "config"
	TypeChanged       = "changed"
	TypeCommandResult = "commandResult"
	TypeAck           = "ack"
	TypeError         = "error"
	TypePong          = "pong"
	TypeActiveApp     = "activeApp"
	TypeButtonState   = "buttonState"
)

// LogMessage is a line the deck adds to the host log, so one file tells the whole story.
type LogMessage struct {
	Type    string `json:"type"`
	Level   string `json:"level"`
	Message string `json:"message"`
	Fields  string `json:"fields,omitempty"`
}

type Envelope struct {
	Type string `json:"type"`
}

type Hello struct {
	Type     string `json:"type"`
	ClientID string `json:"clientId"`
	Name     string `json:"name"`
	Version  int    `json:"version"`
}

type Press struct {
	Type     string `json:"type"`
	ButtonID string `json:"buttonId"`
	SentAt   int64  `json:"sentAt,omitempty"`
}

// Run executes actions that are not stored as a button, such as the example keys on the welcome
// screen or a try-out from the editor. The ack carries RunID as its buttonId.
type Run struct {
	Type    string   `json:"type"`
	RunID   string   `json:"runId"`
	Actions []Action `json:"actions"`
	SentAt  int64    `json:"sentAt,omitempty"`
}

type Ping struct {
	Type   string `json:"type"`
	SentAt int64  `json:"sentAt"`
}

type CommandMessage struct {
	Type         string  `json:"type"`
	CommandID    string  `json:"commandId"`
	BaseRevision int64   `json:"baseRevision"`
	Command      Command `json:"command"`
}

type Sync struct {
	Type          string `json:"type"`
	SinceRevision int64  `json:"sinceRevision"`
}

type Welcome struct {
	Type     string `json:"type"`
	HostName string `json:"hostName"`
	Platform string `json:"platform"`
	Version  int    `json:"version"`
	// DeckBuild identifies the web deck build the host serves; a deck reloads when it changes.
	DeckBuild string `json:"deckBuild,omitempty"`
}

type ConfigMessage struct {
	Type   string `json:"type"`
	Config Config `json:"config"`
}

type Changed struct {
	Type      string  `json:"type"`
	Revision  int64   `json:"revision"`
	CommandID string  `json:"commandId,omitempty"`
	Command   Command `json:"command"`
}

type CommandResult struct {
	Type      string `json:"type"`
	CommandID string `json:"commandId"`
	OK        bool   `json:"ok"`
	Revision  int64  `json:"revision"`
	Error     string `json:"error,omitempty"`
}

type Ack struct {
	Type        string `json:"type"`
	ButtonID    string `json:"buttonId"`
	OK          bool   `json:"ok"`
	Error       string `json:"error,omitempty"`
	SentAt      int64  `json:"sentAt,omitempty"`
	ExecutionMs int64  `json:"executionMs"`
}

// ActiveApp tells decks which application has the focus; pages with a matching appMatch switch in.
type ActiveApp struct {
	Type string `json:"type"`
	Name string `json:"name"`
	ID   string `json:"id"`
}

type Pong struct {
	Type   string `json:"type"`
	SentAt int64  `json:"sentAt"`
}

type ErrorMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// Config is the client-facing configuration: everything except the pairing secret and port.
type Config struct {
	SchemaVersion int       `json:"schemaVersion"`
	Revision      int64     `json:"revision"`
	Settings      Settings  `json:"settings"`
	Profiles      []Profile `json:"profiles"`
}

type Settings struct {
	Terminal string `json:"terminal"`
	// Theme is the visual style shared by every client; empty means the default.
	Theme string `json:"theme"`
	// SmartPages is "explicit" when only pages with an appMatch may follow the focused app;
	// empty or "buttons" also lets pages follow the apps their launch buttons open.
	SmartPages string `json:"smartPages,omitempty"`
	// VerboseLogging records debug lines (active app changes, terminal decisions, API calls).
	VerboseLogging bool `json:"verboseLogging,omitempty"`
	// Assistant configures the page builder; the API keys live outside the config.
	Assistant AssistantSettings `json:"assistant,omitzero"`
	// User-made themes and palettes; the editor derives every other token from these few values.
	CustomThemes   []CustomTheme   `json:"customThemes,omitempty"`
	CustomPalettes []CustomPalette `json:"customPalettes,omitempty"`
}

// AssistantSettings picks the model behind "Build a page with AI".
type AssistantSettings struct {
	// Provider is "anthropic" (default) or "openai" (also Ollama, LM Studio, OpenRouter via BaseURL).
	Provider string `json:"provider,omitempty"`
	Model    string `json:"model,omitempty"`
	// BaseURL replaces the OpenAI endpoint for compatible servers.
	BaseURL string `json:"baseUrl,omitempty"`
	// ShareApps lets the names of installed apps go to the provider, so pages can follow them.
	ShareApps bool `json:"shareApps,omitempty"`
}

type CustomTheme struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Base is the built-in theme whose remaining tokens (fonts, danger colors) are kept.
	Base    string `json:"base"`
	Bg      string `json:"bg"`
	Surface string `json:"surface"`
	Text    string `json:"text"`
	Accent  string `json:"accent"`
	// Light is an optional glow color behind everything; empty means a flat background.
	Light     string `json:"light,omitempty"`
	KeyRadius int    `json:"keyRadius"`
	KeyMix    int    `json:"keyMix"`
	Blur      int    `json:"blur"`
}

type CustomPalette struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Colors []string `json:"colors"`
	Tint   string   `json:"tint,omitempty"`
}

type Profile struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Icon     *IconRef `json:"icon,omitempty"`
	AppMatch string   `json:"appMatch,omitempty"`
	// Palette is the id of a per-page color set the editor uses for new and recolored buttons.
	Palette string   `json:"palette,omitempty"`
	Buttons []Button `json:"buttons"`
}

type Button struct {
	ID        string   `json:"id"`
	Label     string   `json:"label,omitempty"`
	ShowLabel bool     `json:"showLabel"`
	Color     string   `json:"color"`
	Icon      *IconRef `json:"icon,omitempty"`
	Actions   []Action `json:"actions"`
	Folder    []Button `json:"folder"`
	// Repeat lets the deck keep pressing while the key is held, for volume and the like.
	Repeat bool `json:"repeat,omitempty"`
	// Toggle makes the button two-state: the first press runs Actions and turns it on, the next
	// press runs Toggle.Actions and turns it off. Look overrides apply while on.
	Toggle *ToggleState `json:"toggle,omitempty"`
}

type ToggleState struct {
	Label   string   `json:"label,omitempty"`
	Color   string   `json:"color,omitempty"`
	Icon    *IconRef `json:"icon,omitempty"`
	Actions []Action `json:"actions"`
}

// ButtonState carries which toggle buttons are currently on; the host keeps this in memory.
type ButtonState struct {
	Type   string          `json:"type"`
	States map[string]bool `json:"states"`
}

// Icon sources.
const (
	IconAsset       = "asset"
	IconPhosphor    = "phosphor"
	IconSimpleIcons = "simple-icons"
	IconEmoji       = "emoji"
)

type IconRef struct {
	Source string `json:"source"`
	Hash   string `json:"hash,omitempty"`
	Name   string `json:"name,omitempty"`
	Weight string `json:"weight,omitempty"`
	Slug   string `json:"slug,omitempty"`
	Value  string `json:"value,omitempty"`
}

// Action kinds.
const (
	ActionHotkey        = "hotkey"
	ActionText          = "text"
	ActionLaunch        = "launch"
	ActionURL           = "url"
	ActionShell         = "shell"
	ActionTerminal      = "terminal"
	ActionDelay         = "delay"
	ActionMedia         = "media"
	ActionSwitchProfile = "switchProfile"
	ActionAppControl    = "appControl"
)

// Terminal window choices.
const (
	TerminalWindowReuse  = "reuse"
	TerminalWindowNew    = "new"
	TerminalWindowEditor = "editor"
)

// Apps an appControl action can address.
const (
	AppSpotify = "spotify"
	AppMusic   = "music"
)

// App controls; playPause, next and previous share their names with the media controls.
const (
	AppControlShuffle = "shuffle"
	AppControlRepeat  = "repeat"
)

// Values for the two-state app controls (shuffle, repeat).
const (
	AppValueOn     = "on"
	AppValueOff    = "off"
	AppValueToggle = "toggle"
)

// Media controls.
const (
	MediaPlayPause      = "playPause"
	MediaNext           = "next"
	MediaPrevious       = "previous"
	MediaVolumeUp       = "volumeUp"
	MediaVolumeDown     = "volumeDown"
	MediaMute           = "mute"
	MediaBrightnessUp   = "brightnessUp"
	MediaBrightnessDown = "brightnessDown"
)

type Action struct {
	Kind      string   `json:"kind"`
	Key       string   `json:"key,omitempty"`
	Modifiers []string `json:"modifiers,omitempty"`
	Text      string   `json:"text,omitempty"`
	// Target is the app to open for a launch action, or the app to bring to the front before a
	// hotkey is sent, so shortcuts reach apps that are not focused.
	Target  string `json:"target,omitempty"`
	URL     string `json:"url,omitempty"`
	Command string `json:"command,omitempty"`
	WorkDir string `json:"workDir,omitempty"`
	// Prompt is text for the program a terminal action starts, such as a Claude prompt. When that
	// program is already running in the reused terminal, only the prompt is sent.
	Prompt string `json:"prompt,omitempty"`
	// Window is where a terminal action runs: TerminalWindowReuse (also the default when empty)
	// types into the focused editor's terminal or else the open terminal window; TerminalWindowNew
	// always opens a window. TerminalWindowEditor is an older spelling of reuse.
	Window string `json:"window,omitempty"`
	Millis int    `json:"millis,omitempty"`
	// Control names a media key for media actions and a command for appControl actions.
	Control   string `json:"control,omitempty"`
	ProfileID string `json:"profileId,omitempty"`
	// App and Value belong to appControl: which player to drive and, for shuffle and repeat,
	// whether to switch it on, off or toggle it.
	App   string `json:"app,omitempty"`
	Value string `json:"value,omitempty"`
	// Silent suppresses the desktop notification a shell action shows when it finishes.
	Silent bool `json:"silent,omitempty"`
}

// Command types.
const (
	CmdProfileCreate  = "profile.create"
	CmdProfileUpdate  = "profile.update"
	CmdProfileDelete  = "profile.delete"
	CmdProfileMove    = "profile.move"
	CmdButtonCreate   = "button.create"
	CmdButtonUpdate   = "button.update"
	CmdButtonDelete   = "button.delete"
	CmdButtonMove     = "button.move"
	CmdSettingsUpdate = "settings.update"
)

// Command is a tagged union: which fields apply depends on Type.
type Command struct {
	Type      string          `json:"type"`
	ID        string          `json:"id,omitempty"`
	ProfileID string          `json:"profileId,omitempty"`
	ParentID  string          `json:"parentId,omitempty"`
	Index     *int            `json:"index,omitempty"`
	Profile   *Profile        `json:"profile,omitempty"`
	Button    *Button         `json:"button,omitempty"`
	Patch     json.RawMessage `json:"patch,omitempty"`
}
