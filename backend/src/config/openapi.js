/**
 * Assembles the OpenAPI document from YAML fragments under `backend/openapi`.
 * Used by docs routes and any tooling that needs the merged API contract.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OPENAPI_ROOT = path.join(__dirname, '../../openapi');

/** Path fragment YAML files merged into the root document's `paths`. */
const PATH_FILES = [
  'auth.yaml',
  'cars.yaml',
  'reservations.yaml',
  'orders.yaml',
  'payments.yaml',
  'admin.yaml',
  'calendar.yaml',
  'fleet.yaml',
  'analytics.yaml',
];

/**
 * Synchronously load and parse a YAML file from disk.
 * @param {string} filePath - Absolute path to a `.yaml` file
 * @returns {*} Parsed YAML value (object, array, etc.)
 */
function loadYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw);
}

/**
 * Load base OpenAPI YAML plus schemas, parameters, and path fragments.
 * Side effects: reads multiple files from `OPENAPI_ROOT`.
 * @returns {object} Complete OpenAPI document object
 */
function buildOpenApiDocument() {
  const base = loadYaml(path.join(OPENAPI_ROOT, 'openapi.yaml'));
  const schemas = loadYaml(path.join(OPENAPI_ROOT, 'components', 'schemas.yaml'));
  const parameters = loadYaml(path.join(OPENAPI_ROOT, 'components', 'parameters.yaml'));

  // Attach shared components the path fragments `$ref`.
  base.components = base.components || {};
  base.components.schemas = schemas;
  base.components.parameters = parameters;

  const paths = {};
  for (const file of PATH_FILES) {
    const fragment = loadYaml(path.join(OPENAPI_ROOT, 'paths', file));
    // Later files overwrite same path keys if duplicated (order matters).
    if (fragment && typeof fragment === 'object') {
      Object.assign(paths, fragment);
    }
  }
  base.paths = paths;

  return base;
}

/** Lazily built OpenAPI document; cleared via `resetOpenApiCache`. */
let cachedSpec = null;

/**
 * Return the cached OpenAPI document, building it on first access.
 * @returns {object} Merged OpenAPI document
 */
function getOpenApiDocument() {
  if (!cachedSpec) {
    cachedSpec = buildOpenApiDocument();
  }
  return cachedSpec;
}

/**
 * Drop the cached spec so the next get rebuilds from disk (useful in tests).
 * Side effects: clears module-level `cachedSpec`.
 * @returns {void}
 */
function resetOpenApiCache() {
  cachedSpec = null;
}

module.exports = {
  buildOpenApiDocument,
  getOpenApiDocument,
  resetOpenApiCache,
  OPENAPI_ROOT,
};
