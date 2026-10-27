package assistant

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// SecretsFile keeps API keys next to the config but out of it: it is never part of a backup,
// never sent to a deck, and never logged.
const SecretsFile = "secrets.json"

// storedKeys is the shape of the secrets file.
type storedKeys struct {
	AnthropicAPIKey string `json:"anthropicApiKey,omitempty"`
	OpenAIAPIKey    string `json:"openaiApiKey,omitempty"`
}

// Secrets reads and writes the keys file.
type Secrets struct {
	mu   sync.Mutex
	path string
}

func NewSecrets(dir string) *Secrets {
	return &Secrets{path: filepath.Join(dir, SecretsFile)}
}

func (secrets *Secrets) load() (storedKeys, error) {
	var keys storedKeys
	data, err := os.ReadFile(secrets.path)
	if errors.Is(err, os.ErrNotExist) {
		return keys, nil
	}
	if err != nil {
		return keys, err
	}
	if err := json.Unmarshal(data, &keys); err != nil {
		return keys, fmt.Errorf("reading secrets: %w", err)
	}
	return keys, nil
}

// Key returns the key for a provider: the environment wins, then the file.
func (secrets *Secrets) Key(provider string) string {
	secrets.mu.Lock()
	defer secrets.mu.Unlock()
	keys, _ := secrets.load()
	switch provider {
	case ProviderAnthropic:
		if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
			return key
		}
		return keys.AnthropicAPIKey
	case ProviderOpenAI:
		if key := os.Getenv("OPENAI_API_KEY"); key != "" {
			return key
		}
		return keys.OpenAIAPIKey
	}
	return ""
}

// Set stores or clears a key; an empty key removes it.
func (secrets *Secrets) Set(provider, key string) error {
	secrets.mu.Lock()
	defer secrets.mu.Unlock()
	keys, err := secrets.load()
	if err != nil {
		return err
	}
	switch provider {
	case ProviderAnthropic:
		keys.AnthropicAPIKey = key
	case ProviderOpenAI:
		keys.OpenAIAPIKey = key
	default:
		return fmt.Errorf("unknown provider %q", provider)
	}
	data, err := json.MarshalIndent(keys, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(secrets.path), 0o700); err != nil {
		return err
	}
	// Owner-only, because the file holds API keys.
	return os.WriteFile(secrets.path, data, 0o600)
}
