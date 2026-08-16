// ratelimit.go — Force specific URLs to return error responses or inject latency.
// Rules are matched using case-insensitive substring matching against the full request URL.
package main

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimitRule forces a URL pattern to return a specific HTTP status after a delay,
// or adds artificial latency/throttling when StatusCode is 200 or 0.
type RateLimitRule struct {
	ID         string `json:"id"`
	Pattern    string `json:"pattern"`
	StatusCode int    `json:"statusCode"`
	DelayMs    int    `json:"delayMs"`
}

// RateLimiter manages forced-error and throttling rules.
type RateLimiter struct {
	mu    sync.RWMutex
	rules map[string]*RateLimitRule
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{rules: make(map[string]*RateLimitRule)}
}

// Add inserts or replaces a rule.
func (rl *RateLimiter) Add(rule *RateLimitRule) {
	rl.mu.Lock()
	rl.rules[rule.ID] = rule
	rl.mu.Unlock()
}

// Remove deletes a rule by ID.
func (rl *RateLimiter) Remove(id string) {
	rl.mu.Lock()
	delete(rl.rules, id)
	rl.mu.Unlock()
}

// All returns all rules.
func (rl *RateLimiter) All() []*RateLimitRule {
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	out := make([]*RateLimitRule, 0, len(rl.rules))
	for _, r := range rl.rules {
		out = append(out, r)
	}
	return out
}

// Match returns the first matching rule for the given URL, or nil.
func (rl *RateLimiter) Match(rawURL string) *RateLimitRule {
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	lowerURL := strings.ToLower(rawURL)
	for _, r := range rl.rules {
		if strings.Contains(lowerURL, strings.ToLower(r.Pattern)) {
			return r
		}
	}
	return nil
}

// Apply sleeps if needed. If the rule specifies an error status (>= 400),
// it writes the forced HTTP error response and returns (true, rule).
// If the rule is delay-only (< 400 or 0), it sleeps and returns (false, rule),
// allowing the proxy to forward the request with the injected latency.
func (rl *RateLimiter) Apply(w http.ResponseWriter, rawURL string) (bool, *RateLimitRule) {
	rule := rl.Match(rawURL)
	if rule == nil {
		return false, nil
	}
	if rule.DelayMs > 0 {
		time.Sleep(time.Duration(rule.DelayMs) * time.Millisecond)
	}
	if rule.StatusCode >= 400 {
		http.Error(w, http.StatusText(rule.StatusCode), rule.StatusCode)
		return true, rule
	}
	return false, rule
}

