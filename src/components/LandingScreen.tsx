import './LandingScreen.css';

export function LandingScreen() {
    return (
        <div className="landing-screen">
            <div className="hero">
                <div className="hero-badge">Developer Toolbox</div>
                <h1>Dev Browser</h1>
                <p className="subtitle">
                    A precision browser built for developers and designers. Every tool in this shell is
                    purpose-built to save you time during the frontend development loop.
                </p>
            </div>

            <p className="section-title">Core Features</p>

            <div className="features">
                {/* Tabs */}
                <div className="card">
                    <span className="card-icon">🗂️</span>
                    <div className="card-title">Multi-Tab Browsing</div>
                    <p className="card-desc">
                        Manage multiple pages simultaneously in a single window. Each tab maintains its own
                        independent browsing session and navigation history so you can compare multiple URLs side by side
                        without losing context.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>＋</strong> in the tab bar to open a new blank tab.</li>
                            <li>Type a URL in the address bar and press <kbd className="kbd">Enter</kbd> to load it.</li>
                            <li>Click any tab to switch to it — the address bar and webview update instantly.</li>
                            <li>Click <strong>×</strong> on a tab to close it. The last tab is always preserved.</li>
                        </ol>
                    </div>
                </div>

                {/* Split View */}
                <div className="card">
                    <span className="card-icon">⊞</span>
                    <div className="card-title">Split View — Mobile Preview</div>
                    <p className="card-desc">
                        Renders the same URL simultaneously in both a full desktop viewport and a realistic
                        mobile device frame. Ideal for catching layout breaks immediately without switching tools or browser
                        windows.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click the <strong>⊞</strong> icon in the toolbar to toggle split view on.</li>
                            <li>A mobile panel appears on the right with a device frame and shadow.</li>
                            <li>Use the <strong>device preset dropdown</strong> in the panel header to switch between iPhone SE,
                                Pixel 7, iPad Air, and more. The webview dimensions update live.</li>
                            <li>Both panes load the same URL. Navigate in the address bar to update both simultaneously.</li>
                        </ol>
                    </div>
                </div>

                {/* Design Overlay */}
                <div className="card">
                    <span className="card-icon">🖼️</span>
                    <div className="card-title">Design Overlay (Onion Skinning)</div>
                    <p className="card-desc">
                        Superimpose any design mockup — Figma exports, Sketch artboards, or PNGs — directly on
                        top of the live page. Adjust opacity to fade between the design layer and the real implementation,
                        making pixel-perfect comparisons effortless.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click the <strong>🖼️</strong> button in the toolbar to open a file picker.</li>
                            <li>Select any image file (PNG, JPEG, WebP, SVG).</li>
                            <li>The image is sized to fill the primary webview as an absolute overlay layer with
                                <code>pointer-events: none</code> — so clicks still pass through to the real page.
                            </li>
                            <li>Drag the <strong>opacity slider</strong> that appears to blend between 0% (only the site) and
                                100% (only the mockup).</li>
                        </ol>
                    </div>
                </div>

                {/* Wireframe Mode */}
                <div className="card">
                    <span className="card-icon">🕸️</span>
                    <div className="card-title">Wireframe Mode</div>
                    <p className="card-desc">
                        One-click structural X-ray of any page. All backgrounds are stripped and every DOM
                        element gets a 1px red outline, making the box model, layout nesting, and spacing issues immediately
                        visible without opening DevTools.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>🕸️</strong> to activate wireframe mode. The button turns blue when active.</li>
                            <li>The browser injects a CSS stylesheet directly into the webview using Electron's
                                <code>webview.insertCSS()</code> API, which applies
                                <code>outline: 1px solid red !important</code> and removes all background colors from every
                                element.
                            </li>
                            <li>This affects every element in the DOM tree — divs, images, buttons, inputs — all at once.</li>
                            <li>Click <strong>🕸️</strong> again to disable it. The page reloads to cleanly restore original
                                styles.</li>
                        </ol>
                    </div>
                </div>

                {/* Rulers */}
                <div className="card">
                    <span className="card-icon">📏</span>
                    <div className="card-title">Measurement Rulers</div>
                    <p className="card-desc">
                        Pixel rulers along the top and left edges of the content area let you visually measure
                        distances, verify spacing values, and align elements accurately — just like Photoshop or Figma guides,
                        but live inside your browser.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>📏</strong> to toggle the rulers on. Horizontal (top) and vertical (left) rulers
                                appear.</li>
                            <li>Tick marks are placed every <strong>100px</strong> with numeric labels indicating the pixel
                                offset from the origin.</li>
                            <li>The content area gains padding to make room for the rulers so no webview content is obscured.
                            </li>
                            <li>Click <strong>📏</strong> again to dismiss the rulers without affecting the page.</li>
                        </ol>
                    </div>
                </div>

                {/* DevTools */}
                <div className="card">
                    <span className="card-icon">🔍</span>
                    <div className="card-title">Per-Pane DevTools</div>
                    <p className="card-desc">
                        Each webview pane has its own independent Chrome DevTools instance. Inspect the DOM,
                        profile JavaScript, and monitor network requests for the desktop view and the mobile view separately —
                        critical when a bug only appears at a specific viewport size.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Each pane header contains a small <strong>🔍</strong> button.</li>
                            <li>Clicking it calls <code>webview.openDevTools()</code> via a ref directly on that pane's
                                <code>&lt;webview&gt;</code> element.
                            </li>
                            <li>A full Chrome DevTools window opens, scoped entirely to that webview's web contents — including
                                its own Console, Network panel, and Elements tree.</li>
                            <li>You can have DevTools open for both the desktop and mobile pane at the same time.</li>
                        </ol>
                    </div>
                </div>

                {/* Network Throttle */}
                <div className="card">
                    <span className="card-icon">🐢</span>
                    <div className="card-title">Network Throttle</div>
                    <p className="card-desc">
                        Simulate real-world network conditions — from blazing fast 4G down to painful Slow 3G
                        or complete offline mode. Test how your app loads for users on mobile data, highlight large bundle
                        sizes, and verify your offline fallback behaviour.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Use the <strong>⚡ / 🐢 / 🚫</strong> dropdown in the toolbar to select a profile.</li>
                            <li>Profiles include: No Throttle, Fast 4G, Slow 4G, Fast 3G, Slow 3G, and Offline.</li>
                            <li>Each profile defines a <code>downloadThroughput</code>, <code>uploadThroughput</code>, and
                                <code>latency</code> value (in bytes/s and ms).
                            </li>
                            <li>The selection is sent via Electron's IPC bridge to the main process, which applies
                                <code>Network.emulateNetworkConditions</code> through the Chrome DevTools Protocol to the active
                                webview.
                            </li>
                        </ol>
                    </div>
                </div>

                {/* Nav Buttons */}
                <div className="card">
                    <span className="card-icon">«»↻</span>
                    <div className="card-title">Navigation Controls</div>
                    <p className="card-desc">
                        Back, Forward, and Reload buttons in the toolbar work directly on the primary webview,
                        just like a real browser. Navigation history is maintained per tab session, so each tab has its own
                        independent back/forward stack.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>The primary webview element is accessed via a React <code>ref</code> that is passed from
                                <code>App.tsx</code> into the <code>Toolbar</code> component.
                            </li>
                            <li><strong>«</strong> calls <code>webview.goBack()</code>, <strong>»</strong> calls
                                <code>webview.goForward()</code>, and <strong>↻</strong> calls <code>webview.reload()</code> on
                                the Electron WebviewTag API.
                            </li>
                            <li>Typing a URL and pressing <kbd className="kbd">Enter</kbd> updates the React state, which flows as a
                                new <code>src</code> prop to the webview — React's declarative model handles the navigation.
                            </li>
                            <li>Switching tabs reinitializes the webview's <code>src</code> by keying the component on
                                <code>activeTabId</code>, ensuring each tab loads the correct URL independently.</li>
                        </ol>
                    </div>
                </div>

                {/* Go HTTP Proxy */}
                <div className="card">
                    <span className="card-icon">🔌</span>
                    <div className="card-title">Integrated Go Proxy</div>
                    <p className="card-desc">
                        A high-performance HTTP MITM proxy sidecar written in Go. View raw request/response
                        logs, intercept and rewrite traffic on the fly, and apply advanced rate-limiting rules directly from the
                        browser UI.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>🔀</strong> to open the Proxy Panel.</li>
                            <li>The Go sidecar runs silently on port 8877, intercepting all HTTP traffic scoped to the webview
                                session.</li>
                            <li>Use the <strong>Log</strong> tab to stream SSE traffic, or the <strong>Intercept</strong> tab to
                                modify bodies before they hit the browser.</li>
                        </ol>
                    </div>
                </div>

                {/* JWT Decoder */}
                <div className="card">
                    <span className="card-icon">🔑</span>
                    <div className="card-title">JWT Decoder</div>
                    <p className="card-desc">
                        Instantly scan the active page's Local Storage, Session Storage, and Cookies for JWT
                        tokens. Decode their headers and payloads in a clean side panel to verify claims and expirations without
                        external tools.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>🔑</strong> to open the JWT panel.</li>
                            <li>Click <strong>Scan Page</strong>. The browser injects an extraction script and returns matched
                                tokens.</li>
                            <li>Select a token to view the decoded JSON payload and a color-coded expiration badge.</li>
                        </ol>
                    </div>
                </div>

                {/* Security Auditor */}
                <div className="card">
                    <span className="card-icon">🛡️</span>
                    <div className="card-title">Security Header Auditor</div>
                    <p className="card-desc">
                        Automatically analyzes the response headers of the current page (CSP, HSTS,
                        X-Frame-Options, CORS) and flags missing or weak security configurations.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>🛡️</strong> to open the Security panel.</li>
                            <li>Click <strong>Audit Page</strong> to analyze the stored headers from the last page load.</li>
                            <li>Issues are highlighted with Good (Green), Warning (Yellow), or Bad (Red) indicators alongside
                                remediation advice.</li>
                        </ol>
                    </div>
                </div>

                {/* Layout X-Ray */}
                <div className="card">
                    <span className="card-icon">🧮</span>
                    <div className="card-title">Layout X-Ray</div>
                    <p className="card-desc">
                        Instantly highlight all Flexbox and Grid containers on the page to quickly debug
                        complex layout nesting and alignment issues.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>🧮</strong> to toggle X-Ray mode.</li>
                            <li>Flex containers are highlighted in blue. Grid containers are highlighted in purple.</li>
                        </ol>
                    </div>
                </div>

                {/* Distance Scanner */}
                <div className="card">
                    <span className="card-icon">📐</span>
                    <div className="card-title">Distance Scanner</div>
                    <p className="card-desc">
                        Hover over any element on the page to instantly view its exact pixel distances to the
                        viewport edges, making margin and padding verification effortless.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>📐</strong> to activate the scanner.</li>
                            <li>Move your mouse around the webview to draw live distance guides.</li>
                        </ol>
                    </div>
                </div>

                {/* DOM Snapshot Export */}
                <div className="card">
                    <span className="card-icon">📦</span>
                    <div className="card-title">DOM Snapshot Export</div>
                    <p className="card-desc">
                        Serialize the current state of the DOM (including any JavaScript mutations) and save it
                        as an offline HTML file for later inspection or sharing.
                    </p>
                    <div className="how-it-works">
                        <div className="how-it-works-title">How it works</div>
                        <ol>
                            <li>Click <strong>📦</strong> to trigger an export.</li>
                            <li>Choose a save location. The resulting HTML file contains the exact DOM state at that moment.</li>
                        </ol>
                    </div>
                </div>
            </div>

            <footer className="landing-footer">
                Dev Browser — built with Electron, Vite, React, and TypeScript.<br />
                Type a URL in the address bar above to start browsing.
            </footer>
        </div>
    );
}
