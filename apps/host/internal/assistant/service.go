package assistant

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/paneel-nx/paneel/host/internal/protocol"
)

// Provider completes one turn and returns the raw JSON reply.
type Provider interface {
	Complete(ctx context.Context, model string, system string, messages []Message, schema map[string]any) (string, Usage, error)
}

// ErrNotConfigured means no key is available for the chosen provider.
var ErrNotConfigured = errors.New("assistant is not configured on the computer")

// ErrDeclined means the model refused the request for safety reasons.
var ErrDeclined = errors.New("the model declined this request")

const (
	// maxTurns bounds a conversation; each turn is a user message plus the assistant's reply.
	maxTurns    = 12
	turnTimeout = 90 * time.Second

	defaultAnthropicModel = "claude-opus-5-5"
	defaultOpenAIModel    = "gpt-5"
	fakeModel             = "fake"
)

// Options wires the service: settings are read per call so changes apply without a restart.
type Options struct {
	Settings func() protocol.AssistantSettings
	Secrets  *Secrets
	Logger   *slog.Logger
	// Fake answers without any network, for the test suite and demos.
	Fake bool
	// Providers overrides the real providers, for tests.
	Providers map[string]Provider
}

type Service struct {
	opts Options
}

func New(opts Options) *Service {
	if opts.Logger == nil {
		opts.Logger = slog.New(slog.DiscardHandler)
	}
	if opts.Settings == nil {
		opts.Settings = func() protocol.AssistantSettings { return protocol.AssistantSettings{} }
	}
	return &Service{opts: opts}
}

// Status is what the deck may know: provider, model and whether a key exists.
func (service *Service) Status() Status {
	settings := service.opts.Settings()
	providerName := service.resolveProviderName(settings)
	status := Status{
		Provider:  providerName,
		Model:     service.modelName(settings, providerName),
		BaseURL:   settings.BaseURL,
		ShareApps: settings.ShareApps,
	}
	status.Configured = service.opts.Fake || (service.opts.Secrets != nil && service.opts.Secrets.Key(providerName) != "")
	return status
}

// resolveProviderName picks the provider: the fake one when asked, otherwise the setting with
// Anthropic as the default.
func (service *Service) resolveProviderName(settings protocol.AssistantSettings) string {
	if service.opts.Fake {
		return ProviderFake
	}
	if settings.Provider == ProviderOpenAI {
		return ProviderOpenAI
	}
	return ProviderAnthropic
}

func (service *Service) modelName(settings protocol.AssistantSettings, providerName string) string {
	if settings.Model != "" {
		return settings.Model
	}
	switch providerName {
	case ProviderOpenAI:
		return defaultOpenAIModel
	case ProviderFake:
		return fakeModel
	default:
		return defaultAnthropicModel
	}
}

func (service *Service) newProvider(providerName string, settings protocol.AssistantSettings) (Provider, error) {
	if custom, ok := service.opts.Providers[providerName]; ok {
		return custom, nil
	}
	switch providerName {
	case ProviderFake:
		return fakeProvider{}, nil
	case ProviderOpenAI:
		key := service.opts.Secrets.Key(ProviderOpenAI)
		// Local servers such as Ollama and LM Studio need no key.
		if key == "" && !isLocalBaseURL(settings.BaseURL) {
			return nil, ErrNotConfigured
		}
		return newOpenAIProvider(settings.BaseURL, key), nil
	default:
		key := service.opts.Secrets.Key(ProviderAnthropic)
		if key == "" {
			return nil, ErrNotConfigured
		}
		return newAnthropicProvider(key), nil
	}
}

// Plan runs one turn: prompt, provider, parse, validate; one retry when the reply was off-schema.
func (service *Service) Plan(ctx context.Context, request Request) (Reply, error) {
	if len(request.Messages) == 0 {
		return Reply{}, fmt.Errorf("nothing asked")
	}
	if len(request.Messages) > maxTurns*2 {
		return Reply{}, fmt.Errorf("this conversation is long enough; start a new one")
	}
	settings := service.opts.Settings()
	providerName := service.resolveProviderName(settings)
	provider, err := service.newProvider(providerName, settings)
	if err != nil {
		return Reply{}, err
	}
	model := service.modelName(settings, providerName)
	logger := service.opts.Logger.With("provider", providerName, "model", model)
	if !settings.ShareApps {
		request.Apps = nil
	}
	messages := append([]Message{{Role: "user", Content: contextMessage(request)}}, request.Messages...)
	ctx, cancel := context.WithTimeout(ctx, turnTimeout)
	defer cancel()

	started := time.Now()
	raw, usage, err := provider.Complete(ctx, model, systemPrompt, messages, ReplySchema())
	if err != nil {
		logger.Warn("assistant failed", "err", err)
		return Reply{}, err
	}
	reply, problem := parseReply(raw, request)
	if problem != nil {
		reply, usage, err = service.retryWithCorrection(ctx, provider, model, messages, raw, problem, usage, request, logger)
		if err != nil {
			return Reply{}, err
		}
	}
	buttons := 0
	if reply.Plan != nil {
		buttons = len(reply.Plan.Buttons)
	}
	logger.Info("assistant", "kind", reply.Kind, "buttons", buttons,
		"inputTokens", usage.InputTokens, "cacheRead", usage.CacheReadTokens, "outputTokens", usage.OutputTokens,
		"retry", usage.ValidationRetry, "took", time.Since(started).Round(time.Millisecond))
	return reply, nil
}

// retryWithCorrection gives the model one more chance: its invalid reply is echoed back with
// what was wrong with it. Small models fix most slips this way; a second failure is final.
func (service *Service) retryWithCorrection(ctx context.Context, provider Provider, model string, messages []Message, invalidReply string, problem error, usage Usage, request Request, logger *slog.Logger) (Reply, Usage, error) {
	usage.ValidationRetry = true
	logger.Info("assistant reply corrected", "problem", problem.Error())
	messages = append(messages,
		Message{Role: "assistant", Content: invalidReply},
		Message{Role: "user", Content: "Your reply was not valid: " + problem.Error() + ". Answer again following the schema and the rules."},
	)
	raw, retryUsage, err := provider.Complete(ctx, model, systemPrompt, messages, ReplySchema())
	if err != nil {
		return Reply{}, usage, err
	}
	usage.InputTokens += retryUsage.InputTokens
	usage.OutputTokens += retryUsage.OutputTokens
	reply, problem := parseReply(raw, request)
	if problem != nil {
		logger.Warn("assistant reply invalid twice", "err", problem)
		return Reply{}, usage, fmt.Errorf("the assistant did not produce a usable plan: %w", problem)
	}
	return reply, usage, nil
}

func isLocalBaseURL(baseURL string) bool {
	return strings.Contains(baseURL, "localhost") || strings.Contains(baseURL, "127.0.0.1")
}
