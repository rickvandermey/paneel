package assistant

import (
	"context"
	"encoding/json"
	"regexp"
	"strings"
)

// fakeProvider answers without a network: it picks catalog presets whose label shares a word
// with the request, which is enough to walk through the whole flow in tests and demos.
type fakeProvider struct{}

var contextPattern = regexp.MustCompile(`(?s)<context>.*?</context>`)

// fallbackPresetCount is how many catalog keys a plan gets when the request names none.
const fallbackPresetCount = 4

func (fakeProvider) Complete(_ context.Context, _, _ string, messages []Message, _ map[string]any) (string, Usage, error) {
	lastRequest, contextText := splitFakeMessages(messages)
	lower := strings.ToLower(lastRequest)
	var reply Reply
	switch {
	case strings.Contains(lower, "weather") || strings.Contains(lower, "joke") || strings.Contains(lower, "poem"):
		reply = Reply{Kind: KindDecline, Message: "I can only help you build pages for your deck."}
	case strings.HasSuffix(strings.TrimSpace(lower), "?") && !strings.Contains(lower, "page"):
		reply = Reply{Kind: KindQuestion, Message: "Which apps or tasks should the page cover?"}
	default:
		reply = fakePlanReply(lastRequest, contextText)
	}
	data, _ := json.Marshal(reply)
	return string(data), Usage{}, nil
}

// splitFakeMessages separates the rendered context from the user's latest request.
func splitFakeMessages(messages []Message) (lastRequest, contextText string) {
	for _, message := range messages {
		if message.Role != "user" {
			continue
		}
		if contextPattern.MatchString(message.Content) {
			contextText = message.Content
			continue
		}
		lastRequest = message.Content
	}
	return lastRequest, contextText
}

// fakePlanReply builds a plan from the catalog keys the request mentions, or the first few
// keys when it mentions none.
func fakePlanReply(lastRequest, contextText string) Reply {
	lower := strings.ToLower(lastRequest)
	labels := catalogLabels(contextText)
	picked := pickPresets(labels, func(label string) bool { return mentions(lower, label) })
	if len(picked) == 0 {
		picked = pickPresets(labels, func(string) bool { return true })
		if len(picked) > fallbackPresetCount {
			picked = picked[:fallbackPresetCount]
		}
	}
	target := TargetNewPage
	if strings.Contains(lower, "this page") || strings.Contains(lower, "current page") {
		target = TargetCurrentPage
	}
	return Reply{
		Kind:    KindPlan,
		Message: "Here is a page with " + strings.ToLower(joinLabels(picked)) + ".",
		Plan: &Plan{
			Target:  target,
			Name:    pageName(lastRequest),
			Icon:    "sparkle",
			Palette: firstPalette(contextText),
			Apps:    []string{},
			Buttons: picked,
		},
	}
}

// pickPresets keeps the labels the filter accepts, once each.
func pickPresets(labels []string, keep func(label string) bool) []PlanButton {
	var picked []PlanButton
	seen := map[string]bool{}
	for _, label := range labels {
		key := strings.ToLower(label)
		if !keep(label) || seen[key] {
			continue
		}
		seen[key] = true
		picked = append(picked, PlanButton{Preset: label})
	}
	return picked
}

var (
	catalogLinePattern = regexp.MustCompile(`(?m)^[^:\n]+: (.+)$`)
	palettePattern     = regexp.MustCompile(`(?m)^palettes: ([^,\n]+)`)
)

// catalogLabels reads the labels back out of the rendered context, group by group.
func catalogLabels(contextText string) []string {
	start := strings.Index(contextText, "catalog (group: label [summary]):")
	if start < 0 {
		return nil
	}
	var labels []string
	for _, match := range catalogLinePattern.FindAllStringSubmatch(contextText[start:], -1) {
		for _, entry := range strings.Split(match[1], ";") {
			entry = strings.TrimSpace(entry)
			if bracket := strings.Index(entry, " ["); bracket > 0 {
				entry = entry[:bracket]
			}
			if entry != "" {
				labels = append(labels, entry)
			}
		}
	}
	return labels
}

func mentions(text, label string) bool {
	return strings.Contains(text, strings.ToLower(label))
}

func firstPalette(contextText string) string {
	match := palettePattern.FindStringSubmatch(contextText)
	if match == nil {
		return ""
	}
	return strings.TrimSpace(match[1])
}

func pageName(text string) string {
	words := strings.Fields(strings.TrimRight(strings.TrimSpace(text), ".!?"))
	if len(words) == 0 {
		return "New page"
	}
	// "a page for music" -> "Music"; otherwise the first two words.
	for index, word := range words {
		if (strings.EqualFold(word, "for") || strings.EqualFold(word, "with") || strings.EqualFold(word, "about")) && index+1 < len(words) {
			return strings.ToUpper(words[index+1][:1]) + words[index+1][1:]
		}
	}
	name := strings.Join(words[:min(2, len(words))], " ")
	return strings.ToUpper(name[:1]) + name[1:]
}

func joinLabels(buttons []PlanButton) string {
	labels := make([]string, 0, len(buttons))
	for _, button := range buttons {
		labels = append(labels, button.Preset)
	}
	return strings.Join(labels, ", ")
}
