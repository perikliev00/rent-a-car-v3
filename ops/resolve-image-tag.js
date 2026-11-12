#!/usr/bin/env node
/**
 * Validate a release image tag passed as data in INPUT_IMAGE_TAG.
 * Prints the tag only when it is a full 40-character git SHA.
 * The process never evaluates the value as shell.
 */
const tag = process.env.INPUT_IMAGE_TAG ?? '';

if (!/^[0-9a-f]{40}$/.test(tag)) {
  console.error('Image tag must be a full 40-character Git commit SHA');
  process.exit(1);
}

process.stdout.write(tag);
