package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	openAIDefaultBaseURL = "https://api.openai.com/v1"
	openAIMaxTokens      = 4000
	openAIMaxReplyBytes  = 1 << 20
	// maxErrorLineLength keeps an upstream error message to one readable line in our own error.
	maxErrorLineLength = 200
)

// openAIProvider speaks the chat-completions dialect that OpenAI, Ollama, LM Studio and
// OpenRouter share, with a strict JSON schema as response format.
type openAIProvider struct {
	baseURL string
	key     string
	client  *http.Client
}

func newOpenAIProvider(baseURL, key string) Provider {
	if baseURL == "" {
		baseURL = openAIDefaultBaseURL
	}
	return openAIProvider{baseURL: strings.TrimRight(baseURL, "/"), key: key, client: &http.Client{Timeout: turnTimeout}}
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// chatResponse is the part of a chat-completions answer the service reads.
type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
			Refusal string `json:"refusal"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
	Model string `json:"model"`
}

func (provider openAIProvider) Complete(ctx context.Context, model, system string, messages []Message, schema map[string]any) (string, Usage, error) {
	payload, err := json.Marshal(chatRequestBody(model, system, messages, schema))
	if err != nil {
		return "", Usage{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, provider.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", Usage{}, err
	}
	request.Header.Set("Content-Type", "application/json")
	if provider.key != "" {
		request.Header.Set("Authorization", "Bearer "+provider.key)
	}
	started := time.Now()
	response, err := provider.client.Do(request)
	if err != nil {
		return "", Usage{}, fmt.Errorf("openai-compatible: %w", err)
	}
	defer func() { _ = response.Body.Close() }()
	data, err := io.ReadAll(io.LimitReader(response.Body, openAIMaxReplyBytes))
	if err != nil {
		return "", Usage{}, err
	}
	if err := checkChatStatus(response, data); err != nil {
		return "", Usage{}, err
	}
	return parseChatResponse(data, time.Since(started))
}

func chatRequestBody(model, system string, messages []Message, schema map[string]any) map[string]any {
	chat := make([]chatMessage, 0, len(messages)+1)
	chat = append(chat, chatMessage{Role: "system", Content: system})
	for _, message := range messages {
		role := "user"
		if message.Role == "assistant" {
			role = "assistant"
		}
		chat = append(chat, chatMessage{Role: role, Content: message.Content})
	}
	return map[string]any{
		"model":                 model,
		"messages":              chat,
		"max_completion_tokens": openAIMaxTokens,
		"response_format": map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "paneel_reply",
				"strict": true,
				"schema": schema,
			},
		},
	}
}

// checkChatStatus turns the status codes a user can act on into plain messages.
func checkChatStatus(response *http.Response, data []byte) error {
	switch {
	case response.StatusCode == http.StatusUnauthorized:
		return fmt.Errorf("the API key was rejected")
	case response.StatusCode == http.StatusTooManyRequests:
		return fmt.Errorf("rate limit reached, try again in a moment")
	case response.StatusCode >= http.StatusBadRequest:
		return fmt.Errorf("openai-compatible: %s: %s", response.Status, firstLine(string(data)))
	default:
		return nil
	}
}

func parseChatResponse(data []byte, took time.Duration) (string, Usage, error) {
	var parsed chatResponse
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", Usage{}, fmt.Errorf("openai-compatible: unreadable answer: %w", err)
	}
	usage := Usage{InputTokens: parsed.Usage.PromptTokens, OutputTokens: parsed.Usage.CompletionTokens}
	if len(parsed.Choices) == 0 {
		return "", usage, fmt.Errorf("openai-compatible: empty answer after %s", took.Round(time.Millisecond))
	}
	choice := parsed.Choices[0]
	if choice.Message.Refusal != "" {
		return "", usage, ErrDeclined
	}
	return choice.Message.Content, usage, nil
}

func firstLine(text string) string {
	line := strings.TrimSpace(strings.SplitN(text, "\n", 2)[0])
	if len(line) > maxErrorLineLength {
		return line[:maxErrorLineLength]
	}
	return line
}
