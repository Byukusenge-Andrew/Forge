# Architecture — Dev Browser

A detailed breakdown of how the application layers interact, including planned future expansions.

---

## Current Architecture (v1)

```
┌─────────────────────────────────────────────────────┐
│                   Electron Shell                    │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         React Renderer (Vite + TS)           │  │
│  │                                              │  │
│  │  TabBar → Toolbar → WebviewPane(s) + Rulers  │  │
│  │       ↑              ↑                       │  │
│  │    useTabs         useWebviewNav             │  │
│  │       ↑              ↑                       │  │
│  │    App.tsx (global state orchestrator)       │  │
│  └────────────────────┬─────────────────────────┘  │
│                       │ contextBridge IPC           │
│  ┌────────────────────▼─────────────────────────┐  │
│  │         Electron Main Process (Node.js)       │  │
│  │  - BrowserWindow creation                    │  │
│  │  - session.webRequest (CSP headers)          │  │
│  │  - ipcMain.handle('network:throttle', ...)   │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         │  Chromium webview
         ▼
  ┌──────────────┐   ┌──────────────┐
  │  Desktop WV  │   │  Mobile WV   │
  │  (full size) │   │ (device size)│
  └──────────────┘   └──────────────┘
```

---

## Component Data Flow

```
App.tsx
│  State: tabs, activeTab, splitView, overlayImage,
│         overlayOpacity, wireframeMode, showRulers,
│         networkProfile, primaryRef (webview ref)
│
├── TabBar
│     Props: tabs, activeTabId, onSelect, onClose, onNew
│     Hook:  useTabs (open/close/switch/updateTab)
│
├── Toolbar
│     Props: urlInput, primaryWebviewRef, all toggle states
│     Renders: NetworkThrottleMenu (dropdown + icon)
│     Effects: calls webview.goBack/goForward/reload via ref
│              calls IPC 'network:throttle' on profile change
│
└── content-area
      ├── Rulers (conditional)   ← pure presentational, no props
      ├── WebviewPane [primary]
      │     Props:  url, overlayImage, overlayOpacity, webviewRef
      │     State:  preset (local — device preset dropdown)
      │     Renders: <webview>, design-overlay div
      │     Effects: openDevTools() via local ref button
      │
      └── WebviewPane [mobile]   (conditional on splitView)
            Props:  url, isMobile=true
            State:  preset (local — independent from primary)
```

---

## Library / Hook / Lib Layer

| File | Role |
|---|---|
| `hooks/useTabs.ts` | Manages `tabs[]` and `activeTabId` state using lazy `useState` initializers. Exposes `openTab`, `closeTab`, `updateTab`. |
| `hooks/useWebviewNav.ts` | Returns a `ref` for the primary webview and typed `goBack/goForward/reload` wrappers. Importable anywhere. |
| `lib/tabTypes.ts` | `Tab` interface (id, title, url). `createTab()` factory using `crypto.randomUUID()`. |
| `lib/devicePresets.ts` | Array of `DevicePreset` objects with `label`, `width`, `height`. Single source of truth for all device dimensions. |
| `lib/networkProfiles.ts` | Array of `NetworkProfile` objects with `downloadThroughput`, `uploadThroughput`, `latency`, `offline`. |

---

## IPC Bridge (Electron ↔ React)

`electron/preload.js` uses `contextBridge.exposeInMainWorld('electron', {...})` to give the renderer a safe, typed subset of the IPC API:

```js
window.electron.ipcRenderer.invoke('network:throttle', { webContentsId, ...profile })
```

On the main process side, `ipcMain.handle('network:throttle', ...)` receives this and applies the Chrome DevTools Protocol commands to the target webview's `webContents`.

---

## Planned Multi-Language Architecture (v2)

```
┌────────────────────── Electron Shell ──────────────────────────────┐
│  React/TypeScript (UI — unchanged)                                 │
│          │                                                         │
│  Electron Main (Node.js)                                           │
│          │                                                         │
│          ├── spawn ──► Go Sidecar (HTTP Interceptor Proxy :8877)   │
│          │               - MITM TLS proxy for all webview traffic  │
│          │               - Exposes REST API for pause/modify/forward│
│          │                                                         │
│          └── spawn ──► Python Sidecar (AI/Automation API :8765)    │
│                          - FastAPI server                          │
│                          - Receives DOM snapshots from renderer    │
│                          - Returns Gemini AI explanations          │
│                          - Runs visual diff (OpenCV)               │
│                          - Generates Playwright scripts            │
└────────────────────────────────────────────────────────────────────┘
```

**Communication pattern:**
- Both sidecars are spawned by `electron/main.js` as child processes on startup
- They communicate over `localhost` TCP (HTTP REST / JSON)
- The renderer talks to them via `fetch()` or via Electron IPC → main → sidecar
- Sidecars are bundled as single executables for distribution (`go build`, `pyinstaller`)

---

## Security Model

| Concern | Mitigation |
|---|---|
| Webview XSS | `contextIsolation: true`, no Node integration in webview |
| IPC surface | Only whitelisted channels exposed via `preload.js` contextBridge |
| Cross-origin content | CSP header injection via `session.webRequest.onHeadersReceived` |
| Sidecar trust | Sidecars bind to `127.0.0.1` only, never accessible externally |
