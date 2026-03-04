import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── SQLite setup ─────────────────────────────────────────────────────────────
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'devbrowser.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    url        TEXT NOT NULL,
    title      TEXT,
    visited_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
`);

// ── IPC: History ──────────────────────────────────────────────────────────────
ipcMain.handle('history:add', (_e, { url, title }) => {
    db.prepare('INSERT INTO history (url, title) VALUES (?, ?)').run(url, title ?? url);
    return { ok: true };
});

ipcMain.handle('history:get', (_e, { search = '' } = {}) => {
    const like = `%${search}%`;
    return db.prepare(
        `SELECT id, url, title, visited_at FROM history
     WHERE url LIKE ? OR title LIKE ?
     ORDER BY visited_at DESC LIMIT 500`
    ).all(like, like);
});

ipcMain.handle('history:clear', () => {
    db.prepare('DELETE FROM history').run();
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

// ── IPC: Network Throttle (via Chrome DevTools Protocol) ─────────────────
// Electron's session.enableNetworkEmulation is notoriously unreliable for webviews.
// We must attach the debugger to the webview's specific webContents to throttle it.
ipcMain.handle('network:throttle', async (_e, { webContentsId, ...profile }) => {
    try {
        console.log(`[throttle] Received request for wcId=${webContentsId}`, profile);
        if (!webContentsId) return { ok: false, error: 'No webContentsId provided' };

        const { webContents } = await import('electron');
        const wc = webContents.fromId(webContentsId);
        if (!wc) {
            console.log(`[throttle] Failed: WebContents ${webContentsId} not found`);
            return { ok: false, error: 'WebContents not found' };
        }

        console.log(`[throttle] Found webContents: ${wc.id}. Attaching debugger...`);
        try {
            if (!wc.debugger.isAttached()) {
                wc.debugger.attach('1.3');
            }
            // CRITICAL: The Network domain must be enabled before emulateNetworkConditions works
            await wc.debugger.sendCommand('Network.enable');
        } catch (err) {
            console.warn('[throttle] Debugger attached warning:', err);
        }

        if (profile.offline || profile.downloadThroughput >= 0) {
            console.log(`[throttle] Sending CDP Network.emulateNetworkConditions (throttled)`);
            await wc.debugger.sendCommand('Network.emulateNetworkConditions', {
                offline: profile.offline ?? false,
                latency: Math.max(0, profile.latency ?? 0),
                downloadThroughput: profile.downloadThroughput === -1 ? 0 : profile.downloadThroughput,
                uploadThroughput: profile.uploadThroughput === -1 ? 0 : profile.uploadThroughput
            });
        } else {
            console.log(`[throttle] Sending CDP Network.emulateNetworkConditions (clear)`);
            await wc.debugger.sendCommand('Network.emulateNetworkConditions', {
                offline: false,
                latency: 0,
                downloadThroughput: 0,
                uploadThroughput: 0
            });
        }
        console.log(`[throttle] Success`);
        return { ok: true };
    } catch (err) {
        console.error('[throttle] CDP error:', err);
        return { ok: false, error: String(err) };
    }
});

// ── Window ────────────────────────────────────────────────────────────────────
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

    // Relax CSP so external sites load inside webviews
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"]
            }
        });
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    db.close();
    if (process.platform !== 'darwin') app.quit();
});
