// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/customerDocumentSqlService', () => ({
  // Provide the list by user id field value.
  listByUserId: jest.fn(),
  // Provide the upsert field value.
  upsert: jest.fn(),
  // Provide the remove field value.
  remove: jest.fn(),
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the find by id for user field value.
  findByIdForUser: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  // Provide the find by id for user field value.
  findByIdForUser: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/services/storage/privateStorageService', () => ({
  // Provide the store private file field value.
  storePrivateFile: jest.fn(),
  // Provide the delete private file field value.
  deletePrivateFile: jest.fn(),
  // Provide the open private read stream field value.
  openPrivateReadStream: jest.fn(),
}));

// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  // Provide the remove uploaded file field value.
  removeUploadedFile: jest.fn(),
}));

// Require the '../../../src/services/sql/customerDocumentSqlService' module as documentSql.
const documentSql = require('../../../src/services/sql/customerDocumentSqlService');
// Require the '../../../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../../src/services/sql/reservationSqlService');
// Require the '../../../src/services/storage/privateStorageService' module as privateStorage.
const privateStorage = require('../../../src/services/storage/privateStorageService');
// Destructure object properties into local variables.
const { removeUploadedFile } = require('../../../src/middleware/fileUpload/uploadUtils');
// Destructure object properties into local variables.
const { uploadDocument } = require('../../../src/services/account/accountDocumentService');

// Declare a test suite grouping related cases.
describe('accountDocumentService.uploadDocument ownership', () => {
  // Create the file constant.
  const file = {
    // Provide the path field value.
    path: '/tmp/upload.pdf',
    // Provide the originalname field value.
    originalname: 'license.pdf',
    // Provide the mimetype field value.
    mimetype: 'application/pdf',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call documentSql.listByUserId.mockResolvedValue to perform this step.
    documentSql.listByUserId.mockResolvedValue([]);
    // Call privateStorage.storePrivateFile.mockResolvedValue to perform this step.
    privateStorage.storePrivateFile.mockResolvedValue({
      // Provide the storage key field value.
      storageKey: 'customer/key',
      // Provide the mime type field value.
      mimeType: 'application/pdf',
      // Provide the size bytes field value.
      sizeBytes: 12,
    });
    // Call documentSql.upsert.mockResolvedValue to perform this step.
    documentSql.upsert.mockResolvedValue({
      // Provide the document field value.
      document: {
        // Provide the id field value.
        id: 1,
        // Provide the doc type field value.
        docType: 'driver_license',
        // Provide the original filename field value.
        originalFilename: 'license.pdf',
        // Provide the mime type field value.
        mimeType: 'application/pdf',
        // Provide the size bytes field value.
        sizeBytes: 12,
        // Provide the reservation id field value.
        reservationId: null,
        // Provide the created at field value.
        createdAt: new Date().toISOString(),
      },
      // Provide the replaced field value.
      replaced: false,
    });
  });

  // Define a single test case and its expectations.
  test('rejects linking a document to a reservation the user does not own', async () => {
    // Call reservationSql.findByIdForUser.mockResolvedValue to perform this step.
    reservationSql.findByIdForUser.mockResolvedValue(null);

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call uploadDocument to perform this step.
      uploadDocument('user-1', {
        // Contribute this line to the enclosing declaration or statement.
        file,
        // Provide the doc type field value.
        docType: 'driver_license',
        // Provide the reservation id field value.
        reservationId: '999',
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'VALIDATION_ERROR',
      // Provide the status field value.
      status: 422,
      // Provide the message field value.
      message: 'Reservation not found.',
    });

    // Assert that the value matches the intended expectation.
    expect(reservationSql.findByIdForUser).toHaveBeenCalledWith('999', 'user-1');
    // Assert that the value matches the intended expectation.
    expect(removeUploadedFile).toHaveBeenCalledWith(file);
    // Assert that the value matches the intended expectation.
    expect(privateStorage.storePrivateFile).not.toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(documentSql.upsert).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('links document when reservation belongs to the user', async () => {
    // Call reservationSql.findByIdForUser.mockResolvedValue to perform this step.
    reservationSql.findByIdForUser.mockResolvedValue({ id: 42 });
    // Call documentSql.upsert.mockResolvedValue to perform this step.
    documentSql.upsert.mockResolvedValue({
      // Provide the document field value.
      document: {
        // Provide the id field value.
        id: 1,
        // Provide the doc type field value.
        docType: 'driver_license',
        // Provide the original filename field value.
        originalFilename: 'license.pdf',
        // Provide the mime type field value.
        mimeType: 'application/pdf',
        // Provide the size bytes field value.
        sizeBytes: 12,
        // Provide the reservation id field value.
        reservationId: '42',
        // Provide the created at field value.
        createdAt: new Date().toISOString(),
      },
      // Provide the replaced field value.
      replaced: false,
    });

    // Create the result constant.
    const result = await uploadDocument('user-1', {
      // Contribute this line to the enclosing declaration or statement.
      file,
      // Provide the doc type field value.
      docType: 'driver_license',
      // Provide the reservation id field value.
      reservationId: '42',
    });

    // Assert that the value matches the intended expectation.
    expect(documentSql.upsert).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the user id field value.
        userId: 'user-1',
        // Provide the reservation id field value.
        reservationId: 42,
        // Provide the doc type field value.
        docType: 'driver_license',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result.reservationId).toBe('42');
  });
});
