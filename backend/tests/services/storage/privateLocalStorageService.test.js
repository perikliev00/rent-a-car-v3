// Require the 'fs' module as fs.
const fs = require('fs');
// Require the '../../../src/services/storage/privateLocalStorageService' module as local.
const local = require('../../../src/services/storage/privateLocalStorageService');

// Declare a test suite grouping related cases.
describe('privateLocalStorageService', () => {
  // Define a single test case and its expectations.
  test('stores, reads, and deletes a buffer', async () => {
    // Create the stored constant.
    const stored = await local.storePrivateBuffer({
      // Provide the buffer field value.
      buffer: Buffer.from('hello-private'),
      // Provide the original name field value.
      originalName: 'note.txt',
      // Provide the category field value.
      category: 'doc',
      // Provide the mime type field value.
      mimeType: 'text/plain',
    });

    // Assert that the value matches the intended expectation.
    expect(stored.storageKey).toMatch(/^private\/doc\/\d+-[a-f0-9]+\.txt$/);
    // Wait until the asynchronous operation resolves.
    await expect(local.privateFileExists(stored.storageKey)).resolves.toBe(true);

    // Create the opened constant.
    const opened = await local.openPrivateReadStream(stored.storageKey);
    // Assert that the value matches the intended expectation.
    expect(opened.path).toBe(stored.path);
    // Create the chunks constant.
    const chunks = [];
    // Iterate asynchronously over the async iterable.
    for await (const chunk of opened.stream) {
      // Call chunks.push to perform this step.
      chunks.push(chunk);
    }
    // Assert that the value matches the intended expectation.
    expect(Buffer.concat(chunks).toString()).toBe('hello-private');

    // Wait until the asynchronous operation resolves.
    await expect(local.deletePrivateFile(stored.storageKey)).resolves.toBe(true);
    // Wait until the asynchronous operation resolves.
    await expect(local.privateFileExists(stored.storageKey)).resolves.toBe(false);
    // Assert that the value matches the intended expectation.
    expect(fs.existsSync(stored.path)).toBe(false);
  });

  // Define a single test case and its expectations.
  test('resolvePrivatePath rejects traversal keys', () => {
    // Assert that the value matches the intended expectation.
    expect(local.resolvePrivatePath('private/../secret.bin')).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(local.resolvePrivatePath('uploads/private/doc.bin')).toBeNull();
  });
});
