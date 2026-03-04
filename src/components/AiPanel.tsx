/**
 * @file AiPanel.tsx
 * @description Collapsible AI sidebar panel with three tabs:
 *   - DOM Explainer  → sends page HTML to Gemini for analysis
 *   - Visual Diff    → compares two screenshots pixel-by-pixel
 *   - Playwright     → displays the recorded test script for copy
 */

import { useState, useEffect } from 'react';
import { useAiSidecar } from '../hooks/useAiSidecar';

interface AiPanelProps {
    /** A ref callback to get the current page's HTML from the active webview */
    getDomHtml: () => string | null;
    /** A base64 PNG string of the current webview screenshot (optional) */
    currentScreenshot?: string | null;
    /** Recorded Playwright events passed from App.tsx */
    playwrightEvents?: unknown[];
}

type Tab = 'dom' | 'diff' | 'playwright';

export function AiPanel({ getDomHtml, currentScreenshot, playwrightEvents = [] }: AiPanelProps) {
    const { loading, error, explainDom, visualDiff, generatePlaywright, checkHealth } = useAiSidecar();
    const [activeTab, setActiveTab] = useState<Tab>('dom');
    const [result, setResult] = useState<string>('');
    const [baselineScreenshot, setBaselineScreenshot] = useState<string | null>(null);
    const [sidecarOnline, setSidecarOnline] = useState<boolean | null>(null);
    const [diffImage, setDiffImage] = useState<string | null>(null);
    const [language, setLanguage] = useState<'python' | 'javascript'>('python');

    // Poll sidecar health once on mount
    useEffect(() => {
        checkHealth().then(h => setSidecarOnline(h?.status === 'ok'));
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const handleExplainDom = async () => {
        const html = getDomHtml();
        if (!html) { setResult('Could not read page HTML. Make sure the webview is loaded.'); return; }
        const res = await explainDom(html);
        if (res) setResult(res.explanation);
    };

    const handleSetBaseline = () => {
        if (currentScreenshot) setBaselineScreenshot(currentScreenshot);
        else setResult('No screenshot available yet.');
    };

    const handleRunDiff = async () => {
        if (!baselineScreenshot || !currentScreenshot) {
            setResult('Set a baseline and ensure a current screenshot exists first.');
            return;
        }
        const res = await visualDiff(baselineScreenshot, currentScreenshot);
        if (res) {
            setDiffImage(res.diff_b64);
            setResult(`Changed pixels: ${res.changed_pixels.toLocaleString()} (${res.change_percent}%)`);
        }
    };

    const handleGenerateScript = async () => {
        const res = await generatePlaywright(playwrightEvents, language);
        if (res) setResult(res.script);
    };

    const statusDot = sidecarOnline === null ? '⚪' : sidecarOnline ? '🟢' : '🔴';

    return (
        <div className="ai-panel">
            <div className="ai-panel-header">
                <span className="ai-panel-title">🤖 AI Tools</span>
                <span className="sidecar-status" title={sidecarOnline ? 'Sidecar running' : 'Sidecar offline'}>
                    {statusDot} {sidecarOnline === null ? 'Checking…' : sidecarOnline ? 'Online' : 'Offline — run sidecar'}
                </span>
            </div>

            <div className="ai-tab-bar">
                {(['dom', 'diff', 'playwright'] as Tab[]).map(t => (
                    <button
                        key={t}
                        className={`ai-tab ${activeTab === t ? 'ai-tab-active' : ''}`}
                        onClick={() => { setActiveTab(t); setResult(''); setDiffImage(null); }}
                    >
                        {{ dom: '🧠 Explain', diff: '🔍 Diff', playwright: '🎭 Playwright' }[t]}
                    </button>
                ))}
            </div>

            <div className="ai-panel-body">
                {activeTab === 'dom' && (
                    <div className="ai-section">
                        <p className="ai-hint">Sends the active page's HTML to Gemini for structural analysis.</p>
                        <button className="primary-btn" onClick={handleExplainDom} disabled={loading}>
                            {loading ? 'Analysing…' : '🧠 Explain Current DOM'}
                        </button>
                    </div>
                )}

                {activeTab === 'diff' && (
                    <div className="ai-section">
                        <p className="ai-hint">Compare two screenshots pixel-by-pixel. Changed areas turn red.</p>
                        <div className="ai-diff-actions">
                            <button className="secondary-btn" onClick={handleSetBaseline}>
                                📸 Set Baseline
                            </button>
                            <button className="primary-btn" onClick={handleRunDiff} disabled={loading || !baselineScreenshot}>
                                {loading ? 'Diffing…' : '🔍 Run Diff'}
                            </button>
                        </div>
                        {baselineScreenshot && <p className="ai-hint" style={{ color: '#6f9' }}>✓ Baseline set</p>}
                        {diffImage && (
                            <img
                                src={`data:image/png;base64,${diffImage}`}
                                alt="Visual diff"
                                className="diff-image-preview"
                            />
                        )}
                    </div>
                )}

                {activeTab === 'playwright' && (
                    <div className="ai-section">
                        <p className="ai-hint">Converts {playwrightEvents.length} recorded event(s) into a Playwright script.</p>
                        <div className="ai-diff-actions">
                            <select
                                className="device-select"
                                value={language}
                                onChange={e => setLanguage(e.target.value as 'python' | 'javascript')}
                            >
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                            </select>
                            <button className="primary-btn" onClick={handleGenerateScript} disabled={loading || playwrightEvents.length === 0}>
                                {loading ? 'Generating…' : '🎭 Generate Script'}
                            </button>
                        </div>
                    </div>
                )}

                {error && <p className="ai-error">⚠️ {error}</p>}

                {result && (
                    <div className="ai-result">
                        <div className="ai-result-header">
                            <span>Result</span>
                            <button className="xs-btn icon-btn" onClick={() => navigator.clipboard.writeText(result)} title="Copy">📋</button>
                        </div>
                        <pre className="ai-result-text">{result}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
