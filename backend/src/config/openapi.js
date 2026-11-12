/**
 * Assembles the OpenAPI document from YAML fragments under `backend/openapi`.
 * Used by docs routes and any tooling that needs the merged API contract.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the 'js-yaml' module as yaml.
const yaml = require('js-yaml');

// Create the openapi root constant.
const OPENAPI_ROOT = path.join(__dirname, '../../openapi');

/** Path fragment YAML files merged into the root document's `paths`. */
const PATH_FILES = [
  // Supply the literal value used by the enclosing expression.
  'auth.yaml',
  // Supply the literal value used by the enclosing expression.
  'cars.yaml',
  // Supply the literal value used by the enclosing expression.
  'reservations.yaml',
  // Supply the literal value used by the enclosing expression.
  'orders.yaml',
  // Supply the literal value used by the enclosing expression.
  'payments.yaml',
  // Supply the literal value used by the enclosing expression.
  'admin.yaml',
  // Supply the literal value used by the enclosing expression.
  'calendar.yaml',
  // Supply the literal value used by the enclosing expression.
  'fleet.yaml',
  // Supply the literal value used by the enclosing expression.
  'analytics.yaml',
];

/**
 * Synchronously load and parse a YAML file from disk.
 * @param {string} filePath - Absolute path to a `.yaml` file
 * @returns {*} Parsed YAML value (object, array, etc.)
 */
function loadYaml(filePath) {
  // Create the raw constant.
  const raw = fs.readFileSync(filePath, 'utf8');
  // Return the resulting value to the caller.
  return yaml.load(raw);
}

/**
 * Load base OpenAPI YAML plus schemas, parameters, and path fragments.
 * Side effects: reads multiple files from `OPENAPI_ROOT`.
 * @returns {object} Complete OpenAPI document object
 */
function buildOpenApiDocument() {
  // Create the base constant.
  const base = loadYaml(path.join(OPENAPI_ROOT, 'openapi.yaml'));
  // Create the schemas constant.
  const schemas = loadYaml(path.join(OPENAPI_ROOT, 'components', 'schemas.yaml'));
  // Create the parameters constant.
  const parameters = loadYaml(path.join(OPENAPI_ROOT, 'components', 'parameters.yaml'));

  // Attach shared components the path fragments `$ref`.
  base.components = base.components || {};
  // Update base.components.schemas with the right-hand side value.
  base.components.schemas = schemas;
  // Update base.components.parameters with the right-hand side value.
  base.components.parameters = parameters;

  // Create the paths constant.
  const paths = {};
  // Iterate using the loop initializer, condition, and step.
  for (const file of PATH_FILES) {
    // Create the fragment constant.
    const fragment = loadYaml(path.join(OPENAPI_ROOT, 'paths', file));
    // Later files overwrite same path keys if duplicated (order matters).
    if (fragment && typeof fragment === 'object') {
      // Call Object.assign to perform this step.
      Object.assign(paths, fragment);
    }
  }
  // Update base.paths with the right-hand side value.
  base.paths = paths;

  // Return the resulting value to the caller.
  return base;
}

/** Lazily built OpenAPI document; cleared via `resetOpenApiCache`. */
let cachedSpec = null;

/**
 * Return the cached OpenAPI document, building it on first access.
 * @returns {object} Merged OpenAPI document
 */
function getOpenApiDocument() {
  // Evaluate the condition and enter the branch when it is true.
  if (!cachedSpec) {
    // Update cachedSpec with the right-hand side value.
    cachedSpec = buildOpenApiDocument();
  }
  // Return the resulting value to the caller.
  return cachedSpec;
}

/**
 * Drop the cached spec so the next get rebuilds from disk (useful in tests).
 * Side effects: clears module-level `cachedSpec`.
 * @returns {void}
 */
function resetOpenApiCache() {
  // Update cachedSpec with the right-hand side value.
  cachedSpec = null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildOpenApiDocument,
  // Contribute this line to the enclosing declaration or statement.
  getOpenApiDocument,
  // Contribute this line to the enclosing declaration or statement.
  resetOpenApiCache,
  // Contribute this line to the enclosing declaration or statement.
  OPENAPI_ROOT,
};
