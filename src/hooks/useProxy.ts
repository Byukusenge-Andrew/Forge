/**
 * @file useProxy.ts
 * @description Hook that wraps the Go devproxy REST API (http://127.0.0.1:8877).
 * Provides the request log, intercept controls, rate limit rules, and fuzzer.
 */

import { useState, useEffect, useCallback } from 'react';

const BASE = 'http://127.0.0.1:8877';

export interface LogEntry {
    id: string;
    method: string;
    url: string;
    statusCode: number;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    requestBody: string;
    responseBody: string;
    durationMs: number;
    timestamp: string;
}

export interface PendingRequest {
    id: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
}

export interface RateLimitRule {
    id: string;
    pattern: string;
    statusCode: number;
    delayMs: number;
}

export interface FuzzResult {
    payload: string;
    statusCode: number;
    bodySnip: string;
    durationMs: number;
}

export interface FuzzReport {
    targetUrl: string;
    method: string;
    results: FuzzResult[];
}

export function useProxy() {
    const [log, setLog] = useState<LogEntry[]>([]);
    const [interceptEnabled, setInterceptEnabled] = useState(false);
    const [pending, setPending] = useState<PendingRequest[]>([]);
    const [rules, setRules] = useState<RateLimitRule[]>([]);
    const [proxyOnline, setProxyOnline] = useState(false);

    // ── Health check ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetch(`${BASE}/health`)
            .then(r => r.ok && setProxyOnline(true))
            .catch(() => setProxyOnline(false));
    }, []);

    // ── SSE log stream ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!proxyOnline) return;
        // Load existing entries
        fetch(`${BASE}/api/log`)
            .then(r => r.json())
            .then(d => setLog(d.data ?? []))
            .catch(() => { });

        // Stream new ones
        const source = new EventSource(`${BASE}/api/log/stream`);
        source.onmessage = (e) => {
            try {
                const entry: LogEntry = JSON.parse(e.data);
                setLog(prev => [entry, ...prev].slice(0, 500));
            } catch {
                console.error('Failed to parse log entry:', e.data);
             }
        };
        return () => source.close();
    }, [proxyOnline]);

    // ── Intercept pending poll ────────────────────────────────────────────────
    useEffect(() => {
        if (!proxyOnline || !interceptEnabled) {
            // Clear pending when intercept is off — done inside a setTimeout so it's async
            const t = setTimeout(() => setPending([]), 0);
            return () => clearTimeout(t);
        }
        const timer = setInterval(async () => {
            const r = await fetch(`${BASE}/api/intercept/pending`).catch(() => null);
            if (r?.ok) {
                const d = await r.json();
                setPending(d.data ?? []);
            }
        }, 500);
        return () => clearInterval(timer);
    }, [proxyOnline, interceptEnabled]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const toggleIntercept = useCallback(async () => {
        const r = await fetch(`${BASE}/api/intercept/toggle`, { method: 'POST' });
        const d = await r.json();
        setInterceptEnabled(d.data?.enabled ?? false);
    }, []);

    const forwardRequest = useCallback(async (id: string, body?: string, headers?: Record<string, string>) => {
        await fetch(`${BASE}/api/intercept/forward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, body: body ?? '', headers: headers ?? {} }),
        });
        setPending(p => p.filter(x => x.id !== id));
    }, []);

    const dropRequest = useCallback(async (id: string, status = 403) => {
        await fetch(`${BASE}/api/intercept/drop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        });
        setPending(p => p.filter(x => x.id !== id));
    }, []);

    const clearLog = useCallback(async () => {
        await fetch(`${BASE}/api/log`, { method: 'DELETE' });
        setLog([]);
    }, []);

    const loadRules = useCallback(async () => {
        const r = await fetch(`${BASE}/api/ratelimit`);
        const d = await r.json();
        setRules(d.data ?? []);
    }, []);

    const addRule = useCallback(async (pattern: string, statusCode: number, delayMs: number) => {
        await fetch(`${BASE}/api/ratelimit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pattern, statusCode, delayMs }),
        });
        loadRules();
    }, [loadRules]);

    const removeRule = useCallback(async (id: string) => {
        await fetch(`${BASE}/api/ratelimit/${id}`, { method: 'DELETE' });
        setRules(r => r.filter(x => x.id !== id));
    }, []);

    const runFuzz = useCallback(async (method: string, targetUrl: string, body: string, headers: Record<string, string>): Promise<FuzzReport | null> => {
        const r = await fetch(`${BASE}/api/fuzz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, targetUrl, body, headers }),
        }).catch(() => null);
        if (!r?.ok) return null;
        const d = await r.json();
        return d.data ?? null;
    }, []);

    useEffect(() => {
        if (!proxyOnline) return;
        // Defer into a microtask to avoid synchronous setState inside effect body
        Promise.resolve().then(() => loadRules());
    }, [proxyOnline, loadRules]);

    return {
        proxyOnline,
        log, clearLog,
        interceptEnabled, toggleIntercept,
        pending, forwardRequest, dropRequest,
        rules, addRule, removeRule,
        runFuzz,
    };
}
