// Preload scripts run in a sandboxed context and CANNOT use ES module `import`.
// They must use CommonJS `require` syntax.
const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe IPC bridge to the renderer process.
// This is the ONLY way renderer code can communicate with the Electron main process.
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, listener) => ipcRenderer.on(channel, (_event, ...args) => listener(...args)),
        off: (channel, listener) => ipcRenderer.off(channel, listener),
    }
});
