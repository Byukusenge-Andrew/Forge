/**
 * @file JwtPanel.tsx
 * Scans the active webview's localStorage, sessionStorage, and cookies for JWTs.
 * Decodes the header and payload and displays them in a formatted side panel.
 */
import { useState, useCallback } from 'react';
import type { ElectronWebview } from '../App';

interface JwtToken {
    key: string;
    value: string;
    store: string;
}

interface DecodedJwt {
    header: Record<string, unknown>;
    payload: Record<string, unknown>;
    raw: string;
    key: string;
    store: string;
    expired?: boolean;
}

function decodeJwt(token: JwtToken): DecodedJwt | null {
    try {
        const [h, p] = token.value.split('.');
        const decode = (s: string) => JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
        const header = decode(h);
        const payload = decode(p);
        const expired = payload.exp ? payload.exp * 1000 < Date.now() : false;
        return { header, payload, raw: token.value, key: token.key, store: token.store, expired };
    } catch {
        return null;
    }
}

interface JwtPanelProps {
    getActiveWebview: () => ElectronWebview | null;
}

const bridge = (window as unknown as {
    electron?: { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }
}).electron;

export function JwtPanel({ getActiveWebview }: JwtPanelProps) {
    const [tokens, setTokens] = useState<DecodedJwt[]>([]);
    const [scanning, setScanning] = useState(false);
    const [selected, setSelected] = useState<DecodedJwt | null>(null);
    const [error, setError] = useState('');

    const scan = useCallback(async () => {
        const wv = getActiveWebview();
        if (!wv) { setError('No active webview'); return; }
        setScanning(true);
        setError('');
        const wcId = wv.getWebContentsId();
        const result = await bridge?.ipcRenderer?.invoke('jwt:scan', wcId) as { ok: boolean; tokens: JwtToken[] } | undefined;
        setScanning(false);
        if (!result?.ok) { setError('Scan failed'); return; }
        const decoded = (result.tokens ?? []).map(decodeJwt).filter(Boolean) as DecodedJwt[];
        setTokens(decoded);
        if (decoded.length === 0) setError('No JWTs found in storage or cookies.');
    }, [getActiveWebview]);

    const fmt = (exp?: number) => {
        if (!exp) return '';
        return new Date(exp * 1000).toLocaleString();
    };

    return (
        <div className="side-panel">
            <div className="side-panel-header">
                <span>🔑 JWT Decoder</span>
                <button className="action-btn" onClick={scan} disabled={scanning}>
                    {scanning ? '⏳ Scanning…' : '🔍 Scan Page'}
                </button>
            </div>

            {error && <div className="panel-hint">{error}</div>}

            {tokens.length > 0 && !selected && (
                <div className="jwt-list">
                    {tokens.map((t, i) => (
                        <div key={i} className={`jwt-item ${t.expired ? 'jwt-expired' : 'jwt-valid'}`} onClick={() => setSelected(t)}>
                            <span className="jwt-key">{t.key}</span>
                            <span className="jwt-store">{t.store}</span>
                            {t.expired && <span className="jwt-tag expired">EXPIRED</span>}
                            {!t.expired && <span className="jwt-tag valid">VALID</span>}
                        </div>
                    ))}
                </div>
            )}

            {selected && (
                <div className="jwt-detail">
                    <button className="icon-btn xs-btn" onClick={() => setSelected(null)}>← Back</button>
                    <h4>{selected.key} <span className="jwt-store">({selected.store})</span></h4>
                    {selected.expired && <div className="jwt-tag expired" style={{ marginBottom: 8 }}>EXPIRED — exp: {fmt(selected.payload.exp as number)}</div>}
                    {!selected.expired && !!selected.payload.exp && <div className="jwt-tag valid" style={{ marginBottom: 8 }}>Expires: {fmt(selected.payload.exp as number)}</div>}

                    <h5>Header</h5>
                    <pre className="jwt-pre">{JSON.stringify(selected.header, null, 2)}</pre>
                    <h5>Payload</h5>
                    <pre className="jwt-pre">{JSON.stringify(selected.payload, null, 2)}</pre>
                    <button className="icon-btn xs-btn" onClick={() => navigator.clipboard.writeText(selected.raw)}>📋 Copy Token</button>
                </div>
            )}
        </div>
    );
}
