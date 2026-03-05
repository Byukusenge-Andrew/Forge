// main.go — Dev Browser Go HTTP Interceptor Proxy
// Starts a combined HTTP proxy + REST control API on 127.0.0.1:8877
//
// Usage:
//
//	go run . [--port 8877]
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

func main() {
	port := flag.Int("port", 8877, "Port for the proxy + control API")
	flag.Parse()

	addr := fmt.Sprintf("127.0.0.1:%d", *port)

	// Initialise shared state
	reqLog := NewRequestLog()
	interceptor := NewInterceptor()
	rateLimiter := NewRateLimiter2()
	fuzzer := NewFuzzer()

	// Single mux handles both proxy requests and /api/* control routes
	mux := http.NewServeMux()

	// Register REST API routes
	registerAPI(mux, reqLog, interceptor, rateLimiter, fuzzer)

	// The proxy handler catches everything else (non-/api/ requests)
	proxy := NewProxy(reqLog, interceptor, rateLimiter)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Pass /api/* requests to the mux (already registered above)
		// Everything else is a proxy request
		proxy.ServeHTTP(w, r)
	})

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	log.Printf("[devproxy] listening on %s (proxy + control API)\n", addr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("[devproxy] server error: %v", err)
	}
}
