import React, { useState, useEffect } from 'react';
import { substituteVariables } from './services/env';
import { applyAuth } from './services/auth';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function App() {
  // Sidebar state
  const [sidebarTab, setSidebarTab] = useState('history'); // 'history' | 'collections' | 'environments'
  const [history, setHistory] = useState([]);
  const [collections, setCollections] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [selectedEnvId, setSelectedEnvId] = useState('');

  // Request state
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/todos/1');
  const [queryParams, setQueryParams] = useState([{ key: '', value: '', enabled: true }]);
  const [headers, setHeaders] = useState([
    { key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [auth, setAuth] = useState({
    type: 'none',
    token: '',
    username: '',
    password: '',
    key: 'X-API-Key',
    value: '',
    addTo: 'header',
  });
  const [bodyText, setBodyText] = useState('{\n  "title": "foo",\n  "completed": false\n}');
  const [requestTab, setRequestTab] = useState('params'); // 'params' | 'headers' | 'auth' | 'body'

  // Response state
  const [response, setResponse] = useState(null);
  const [responseTab, setResponseTab] = useState('body'); // 'body' | 'headers'
  const [loading, setLoading] = useState(false);

  // Modal / save state
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveRequestName, setSaveRequestName] = useState('My Request');
  const [saveCollectionName, setSaveCollectionName] = useState('Default Collection');

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  // Initial load
  useEffect(() => {
    async function initData() {
      if (isElectron) {
        try {
          const [hList, cList, eList] = await Promise.all([
            window.electronAPI.history.list(),
            window.electronAPI.collection.list(),
            window.electronAPI.environment.list(),
          ]);
          setHistory(hList || []);
          setCollections(cList || []);
          setEnvironments(eList || []);
          if (eList && eList.length > 0) {
            setSelectedEnvId(eList[0].id);
          }
        } catch (err) {
          console.error('Failed to load initial data via IPC:', err);
        }
      }
    }
    initData();
  }, [isElectron]);

  // Build active environment variable dictionary
  const getActiveEnvMap = () => {
    if (!selectedEnvId) return {};
    const activeEnv = environments.find((e) => e.id === selectedEnvId);
    if (!activeEnv || !Array.isArray(activeEnv.variables)) return {};
    const map = {};
    for (const v of activeEnv.variables) {
      if (v.key && v.enabled !== false) {
        map[v.key] = v.value || '';
      }
    }
    return map;
  };

  // Send Request handler
  const handleSend = async () => {
    setLoading(true);
    setResponse(null);

    const envMap = getActiveEnvMap();

    // 1. Substitute environment variables in URL
    let resolvedUrl = substituteVariables(url.trim(), envMap);

    // 2. Assemble and append query parameters
    const activeParams = queryParams.filter((p) => p.enabled && p.key.trim() !== '');
    if (activeParams.length > 0) {
      try {
        const u = new URL(resolvedUrl);
        for (const p of activeParams) {
          const k = substituteVariables(p.key.trim(), envMap);
          const v = substituteVariables(p.value, envMap);
          u.searchParams.set(k, v);
        }
        resolvedUrl = u.toString();
      } catch {
        // Fallback for partial URLs
        const queryString = activeParams
          .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
          .join('&');
        resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    // 3. Assemble headers
    const activeHeaders = {};
    for (const h of headers) {
      if (h.enabled && h.key.trim() !== '') {
        const k = substituteVariables(h.key.trim(), envMap);
        const v = substituteVariables(h.value, envMap);
        activeHeaders[k] = v;
      }
    }

    // 4. Apply Auth
    const { headers: authedHeaders, url: finalUrl } = applyAuth(activeHeaders, resolvedUrl, auth);

    // 5. Build body
    const resolvedBody =
      method !== 'GET' && method !== 'HEAD' && bodyText.trim() !== ''
        ? substituteVariables(bodyText, envMap)
        : null;

    const requestPayload = {
      method,
      url: finalUrl,
      headers: Object.entries(authedHeaders).map(([key, value]) => ({ key, value, enabled: true })),
      body: resolvedBody ? { mode: 'raw', raw: resolvedBody } : null,
      timeout: 30000,
    };

    try {
      let result;
      if (isElectron) {
        result = await window.electronAPI.request.send(requestPayload);
        const updatedHistory = await window.electronAPI.history.list();
        setHistory(updatedHistory || []);
      } else {
        // Fallback for standalone browser testing
        const start = Date.now();
        const res = await fetch(finalUrl, {
          method,
          headers: authedHeaders,
          body: resolvedBody,
        });
        const text = await res.text();
        const resHeaders = {};
        res.headers.forEach((v, k) => {
          resHeaders[k] = v;
        });
        result = {
          id: String(Date.now()),
          statusCode: res.status,
          statusMessage: res.statusText,
          headers: resHeaders,
          body: text,
          bodyType: (res.headers.get('content-type') || '').includes('json') ? 'json' : 'text',
          elapsedMs: Date.now() - start,
          timestamp: Date.now(),
          ok: res.ok,
          error: null,
        };
      }
      setResponse(result);
    } catch (err) {
      setResponse({
        id: String(Date.now()),
        statusCode: 0,
        statusMessage: 'Error',
        headers: {},
        body: null,
        elapsedMs: 0,
        timestamp: Date.now(),
        ok: false,
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadFromHistory = (item) => {
    if (item.method) setMethod(item.method);
    if (item.url) setUrl(item.url);
  };

  const handleSaveRequest = async () => {
    const colName = saveCollectionName.trim() || 'General';
    let targetCol = collections.find((c) => c.name.toLowerCase() === colName.toLowerCase());

    if (!targetCol) {
      targetCol = {
        id: `col-${Date.now()}`,
        name: colName,
        createdAt: Date.now(),
      };
      if (isElectron) {
        await window.electronAPI.collection.save(targetCol);
      }
      setCollections((prev) => [...prev, targetCol]);
    }

    const reqItem = {
      id: `req-${Date.now()}`,
      collectionId: targetCol.id,
      name: saveRequestName.trim() || 'Untitled Request',
      method,
      url,
      queryParams,
      headers,
      auth,
      body: { mode: 'raw', raw: bodyText },
    };

    if (isElectron) {
      await window.electronAPI.request.save(reqItem);
    }

    setSaveModalOpen(false);
  };

  // Helper formatting for JSON body
  const renderResponseBody = () => {
    if (!response) return null;
    if (response.error) {
      return (
        <div style={{ color: 'var(--color-error)', padding: '12px' }}>
          <strong>Request Failed:</strong> {response.error}
        </div>
      );
    }
    if (!response.body) {
      return <div className="empty-state">No response body received</div>;
    }

    let formatted = response.body;
    try {
      const parsed = JSON.parse(response.body);
      formatted = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep as plain text
    }

    return <pre className="response-code-view">{formatted}</pre>;
  };

  const getStatusClass = (code) => {
    if (!code) return 'status-err';
    if (code >= 200 && code < 300) return 'status-2xx';
    if (code >= 300 && code < 400) return 'status-3xx';
    if (code >= 400 && code < 500) return 'status-4xx';
    return 'status-5xx';
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-badge">RIDU</span>
          <span>API Studio</span>
        </div>
        <div className="header-env">
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>ENV:</span>
          <select
            value={selectedEnvId}
            onChange={(e) => setSelectedEnvId(e.target.value)}
          >
            <option value="">No Environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main App Layout */}
      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarTab === 'history' ? 'active' : ''}`}
              onClick={() => setSidebarTab('history')}
            >
              History ({history.length})
            </button>
            <button
              className={`sidebar-tab ${sidebarTab === 'collections' ? 'active' : ''}`}
              onClick={() => setSidebarTab('collections')}
            >
              Collections
            </button>
          </div>

          <div className="sidebar-content">
            {sidebarTab === 'history' && (
              <div>
                {history.length === 0 ? (
                  <div className="empty-state">No request history yet</div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="sidebar-item"
                      onClick={() => loadFromHistory(item)}
                    >
                      <span className={`method-tag method-${item.method}`}>{item.method}</span>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          margin: '0 8px',
                        }}
                      >
                        {item.url}
                      </span>
                      {item.statusCode ? (
                        <span style={{ fontSize: '11px', color: item.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
                          {item.statusCode}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            )}

            {sidebarTab === 'collections' && (
              <div>
                {collections.length === 0 ? (
                  <div className="empty-state">No collections saved</div>
                ) : (
                  collections.map((col) => (
                    <div key={col.id} className="sidebar-item">
                      📁 {col.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Workspace */}
        <main className="main-workspace">
          {/* URL & Action Bar */}
          <div className="url-bar-container">
            <select
              className="method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {HTTP_METHODS.map((m) => (
                <option key={m} value={m} className={`method-${m}`}>
                  {m}
                </option>
              ))}
            </select>

            <input
              type="text"
              className="url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://api.example.com/v1/resource"
            />

            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || !url.trim()}
            >
              {loading ? 'Sending...' : 'Send'}
            </button>

            <button
              className="save-btn"
              onClick={() => setSaveModalOpen(true)}
            >
              Save
            </button>
          </div>

          {/* Split Pane: Request Details (Left) / Response (Right) */}
          <div className="split-pane">
            {/* Request Pane */}
            <section className="pane">
              <div className="tabs-bar">
                <button
                  className={`tab-btn ${requestTab === 'params' ? 'active' : ''}`}
                  onClick={() => setRequestTab('params')}
                >
                  Params {queryParams.filter((p) => p.key).length > 0 && `(${queryParams.filter((p) => p.key).length})`}
                </button>
                <button
                  className={`tab-btn ${requestTab === 'headers' ? 'active' : ''}`}
                  onClick={() => setRequestTab('headers')}
                >
                  Headers {headers.filter((h) => h.key).length > 0 && `(${headers.filter((h) => h.key).length})`}
                </button>
                <button
                  className={`tab-btn ${requestTab === 'auth' ? 'active' : ''}`}
                  onClick={() => setRequestTab('auth')}
                >
                  Auth {auth.type !== 'none' && `(${auth.type})`}
                </button>
                <button
                  className={`tab-btn ${requestTab === 'body' ? 'active' : ''}`}
                  onClick={() => setRequestTab('body')}
                >
                  Body
                </button>
              </div>

              <div className="pane-content">
                {/* Query Params Tab */}
                {requestTab === 'params' && (
                  <div>
                    <table className="key-value-table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}></th>
                          <th>Key</th>
                          <th>Value</th>
                          <th style={{ width: 30 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {queryParams.map((param, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="checkbox"
                                checked={param.enabled}
                                onChange={(e) => {
                                  const next = [...queryParams];
                                  next[idx].enabled = e.target.checked;
                                  setQueryParams(next);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="table-input"
                                value={param.key}
                                placeholder="Parameter"
                                onChange={(e) => {
                                  const next = [...queryParams];
                                  next[idx].key = e.target.value;
                                  setQueryParams(next);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="table-input"
                                value={param.value}
                                placeholder="Value"
                                onChange={(e) => {
                                  const next = [...queryParams];
                                  next[idx].value = e.target.value;
                                  setQueryParams(next);
                                }}
                              />
                            </td>
                            <td>
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setQueryParams(queryParams.filter((_, i) => i !== idx));
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      className="btn-add-row"
                      onClick={() => setQueryParams([...queryParams, { key: '', value: '', enabled: true }])}
                    >
                      + Add Parameter
                    </button>
                  </div>
                )}

                {/* Headers Tab */}
                {requestTab === 'headers' && (
                  <div>
                    <table className="key-value-table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}></th>
                          <th>Header</th>
                          <th>Value</th>
                          <th style={{ width: 30 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {headers.map((h, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="checkbox"
                                checked={h.enabled}
                                onChange={(e) => {
                                  const next = [...headers];
                                  next[idx].enabled = e.target.checked;
                                  setHeaders(next);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="table-input"
                                value={h.key}
                                placeholder="Header"
                                onChange={(e) => {
                                  const next = [...headers];
                                  next[idx].key = e.target.value;
                                  setHeaders(next);
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="table-input"
                                value={h.value}
                                placeholder="Value"
                                onChange={(e) => {
                                  const next = [...headers];
                                  next[idx].value = e.target.value;
                                  setHeaders(next);
                                }}
                              />
                            </td>
                            <td>
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setHeaders(headers.filter((_, i) => i !== idx));
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      className="btn-add-row"
                      onClick={() => setHeaders([...headers, { key: '', value: '', enabled: true }])}
                    >
                      + Add Header
                    </button>
                  </div>
                )}

                {/* Auth Tab */}
                {requestTab === 'auth' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Authentication Type
                      </label>
                      <select
                        className="table-input"
                        value={auth.type}
                        onChange={(e) => setAuth({ ...auth, type: e.target.value })}
                      >
                        <option value="none">No Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="api-key">API Key</option>
                      </select>
                    </div>

                    {auth.type === 'bearer' && (
                      <div>
                        <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          Token
                        </label>
                        <input
                          type="password"
                          className="table-input"
                          placeholder="Bearer eyJhbGciOi..."
                          value={auth.token}
                          onChange={(e) => setAuth({ ...auth, token: e.target.value })}
                        />
                      </div>
                    )}

                    {auth.type === 'basic' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                            Username
                          </label>
                          <input
                            type="text"
                            className="table-input"
                            value={auth.username}
                            onChange={(e) => setAuth({ ...auth, username: e.target.value })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                            Password
                          </label>
                          <input
                            type="password"
                            className="table-input"
                            value={auth.password}
                            onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {auth.type === 'api-key' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                              Key
                            </label>
                            <input
                              type="text"
                              className="table-input"
                              value={auth.key}
                              onChange={(e) => setAuth({ ...auth, key: e.target.value })}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                              Value
                            </label>
                            <input
                              type="text"
                              className="table-input"
                              value={auth.value}
                              onChange={(e) => setAuth({ ...auth, value: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                            Add To
                          </label>
                          <select
                            className="table-input"
                            value={auth.addTo}
                            onChange={(e) => setAuth({ ...auth, addTo: e.target.value })}
                          >
                            <option value="header">Header</option>
                            <option value="query">Query Params</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Body Tab */}
                {requestTab === 'body' && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <textarea
                      className="body-textarea"
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      placeholder='{ "key": "value" }'
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Response Pane */}
            <section className="pane">
              {response ? (
                <>
                  <div className="response-status-bar">
                    <span className={`status-pill ${getStatusClass(response.statusCode)}`}>
                      {response.statusCode ? `${response.statusCode} ${response.statusMessage || ''}` : 'Error'}
                    </span>
                    <span className="response-meta">⏱ {response.elapsedMs} ms</span>
                    {response.body && (
                      <span className="response-meta">
                        📦 {(new Blob([response.body]).size / 1024).toFixed(2)} KB
                      </span>
                    )}
                  </div>

                  <div className="tabs-bar">
                    <button
                      className={`tab-btn ${responseTab === 'body' ? 'active' : ''}`}
                      onClick={() => setResponseTab('body')}
                    >
                      Response Body
                    </button>
                    <button
                      className={`tab-btn ${responseTab === 'headers' ? 'active' : ''}`}
                      onClick={() => setResponseTab('headers')}
                    >
                      Headers ({Object.keys(response.headers || {}).length})
                    </button>
                  </div>

                  <div className="pane-content">
                    {responseTab === 'body' && renderResponseBody()}
                    {responseTab === 'headers' && (
                      <table className="key-value-table">
                        <thead>
                          <tr>
                            <th>Header</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(response.headers || {}).map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{k}</td>
                              <td style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <span>Enter a URL and click Send to inspect the response</span>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {/* Save Modal */}
      {saveModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 20,
              width: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ fontSize: 15 }}>Save Request</h3>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                Request Name
              </label>
              <input
                type="text"
                className="table-input"
                value={saveRequestName}
                onChange={(e) => setSaveRequestName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                Collection Name
              </label>
              <input
                type="text"
                className="table-input"
                value={saveCollectionName}
                onChange={(e) => setSaveCollectionName(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                className="save-btn"
                onClick={() => setSaveModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="send-btn"
                onClick={handleSaveRequest}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
