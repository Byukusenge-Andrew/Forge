import { NetworkThrottleMenu } from './NetworkThrottleMenu';
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

                <button className={`icon-btn toggle-btn ${wireframeMode ? 'active' : ''}`} onClick={toggleWireframe} title="Wireframe Mode">🕸️</button>
                <button className={`icon-btn toggle-btn ${showRulers ? 'active' : ''}`} onClick={() => setShowRulers(!showRulers)} title="Rulers">📏</button>
                <button className={`icon-btn toggle-btn ${splitView ? 'active' : ''}`} onClick={() => setSplitView(!splitView)} title="Mobile Split View">⊞</button>

                <div className="overlay-controls">
                    <label className="icon-btn toggle-btn" title="Upload Overlay" style={{ cursor: 'pointer', width: 'auto', padding: '0 6px', fontSize: '11px' }}>
                        🖼️
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
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
