import { useState, useRef, useCallback } from 'react';
import './index.css';
import { Toolbar } from './components/Toolbar';
import { WebviewPane } from './components/WebviewPane';
import { Rulers } from './components/Rulers';
import { TabBar } from './components/TabBar';
import { HistoryPanel } from './components/HistoryPanel';
import { ProxyPanel } from './components/ProxyPanel';
import { JwtPanel } from './components/JwtPanel';
import { SecurityPanel } from './components/SecurityPanel';
import { useTabs } from './hooks/useTabs';
import { useHistory } from './hooks/useHistory';
import { DEFAULT_PROFILE, type NetworkProfile } from './lib/networkProfiles';

import * as pdfjsLib from 'pdfjs-dist';
// Explicitly import the worker path for Vite
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: boolean | undefined;
      };
    }
  }
}

export interface ElectronWebview extends HTMLElement {
  insertCSS: (css: string) => Promise<string>;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  openDevTools: () => void;
  getWebContentsId: () => number;
  getTitle: () => string;
}

function App() {
  const { tabs, activeTab, activeTabId, setActiveTabId, openTab, closeTab, updateTab } = useTabs();
  const { addEntry } = useHistory();

  const [urlInput, setUrlInput] = useState(activeTab.url);
  // splitView is now PER-TAB — stored in tab.splitView, not a global boolean
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.5);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showProxy, setShowProxy] = useState(false);
  const [showJwt, setShowJwt] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [distanceActive, setDistanceActive] = useState(false);
  const [networkProfile, setNetworkProfile] = useState<NetworkProfile>(DEFAULT_PROFILE);

  // Derived from the active tab — each tab has its own split view state
  const splitView = activeTab.splitView ?? false;
  const setSplitView = (val: boolean) => updateTab(activeTabId, { splitView: val });

  // ── Webview refs: one per tab, keyed by tabId ────────────────────────────
  // We render ALL webviews simultaneously and CSS-hide inactive ones.
  // This prevents webviews from unmounting/reloading when switching tabs.
  const webviewRefs = useRef<Map<string, ElectronWebview>>(new Map());
  const getActiveWv = useCallback(() => webviewRefs.current.get(activeTabId) ?? null, [activeTabId]);

  // Called by each WebviewPane when its webview element mounts
  const registerWebview = useCallback((tabId: string, el: ElectronWebview | null) => {
    if (el) webviewRefs.current.set(tabId, el);
    else webviewRefs.current.delete(tabId);
  }, []);

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
    const tab = tabs.find(t => t.id === id);
    if (tab) setUrlInput(tab.url);
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let finalUrl = urlInput;
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
    setUrlInput(finalUrl);
    try {
      const hostname = new URL(finalUrl).hostname;
      updateTab(activeTabId, { url: finalUrl, title: hostname });
      addEntry(finalUrl, hostname);
    } catch {
      updateTab(activeTabId, { url: finalUrl });
      addEntry(finalUrl, finalUrl);
    }
  };

  // Called when a user clicks a link inside the webview itself
  const handleWebviewNavigate = useCallback((tabId: string, newUrl: string, newTitle: string) => {
    updateTab(tabId, { url: newUrl, title: newTitle });
    addEntry(newUrl, newTitle);
    if (tabId === activeTabId) {
      setUrlInput(newUrl);
    }
  }, [activeTabId, updateTab, addEntry]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for sharpness

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await page.render({ canvasContext: context, viewport } as any).promise;
        setOverlayImage(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Error parsing PDF overlay:', err);
        alert('Failed to load PDF overlay');
      }
    } else {
      setOverlayImage(URL.createObjectURL(file));
    }
  };

  const clearOverlay = () => setOverlayImage(null);

  const toggleWireframe = () => {
    const newMode = !wireframeMode;
    setWireframeMode(newMode);
    // Only apply to the currently visible webview(s)
    const wv = getActiveWv();
    if (wv) {
      if (newMode) {
        wv.insertCSS('* { outline: 1px solid red !important; background: transparent !important; }')
          .then(key => wv.setAttribute('data-wireframe-key', key));
      } else {
        wv.reload();
      }
    }
  };

  // Navigate to a URL from the history panel
  const navigateToUrl = (url: string) => {
    setUrlInput(url);
    updateTab(activeTabId, { url, title: new URL(url).hostname });
    setShowHistory(false);
  };

  return (
    <div className="browser-shell">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={handleSelectTab}
        onClose={closeTab}
        onNew={() => openTab()}
      />

      <Toolbar
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        getActiveWebview={getActiveWv}
        splitView={splitView} setSplitView={setSplitView}
        wireframeMode={wireframeMode} toggleWireframe={toggleWireframe}
        showRulers={showRulers} setShowRulers={setShowRulers}
        showHistory={showHistory} setShowHistory={setShowHistory}
        showProxy={showProxy} setShowProxy={setShowProxy}
        showJwt={showJwt} setShowJwt={setShowJwt}
        showSecurity={showSecurity} setShowSecurity={setShowSecurity}
        distanceActive={distanceActive} setDistanceActive={setDistanceActive}
        overlayImage={overlayImage} handleImageUpload={handleImageUpload}
        clearOverlay={clearOverlay}
        overlayOpacity={overlayOpacity} setOverlayOpacity={setOverlayOpacity}
        handleNavigate={handleNavigate}
        networkProfile={networkProfile} onNetworkChange={setNetworkProfile}
      />

      <div className="app-body">
        {showHistory && (
          <HistoryPanel onNavigate={navigateToUrl} />
        )}
        {showProxy && (
          <ProxyPanel />
        )}
        {showJwt && (
          <JwtPanel getActiveWebview={getActiveWv} />
        )}
        {showSecurity && (
          <SecurityPanel activeUrl={activeTab.url} />
        )}

        <div className={`content-area ${showRulers ? 'with-rulers' : ''}`}>
          {showRulers && <Rulers />}

          {/* Render ALL tab webviews simultaneously; hide inactive via CSS.
              This prevents tab-switching from unmounting and reloading a webview. */}
          {tabs.map(tab => (
            <WebviewPane
              key={tab.id}
              tabId={tab.id}
              title={tab.title}
              url={tab.url}
              hidden={tab.id !== activeTabId}
              onWebviewMount={registerWebview}
              onNavigate={(u, t) => handleWebviewNavigate(tab.id, u, t)}
              overlayImage={tab.id === activeTabId ? overlayImage : null}
              overlayOpacity={overlayOpacity}
            />
          ))}

          {/* Mobile split view — always uses the active tab URL */}
          {splitView && (
            <WebviewPane
              key="mobile"
              tabId="mobile"
              title="Mobile View"
              url={activeTab.url}
              isMobile={true}
              onWebviewMount={registerWebview}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
