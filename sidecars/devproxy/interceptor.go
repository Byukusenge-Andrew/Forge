// interceptor.go — Pause/forward/drop logic for the Dev Browser proxy.
// When intercept mode is ON, every matching request is paused until the UI
// either forwards it (optionally with modified headers/body) or drops it.
package main

import (
	"net/http"
	"sync"
	"time"
)

// PendingRequest holds a paused HTTP round-trip waiting for a UI decision.
type PendingRequest struct {
	ID      string            `json:"id"`
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`

	// Internal — not JSON-serialised
	decide chan Decision
}

// Decision is the UI's verdict on a paused request.
type Decision struct {
	Forward bool
	// Modified values (empty = keep original)
	Body    string
	Headers map[string]string
	// If Forward==false, respond with this status
	DropStatus int
}

// Interceptor manages pause/forward/drop state.
type Interceptor struct {
	mu      sync.RWMutex
	enabled bool
	pending map[string]*PendingRequest
}

func NewInterceptor() *Interceptor {
	return &Interceptor{pending: make(map[string]*PendingRequest)}
}

// Enabled returns the current intercept state.
func (i *Interceptor) Enabled() bool {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.enabled
}

// Toggle flips the intercept state.
func (i *Interceptor) Toggle() bool {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.enabled = !i.enabled
	return i.enabled
}

// Pause holds the request until a decision arrives or the 30 s timeout fires.
// Returns (forward=true, modified body/headers) or (forward=false, dropStatus).
func (i *Interceptor) Pause(id, method, urlStr string, headers map[string]string, body string) Decision {
	p := &PendingRequest{
		ID:      id,
		Method:  method,
		URL:     urlStr,
		Headers: headers,
		Body:    body,
		decide:  make(chan Decision, 1),
	}
	i.mu.Lock()
	i.pending[id] = p
	i.mu.Unlock()

	defer func() {
		i.mu.Lock()
		delete(i.pending, id)
		i.mu.Unlock()
	}()

	select {
	case d := <-p.decide:
		return d
	case <-time.After(30 * time.Second):
		// Auto-forward after timeout to avoid hanging forever
		return Decision{Forward: true}
	}
}

// Pending returns all currently paused requests.
func (i *Interceptor) Pending() []*PendingRequest {
	i.mu.RLock()
	defer i.mu.RUnlock()
	out := make([]*PendingRequest, 0, len(i.pending))
	for _, p := range i.pending {
		out = append(out, p)
	}
	return out
}

// Forward sends a forward decision to the paused request.
func (i *Interceptor) Forward(id string, body string, headers map[string]string) bool {
	i.mu.RLock()
	p, ok := i.pending[id]
	i.mu.RUnlock()
	if !ok {
		return false
	}
	p.decide <- Decision{Forward: true, Body: body, Headers: headers}
	return true
}

// Drop sends a drop decision to the paused request.
func (i *Interceptor) Drop(id string, status int) bool {
	i.mu.RLock()
	p, ok := i.pending[id]
	i.mu.RUnlock()
	if !ok {
		return false
	}
	if status == 0 {
		status = http.StatusForbidden
	}
	p.decide <- Decision{Forward: false, DropStatus: status}
	return true
}
