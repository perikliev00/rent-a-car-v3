// Require the 'path' module as path.
const path = require('path');

// Call jest.mock to perform this step.
jest.mock('../../../src/repositories/carRepository', () => ({
  // Provide the find by id for admin field value.
  findByIdForAdmin: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/sql/carDocumentSqlService', () => ({
  // Provide the list by car id field value.
  listByCarId: jest.fn(),
  // Provide the find by id field value.
  findById: jest.fn(),
  // Provide the create field value.
  create: jest.fn(),
  // Provide the remove field value.
  remove: jest.fn(),
  // Provide the to public document field value.
  toPublicDocument: jest.fn((doc) => ({
    // Provide the id field value.
    id: doc.id,
    // Provide the car id field value.
    carId: doc.carId,
    // Provide the name field value.
    name: doc.name,
    // Provide the original filename field value.
    originalFilename: doc.originalFilename,
    // Provide the mime type field value.
    mimeType: doc.mimeType,
    // Provide the size bytes field value.
    sizeBytes: doc.sizeBytes,
    // Provide the has file field value.
    hasFile: doc.hasFile,
    // Provide the uploaded by user id field value.
    uploadedByUserId: doc.uploadedByUserId,
    // Provide the created at field value.
    createdAt: doc.createdAt,
  })),
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
jest.mock('../../../src/services/storage', () => ({
  // Provide the driver field value.
  driver: 'local',
  // Provide the is managed public url field value.
  isManagedPublicUrl: jest.fn(() => false),
  // Provide the open managed public read stream field value.
  openManagedPublicReadStream: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  // Provide the remove uploaded file field value.
  removeUploadedFile: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../../src/services/admin/car/carAdminHelpers', () => ({
  // Provide the delete managed image if unused field value.
  deleteManagedImageIfUnused: jest.fn(),
}));

// Require the '../../../src/repositories/carRepository' module as carRepository.
const carRepository = require('../../../src/repositories/carRepository');
// Require the '../../../src/services/sql/carDocumentSqlService' module as documentSql.
const documentSql = require('../../../src/services/sql/carDocumentSqlService');
// Require the '../../../src/services/storage/privateStorageService' module as privateStorage.
const privateStorage = require('../../../src/services/storage/privateStorageService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  uploadDocument,
  // Contribute this line to the enclosing declaration or statement.
  openDocumentDownload,
  // Contribute this line to the enclosing declaration or statement.
  listDocuments,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/admin/car/carAdminDocumentsService');

// Declare a test suite grouping related cases.
describe('carAdminDocumentsService private storage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
    // Call carRepository.findByIdForAdmin.mockResolvedValue to perform this step.
    carRepository.findByIdForAdmin.mockResolvedValue({ id: 1, isDeleted: false });
  });

  // Define a single test case and its expectations.
  test('uploadDocument stores file privately and returns public shape without url', async () => {
    // Call privateStorage.storePrivateFile.mockResolvedValue to perform this step.
    privateStorage.storePrivateFile.mockResolvedValue({
      // Provide the storage key field value.
      storageKey: 'private/car-docs/abc.pdf',
      // Provide the mime type field value.
      mimeType: 'application/pdf',
      // Provide the size bytes field value.
      sizeBytes: 1200,
    });
    // Call documentSql.create.mockResolvedValue to perform this step.
    documentSql.create.mockResolvedValue({
      // Provide the id field value.
      id: 9,
      // Provide the car id field value.
      carId: '1',
      // Provide the name field value.
      name: 'Registration',
      // Provide the storage key field value.
      storageKey: 'private/car-docs/abc.pdf',
      // Provide the original filename field value.
      originalFilename: 'scan.pdf',
      // Provide the mime type field value.
      mimeType: 'application/pdf',
      // Provide the size bytes field value.
      sizeBytes: 1200,
      // Provide the has file field value.
      hasFile: true,
      // Provide the uploaded by user id field value.
      uploadedByUserId: 3,
      // Provide the created at field value.
      createdAt: '2026-01-01',
    });

    // Create the result constant.
    const result = await uploadDocument(
      // Supply the literal value used by the enclosing expression.
      1,
      {
        // Provide the path field value.
        path: path.join(__dirname, 'tmp.pdf'),
        // Provide the originalname field value.
        originalname: 'scan.pdf',
        // Provide the mimetype field value.
        mimetype: 'application/pdf',
      },
      // Supply the literal value used by the enclosing expression.
      'Registration',
      // Supply the literal value used by the enclosing expression.
      3
    );

    // Assert that the value matches the intended expectation.
    expect(privateStorage.storePrivateFile).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the category field value.
        category: 'car-docs',
        // Provide the mime type field value.
        mimeType: 'application/pdf',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(documentSql.create).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      1,
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the storage key field value.
        storageKey: 'private/car-docs/abc.pdf',
        // Provide the original filename field value.
        originalFilename: 'scan.pdf',
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result).toEqual(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the id field value.
        id: 9,
        // Provide the name field value.
        name: 'Registration',
        // Provide the has file field value.
        hasFile: true,
      })
    );
    // Assert that the value matches the intended expectation.
    expect(result.url).toBeUndefined();
  });

  // Define a single test case and its expectations.
  test('listDocuments maps to public documents without storage keys', async () => {
    // Call documentSql.listByCarId.mockResolvedValue to perform this step.
    documentSql.listByCarId.mockResolvedValue([
      {
        // Provide the id field value.
        id: 1,
        // Provide the car id field value.
        carId: '1',
        // Provide the name field value.
        name: 'Doc',
        // Provide the storage key field value.
        storageKey: 'private/car-docs/x.pdf',
        // Provide the original filename field value.
        originalFilename: 'x.pdf',
        // Provide the mime type field value.
        mimeType: 'application/pdf',
        // Provide the size bytes field value.
        sizeBytes: 10,
        // Provide the has file field value.
        hasFile: true,
        // Provide the uploaded by user id field value.
        uploadedByUserId: null,
        // Provide the created at field value.
        createdAt: '2026-01-01',
      },
    ]);

    // Create the docs constant.
    const docs = await listDocuments(1);
    // Assert that the value matches the intended expectation.
    expect(docs[0].storageKey).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(docs[0].hasFile).toBe(true);
  });

  // Define a single test case and its expectations.
  test('openDocumentDownload streams from private storage after car lookup', async () => {
    // Call documentSql.findById.mockResolvedValue to perform this step.
    documentSql.findById.mockResolvedValue({
      // Provide the id field value.
      id: 5,
      // Provide the car id field value.
      carId: '1',
      // Provide the name field value.
      name: 'Doc',
      // Provide the storage key field value.
      storageKey: 'private/car-docs/x.pdf',
      // Provide the original filename field value.
      originalFilename: 'x.pdf',
      // Provide the mime type field value.
      mimeType: 'application/pdf',
      // Provide the has file field value.
      hasFile: true,
    });
    // Create the stream constant.
    const stream = { pipe: jest.fn() };
    // Call privateStorage.openPrivateReadStream.mockResolvedValue to perform this step.
    privateStorage.openPrivateReadStream.mockResolvedValue({ stream });

    // Create the opened constant.
    const opened = await openDocumentDownload(1, 5);
    // Assert that the value matches the intended expectation.
    expect(opened.stream).toBe(stream);
    // Assert that the value matches the intended expectation.
    expect(opened.filename).toBe('x.pdf');
    // Assert that the value matches the intended expectation.
    expect(opened.mimeType).toBe('application/pdf');
  });
});
