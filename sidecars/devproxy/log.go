// log.go — In-memory circular request/response log for the Dev Browser proxy.
package main

import (
	"sync"
	"time"
)

// LogEntry stores a single intercepted HTTP transaction.
type LogEntry struct {
	ID              string            `json:"id"`
	Method          string            `json:"method"`
	URL             string            `json:"url"`
	StatusCode      int               `json:"statusCode"`
	RequestHeaders  map[string]string `json:"requestHeaders"`
	ResponseHeaders map[string]string `json:"responseHeaders"`
	RequestBody     string            `json:"requestBody"`
	ResponseBody    string            `json:"responseBody"`
	DurationMs      int64             `json:"durationMs"`
	Timestamp       time.Time         `json:"timestamp"`
}

const maxLogSize = 2000

// RequestLog is a fixed-size circular log protected by a mutex.
type RequestLog struct {
	mu      sync.RWMutex
	entries []*LogEntry
	// SSE subscribers receive new entries via these channels
	subs map[chan *LogEntry]struct{}
}

func NewRequestLog() *RequestLog {
	return &RequestLog{
		entries: make([]*LogEntry, 0, maxLogSize),
		subs:    make(map[chan *LogEntry]struct{}),
	}
}

// Add inserts a log entry, evicting the oldest if at capacity.
func (l *RequestLog) Add(entry *LogEntry) {
	l.mu.Lock()
	if len(l.entries) >= maxLogSize {
		l.entries = l.entries[1:]
	}
	l.entries = append(l.entries, entry)
	// Notify SSE subscribers
	for ch := range l.subs {
		select {
		case ch <- entry:
		default:
		}
	}
	l.mu.Unlock()
}

// All returns a copy of the current log (newest first).
func (l *RequestLog) All() []*LogEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()
	out := make([]*LogEntry, len(l.entries))
	for i, e := range l.entries {
		out[len(l.entries)-1-i] = e
	}
	return out
}

// Clear wipes all log entries.
func (l *RequestLog) Clear() {
	l.mu.Lock()
	l.entries = l.entries[:0]
	l.mu.Unlock()
}

// Subscribe registers a channel to receive new entries. Caller must call Unsubscribe when done.
func (l *RequestLog) Subscribe() chan *LogEntry {
	ch := make(chan *LogEntry, 64)
	l.mu.Lock()
	l.subs[ch] = struct{}{}
	l.mu.Unlock()
	return ch
}

// Unsubscribe removes and closes a subscriber channel.
func (l *RequestLog) Unsubscribe(ch chan *LogEntry) {
	l.mu.Lock()
	delete(l.subs, ch)
	l.mu.Unlock()
	close(ch)
}
