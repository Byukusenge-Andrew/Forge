// api.go — REST control API for the Dev Browser proxy.
// Endpoints are served on the same port as the proxy, under the /api/ prefix.
// All responses are JSON. CORS is open (localhost only in practice).
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// apiOK is the standard success envelope.
type apiOK struct {
	OK      bool        `json:"ok"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

// registerAPI mounts all /api/* routes onto the given mux.
func registerAPI(mux *http.ServeMux, log *RequestLog, interceptor *Interceptor, rateLimiter *RateLimiter, fuzzer *Fuzzer) {

	// ── Helper ────────────────────────────────────────────────────────────────
	writeJSON := func(w http.ResponseWriter, v interface{}) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(v)
	}
	readJSON := func(r *http.Request, v interface{}) error {
		return json.NewDecoder(r.Body).Decode(v)
	}
	cors := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next(w, r)
		}
	}

	// ── Health ────────────────────────────────────────────────────────────────
	mux.HandleFunc("/health", cors(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, apiOK{OK: true, Message: "devproxy running"})
	}))

	// ── Request Log ───────────────────────────────────────────────────────────
	// GET /api/log        — return all logged entries (newest first)
	// DELETE /api/log     — clear the log
	mux.HandleFunc("/api/log", cors(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, apiOK{OK: true, Data: log.All()})
		case http.MethodDelete:
			log.Clear()
			writeJSON(w, apiOK{OK: true, Message: "log cleared"})
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	// GET /api/log/stream — SSE stream of new log entries
	mux.HandleFunc("/api/log/stream", cors(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		ch := log.Subscribe()
		defer log.Unsubscribe(ch)

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case entry, ok := <-ch:
				if !ok {
					return
				}
				data, _ := json.Marshal(entry)
				fmt.Fprintf(w, "data: %s\n\n", data)
				flusher.Flush()
			}
		}
	}))

	// ── Intercept ─────────────────────────────────────────────────────────────
	// POST /api/intercept/toggle  — flip intercept on/off
	// GET  /api/intercept/pending — list paused requests
	// POST /api/intercept/forward — forward a paused request (body: {id, body?, headers?})
	// POST /api/intercept/drop    — drop a paused request   (body: {id, status?})
	mux.HandleFunc("/api/intercept/toggle", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		enabled := interceptor.Toggle()
		writeJSON(w, apiOK{OK: true, Data: map[string]bool{"enabled": enabled}})
	}))

	mux.HandleFunc("/api/intercept/pending", cors(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, apiOK{OK: true, Data: interceptor.Pending()})
	}))

	mux.HandleFunc("/api/intercept/forward", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			ID      string            `json:"id"`
			Body    string            `json:"body"`
			Headers map[string]string `json:"headers"`
		}
		if err := readJSON(r, &body); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		ok := interceptor.Forward(body.ID, body.Body, body.Headers)
		writeJSON(w, apiOK{OK: ok})
	}))

	mux.HandleFunc("/api/intercept/drop", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			ID     string `json:"id"`
			Status int    `json:"status"`
		}
		if err := readJSON(r, &body); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		ok := interceptor.Drop(body.ID, body.Status)
		writeJSON(w, apiOK{OK: ok})
	}))

	// ── Rate Limit ────────────────────────────────────────────────────────────
	// GET    /api/ratelimit       — list all rules
	// POST   /api/ratelimit       — add a rule  {pattern, statusCode, delayMs}
	// DELETE /api/ratelimit/{id}  — remove a rule
	mux.HandleFunc("/api/ratelimit", cors(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, apiOK{OK: true, Data: rateLimiter.All()})
		case http.MethodPost:
			var rule RateLimitRule
			if err := readJSON(r, &rule); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if rule.ID == "" {
				rule.ID = newID()
			}
			if rule.StatusCode == 0 && rule.DelayMs == 0 {
				rule.StatusCode = http.StatusTooManyRequests
			}
			rateLimiter.Add(&rule)
			writeJSON(w, apiOK{OK: true, Data: rule})
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	mux.HandleFunc("/api/ratelimit/", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		id := r.URL.Path[len("/api/ratelimit/"):]
		rateLimiter.Remove(id)
		writeJSON(w, apiOK{OK: true})
	}))

	// ── Fuzzer ────────────────────────────────────────────────────────────────
	// POST /api/fuzz — run a fuzz session
	// Body: {method, targetUrl, body, headers}
	mux.HandleFunc("/api/fuzz", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			Method    string            `json:"method"`
			TargetURL string            `json:"targetUrl"`
			Body      string            `json:"body"`
			Headers   map[string]string `json:"headers"`
		}
		if err := readJSON(r, &req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if req.Method == "" {
			req.Method = http.MethodPost
		}
		report, err := fuzzer.Run(req.Method, req.TargetURL, req.Body, req.Headers)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, apiOK{OK: true, Data: report})
	}))
}
