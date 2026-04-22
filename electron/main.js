import { app, BrowserWindow, session, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import http from 'http';

// ── Ad Blocker Domains ────────────────────────────────────────────────────────
const AD_DOMAINS = [
    'doubleclick.net', 'googlesyndication.com', 'google-analytics.com', 'adnxs.com',
    'quantserve.com', 'scorecardresearch.com', 'exponential.com', 'advertising.com',
    'amazon-adsystem.com', 'adbrn.com', 'adform.net', 'adroll.com', 'adsrvr.org',
    'adtech.de', 'adtheta.com', 'taboola.com', 'outbrain.com', 'mgid.com',
    'revcontent.com', 'popads.net', 'popcash.net', 'yandex.ru', 'openx.net',
    'pubmatic.com', 'rubiconproject.com', 'yieldmo.com', 'moatads.com',
    'lijit.com', 'bidswitch.net', 'casalemedia.com', 'criteo.com',
    'indexww.com', 'smartadserver.com', 'sovrn.com', 'teads.tv',
    'triplelift.com',
];

let adBlockEnabled = false;

// __dirname is not reliable in ESM ASAR, using app.getAppPath() where needed

// ── JSON-based History (no native modules required) ───────────────────────────
// History is stored as an array of entry objects, newest-first, in history.json.
// This avoids the better-sqlite3 NODE_MODULE_VERSION mismatch entirely.
const userDataPath = app.getPath('userData');
const historyPath = path.join(userDataPath, 'history.json');

function readHistory() {
    try {
        return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch {
        return [];
    }
}

function writeHistory(entries) {
    fs.writeFileSync(historyPath, JSON.stringify(entries, null, 2), 'utf-8');
}

// ── IPC: History ───────────────────────────────────────────────────────────────
ipcMain.handle('history:add', (_e, { url, title }) => {
    const entries = readHistory();
    const newEntry = {
        id: Date.now(),
        url,
        title: title ?? url,
        visited_at: new Date().toISOString(),
    };
    // Newest-first, keep latest 1000 entries only
    entries.unshift(newEntry);
    writeHistory(entries.slice(0, 1000));
    return { ok: true };
});

ipcMain.handle('history:get', (_e, { search = '' } = {}) => {
    const lower = search.toLowerCase();
    return readHistory().filter(e =>
        !lower ||
        e.url.toLowerCase().includes(lower) ||
        (e.title ?? '').toLowerCase().includes(lower)
    ).slice(0, 500);
});

ipcMain.handle('history:clear', () => {
    writeHistory([]);
    return { ok: true };
});



// ── IPC: Settings ─────────────────────────────────────────────────────────────
const settingsPath = path.join(userDataPath, 'settings.json');

ipcMain.handle('settings:load', () => {
    try {
        return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {
        return {};
    }
});

ipcMain.handle('settings:save', (_e, data) => {
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
});

// ── IPC: Network Throttle ─────────────────────────────────────────────────────
// KEY INSIGHT: session.defaultSession is the Electron *shell* session.
// Webview traffic flows through `webContents.fromId(id).session`.
// We must call enableNetworkEmulation() on THAT session object directly.
ipcMain.handle('network:throttle', async (_e, { webContentsId, ...profile }) => {
    try {
        console.log(`[throttle] request wcId=${webContentsId}`, profile);
        if (!webContentsId) return { ok: false, error: 'No webContentsId' };

        const { webContents } = await import('electron');
        const wc = webContents.fromId(webContentsId);
        if (!wc) {
            console.error(`[throttle] webContents ${webContentsId} not found`);
            return { ok: false, error: 'WebContents not found' };
        }

        const ses = wc.session;

        if (profile.offline) {
            ses.enableNetworkEmulation({ offline: true });
        } else if (profile.downloadThroughput !== -1 || profile.uploadThroughput !== -1) {
            ses.enableNetworkEmulation({
                offline: false,
                latency: profile.latency ?? 0,
                downloadThroughput: profile.downloadThroughput === -1 ? 0 : profile.downloadThroughput,
                uploadThroughput: profile.uploadThroughput === -1 ? 0 : profile.uploadThroughput,
            });
        } else {
            ses.disableNetworkEmulation();
        }

        console.log(`[throttle] applied via session ${ses.storagePath ?? '(default)'}`);
        return { ok: true };
    } catch (err) {
        console.error('[throttle] error:', err);
        return { ok: false, error: String(err) };
    }
});

// ── IPC: Ad Blocker ───────────────────────────────────────────────────────────
ipcMain.handle('adblock:toggle', (_e, enabled) => {
    adBlockEnabled = enabled;
    console.log(`[adblock] status: ${adBlockEnabled ? 'ENABLED' : 'DISABLED'}`);
    return { ok: true, enabled: adBlockEnabled };
});

// ── IPC: Phase 2 Features ─────────────────────────────────────────────────────

// Store the last response headers seen per URL (for the Security Auditor).
const lastHeaders = new Map(); // url → headers object

// ── IPC: JWT Scanner ─────────────────────────────────────────────────────────
// Executes JS in the active webview to pull all localStorage/sessionStorage
// values that look like JWTs, then returns them to the renderer.
ipcMain.handle('jwt:scan', async (_e, webContentsId) => {
    try {
        const { webContents } = await import('electron');
        const wc = webContents.fromId(webContentsId);
        if (!wc) return { ok: false, tokens: [] };

        const script = `(function() {
            const JWT_RE = /^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+$/;
            const found = [];
            const scan = (store, storeName) => {
                for (let i = 0; i < store.length; i++) {
                    const key = store.key(i);
                    const val = store.getItem(key);
                    if (val && JWT_RE.test(val.trim())) {
                        found.push({ key, value: val.trim(), store: storeName });
                    }
                }
            };
            try { scan(localStorage, 'localStorage'); } catch(e) {}
            try { scan(sessionStorage, 'sessionStorage'); } catch(e) {}
            // Also check cookies for Bearer tokens
            document.cookie.split(';').forEach(c => {
                const [k, v] = c.trim().split('=');
                if (v && JWT_RE.test(v.trim())) found.push({ key: k, value: v.trim(), store: 'cookie' });
            });
            return found;
        })()`;

        const tokens = await wc.executeJavaScript(script);
        return { ok: true, tokens };
    } catch (err) {
        return { ok: false, error: String(err), tokens: [] };
    }
});

// ── IPC: Webview JS Execute ───────────────────────────────────────────────────
ipcMain.handle('webview:execute', async (_e, { id, script }) => {
    try {
        const { webContents } = await import('electron');
        const wc = webContents.fromId(id);
        if (!wc) return;
        return await wc.executeJavaScript(script);
    } catch (err) {
        console.error('[webview:execute] Error:', err);
        return undefined;
    }
});

// ── IPC: Security Headers ─────────────────────────────────────────────────────
ipcMain.handle('security:headers', (_e, url) => {
    const headers = lastHeaders.get(url) ?? lastHeaders.get(url?.split('?')[0]) ?? null;
    return { ok: true, headers };
});

// ── IPC: Screenshot ───────────────────────────────────────────────────────────
ipcMain.handle('screenshot:capture', async (_e, webContentsId) => {
    try {
        const { webContents, dialog, nativeImage } = await import('electron');
        const wc = webContents.fromId(webContentsId);
        if (!wc) return { ok: false, error: 'WebContents not found' };

        const image = await wc.capturePage();
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save Screenshot',
            defaultPath: `screenshot-${Date.now()}.png`,
            filters: [{ name: 'PNG Image', extensions: ['png'] }],
        });
        if (!filePath) return { ok: false, error: 'cancelled' };
        fs.writeFileSync(filePath, image.toPNG());
        return { ok: true, filePath };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
});

// ── IPC: DOM Snapshot Export ─────────────────────────────────────────────────
ipcMain.handle('snapshot:export', async (_e, { webContentsId, html, url }) => {
    try {
        const { dialog } = await import('electron');
        const { filePath } = await dialog.showSaveDialog({
            title: 'Save DOM Snapshot',
            defaultPath: `dom-snapshot-${Date.now()}.html`,
            filters: [{ name: 'HTML File', extensions: ['html'] }],
        });
        if (!filePath) return { ok: false, error: 'cancelled' };

        const meta = `<!-- Snapshot URL: ${url}\n     Captured: ${new Date().toISOString()} -->\n`;
        fs.writeFileSync(filePath, meta + html, 'utf-8');
        return { ok: true, filePath };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
});

;

// ── Window ────────────────────────────────────────────────────────────────────

// Register `app://` protocol to serve files from the /public folder.
// This avoids passing landing.html through Vite's dev-server transform pipeline
// (which causes ERR_ABORTED inside <webview> tags).
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            sandbox: true,
            nodeIntegration: false,
            preload: path.join(app.getAppPath(), 'electron', 'preload.js'),
            webviewTag: true,
            contextIsolation: true,
            
        }
    });

    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    }

    // Register the app:// protocol handler (must happen after session is available)
    // Maps app://filename => <projectRoot>/public/filename
    const publicDir = app.isPackaged
        ? path.join(process.resourcesPath, 'public')
        : path.join(app.getAppPath(), 'public');

    session.defaultSession.protocol.registerFileProtocol('app', (request, callback) => {
        let requestUrl = new URL(request.url).pathname;
        if (requestUrl.startsWith('//localhost/')) {
            requestUrl = requestUrl.slice('//localhost'.length);
        }
        const filePath = path.join(publicDir, requestUrl);
        callback({ path: filePath });
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // Store headers for the Security Auditor (flatten multi-value arrays to single string)
        if (details.url && details.responseHeaders) {
            const flat = {};
            for (const [k, v] of Object.entries(details.responseHeaders)) {
                flat[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
            }
            lastHeaders.set(details.url, flat);
            lastHeaders.set(details.url.split('?')[0], flat);
            if (lastHeaders.size > 500) {
                // Prevent unbounded growth
                const firstKey = lastHeaders.keys().next().value;
                lastHeaders.delete(firstKey);
            }
        }

        // Only override CSP with highly permissive rules for our own React UI / Dev Server.
        // Third-party webviews should enforce their own CSP for security auditing and accuracy.
        let cspHeaders = details.responseHeaders;
        if (details.url.startsWith('app://') || details.url.startsWith('http://localhost:5173')) {
            cspHeaders = {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"]
            };
        }
        callback({ responseHeaders: cspHeaders });
    });
}

// ── Go Proxy Sidecar ───────────────────────────────────────────────────────────────
const PROXY_PORT = 8877;
let goProxy = null;

function startGoProxy() {
    const binaryName = process.platform === 'win32' ? 'devproxy.exe' : 'devproxy';
    const binaryPath = app.isPackaged
        ? path.join(process.resourcesPath, 'sidecars', binaryName)
        : path.join(app.getAppPath(), 'sidecars', binaryName);

    if (!fs.existsSync(binaryPath)) {
        console.warn('[proxy] devproxy binary not found at:', binaryPath);
        return;
    }

    goProxy = spawn(binaryPath, ['--port', String(PROXY_PORT)], {
        stdio: 'pipe',
        windowsHide: true,  // Prevent a console window opening on Windows
    });
    goProxy.stdout?.on('data', d => console.log('[proxy]', d.toString().trim()));
    goProxy.stderr?.on('data', d => console.error('[proxy]', d.toString().trim()));
    goProxy.on('error', err => console.error('[proxy] spawn error:', err));
    goProxy.on('exit', code => console.log('[proxy] exited with code', code));
    console.log('[proxy] started devproxy on port', PROXY_PORT);
}

// Poll until the proxy is ready, then set the session proxy.
function waitForProxy(retries = 20) {
    return new Promise((resolve) => {
        const attempt = (n) => {
            http.get(`http://127.0.0.1:${PROXY_PORT}/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    retry(n);
                }
            }).on('error', () => retry(n));
        };
        const retry = (n) => {
            if (n <= 0) { resolve(); return; } // give up silently
            setTimeout(() => attempt(n - 1), 300);
        };
        attempt(retries);
    });
}

app.whenReady().then(async () => {
    startGoProxy();
    await waitForProxy();

    // Only proxy plain HTTP for now — HTTPS MITM would require CA cert injection in Electron.
    // HTTPS goes direct (no ERR_FAILED). Full TLS interception can be added in a future iteration.
    session.defaultSession.setProxy({
        proxyRules: `http=http://127.0.0.1:${PROXY_PORT};direct://`
    });

    createWindow();
    
    // Clean the User-Agent: removes "Electron/X.Y.Z" and "dev-browser/X.Y.Z" to bypass Google's block
    const originalUA = session.defaultSession.getUserAgent();
    const cleanUA = originalUA
        .replace(/Electron\/\d+(\.\d+)+ /g, '')
        .replace(/dev-browser\/\d+(\.\d+)+ /g, '');
    session.defaultSession.setUserAgent(cleanUA);
    console.log('[Security] User-Agent cleaned:', cleanUA);

    // Security: Automatically deny all unexpected permissions like camera/mic in background webviews
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        console.warn(`[Security] Denied ${permission} permission request from ${webContents.getURL()}`);
        callback(false);
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // ── Global Ad Blocker (Network Level) ─────────────────────────────────────
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
        if (!adBlockEnabled) {
            callback({});
            return;
        }

        try {
            const url = new URL(details.url);
            const hostname = url.hostname.toLowerCase();
            const isAd = AD_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));

            if (isAd) {
                console.log(`[adblock] Blocked: ${details.url}`);
                callback({ cancel: true });
            } else {
                callback({});
            }
        } catch (e) {
            callback({});
        }
    });
});

app.on('web-contents-created', (event, contents) => {
    // Prevent generic popups and new windows opening arbitrarily 
    contents.setWindowOpenHandler(({ url }) => {
        console.warn(`[Security] Blocked window open for: ${url}`);
        return { action: 'deny' };
    });

    // Prevent top-level navigations from traversing into local files
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol === 'file:') {
            console.warn(`[Security] Blocked file:// navigation: ${navigationUrl}`);
            event.preventDefault();
        }
    });

    // Ensure strict webview sandboxing
    contents.on('will-attach-webview', (event, webPreferences) => {
        webPreferences.nodeIntegration = false;
        webPreferences.nodeIntegrationInWorker = false;
        webPreferences.nodeIntegrationInSubFrames = false;
        // Strip out preload scripts if any ever tried to leak in
        delete webPreferences.preload;
    });
});

app.on('window-all-closed', () => {
    if (goProxy) { goProxy.kill(); goProxy = null; }
    if (process.platform !== 'darwin') app.quit();
});

