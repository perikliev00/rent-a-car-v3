#!/usr/bin/env node
/**
 * Validate a release image tag passed as data in INPUT_IMAGE_TAG.
 * Prints the tag only when it is a full 40-character git SHA.
 * The process never evaluates the value as shell.
 */
const tag = process.env.INPUT_IMAGE_TAG ?? '';

// Evaluate the condition and enter the branch when it is true.
if (!/^[0-9a-f]{40}$/.test(tag)) {
  // Emit a diagnostic log message.
  console.error('Image tag must be a full 40-character Git commit SHA');
  // Call process.exit to perform this step.
  process.exit(1);
}

// Call process.stdout.write to perform this step.
process.stdout.write(tag);
