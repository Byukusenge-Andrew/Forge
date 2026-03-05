/**
 * @file HistoryPanel.tsx
 * @description Browsing history panel — lists visited URLs from SQLite, supports text search and clear.
 */
import { useState, useEffect } from 'react';
import { useHistory, type HistoryEntry } from '../hooks/useHistory';

interface HistoryPanelProps {
    onNavigate: (url: string) => void;
}

export function HistoryPanel({ onNavigate }: HistoryPanelProps) {
    const { history, loadHistory, clearHistory } = useHistory();
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadHistory(search);
    }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

    const grouped = groupByDate(history);

    return (
        <div className="history-panel">
            <div className="history-header">
                <input
                    className="address-input history-search"
                    placeholder="Search history…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {history.length > 0 && (
                    <button className="danger-btn  px-2 " onClick={clearHistory} title="Clear all history"><span className='px-2'>clear</span></button>
                )}
            </div>

            {history.length === 0 ? (
                <p className="history-empty">No history yet.</p>
            ) : (
                Object.entries(grouped).map(([date, entries]) => (
                    <div key={date} className="history-group">
                        <div className="history-date-label">{date}</div>
                        {entries.map(e => (
                            <button
                                key={e.id}
                                className="history-entry"
                                onClick={() => onNavigate(e.url)}
                                title={e.url}
                            >
                                <span className="history-title">{e.title || e.url}</span>
                                <span className="history-url">{e.url}</span>
                                <span className="history-time">{formatTime(e.visited_at)}</span>
                            </button>
                        ))}
                    </div>
                ))
            )}
        </div>
    );
}

function groupByDate(entries: HistoryEntry[]): Record<string, HistoryEntry[]> {
    const result: Record<string, HistoryEntry[]> = {};
    for (const e of entries) {
        const date = formatDate(e.visited_at);
        if (!result[date]) result[date] = [];
        result[date].push(e);
    }
    return result;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
