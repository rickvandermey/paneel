package assistant

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const anthropicMaxTokens = 4000

type anthropicProvider struct {
	client anthropic.Client
}

func newAnthropicProvider(key string) Provider {
	return anthropicProvider{client: anthropic.NewClient(option.WithAPIKey(key))}
}

// Complete asks for a structured reply. The system prompt is cached because it carries the
// catalog-independent rules; adaptive thinking at low effort fits a short planning turn.
func (provider anthropicProvider) Complete(ctx context.Context, model, system string, messages []Message, schema map[string]any) (string, Usage, error) {
	params := anthropic.MessageNewParams{
		Model:     model,
		MaxTokens: anthropicMaxTokens,
		System: []anthropic.TextBlockParam{{
			Text:         system,
			CacheControl: anthropic.NewCacheControlEphemeralParam(),
		}},
		Messages: toAnthropicMessages(messages),
		OutputConfig: anthropic.OutputConfigParam{
			Effort: anthropic.OutputConfigEffortLow,
			Format: anthropic.JSONOutputFormatParam{Schema: schema},
		},
	}
	response, err := provider.client.Messages.New(ctx, params)
	if err != nil {
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) {
			switch apiErr.StatusCode {
			case http.StatusUnauthorized:
				return "", Usage{}, fmt.Errorf("the Anthropic key was rejected")
			case http.StatusTooManyRequests:
				return "", Usage{}, fmt.Errorf("rate limit reached at Anthropic, try again in a moment")
			}
		}
		return "", Usage{}, fmt.Errorf("anthropic: %w", err)
	}
	usage := Usage{
		InputTokens:     int(response.Usage.InputTokens),
		CacheReadTokens: int(response.Usage.CacheReadInputTokens),
		OutputTokens:    int(response.Usage.OutputTokens),
	}
	if response.StopReason == anthropic.StopReasonRefusal {
		return "", usage, ErrDeclined
	}
	var text strings.Builder
	for _, block := range response.Content {
		if block.Type == "text" {
			text.WriteString(block.Text)
		}
	}
	return text.String(), usage, nil
}

func toAnthropicMessages(messages []Message) []anthropic.MessageParam {
	result := make([]anthropic.MessageParam, 0, len(messages))
	for _, message := range messages {
		block := anthropic.NewTextBlock(message.Content)
		if message.Role == "assistant" {
			result = append(result, anthropic.NewAssistantMessage(block))
		} else {
			result = append(result, anthropic.NewUserMessage(block))
		}
	}
	return result
}
