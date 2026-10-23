# Ridu API Studio

> Fast, lightweight, and secure desktop API client built with Electron, React, and Node.js.

![Node.js](https://img.shields.io/badge/node->=20-brightgreen.svg)
![Electron](https://img.shields.io/badge/electron-v44-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

- **Built-in HTTP Engine**: Powered directly by Node.js `http` and `https` modules with **zero external HTTP library dependencies**.
- **Security-First Architecture**:
  - TLS certificate verification enforced by default.
  - Sensitive authorization headers, tokens, and credentials automatically masked in logs.
  - Context isolation and secure preload bridge between renderer and main process.
- **Full Method Support**: GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
- **Interactive Request Builder**:
  - Key/value editors for query parameters and headers with enable/disable toggles.
  - Authentication support for **Bearer Token**, **HTTP Basic Auth**, and **API Key** (in header or query).
  - Raw JSON and text body payloads.
- **Environment Variable Engine**: Dynamic `{{variable}}` templating across URLs, headers, and request bodies.
- **Response Inspector**: Real-time HTTP status codes, latency in milliseconds, payload size, pretty-printed JSON, and response headers table.
- **Persistence**: File-backed storage for request history, collections, and environments.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [npm](https://www.npmjs.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/Ratanazen/RiduAPI.git
cd RiduAPI

# Install dependencies
npm install
```

### Development & Build

```bash
# Build the React frontend
npm run build

# Start the Electron application
npm start

# Run frontend in Vite dev mode (optional)
npm run dev:renderer
```

### Running Tests

```bash
# Run unit & integration tests using Node's built-in test runner
npm test

# Run tests with code coverage report
npm run test:coverage
```

---

## 📁 Project Structure

```
RiduAPI/
├── src/
│   ├── main/            # Electron main process entry bridge
│   ├── services/        # Core API engine & business logic
│   │   ├── apiClient.js # Zero-dependency HTTP/HTTPS client
│   │   ├── auth.js      # Bearer, Basic, and API Key auth handling
│   │   ├── env.js       # Dynamic {{var}} substitution engine
│   │   └── store.js     # Persistence store for collections & history
│   ├── components/      # React UI components
│   ├── App.jsx          # Main application interface
│   ├── styles.css       # Dark studio theme stylesheet
│   └── index.jsx        # React root mounting script
├── __tests__/           # Comprehensive test suites (node:test)
├── main.js              # Electron main process
├── preload.js           # Safe IPC context bridge
├── vite.config.mjs      # Vite build configuration
└── package.json         # Scripts and dependencies
```

---

## 📄 License

MIT © RiduAPI Team
