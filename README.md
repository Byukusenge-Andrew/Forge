# Dev Browser

A custom developer-focused browser built with **Electron, React, and TypeScript**, supercharged by a **Python AI Sidecar**. It provides a suite of visual debugging tools (onion-skin overlays, rulers, mobile split-view, hardware-level network throttling) directly inside the browser shell. 

Powered by the **Gemini API** and **OpenCV**, the browser actively assists developers by explaining DOM structures, calculating structural visual diffs across screen states, and instantly generating robust Playwright test scripts from recorded browser interactions.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start in development mode (Vite + Electron together)
npm run electron:dev
```

---

## Download / Installation

- **Pre-built Windows `.exe`**: Download the latest installer from the **GitHub Actions** tab (under Artifacts) or the **Releases** page (if available).
- **Build Locally**: Run `npm run pack` to generate the `.exe` inside the `release/` directory.

---

## Project Structure

```
dev-browser/
├── electron/
│   ├── main.js           # Electron main process (window, IPC, session)
│   └── preload.js        # Context bridge (exposes IPC to renderer)
│
├── public/
│   └── landing.html      # Custom new-tab / home page
│
└── src/
    ├── App.tsx           # Root component — global state orchestration
    ├── index.css         # Global design system & component styles
    ├── main.tsx          # React entry point
    │
    ├── components/
    │   ├── AiPanel.tsx           # AI tools (DOM Explainer, Visual Diff, Playwright generator)
    │   ├── HistoryPanel.tsx      # SQLite-backed browsing history viewer
    │   ├── SettingsModal.tsx     # Gemini API Key configuration
    │   ├── TabBar.tsx            # Multi-tab strip UI
    │   ├── Toolbar.tsx           # Address bar, nav buttons, tool toggles
    │   ├── WebviewPane.tsx       # Single webview frame with DevTools & device preset
    │   ├── Rulers.tsx            # Pixel ruler overlay (H + V)
    │   └── NetworkThrottleMenu.tsx  # Network condition selector dropdown
    │
    ├── hooks/
    │   ├── useAiSidecar.ts   # Wraps Python FastAPI HTTP endpoint calls
    │   ├── useHistory.ts     # SQLite IPC bindings for history
    │   ├── useSettings.ts    # Settings IPC bindings for Gemini Key
    │   └── useTabs.ts        # Tab open/close/switch state management
    │
    └── lib/
        ├── tabTypes.ts        # Tab interface and createTab() factory
        ├── devicePresets.ts   # Mobile device dimension presets
        └── networkProfiles.ts # Network throttle profile definitions
        
sidecars/
└── ai_server/
    ├── main.py              # FastAPI microservice entrypoint
    ├── routes/              # Handlers for visual diff, Playwright gen, and DOM explanation
    └── requirements.txt     # Python dependencies (Playwright, OpenCV, Google GenAI)
```

---

## Features

### 🗂️ Multi-Tab Browsing
- Open, close, and switch tabs from the tab bar
- Each tab has its own URL, title, and navigation history
- **State Preservation**: All tab webviews are rendered simultaneously and toggled via CSS `display: none`. Switching tabs will *never* force the page to reload.

### 🕑 SQLite Browsing History
- Automatically logs all navigated URLs using a `better-sqlite3` backing database
- Accessed via the 🕑 button in the toolbar
- Searchable by URL or page title
- Grouped neatly by "Today", "Yesterday", and older dates

### «»↻ Navigation Controls
- Back, Forward, and Reload buttons operate directly on the primary webview via an Electron `WebviewTag` ref passed through `App.tsx → Toolbar`

### ⊞ Split View — Mobile Preview
- Renders the same URL in both a desktop and a configurable mobile device frame
- Mobile pane width and height are driven by the **Device Preset** dropdown

### 📱 Device Presets
- 8 real device dimensions built into `src/lib/devicePresets.ts`
- iPhone SE, iPhone 14 Pro Max, Pixel 7, Galaxy S23, iPad Mini, iPad Air, iPad Pro 12.9"
- The preset dropdown in the mobile pane header updates the frame size live via inline `style`

### 🖼️ Design Overlay (Onion Skinning)
- Upload any image (PNG, JPEG, WebP) from the toolbar
- Image is positioned absolutely over the primary webview with `pointer-events: none`
- Opacity slider blends between 0–100% for pixel-accurate comparison

### 🕸️ Wireframe Mode
- Injects `outline: 1px solid red !important; background: transparent !important;` into every webview using `webview.insertCSS()`
- Toggle off reloads the webview to cleanly restore styles

### 📏 Measurement Rulers
- Horizontal and vertical pixel rulers drawn with CSS along the content area edges
- Tick marks every 100px with numeric labels

### 🔌 Integrated Go Proxy (Sidecar)
- High-performance HTTP HTTP/MITM proxy running silently on port 8877.
- **Log Tab**: Streams real-time HTTP requests/responses via SSE directly into the DevBrowser React UI.
- **Intercept Tab**: Pause requests, rewrite JSON bodies, adjust outgoing headers, and drop connections on the fly.
- **Rate Limit Tab**: Simulate connection pooling limits and artificial latency at the packet level.
- **Fuzzer Tab**: Randomly inject faulty data or drop packets based on a percentage slider to test frontend resilience.

### 🔑 JWT Decoder
- Injects an extraction script into the active page to scrape LocalStorage, SessionStorage, and Document Cookies.
- Parses anything matching the standard `xxxxx.yyyyy.zzzzz` pattern.
- Decodes the header, verifies the signature structure, and cleanly formats the JWT payload.
- Automatically flags tokens that surpass their `exp` claim as Exired (Red) or Valid (Green).

### 🛡️ Security Header Auditor
- Hooks directly into Electron's `onHeadersReceived` event pipeline to capture raw response headers.
- Analyzes and grades the presence of security-critical directives (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CORS).
- Flags missing headers or weak configurations (e.g. `'unsafe-eval'` in CSP) with visual warnings and remediation advice.

### 🧮 Layout X-Ray
- Development tool to instantly find layout containers.
- Injects CSS to strongly outline all `display: flex` elements in blue and `display: grid` elements in purple.

### 📐 Distance Scanner
- Visual margin and padding inspector.
- Injects an overlay into the webview. Hovering any element draws measurement guides and calculates the exact pixel distances between the bounding client rect of the target and the actual viewport edges.

### 📦 DOM Snapshot Export
- Instantly capture the live generated DOM state.
- Extracts `document.documentElement.outerHTML` (capturing all mutations handled by JavaScript frameworks after initial load).
- Wraps the DOM tree with viewport/timestamp metadata and triggers a native OS save dialog to export as an offline `.html` file.

### 🔍 Per-Pane DevTools
- Each `WebviewPane` has an **Inspect** button that calls `webview.openDevTools()` via a React ref scoped to that specific pane
- Desktop and mobile panes get independent DevTools windows

### 🐢 Network Throttle
- Profiles defined in `src/lib/networkProfiles.ts`
- Dropdown in the toolbar with: No Throttle ⚡, Fast 4G, Slow 4G, Fast 3G, Slow 3G, Offline 🚫
- **Hardware Level accuracy**: Attaches a silent diagnostic debugger to the `<webview>` and applies Chrome DevTools Protocol (CDP) `Network.emulateNetworkConditions` to guarantee accurate packet limits even on streaming protocols.

### 🤖 AI-Powered Sidecar (Python FastAPI)
Running locally alongside the Electron application is a Python microservice that supercharges the browser using the Gemini API and OpenCV:
- **DOM Explainer**: Select an element; Gemini reads the DOM structure and explains how it was built.
- **Visual Diffing**: Take a baseline screenshot, make code changes, and take another. The sidecar uses OpenCV to calculate structural differences and highlighting changed pixels.
- **Playwright Test Generation**: Record a series of clicks and inputs. The sidecar asks Gemini to instantly generate a robust Python or Node Playwright test script mimicking those actions.
- **Bring Your Own Key**: Securely manage your `GEMINI_API_KEY` in the browser's settings modal.

---

## Architecture Overview

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full technical breakdown.

## Feature Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the planned feature pipeline and multi-language expansion plan.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Shell / OS integration | Electron (Node.js) |
| UI framework | React 18 + TypeScript |
| Build tool | Vite 7 |
| Styling | Vanilla CSS (design tokens via CSS custom properties) |
| IPC bridge | Electron `contextBridge` + `ipcMain`/`ipcRenderer` |
| Webview engine | Chromium via Electron `<webview>` tag |
