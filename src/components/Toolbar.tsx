import { NetworkThrottleMenu } from './NetworkThrottleMenu';
import { DISTANCE_SCANNER_INJECT, DISTANCE_SCANNER_REMOVE } from '../lib/distanceScanner';
import type { NetworkProfile } from '../lib/networkProfiles';
import type { ElectronWebview } from '../App';

interface ToolbarProps {
    urlInput: string;
    setUrlInput: (url: string) => void;
    /** Returns the currently active webview element */
    getActiveWebview: () => ElectronWebview | null;
    splitView: boolean;
    setSplitView: (v: boolean) => void;
    wireframeMode: boolean;
    toggleWireframe: () => void;
    showRulers: boolean;
    setShowRulers: (v: boolean) => void;
    showHistory: boolean;
    setShowHistory: (v: boolean) => void;
    showProxy: boolean;
    setShowProxy: (v: boolean) => void;
    showJwt: boolean;
    setShowJwt: (v: boolean) => void;
    showSecurity: boolean;
    setShowSecurity: (v: boolean) => void;
    distanceActive: boolean;
    setDistanceActive: (v: boolean) => void;
    overlayImage: string | null;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    clearOverlay: () => void;
    overlayOpacity: number;
    setOverlayOpacity: (v: number) => void;
    handleNavigate: (e: React.FormEvent) => void;
    networkProfile: NetworkProfile;
    onNetworkChange: (profile: NetworkProfile) => void;
}

const electronBridge = (window as unknown as {
    electron?: { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }
}).electron;

export function Toolbar({
    urlInput, setUrlInput,
    getActiveWebview,
    splitView, setSplitView,
    wireframeMode, toggleWireframe,
    showRulers, setShowRulers,
    showHistory, setShowHistory,
    showProxy, setShowProxy,
    showJwt, setShowJwt,
    showSecurity, setShowSecurity,
    distanceActive, setDistanceActive,
    overlayImage, handleImageUpload, clearOverlay,
    overlayOpacity, setOverlayOpacity,
    handleNavigate,
    networkProfile, onNetworkChange,
}: ToolbarProps) {
    const wv = () => getActiveWebview();

    const goBack = () => wv()?.goBack();
    const goForward = () => wv()?.goForward();
    // Reload only the active webview — NOT the Electron shell
    const reload = () => wv()?.reload();

    const handleNetworkChange = async (profile: NetworkProfile) => {
        onNetworkChange(profile);
        const webviewEl = wv();
        if (!webviewEl) {
            console.error('No active webview found to throttle');
            return;
        }

        const id = typeof webviewEl.getWebContentsId === 'function' ? webviewEl.getWebContentsId() : undefined;
        if (id === undefined) {
            console.error('Webview does not have getWebContentsId method yet!');
            // Fallback for some Electron versions
            alert('Cannot throttle: Webview not fully initialized');
            return;
        }

        console.log(`Sending network:throttle for webContentsId: ${id}`, profile);
        // Send to main process — main.js strictly uses CDP on this specific webContentsId
        const res = await electronBridge?.ipcRenderer?.invoke('network:throttle', { webContentsId: id, ...profile }) as { ok: boolean, error?: string } | undefined;
        console.log('Throttle response:', res);
        if (res && !res.ok) {
            alert('Failed to apply throttle: ' + res.error);
        }
    };

    const handleScreenshot = async () => {
        const wvEl = wv();
        if (!wvEl) return alert('No active tab to capture');
        const id = typeof wvEl.getWebContentsId === 'function' ? wvEl.getWebContentsId() : undefined;
        if (id === undefined) return;
        const res = await electronBridge?.ipcRenderer?.invoke('screenshot:capture', id) as { ok: boolean, error?: string, filePath?: string } | undefined;
        if (res?.ok) console.log('Saved to', res.filePath);
        else alert('Screenshot failed: ' + res?.error);
    };

    const handleSnapshot = async () => {
        const wvEl = wv();
        if (!wvEl) return alert('No active tab to snapshot');
        const id = typeof wvEl.getWebContentsId === 'function' ? wvEl.getWebContentsId() : undefined;
        if (id === undefined) return;
        try {
            const html = await electronBridge?.ipcRenderer?.invoke('webview:execute', { id, script: 'document.documentElement.outerHTML' }) as string | undefined;
            const url = await electronBridge?.ipcRenderer?.invoke('webview:execute', { id, script: 'location.href' }) as string | undefined;
            if (!html) return alert('Failed to get HTML');

            const res = await electronBridge?.ipcRenderer?.invoke('snapshot:export', { webContentsId: id, html, url }) as { ok: boolean, error?: string, filePath?: string } | undefined;
            if (res?.ok) console.log('Saved snapshot to', res.filePath);
            else alert('Snapshot failed: ' + res?.error);
        } catch (e) {
            console.error(e);
        }
    };

    const injectCss = async (css: string) => {
        const wvEl = wv();
        if (wvEl && typeof wvEl.insertCSS === 'function') await wvEl.insertCSS(css);
    };

    const toggleXray = async () => {
        const active = !wireframeMode;
        toggleWireframe();
        if (active) {
            await injectCss(`
                .__dev_xray_flex { outline: 2px solid #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; }
                .__dev_xray_grid { outline: 2px solid #8b5cf6 !important; background: rgba(139, 92, 246, 0.1) !important; }
            `);
            const wvEl = wv();
            if (!wvEl) return;
            const id = typeof wvEl.getWebContentsId === 'function' ? wvEl.getWebContentsId() : undefined;
            if (id !== undefined) {
                await electronBridge?.ipcRenderer?.invoke('webview:execute', {
                    id, script: `
                    document.querySelectorAll('*').forEach(el => {
                        const d = getComputedStyle(el).display;
                        if (d === 'flex' || d === 'inline-flex') el.classList.add('__dev_xray_flex');
                        if (d === 'grid' || d === 'inline-grid') el.classList.add('__dev_xray_grid');
                    });
                ` });
            }
        } else {
            const wvEl = wv();
            if (!wvEl) return;
            const id = typeof wvEl.getWebContentsId === 'function' ? wvEl.getWebContentsId() : undefined;
            if (id !== undefined) {
                await electronBridge?.ipcRenderer?.invoke('webview:execute', {
                    id, script: `
                    document.querySelectorAll('.__dev_xray_flex').forEach(el => el.classList.remove('__dev_xray_flex'));
                    document.querySelectorAll('.__dev_xray_grid').forEach(el => el.classList.remove('__dev_xray_grid'));
                ` });
            }
        }
    };

    const handleDistanceScan = async () => {
        const active = !distanceActive;
        setDistanceActive(active);
        const wvEl = wv();
        if (!wvEl) return;
        const id = typeof wvEl.getWebContentsId === 'function' ? wvEl.getWebContentsId() : undefined;
        if (id === undefined) return;

        await electronBridge?.ipcRenderer?.invoke('webview:execute', {
            id,
            script: active ? DISTANCE_SCANNER_INJECT : DISTANCE_SCANNER_REMOVE
        });
    };

    return (
        <div className="toolbar">
            <div className="nav-buttons">
                <button className="icon-btn" title="Back" onClick={goBack}>«</button>
                <button className="icon-btn" title="Forward" onClick={goForward}>»</button>
                <button className="icon-btn" title="Reload tab" onClick={reload}>↻</button>
            </div>

            <form className="address-bar-container" onSubmit={handleNavigate}>
                <input
                    type="text"
                    className="address-input"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    placeholder="Enter URL or search…"
                />
            </form>

            <div className="dev-tools-controls">
                <NetworkThrottleMenu activeProfile={networkProfile} onChange={handleNetworkChange} />

                <div className="toolbar-divider" />

                <button
                    className={`icon-btn toggle-btn ${showHistory ? 'active' : ''}`}
                    onClick={() => setShowHistory(!showHistory)}
                    title="Browsing History"
                >🕑</button>

                <button
                    className={`icon-btn toggle-btn ${showProxy ? 'active' : ''}`}
                    onClick={() => setShowProxy(!showProxy)}
                    title="HTTP Proxy Inspector"
                >🔀</button>

                <div className="toolbar-divider" />

                <button className={`icon-btn toggle-btn ${showJwt ? 'active' : ''}`} onClick={() => setShowJwt(!showJwt)} title="JWT Decoder">🔑</button>
                <button className={`icon-btn toggle-btn ${showSecurity ? 'active' : ''}`} onClick={() => setShowSecurity(!showSecurity)} title="Security Auditor">🛡️</button>
                <button className="icon-btn" onClick={handleScreenshot} title="Capture Screenshot">📷</button>
                <button className={`icon-btn toggle-btn ${wireframeMode ? 'active' : ''}`} onClick={toggleXray} title="Flex/Grid X-Ray">🧮</button>
                <button className={`icon-btn toggle-btn ${distanceActive ? 'active' : ''}`} onClick={handleDistanceScan} title="Element Distance Scanner">📐</button>
                <button className="icon-btn" onClick={handleSnapshot} title="Export DOM Snapshot">📦</button>

                <div className="toolbar-divider" />

                <button className={`icon-btn toggle-btn ${showRulers ? 'active' : ''}`} onClick={() => setShowRulers(!showRulers)} title="Rulers">📏</button>
                <button className={`icon-btn toggle-btn ${splitView ? 'active' : ''}`} onClick={() => setSplitView(!splitView)} title="Mobile Split View">⊞</button>

                <div className="overlay-controls">
                    <label className="icon-btn toggle-btn" title="Upload Overlay" style={{ cursor: 'pointer', width: 'auto', padding: '0 6px', fontSize: '11px' }}>
                        🖼️
                        <input type="file" accept="image/*,application/pdf" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                    {overlayImage && (
                        <>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={overlayOpacity}
                                onChange={e => setOverlayOpacity(parseFloat(e.target.value))}
                                className="opacity-slider"
                                title={`Opacity: ${Math.round(overlayOpacity * 100)}%`}
                            />
                            <button
                                className="icon-btn xs-btn"
                                onClick={clearOverlay}
                                title="Remove overlay"
                                style={{ color: '#f88' }}
                            >✕</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
