import { app, BrowserWindow, session, ipcMain, protocol } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        // Use the webview's OWN session — this is what controls its network stack
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
            // "No Throttle" — remove all emulation
            ses.disableNetworkEmulation();
        }

        console.log(`[throttle] applied via session ${ses.storagePath ?? '(default)'}`);
        return { ok: true };
    } catch (err) {
        console.error('[throttle] error:', err);
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
            preload: path.join(__dirname, 'preload.js'),
            webviewTag: true,
            contextIsolation: true,
        }
    });

    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Register the app:// protocol handler (must happen after session is available)
    // Maps app://filename => <projectRoot>/public/filename
    const publicDir = app.isPackaged
        ? path.join(process.resourcesPath, 'public')
        : path.join(__dirname, '../public');

    session.defaultSession.protocol.registerFileProtocol('app', (request, callback) => {
        const filePath = path.join(publicDir, new URL(request.url).pathname);
        callback({ path: filePath });
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"]
            }
        });
    });
}

// ── Go Proxy Sidecar ───────────────────────────────────────────────────────────────
const PROXY_PORT = 8877;
let goProxy = null;

function startGoProxy() {
    const binaryName = process.platform === 'win32' ? 'devproxy.exe' : 'devproxy';
    const binaryPath = app.isPackaged
        ? path.join(process.resourcesPath, 'sidecars', binaryName)
        : path.join(__dirname, '../sidecars', binaryName);

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
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (goProxy) { goProxy.kill(); goProxy = null; }
    if (process.platform !== 'darwin') app.quit();
});

