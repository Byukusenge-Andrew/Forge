/**
 * @file useHistory.ts
 * @description Hook that manages browsing history via Electron IPC → SQLite.
 */
import { useState, useCallback } from 'react';

export interface HistoryEntry {
    id: number;
    url: string;
    title: string;
    visited_at: string; // ISO timestamp
}

const ipc = (window as unknown as {
    electron?: { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }
}).electron?.ipcRenderer;

export function useHistory() {
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    const addEntry = useCallback(async (url: string, title: string) => {
        await ipc?.invoke('history:add', { url, title });
    }, []);

    const loadHistory = useCallback(async (search = '') => {
        const rows = await ipc?.invoke('history:get', { search }) as HistoryEntry[] | undefined;
        setHistory(rows ?? []);
    }, []);

    const clearHistory = useCallback(async () => {
        await ipc?.invoke('history:clear');
        setHistory([]);
    }, []);

    return { history, addEntry, loadHistory, clearHistory };
}
