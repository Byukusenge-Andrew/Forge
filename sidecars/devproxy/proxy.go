// proxy.go — Core HTTP reverse proxy / interceptor for the Dev Browser.
// Handles HTTP CONNECT tunneling for HTTPS (transparent passthrough),
// and full HTTP proxying with logging for plain HTTP traffic.
package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// Proxy is the main HTTP proxy server.
type Proxy struct {
	log         *RequestLog
	interceptor *Interceptor
	rateLimiter *RateLimiter
}

func NewProxy(log *RequestLog, interceptor *Interceptor, rateLimiter *RateLimiter) *Proxy {
	return &Proxy{log: log, interceptor: interceptor, rateLimiter: rateLimiter}
}

// ServeHTTP dispatches HTTP CONNECT requests and regular HTTP requests.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodConnect {
		p.handleConnect(w, r)
	} else {
		p.handleHTTP(w, r)
	}
}

// handleConnect tunnels an HTTPS connection transparently.
// Note: we don't inject a CA cert so this is a pass-through — traffic is logged
// at the TCP level only (host:port). Full HTTPS decryption can be added later.
func (p *Proxy) handleConnect(w http.ResponseWriter, r *http.Request) {
	dst, err := net.DialTimeout("tcp", r.Host, 10*time.Second)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer dst.Close()

	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijacking not supported", http.StatusInternalServerError)
		return
	}
	conn, _, err := hj.Hijack()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	// Acknowledge the tunnel
	conn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))

	// Log CONNECT as a special entry
	p.log.Add(&LogEntry{
		ID:        newID(),
		Method:    "CONNECT",
		URL:       r.Host,
		Timestamp: time.Now(),
	})

	// Bidirectional TCP copy
	done := make(chan struct{}, 2)
	go func() { io.Copy(dst, conn); done <- struct{}{} }()
	go func() { io.Copy(conn, dst); done <- struct{}{} }()
	<-done
}

// handleHTTP proxies a plain HTTP request, applying rate limit and intercept rules.
func (p *Proxy) handleHTTP(w http.ResponseWriter, r *http.Request) {
	reqID := newID()
	rawURL := r.URL.String()

	// Apply rate limit / throttling rules first
	if handled, rule := p.rateLimiter.Apply(w, rawURL); handled {
		status := http.StatusTooManyRequests
		delay := int64(0)
		if rule != nil {
			status = rule.StatusCode
			delay = int64(rule.DelayMs)
		}
		p.log.Add(&LogEntry{
			ID:         reqID,
			Method:     r.Method,
			URL:        rawURL,
			StatusCode: status,
			DurationMs: delay,
			Timestamp:  time.Now(),
		})
		return
	}

	// Read request body for logging/intercept
	var bodyBuf []byte
	if r.Body != nil {
		bodyBuf, _ = io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1 MB cap
		r.Body = io.NopCloser(bytes.NewReader(bodyBuf))
	}

	// Intercept — pause until UI decisions
	if p.interceptor.Enabled() {
		headers := headerMap(r.Header)
		decision := p.interceptor.Pause(reqID, r.Method, rawURL, headers, string(bodyBuf))
		if !decision.Forward {
			dropStatus := decision.DropStatus
			if dropStatus == 0 {
				dropStatus = http.StatusForbidden
			}
			http.Error(w, http.StatusText(dropStatus), dropStatus)
			return
		}
		// Apply modifications from UI
		if decision.Body != "" {
			bodyBuf = []byte(decision.Body)
		}
		for k, v := range decision.Headers {
			r.Header.Set(k, v)
		}
		r.Body = io.NopCloser(bytes.NewReader(bodyBuf))
	}

	// Remove proxy-specific headers before forwarding
	r.RequestURI = ""
	r.Header.Del("Proxy-Connection")
	r.Header.Del("Proxy-Authenticate")
	r.Header.Del("Proxy-Authorization")

	// Build target URL (r.URL already has the full URL since we're a proxy)
	target, err := url.Parse(rawURL)
	if err != nil {
		http.Error(w, "bad URL", http.StatusBadRequest)
		return
	}
	r.URL = target
	r.Host = target.Host

	// Capture the response
	rr := &responseRecorder{header: make(http.Header)}
	start := time.Now()

	// Create a transport that skips TLS verification for dev usage
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, // #nosec G402 — dev tool only
	}
	rp := &httputil.ReverseProxy{
		Director:  func(*http.Request) {},
		Transport: transport,
	}
	rp.ServeHTTP(rr, r)
	elapsed := time.Since(start).Milliseconds()

	// Write captured response to actual ResponseWriter
	for k, vs := range rr.header {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(rr.status)
	w.Write(rr.body.Bytes())

	// Log the completed transaction
	p.log.Add(&LogEntry{
		ID:              reqID,
		Method:          r.Method,
		URL:             rawURL,
		StatusCode:      rr.status,
		RequestHeaders:  headerMap(r.Header),
		ResponseHeaders: headerMap2(rr.header),
		RequestBody:     string(bodyBuf),
		ResponseBody:    truncate(rr.body.String(), 2048),
		DurationMs:      elapsed,
		Timestamp:       time.Now(),
	})
}

// responseRecorder captures an HTTP response for inspection.
type responseRecorder struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (rr *responseRecorder) Header() http.Header { return rr.header }
func (rr *responseRecorder) WriteHeader(s int)   { rr.status = s }
func (rr *responseRecorder) Write(b []byte) (int, error) {
	if rr.status == 0 {
		rr.status = http.StatusOK
	}
	return rr.body.Write(b)
}

// helpers

func newID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func headerMap(h http.Header) map[string]string {
	m := make(map[string]string, len(h))
	for k := range h {
		m[k] = h.Get(k)
	}
	return m
}

func headerMap2(h http.Header) map[string]string { return headerMap(h) }

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}
