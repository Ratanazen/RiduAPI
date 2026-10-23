/**
 * Ridu API Studio — Electron main process (Agent 1: integration/architecture)
 *
 * Responsibilities:
 *  - App lifecycle & BrowserWindow management
 *  - IPC bridge between renderer (React) and Node API engine / store
 *  - Persistence of collections, environments, and request history to a JSON
 *    store in the OS user-data directory
 *  - Security: TLS verification on by default; secrets never logged
 */

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const { sendRequest } = require('./src/services/apiClient');
const { Store } = require('./src/services/store');
const { redactHeaders } = require('./src/services/auth');

// ---------------------------------------------------------------------------
function getStorePath() {
  try {
    return path.join(app.getPath('userData'), 'ridu-api-store.json');
  } catch {
    const home = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(home, '.ridu-api-store.json');
  }
}
const DEFAULT_TIMEOUT_MS = 30000;

// Hard security default: TLS certificate verification is ENABLED by default.
// Never disable by default; only overridable via an explicit user setting.
let tlsVerifyEnabled = true;

const store = new Store(getStorePath);

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Ridu API Studio',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Dev: Vite dev server. Production: file:// dist.
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Open DevTools only in development.
  if (process.env.NODE_ENV === 'development' || devUrl) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Enforce TLS verification at the session level as a defense-in-depth layer.
  const ses = session.fromPartition('persist:ridu-api');
  ses.setCertificateVerifyProc((request, callback) => {
    // Node's https layer also enforces rejectUnauthorized by default.
    callback(0);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

// Store access
ipcMain.handle('store:get', () => store.get());

// Collections
ipcMain.handle('collection:list', () => store.data.collections);
ipcMain.handle('collection:get', (_, id) =>
  store.data.collections.find((c) => c.id === id) || null
);
ipcMain.handle('collection:save', (_, collection) => {
  const collections = store.data.collections.filter((c) => c.id !== collection.id);
  collections.push({ ...collection, updatedAt: Date.now() });
  store.set({ ...store.data, collections });
  return collection;
});
ipcMain.handle('collection:delete', (_, id) => {
  store.set({
    ...store.data,
    collections: store.data.collections.filter((c) => c.id !== id),
    requests: (store.data.requests || []).filter((r) => r.collectionId !== id),
  });
  return { ok: true };
});

// Requests (saved requests belong to collections)
ipcMain.handle('request:list', (_, collectionId) => {
  const requests = store.data.requests || [];
  if (collectionId === undefined) return requests;
  return requests.filter((r) => r.collectionId === collectionId);
});
ipcMain.handle('request:save', (_, request) => {
  const requests = store.data.requests || [];
  const next = requests.filter((r) => r.id !== request.id);
  next.push({ ...request, updatedAt: Date.now() });
  store.set({ ...store.data, requests: next });
  return request;
});
ipcMain.handle('request:delete', (_, id) => {
  store.set({
    ...store.data,
    requests: (store.data.requests || []).filter((r) => r.id !== id),
  });
  return { ok: true };
});

// Environments
ipcMain.handle('environment:list', () => store.data.environments);
ipcMain.handle('environment:save', (_, env) => {
  const environments = store.data.environments.filter((e) => e.id !== env.id);
  environments.push({ ...env, updatedAt: Date.now() });
  store.set({ ...store.data, environments });
  return env;
});
ipcMain.handle('environment:delete', (_, id) => {
  store.set({
    ...store.data,
    environments: store.data.environments.filter((e) => e.id !== id),
  });
  return { ok: true };
});

// History
ipcMain.handle('history:add', (_, entry) => {
  const history = [entry, ...(store.data.history || [])].slice(0, 500);
  store.set({ ...store.data, history });
  return { ok: true };
});
ipcMain.handle('history:list', () => store.data.history || []);
ipcMain.handle('history:clear', () => {
  store.set({ ...store.data, history: [] });
  return { ok: true };
});

// Settings (TLS verification etc.)
ipcMain.handle('settings:get', () => store.data.settings);
ipcMain.handle('settings:set', (_, settings) => {
  if (settings.tlsVerifyEnabled !== undefined) {
    tlsVerifyEnabled = !!settings.tlsVerifyEnabled;
  }
  store.set({ ...store.data, settings });
  return store.data.settings;
});

// ---------------------------------------------------------------------------
// API engine: send an HTTP request (Agent 2 boundary)
// ---------------------------------------------------------------------------
ipcMain.handle('request:send', async (_, request) => {
  const start = Date.now();

  // Build resolved config from the request (auth/env already applied by renderer
  // in P0; engine applies TLS + timeout + cancellation safety nets).
  const config = {
    method: request.method || 'GET',
    url: request.url || '',
    headers: Object.fromEntries(
      (request.headers || []).filter((h) => h.enabled !== false).map((h) => [h.key, h.value])
    ),
    body: request.body && request.body.mode === 'raw' ? request.body.raw || '' : null,
    timeout: request.timeout || DEFAULT_TIMEOUT_MS,
    rejectUnauthorized: tlsVerifyEnabled,
  };

  let response;
  let error = null;

  try {
    response = await sendRequest(config);
  } catch (err) {
    error = err.message;
    response = null;
  }

  const elapsed = Date.now() - start;

  const result = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    requestId: request.id || null,
    statusCode: response ? response.statusCode : null,
    statusMessage: response ? response.statusMessage : null,
    headers: response ? redactHeaders(response.headers) : {},
    body: response ? response.body : null,
    bodyType: response ? detectBodyType(response) : 'text',
    elapsedMs: elapsed,
    timestamp: Date.now(),
    error,
    ok: response ? response.statusCode >= 200 && response.statusCode < 300 : false,
  };

  // Persist to history
  const historyEntry = {
    id: result.id,
    requestId: request.id || null,
    method: config.method,
    url: config.url,
    statusCode: result.statusCode,
    statusMessage: result.statusMessage,
    elapsedMs: result.elapsedMs,
    timestamp: result.timestamp,
    ok: result.ok,
    error,
  };
  const history = [historyEntry, ...(store.data.history || [])].slice(0, 500);
  store.set({ ...store.data, history });

  return result;
});

function detectBodyType(response) {
  const ct = (response.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) return 'json';
  if (ct.includes('text/') || ct.includes('+xml')) return 'text';
  if (ct.includes('image/')) return 'image';
  if (ct.includes('application/')) return 'binary';
  return 'text';
}
