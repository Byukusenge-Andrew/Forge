// ratelimit.go — Force specific URLs to return error responses.
// Rules are matched using simple substring matching against the full request URL.
package main

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimitRule forces a URL pattern to return a specific HTTP status after a delay.
type RateLimitRule struct {
	ID         string `json:"id"`
	Pattern    string `json:"pattern"`
	StatusCode int    `json:"statusCode"`
	DelayMs    int    `json:"delayMs"`
}

// RateLimiter manages forced-error rules.
type RateLimiter struct {
	mu    sync.RWMutex
	rules map[string]*RateLimitRule
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{rules: make(map[string]*RateLimitRule)}
}

func NewRateLimiter2() *RateLimiter {
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
	for _, r := range rl.rules {
		if strings.Contains(rawURL, r.Pattern) {
			return r
		}
	}
	return nil
}

// Apply sleeps if needed and writes the forced response. Returns true if a rule matched.
func (rl *RateLimiter) Apply(w http.ResponseWriter, rawURL string) bool {
	rule := rl.Match(rawURL)
	if rule == nil {
		return false
	}
	if rule.DelayMs > 0 {
		time.Sleep(time.Duration(rule.DelayMs) * time.Millisecond)
	}
	http.Error(w, http.StatusText(rule.StatusCode), rule.StatusCode)
	return true
}
