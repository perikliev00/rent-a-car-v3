const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const OPENAPI_ROOT = path.join(__dirname, '../../openapi');

const PATH_FILES = [
  'auth.yaml',
  'account.yaml',
  'cars.yaml',
  'reservations.yaml',
  'orders.yaml',
  'payments.yaml',
  'admin.yaml',
  'calendar.yaml',
  'fleet.yaml',
  'analytics.yaml',
];

function loadYaml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.load(raw);
}

function buildOpenApiDocument() {
  const base = loadYaml(path.join(OPENAPI_ROOT, 'openapi.yaml'));
  const schemas = loadYaml(path.join(OPENAPI_ROOT, 'components', 'schemas.yaml'));
  const parameters = loadYaml(path.join(OPENAPI_ROOT, 'components', 'parameters.yaml'));

  base.components = base.components || {};
  base.components.schemas = schemas;
  base.components.parameters = parameters;

  const paths = {};
  for (const file of PATH_FILES) {
    const fragment = loadYaml(path.join(OPENAPI_ROOT, 'paths', file));
    if (fragment && typeof fragment === 'object') {
      Object.assign(paths, fragment);
    }
  }
  base.paths = paths;

  return base;
}

let cachedSpec = null;

function getOpenApiDocument() {
  if (!cachedSpec) {
    cachedSpec = buildOpenApiDocument();
  }
  return cachedSpec;
}

function resetOpenApiCache() {
  cachedSpec = null;
}

module.exports = {
  buildOpenApiDocument,
  getOpenApiDocument,
  resetOpenApiCache,
  OPENAPI_ROOT,
};
