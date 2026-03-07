# Feature Roadmap — Dev Browser

Features are grouped by implementation phase and language requirement. The current v1 shell is complete. Everything here is planned for v2+.

---

## ✅ Phase 1 — Current (Electron + TypeScript)

| Feature | Status |
|---|---|
| Multi-tab browsing | ✅ Done |
| Back / Forward / Reload navigation | ✅ Done |
| Split view desktop + mobile | ✅ Done |
| Device preset selector (8 devices) | ✅ Done |
| Design overlay (onion skinning) | ✅ Done |
| Wireframe mode (inject CSS) | ✅ Done |
| Pixel rulers (H + V) | ✅ Done |
| Per-pane Chrome DevTools | ✅ Done |
| Network throttle (4G / 3G / Offline) | ✅ Done |
| Custom landing/home page | ✅ Done |

---

## 🔵 Phase 2 — Pure TypeScript (No new languages needed)

These can be built directly into the Electron/React shell.

| Feature | Description |
|---|---|
| **JWT Decoder** | Auto-detect JWTs in `localStorage` or response headers and display decoded payload in a side panel |
| **CORS / CSP Auditor** | Parse response headers and visually flag missing or overly permissive security policies |
| **Local Resource Override** | Use `session.webRequest.onBeforeRequest` to swap a live production JS/CSS file with a file from disk |
| **Multi-Agent Session Isolation** | Use `session.fromPartition('tab-N')` to give each tab its own cookie jar, localStorage, and IP session |
| **CSS Grid / Flexbox X-Ray** | Inject a CSS stylesheet that puts visible guides around all `display:flex` and `display:grid` containers |
| **Element Distance Scanner** | Inject a JS hover listener that calculates `getBoundingClientRect()` distances between elements |
| **Screenshot Capture** | Call `webview.capturePage()` and save the result as a PNG using Electron's `dialog.showSaveDialog` |
| **DOM Snapshot Export** | Serialize `document.documentElement.outerHTML` + computed styles to a zip file for AI analysis |

---

## 🟡 Phase 3 — Go Sidecar (HTTP Interceptor Proxy)

A standalone Go binary started by Electron as a subprocess. Binds to `127.0.0.1:8877`. All webview traffic is routed through it via `session.setProxy()`.

| Feature | Description |
|---|---|
| **Mini-Interceptor Proxy** | Pause any HTTP/HTTPS request mid-flight. Display headers and body in the UI. Allow the user to modify and forward or drop. Functionally similar to Burp Suite's intercept tab. |
| **Rate Limit Simulator** | Force specific URLs to return HTTP 429, 500, or 503 responses, or add artificial latency, to test error handling states |
| **XSS / SQLi Fuzzer** | Right-click any input. The proxy intercepts form submissions and replaces values with a payload list from a built-in wordlist |
| **Request / Response Log** | A flat log of all HTTP traffic for the current tab with filter by domain, method, and status code |

**Go dependencies:** `net/http`, `httputil.ReverseProxy`, `crypto/tls`

---

## 🟠 Phase 4 — Python Sidecar (AI & Automation)

A `FastAPI` server started by Electron as a subprocess. Binds to `127.0.0.1:8765`.

| Feature | Description | Python Libs |
|---|---|---|
| **AI DOM Explainer** | Send a DOM snapshot to the sidecar. It calls the Gemini API and returns a plain-English explanation of the page's structure and detected issues | `google-generativeai`, `beautifulsoup4` |
| **AI CSS Auto-Refactor** | Highlight a section of the page. Send the computed styles to Gemini and ask it to rewrite the CSS (e.g., "convert to Tailwind") | `google-generativeai` |
| **Visual Diffing Engine** | Take a "baseline" screenshot. Compare future screenshots pixel-by-pixel and highlight regressions in red | `opencv-python`, `Pillow` |
| **Playwright Action Recorder** | Inject a JS event listener into the webview that captures all clicks, inputs, and navigations and sends them to the sidecar. The sidecar formats them as a ready-to-run Playwright Python or JS test file | `playwright` |
| **Context-Aware Copilot** | A chat sidebar in the UI that reads the current page's DOM, active console errors, and network failures and uses Gemini to suggest fixes | `google-generativeai`, `fastapi` |

**Python dependencies:** `fastapi`, `uvicorn`, `google-generativeai`, `opencv-python`, `Pillow`, `playwright`

---

## 🔴 Phase 5 — Rust Sidecar (High-Performance Network Layer)

For features that require high-throughput, low-latency, concurrent packet inspection beyond what Go or Node can handle.

| Feature | Description |
|---|---|
| **WebSocket & SSE Inspector** | Intercept and display live WebSocket frames and Server-Sent Events, with the ability to pause, filter, and manually inject messages at high frequency |
| **Web Serial / MQTT Monitor** | Connect to local IoT devices (ESP8266, Arduino) via Web Serial or MQTT and display a formatted message terminal in a side panel |
| **Deep Link Simulator** | Fire custom URI scheme links (`myapp://`) to test web-to-native app handoffs on iOS and Android deep link configurations |

**Rust dependencies:** `tokio`, `hyper`, `tungstenite`, `neon` (for Node native addon)

---

## Sidecar Startup Plan

```js
// electron/main.js  (planned addition)
import { spawn } from 'child_process';
import path from 'path';

let goProxy, pythonAI;

app.whenReady().then(() => {
  // Start Go interceptor proxy
  goProxy = spawn(path.join(__dirname, '../sidecars/devproxy'), ['--port', '8877']);
  session.defaultSession.setProxy({ proxyRules: 'http://127.0.0.1:8877' });

  // Start Python AI sidecar
  pythonAI = spawn(path.join(__dirname, '../sidecars/aiserve'), ['--port', '8765']);

  createWindow();
});

app.on('window-all-closed', () => {
  goProxy?.kill();
  pythonAI?.kill();
  if (process.platform !== 'darwin') app.quit();
});
```

---

## Language Decision Matrix

| Requirement | TypeScript | Go | Python | Rust |
|---|:---:|:---:|:---:|:---:|
| UI components | ✅ | – | – | – |
| Local state, hooks | ✅ | – | – | – |
| Electron IPC | ✅ | – | – | – |
| HTTP interceptor / MITM proxy | ⚠️ slow | ✅ | – | ✅ |
| AI API calls | ✅ | – | ✅ best | – |
| Visual diffing | – | – | ✅ OpenCV | – |
| High-freq WebSocket inspection | – | ✅ | – | ✅ best |
| Native OS / hardware (Serial, BLE) | – | – | – | ✅ |


## If you have more ideas feel free to contribute