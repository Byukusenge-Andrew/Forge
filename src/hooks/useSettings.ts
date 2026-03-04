/**
 * @file useSettings.ts
 * @description Hook for persisting app settings (like the Gemini API key) via Electron IPC.
 * Settings are stored in `app.getPath('userData')/settings.json` by the main process.
 */

import { useState, useEffect } from 'react';

interface AppSettings {
    geminiApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = { geminiApiKey: '' };

// IPC bridge exposed via preload.js
const ipc = (window as unknown as { electron?: { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } } }).electron?.ipcRenderer;

/**
 * Loads and saves application settings via Electron IPC.
 *
 * @returns settings       - Current settings object.
 * @returns saveSettings   - Persists settings to disk and hot-reloads the sidecar API key.
 * @returns isLoading      - True while settings are being loaded from disk.
 */
export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    // Load settings on mount
    useEffect(() => {
        ipc?.invoke('settings:load')
            .then(data => {
                if (data && typeof data === 'object') {
                    setSettings({ ...DEFAULT_SETTINGS, ...(data as Partial<AppSettings>) });
                }
            })
            .catch(() => { /* settings.json not found on first run, use defaults */ })
            .finally(() => setIsLoading(false));
    }, []);

    const saveSettings = async (updated: Partial<AppSettings>) => {
        const next = { ...settings, ...updated };
        setSettings(next);
        await ipc?.invoke('settings:save', next);

        // Hot-reload the sidecar with the new API key immediately
        if (updated.geminiApiKey !== undefined) {
            try {
                await fetch('http://127.0.0.1:8765/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ gemini_api_key: updated.geminiApiKey }),
                });
            } catch {
                // Sidecar may not be running yet — the key will be passed at next spawn
            }
        }
    };

    return { settings, saveSettings, isLoading };
}
