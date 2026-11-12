#!/usr/bin/env node
/**
 * Point this clone at `.githooks/` so the pre-push CI gate is active.
 * Safe to re-run; no-op outside a git working tree.
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const hooksPath = '.githooks';
const prePush = path.join(repoRoot, hooksPath, 'pre-push');

if (!fs.existsSync(path.join(repoRoot, '.git'))) {
  console.warn('install-git-hooks: not a git working tree; skipping');
  process.exit(0);
}

if (!fs.existsSync(prePush)) {
  console.error(`install-git-hooks: missing ${prePush}`);
  process.exit(1);
}

try {
  fs.chmodSync(prePush, 0o755);
} catch {
  // Windows may ignore mode bits; Git Bash still executes the hook.
}

const result = spawnSync('git', ['config', 'core.hooksPath', hooksPath], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: false,
});

if (result.status !== 0) {
  console.error('install-git-hooks: failed to set core.hooksPath');
  process.exit(result.status ?? 1);
}

console.log(`Git hooks installed (core.hooksPath=${hooksPath}).`);
console.log('pre-push runs `npm run ci:local` and blocks the push on failure.');
