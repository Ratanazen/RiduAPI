# Ridu API Studio — Task Map

## Status
Phase 2 core built and verified. App starts and bundles successfully; 20/20 automated tests passing with >94% test coverage.

## Tech Stack
- **Runtime:** Electron v44 (system binary) + Node 26
- **UI:** React + Vite
- **API engine:** Node built-in `http`/`https` (zero external HTTP dependencies)
- **Tests:** Node built-in `node:test` runner
- **Security:** TLS on by default, no hardcoded secrets, header & credential redaction

## Agent File Ownership (Phase 2 Status)
- [x] **Agent 1 (Lead/Integration):** `main.js`, `preload.js`, IPC contracts, shared architecture, build config (fixed syntax error & store paths)
- [x] **Agent 2 (API Engine):** `src/services/apiClient.js`, `src/services/auth.js`, `src/services/env.js`, `src/services/store.js`
- [x] **Agent 3 (Tests):** `__tests__/services/*.test.js` (20 tests passing)
- [x] **Agent 4 (UI/UX):** `src/App.jsx`, `src/styles.css`, `index.html`, `vite.config.mjs`
- [x] **Agent 5 (Review):** verified all changes; tests and build succeed cleanly

## Data Contracts (Phase 2)
- `Request`: id, collectionId, name, method, url, query[], headers[], body, auth, timeout, environmentId, timestamps
- `Environment`: id, name, variables[], isDefault, timestamps
- `Response`: id, requestId, statusCode, statusMessage, headers[], body, bodyType, elapsedMs, timestamp, error, ok
- `Auth`: none | bearer | basic | api-key

## Priority Backlog
- [x] **P0:** App starts & navigates; GET/POST/PUT/PATCH/DELETE; query params, headers, JSON body, timeout, cancellation; status/headers/body/elapsed/errors display; TLS on by default
- [ ] **P1:** Collections & saved requests; env vars & substitution; Bearer/Basic/API-key auth; JSON formatting/raw view; history; cURL/OpenAPI import
- [ ] **P2:** Automated assertions/test suites; exportable results; WebSocket/GraphQL/RiduDB where feasible

## Current Focus
P0 core completed and verified. Ready for P1 feature expansion.
