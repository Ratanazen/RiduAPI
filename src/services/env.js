/**
 * Ridu API Studio — Environment Variable Engine (Agent 2)
 *
 * Resolves active environment variable definitions and substitutes {{variable}} placeholders.
 */

/**
 * Converts an environment object with variable array to a key-value dictionary.
 *
 * @param {Object|null} env - Environment object { id, name, variables: [{ key, value, enabled }] }
 * @returns {Record<string, string>}
 */
function resolveEnvMap(env) {
  if (!env || !Array.isArray(env.variables)) return {};

  const map = {};
  for (const v of env.variables) {
    if (v && v.key && v.enabled !== false) {
      map[v.key] = v.value !== undefined ? String(v.value) : '';
    }
  }
  return map;
}

/**
 * Substitutes {{variable}} placeholders in a string using provided key-value dictionary.
 *
 * @param {string} text
 * @param {Record<string, string>} envMap
 * @param {boolean} [preserveMissing=true] - If true, keeps {{var}} intact when missing
 * @returns {string}
 */
function substituteString(text, envMap = {}, preserveMissing = true) {
  if (typeof text !== 'string') return text;

  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(envMap, key)) {
      return envMap[key];
    }
    return preserveMissing ? match : '';
  });
}

/**
 * Deeply substitutes {{variable}} placeholders across strings, arrays, and objects.
 *
 * @param {*} value
 * @param {Record<string, string>} envMap
 * @param {boolean} [preserveMissing=true]
 * @returns {*}
 */
function substituteVariables(value, envMap = {}, preserveMissing = true) {
  if (!value || !envMap || Object.keys(envMap).length === 0) return value;

  if (typeof value === 'string') {
    return substituteString(value, envMap, preserveMissing);
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteVariables(item, envMap, preserveMissing));
  }

  if (typeof value === 'object' && value !== null) {
    const copy = {};
    for (const [k, v] of Object.entries(value)) {
      copy[k] = substituteVariables(v, envMap, preserveMissing);
    }
    return copy;
  }

  return value;
}

module.exports = {
  resolveEnvMap,
  substituteString,
  substituteVariables,
};
