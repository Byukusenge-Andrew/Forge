/**
 * @file ProxyPanel.tsx
 * @description Proxy inspection panel with four tabs:
 *   Log — all intercepted HTTP requests (searchable)
 *   Intercept — paused requests waiting for forward/drop decision
 *   Rate Limit — add rules to force error responses on URL patterns
 *   Fuzzer — run XSS/SQLi payload wordlist against a captured request
 */

import { useState } from 'react';
import { useProxy, type PendingRequest, type FuzzReport } from '../hooks/useProxy';

type ProxyTab = 'log' | 'intercept' | 'ratelimit' | 'fuzzer';

export function ProxyPanel() {
    const {
        proxyOnline, log, clearLog,
        interceptEnabled, toggleIntercept,
        pending, forwardRequest, dropRequest,
        rules, addRule, removeRule,
        runFuzz,
    } = useProxy();

    const [activeTab, setActiveTab] = useState<ProxyTab>('log');
    const [logSearch, setLogSearch] = useState('');
    const [selected, setSelected] = useState<PendingRequest | null>(null);
    const [editBody, setEditBody] = useState('');

    // Rate limit form
    const [rlPattern, setRlPattern] = useState('');
    const [rlStatus, setRlStatus] = useState(429);
    const [rlDelay, setRlDelay] = useState(0);

    // Fuzzer form
    const [fuzzUrl, setFuzzUrl] = useState('');
    const [fuzzMethod, setFuzzMethod] = useState('POST');
    const [fuzzBody, setFuzzBody] = useState('');
    const [fuzzRunning, setFuzzRunning] = useState(false);
    const [fuzzReport, setFuzzReport] = useState<FuzzReport | null>(null);

    const filteredLog = log.filter(e =>
        !logSearch || e.url.toLowerCase().includes(logSearch.toLowerCase()) ||
        String(e.statusCode).includes(logSearch)
    );

    const statusColor = (code: number) => {
        if (code >= 500) return '#ff5f57';
        if (code >= 400) return '#ffbd2e';
        if (code >= 300) return '#a78bfa';
        if (code >= 200) return '#27c93f';
        return '#888';
    };

    return (
        <div className="proxy-panel">
            <div className="proxy-header">
                <span className={`proxy-badge ${proxyOnline ? 'online' : 'offline'}`}>
                    {proxyOnline ? '🟢 Proxy Online' : '🔴 Proxy Offline'}
                </span>
                <div className="proxy-tabs">
                    {(['log', 'intercept', 'ratelimit', 'fuzzer'] as ProxyTab[]).map(t => (
                        <button
                            key={t}
                            className={`proxy-tab-btn ${activeTab === t ? 'active' : ''}`}
                            onClick={() => setActiveTab(t)}
                        >
                            {t === 'log' && '📋 Log'}
                            {t === 'intercept' && `⏸ Intercept${pending.length ? ` (${pending.length})` : ''}`}
                            {t === 'ratelimit' && '⚡ Rate Limit'}
                            {t === 'fuzzer' && '🔬 Fuzzer'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Log Tab ── */}
            {activeTab === 'log' && (
                <div className="proxy-tab-body">
                    <div className="proxy-toolbar">
                        <input
                            className="proxy-search"
                            placeholder="Filter by URL or status…"
                            value={logSearch}
                            onChange={e => setLogSearch(e.target.value)}
                        />
                        <button className="danger-btn " onClick={clearLog}>🗑 Clear</button>
                    </div>
                    <div className="proxy-log-table">
                        <div className="proxy-log-header">
                            <span>Method</span><span>Status</span><span>URL</span><span>ms</span>
                        </div>
                        {filteredLog.length === 0 && (
                            <div className="proxy-empty">No requests captured yet. Browse a site.</div>
                        )}
                        {filteredLog.map(e => (
                            <div key={e.id} className="proxy-log-row">
                                <span className="method-badge">{e.method}</span>
                                <span style={{ color: statusColor(e.statusCode), fontWeight: 600, minWidth: 40 }}>
                                    {e.statusCode || '–'}
                                </span>
                                <span className="log-url" title={e.url}>{e.url}</span>
                                <span className="log-ms">{e.durationMs}ms</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Intercept Tab ── */}
            {activeTab === 'intercept' && (
                <div className="proxy-tab-body">
                    <div className="proxy-toolbar">
                        <button
                            className={interceptEnabled ? 'danger-btn' : 'action-btn'}
                            onClick={toggleIntercept}
                        >
                            {interceptEnabled ? '⏹ Stop Intercept' : '⏺ Start Intercept'}
                        </button>
                        {interceptEnabled && <span className="intercept-status">Pausing all HTTP requests…</span>}
                    </div>
                    {pending.length === 0 && (
                        <div className="proxy-empty">
                            {interceptEnabled ? 'Waiting for a request…' : 'Enable intercept above to pause requests.'}
                        </div>
                    )}
                    {pending.map(p => (
                        <div key={p.id} className={`intercept-card ${selected?.id === p.id ? 'selected' : ''}`}
                            onClick={() => { setSelected(p); setEditBody(p.body); }}>
                            <span className="method-badge">{p.method}</span>
                            <span className="log-url">{p.url}</span>
                        </div>
                    ))}
                    {selected && (
                        <div className="intercept-editor">
                            <h4>Modify Request</h4>
                            <textarea
                                className="intercept-body"
                                value={editBody}
                                onChange={e => setEditBody(e.target.value)}
                                rows={6}
                                placeholder="Request body (editable)"
                            />
                            <div className="intercept-actions">
                                <button className="action-btn" onClick={() => {
                                    forwardRequest(selected.id, editBody);
                                    setSelected(null);
                                }}>▶ Forward</button>
                                <button className="danger-btn" onClick={() => {
                                    dropRequest(selected.id, 403);
                                    setSelected(null);
                                }}>✕ Drop (403)</button>
                                <button className="icon-btn" onClick={() => {
                                    dropRequest(selected.id, 429);
                                    setSelected(null);
                                }}>Drop (429)</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Rate Limit Tab ── */}
            {activeTab === 'ratelimit' && (
                <div className="proxy-tab-body">
                    <div className="ratelimit-form">
                        <input
                            className="proxy-search"
                            placeholder="URL pattern (substring match)"
                            value={rlPattern}
                            onChange={e => setRlPattern(e.target.value)}
                        />
                        <select value={rlStatus} onChange={e => setRlStatus(Number(e.target.value))} className="rl-select">
                            <option value={200}>200 OK (Throttle / Latency Only)</option>
                            <option value={429}>429 Too Many Requests</option>
                            <option value={500}>500 Internal Server Error</option>
                            <option value={503}>503 Service Unavailable</option>
                            <option value={504}>504 Gateway Timeout</option>
                            <option value={403}>403 Forbidden</option>
                        </select>
                        <input
                            type="number"
                            min={0}
                            className="rl-delay"
                            placeholder="Delay ms"
                            value={rlDelay}
                            onChange={e => setRlDelay(Number(e.target.value))}
                        />
                        <button
                            className="action-btn"
                            disabled={!rlPattern}
                            onClick={() => { addRule(rlPattern, rlStatus, rlDelay); setRlPattern(''); setRlDelay(0); }}
                        >+ Add Rule</button>
                    </div>
                    {rules.length === 0 && <div className="proxy-empty">No rules yet. Add one above.</div>}
                    {rules.map(r => (
                        <div key={r.id} className="rl-rule-row">
                            <span className="log-url">{r.pattern}</span>
                            <span style={{ color: statusColor(r.statusCode) }}>{r.statusCode}</span>
                            {r.delayMs > 0 && <span className="log-ms">{r.delayMs}ms delay</span>}
                            <button className="danger-btn xs-btn" onClick={() => removeRule(r.id)}>✕</button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Fuzzer Tab ── */}
            {activeTab === 'fuzzer' && (
                <div className="proxy-tab-body">
                    <div className="fuzzer-form">
                        <input
                            className="proxy-search"
                            placeholder="Target URL"
                            value={fuzzUrl}
                            onChange={e => setFuzzUrl(e.target.value)}
                        />
                        <select value={fuzzMethod} onChange={e => setFuzzMethod(e.target.value)} className="rl-select">
                            <option>POST</option><option>GET</option><option>PUT</option>
                        </select>
                        <textarea
                            className="intercept-body"
                            rows={3}
                            placeholder="Request body (form-encoded or JSON)"
                            value={fuzzBody}
                            onChange={e => setFuzzBody(e.target.value)}
                        />
                        <button
                            className="action-btn"
                            disabled={!fuzzUrl || fuzzRunning}
                            onClick={async () => {
                                setFuzzRunning(true);
                                setFuzzReport(null);
                                const report = await runFuzz(fuzzMethod, fuzzUrl, fuzzBody, {});
                                setFuzzReport(report);
                                setFuzzRunning(false);
                            }}
                        >{fuzzRunning ? '⏳ Running…' : '🔬 Run Fuzz'}</button>
                    </div>
                    {fuzzReport && (
                        <div className="fuzz-results">
                            <h4>Results for {fuzzReport.targetUrl}</h4>
                            <div className="proxy-log-header">
                                <span>Status</span><span>ms</span><span>Payload</span><span>Response Snip</span>
                            </div>
                            {fuzzReport.results.map((r, i) => (
                                <div key={i} className="proxy-log-row">
                                    <span style={{ color: statusColor(r.statusCode) }}>{r.statusCode || '–'}</span>
                                    <span className="log-ms">{r.durationMs}ms</span>
                                    <span className="log-url fuzz-payload" title={r.payload}>{r.payload.slice(0, 40)}</span>
                                    <span className="log-url" title={r.bodySnip}>{r.bodySnip.slice(0, 60)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
