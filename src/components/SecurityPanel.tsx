/**
 * @file SecurityPanel.tsx
 * Audits response headers of the current page for CORS / CSP / security issues.
 * Headers are captured in the main process via onHeadersReceived and stored per URL.
 */
import { useState, useCallback } from 'react';

interface SecurityPanelProps {
    activeUrl: string;
}

const bridge = (window as unknown as {
    electron?: { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }
}).electron;

interface Audit {
    header: string;
    value: string | null;
    status: 'good' | 'warn' | 'bad';
    message: string;
}

function auditHeaders(headers: Record<string, string> | null): Audit[] {
    if (!headers) return [];
    const h = (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null;
    const audits: Audit[] = [];

    // Content-Security-Policy
    const csp = h('content-security-policy');
    if (!csp) {
        audits.push({ header: 'Content-Security-Policy', value: null, status: 'bad', message: 'Missing — XSS protection is disabled' });
    } else if (csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")) {
        audits.push({ header: 'Content-Security-Policy', value: csp, status: 'warn', message: "Contains 'unsafe-inline' or 'unsafe-eval' — reduces XSS protection" });
    } else {
        audits.push({ header: 'Content-Security-Policy', value: csp, status: 'good', message: 'Looks good' });
    }

    // Strict-Transport-Security
    const hsts = h('strict-transport-security');
    if (!hsts) {
        audits.push({ header: 'Strict-Transport-Security', value: null, status: 'warn', message: 'Missing — HTTPS not enforced by header' });
    } else {
        audits.push({ header: 'Strict-Transport-Security', value: hsts, status: 'good', message: 'HTTPS enforced' });
    }

    // X-Frame-Options
    const xfo = h('x-frame-options');
    if (!xfo) {
        audits.push({ header: 'X-Frame-Options', value: null, status: 'warn', message: 'Missing — page may be embeddable in iframes (clickjacking risk)' });
    } else {
        audits.push({ header: 'X-Frame-Options', value: xfo, status: 'good', message: 'Clickjacking protection in place' });
    }

    // X-Content-Type-Options
    const xcto = h('x-content-type-options');
    if (!xcto || xcto.toLowerCase() !== 'nosniff') {
        audits.push({ header: 'X-Content-Type-Options', value: xcto, status: 'warn', message: 'Should be "nosniff" to prevent MIME sniffing' });
    } else {
        audits.push({ header: 'X-Content-Type-Options', value: xcto, status: 'good', message: 'MIME sniffing disabled' });
    }

    // Access-Control-Allow-Origin
    const acao = h('access-control-allow-origin');
    if (acao === '*') {
        audits.push({ header: 'Access-Control-Allow-Origin', value: acao, status: 'warn', message: 'Wildcard (*) allows any origin — may expose sensitive data' });
    } else if (acao) {
        audits.push({ header: 'Access-Control-Allow-Origin', value: acao, status: 'good', message: 'Restricted to specific origin' });
    }

    // Referrer-Policy
    const rp = h('referrer-policy');
    if (!rp) {
        audits.push({ header: 'Referrer-Policy', value: null, status: 'warn', message: 'Missing — full URL may leak in Referer header' });
    } else {
        audits.push({ header: 'Referrer-Policy', value: rp, status: 'good', message: 'Referrer controlled' });
    }

    // Permissions-Policy
    const pp = h('permissions-policy');
    if (!pp) {
        audits.push({ header: 'Permissions-Policy', value: null, status: 'warn', message: 'Missing — camera, mic, geolocation not explicitly restricted' });
    } else {
        audits.push({ header: 'Permissions-Policy', value: pp, status: 'good', message: 'Browser features restricted' });
    }

    return audits;
}

export function SecurityPanel({ activeUrl }: SecurityPanelProps) {
    const [audits, setAudits] = useState<Audit[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scannedUrl, setScannedUrl] = useState('');

    const scan = useCallback(async () => {
        setScanning(true);
        const result = await bridge?.ipcRenderer?.invoke('security:headers', activeUrl) as { ok: boolean; headers: Record<string, string> | null } | undefined;
        setScanning(false);
        const parsed = auditHeaders(result?.headers ?? null);
        setAudits(parsed);
        setScannedUrl(activeUrl);
    }, [activeUrl]);

    const icon = (s: Audit['status']) => s === 'good' ? '✅' : s === 'warn' ? '⚠️' : '❌';
    const cls = (s: Audit['status']) => `audit-row audit-${s}`;

    return (
        <div className="side-panel">
            <div className="side-panel-header">
                <span>🛡️ Security Auditor</span>
                <button className="action-btn" onClick={scan} disabled={scanning}>
                    {scanning ? '⏳ Scanning…' : '🔍 Audit Page'}
                </button>
            </div>

            {scannedUrl && (
                <div className="panel-hint" style={{ wordBreak: 'break-all' }}>
                    Audited: <span style={{ color: '#aaa' }}>{scannedUrl}</span>
                </div>
            )}

            {audits.length === 0 && !scanning && (
                <div className="panel-hint">Click "Audit Page" to inspect response headers. Note: headers are captured on page load — navigate to the page first.</div>
            )}

            <div className="audit-list">
                {audits.map((a, i) => (
                    <div key={i} className={cls(a.status)}>
                        <div className="audit-header-row">
                            <span>{icon(a.status)}</span>
                            <span className="audit-name">{a.header}</span>
                        </div>
                        {a.value && <div className="audit-value">{a.value}</div>}
                        <div className="audit-msg">{a.message}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
