import React, { useRef, useState, useEffect } from 'react';
import { DEVICE_PRESETS, DEFAULT_PRESET, type DevicePreset } from '../lib/devicePresets';
import type { ElectronWebview } from '../App';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
    namespace JSX {
        interface IntrinsicElements {
            webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src?: string;
                allowpopups?: boolean;
            };
        }
    }
}

interface WebviewPaneProps {
    tabId: string;
    title: string;
    url: string;
    hidden?: boolean;
    isMobile?: boolean;
    overlayImage?: string | null;
    overlayOpacity?: number;
    /** Called when the inner webview mounts/unmounts — used by App to build the ref map */
    onWebviewMount?: (tabId: string, el: ElectronWebview | null) => void;
    /** Called when the webview navigates to a new page (e.g. user clicks a link) */
    onNavigate?: (url: string, title: string) => void;
}

export function WebviewPane({
    tabId, title, url, hidden = false,
    isMobile = false, overlayImage, overlayOpacity,
    onWebviewMount, onNavigate,
}: WebviewPaneProps) {
    const wvRef = useRef<ElectronWebview | null>(null);
    const [preset, setPreset] = useState<DevicePreset>(DEFAULT_PRESET);

    // Register this webview in the App's ref map when it mounts
    useEffect(() => {
        return () => onWebviewMount?.(tabId, null);
    }, [tabId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRef = (el: HTMLElement | null) => {
        const wv = el as ElectronWebview | null;
        wvRef.current = wv;
        onWebviewMount?.(tabId, wv);

        if (wv) {
            // Remove old listener if re-attaching
            wv.removeEventListener('load-commit', handleNavigationStateChange);
            wv.addEventListener('load-commit', handleNavigationStateChange);
        }
    };

    // Fired when the webview commits to a navigation (link click, redirect, forms)
    interface LoadCommitEvent extends Event {
        isMainFrame: boolean;
        url: string;
    }

    const handleNavigationStateChange = (e: Event) => {
        const commitEvent = e as LoadCommitEvent;
        if (commitEvent.isMainFrame && onNavigate && wvRef.current) {
            const newUrl = commitEvent.url;
            const newTitle = wvRef.current.getTitle?.() || new URL(newUrl).hostname;
            onNavigate(newUrl, newTitle);
        }
    };

    const handleInspect = () => {
        if (wvRef.current && typeof wvRef.current.openDevTools === 'function') {
            wvRef.current.openDevTools();
        }
    };

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = DEVICE_PRESETS.find(p => p.label === e.target.value);
        if (selected) setPreset(selected);
    };

    const containerClass = [
        'webview-container',
        isMobile ? 'mobile-view' : 'desktop-view',
        hidden ? 'webview-hidden' : '',
    ].filter(Boolean).join(' ');

    const mobileWrapperStyle: React.CSSProperties = isMobile
        ? { width: preset.width, height: preset.height }
        : {};

    return (
        <div className={containerClass}>
            <div className="webview-header">
                <span className="pane-title">{isMobile ? `📱 ${preset.label}` : title}</span>
                <div className="pane-actions">
                    {isMobile && (
                        <select className="device-select" value={preset.label} onChange={handlePresetChange}>
                            {DEVICE_PRESETS.map(p => (
                                <option key={p.label} value={p.label}>
                                    {p.label} ({p.width}×{p.height})
                                </option>
                            ))}
                        </select>
                    )}
                    <button className="icon-btn xs-btn" onClick={handleInspect} title="Open DevTools">🔍</button>
                </div>
            </div>

            <div className={`webview-wrapper ${isMobile ? 'mobile-wrapper' : ''}`} style={mobileWrapperStyle}>
                <webview
                    ref={handleRef as unknown as React.RefObject<HTMLElement>}
                    src={url}
                    allowpopups
                />
                {!isMobile && overlayImage && overlayOpacity !== undefined && (
                    <div className="design-overlay" style={{ opacity: overlayOpacity, pointerEvents: overlayOpacity > 0 ? 'auto' : 'none' }}>
                        <img src={overlayImage} alt="PDF Design Overlay" className="design-overlay-img" />
                    </div>
                )}
            </div>
        </div>
    );
}
