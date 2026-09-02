const fs = require('fs');
const local = require('../../../src/services/storage/privateLocalStorageService');

describe('privateLocalStorageService', () => {
  test('stores, reads, and deletes a buffer', async () => {
    const stored = await local.storePrivateBuffer({
      buffer: Buffer.from('hello-private'),
      originalName: 'note.txt',
      category: 'doc',
      mimeType: 'text/plain',
    });

    expect(stored.storageKey).toMatch(/^private\/doc\/\d+-[a-f0-9]+\.txt$/);
    await expect(local.privateFileExists(stored.storageKey)).resolves.toBe(true);

    const opened = await local.openPrivateReadStream(stored.storageKey);
    expect(opened.path).toBe(stored.path);
    const chunks = [];
    for await (const chunk of opened.stream) {
      chunks.push(chunk);
    }
    expect(Buffer.concat(chunks).toString()).toBe('hello-private');

    await expect(local.deletePrivateFile(stored.storageKey)).resolves.toBe(true);
    await expect(local.privateFileExists(stored.storageKey)).resolves.toBe(false);
    expect(fs.existsSync(stored.path)).toBe(false);
  });

  test('resolvePrivatePath rejects traversal keys', () => {
    expect(local.resolvePrivatePath('private/../secret.bin')).toBeNull();
    expect(local.resolvePrivatePath('uploads/private/doc.bin')).toBeNull();
  });
});
