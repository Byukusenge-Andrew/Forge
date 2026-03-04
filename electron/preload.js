import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe IPC bridge to the renderer
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, listener) => ipcRenderer.on(channel, listener),
        off: (channel, listener) => ipcRenderer.off(channel, listener),
    }
});
