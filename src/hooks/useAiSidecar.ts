/**
 * @file useAiSidecar.ts
 * @description Hook that wraps all HTTP calls to the Python FastAPI sidecar at
 * http://127.0.0.1:8765. Provides helpers for each endpoint with loading/error state.
 */

import { useState } from 'react';

const BASE = 'http://127.0.0.1:8765';

interface SidecarState {
    loading: boolean;
    error: string | null;
}

/**
 * Provides typed functions to call each AI sidecar endpoint.
 */
export function useAiSidecar() {
    const [state, setState] = useState<SidecarState>({ loading: false, error: null });

    async function call<T>(path: string, body: unknown): Promise<T | null> {
        setState({ loading: true, error: null });
        try {
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new Error((err as { detail?: string }).detail ?? res.statusText);
            }
            return (await res.json()) as T;
        } catch (e) {
            setState({ loading: false, error: (e as Error).message });
            return null;
        } finally {
            setState(prev => ({ ...prev, loading: false }));
        }
    }

    /** Explain the structure and issues of a DOM HTML string using Gemini. */
    const explainDom = (html: string, question?: string) =>
        call<{ explanation: string }>('/explain-dom', { html, question });

    /** Compare two base64-encoded PNG screenshots and return a diff image. */
    const visualDiff = (baseline_b64: string, current_b64: string) =>
        call<{ diff_b64: string; changed_pixels: number; change_percent: number }>(
            '/visual-diff', { baseline_b64, current_b64 }
        );

    /** Generate a Playwright script from an array of recorded events. */
    const generatePlaywright = (events: unknown[], language: 'python' | 'javascript' = 'python') =>
        call<{ script: string }>('/playwright', { events, language });

    /** Check if the sidecar is alive. */
    const checkHealth = async () => {
        try {
            const res = await fetch(`${BASE}/health`);
            return await res.json();
        } catch {
            return null;
        }
    };

    return { ...state, explainDom, visualDiff, generatePlaywright, checkHealth };
}
