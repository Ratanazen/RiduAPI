/**
 * Ridu API Studio — Preload script (Agent 1: integration/architecture)
 *
 * ContextBridge: exposes a narrow, safe IPC API to the renderer. The renderer
 * never has direct access to Node or Electron internals. Secrets (auth tokens,
 * API keys) travel over IPC but are never written to logs by the main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Validate that a channel is one of the allowed, whitelisted channels.
const ALLOWED = new Set([
  'store:get',
  'collection:list',
  'collection:get',
  'collection:save',
  'collection:delete',
  'request:list',
  'request:save',
  'request:delete',
  'request:send',
  'environment:list',
  'environment:save',
  'environment:delete',
  'history:add',
  'history:list',
  'history:clear',
  'settings:get',
  'settings:set',
]);

contextBridge.exposeInMainWorld('electronAPI', {
  invoke(channel, ...args) {
    if (!ALLOWED.has(channel)) {
      throw new Error(`[ridu] IPC channel not allowed: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // Convenience typed wrappers.
  store: {
    get: () => ipcRenderer.invoke('store:get'),
  },
  collection: {
    list: () => ipcRenderer.invoke('collection:list'),
    get: (id) => ipcRenderer.invoke('collection:get', id),
    save: (c) => ipcRenderer.invoke('collection:save', c),
    delete: (id) => ipcRenderer.invoke('collection:delete', id),
  },
  request: {
    list: (collectionId) => ipcRenderer.invoke('request:list', collectionId),
    save: (r) => ipcRenderer.invoke('request:save', r),
    delete: (id) => ipcRenderer.invoke('request:delete', id),
    send: (r) => ipcRenderer.invoke('request:send', r),
  },
  environment: {
    list: () => ipcRenderer.invoke('environment:list'),
    save: (e) => ipcRenderer.invoke('environment:save', e),
    delete: (id) => ipcRenderer.invoke('environment:delete', id),
  },
  history: {
    add: (e) => ipcRenderer.invoke('history:add', e),
    list: () => ipcRenderer.invoke('history:list'),
    clear: () => ipcRenderer.invoke('history:clear'),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (s) => ipcRenderer.invoke('settings:set', s),
  },
});
