/**
 * Ridu API Studio — Persistence Store (Agent 2)
 *
 * File-backed JSON store for collections, environments, saved requests, and request history.
 */

const fs = require('node:fs');
const path = require('node:path');

function createDefaultData() {
  return {
    version: 1,
    collections: [],
    requests: [],
    environments: [],
    history: [],
    settings: {
      tlsVerifyEnabled: true,
      defaultTimeoutMs: 30000,
    },
  };
}

class Store {
  /**
   * @param {string|Function} filePathOrGetter - Absolute path or getter returning absolute path
   */
  constructor(filePathOrGetter) {
    this.filePathOrGetter = filePathOrGetter;
    this.data = createDefaultData();
    this.load();
  }

  getFilePath() {
    if (typeof this.filePathOrGetter === 'function') {
      return this.filePathOrGetter();
    }
    return this.filePathOrGetter;
  }

  load() {
    try {
      const filePath = this.getFilePath();
      if (filePath && fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.data = { ...createDefaultData(), ...parsed };
      }
    } catch (err) {
      // Safe fallback on corrupted or unreadable store
      this.data = createDefaultData();
    }
    return this.data;
  }

  persist() {
    try {
      const filePath = this.getFilePath();
      if (!filePath) return;
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch {
      // Ignore write errors during shutdown or restricted environments
    }
  }

  get() {
    return this.data;
  }

  set(next) {
    this.data = { ...this.data, ...next };
    this.persist();
    return this.data;
  }
}

module.exports = {
  createDefaultData,
  Store,
};
