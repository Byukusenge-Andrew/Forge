import { useRef } from 'react';

// Electron webview element interface
export interface ElectronWebview extends HTMLElement {
    insertCSS: (css: string) => Promise<string>;
    reload: () => void;
    goBack: () => void;
    goForward: () => void;
    openDevTools: () => void;
    loadURL: (url: string) => Promise<void>;
}

/**
 * Hook that returns a ref for a primary webview and navigation handlers.
 */
export function useWebviewNav() {
    const primaryRef = useRef<ElectronWebview | null>(null);

    const goBack = () => primaryRef.current?.goBack();
    const goForward = () => primaryRef.current?.goForward();
    const reload = () => primaryRef.current?.reload();

    return { primaryRef, goBack, goForward, reload };
}
