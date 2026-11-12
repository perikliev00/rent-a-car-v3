const path = require('path');

jest.mock('../../../src/repositories/carRepository', () => ({
  findByIdForAdmin: jest.fn(),
}));
jest.mock('../../../src/services/sql/carDocumentSqlService', () => ({
  listByCarId: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
  toPublicDocument: jest.fn((doc) => ({
    id: doc.id,
    carId: doc.carId,
    name: doc.name,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    hasFile: doc.hasFile,
    uploadedByUserId: doc.uploadedByUserId,
    createdAt: doc.createdAt,
  })),
}));
jest.mock('../../../src/services/storage/privateStorageService', () => ({
  storePrivateFile: jest.fn(),
  deletePrivateFile: jest.fn(),
  openPrivateReadStream: jest.fn(),
}));
jest.mock('../../../src/services/storage', () => ({
  driver: 'local',
  isManagedPublicUrl: jest.fn(() => false),
  openManagedPublicReadStream: jest.fn(),
}));
jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  removeUploadedFile: jest.fn(),
}));
jest.mock('../../../src/services/admin/car/carAdminHelpers', () => ({
  deleteManagedImageIfUnused: jest.fn(),
}));

const carRepository = require('../../../src/repositories/carRepository');
const documentSql = require('../../../src/services/sql/carDocumentSqlService');
const privateStorage = require('../../../src/services/storage/privateStorageService');
const {
  uploadDocument,
  openDocumentDownload,
  listDocuments,
} = require('../../../src/services/admin/car/carAdminDocumentsService');

describe('carAdminDocumentsService private storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    carRepository.findByIdForAdmin.mockResolvedValue({ id: 1, isDeleted: false });
  });

  test('uploadDocument stores file privately and returns public shape without url', async () => {
    privateStorage.storePrivateFile.mockResolvedValue({
      storageKey: 'private/car-docs/abc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1200,
    });
    documentSql.create.mockResolvedValue({
      id: 9,
      carId: '1',
      name: 'Registration',
      storageKey: 'private/car-docs/abc.pdf',
      originalFilename: 'scan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1200,
      hasFile: true,
      uploadedByUserId: 3,
      createdAt: '2026-01-01',
    });

    const result = await uploadDocument(
      1,
      {
        path: path.join(__dirname, 'tmp.pdf'),
        originalname: 'scan.pdf',
        mimetype: 'application/pdf',
      },
      'Registration',
      3
    );

    expect(privateStorage.storePrivateFile).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'car-docs',
        mimeType: 'application/pdf',
      })
    );
    expect(documentSql.create).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        storageKey: 'private/car-docs/abc.pdf',
        originalFilename: 'scan.pdf',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 9,
        name: 'Registration',
        hasFile: true,
      })
    );
    expect(result.url).toBeUndefined();
  });

  test('listDocuments maps to public documents without storage keys', async () => {
    documentSql.listByCarId.mockResolvedValue([
      {
        id: 1,
        carId: '1',
        name: 'Doc',
        storageKey: 'private/car-docs/x.pdf',
        originalFilename: 'x.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        hasFile: true,
        uploadedByUserId: null,
        createdAt: '2026-01-01',
      },
    ]);

    const docs = await listDocuments(1);
    expect(docs[0].storageKey).toBeUndefined();
    expect(docs[0].hasFile).toBe(true);
  });

  test('openDocumentDownload streams from private storage after car lookup', async () => {
    documentSql.findById.mockResolvedValue({
      id: 5,
      carId: '1',
      name: 'Doc',
      storageKey: 'private/car-docs/x.pdf',
      originalFilename: 'x.pdf',
      mimeType: 'application/pdf',
      hasFile: true,
    });
    const stream = { pipe: jest.fn() };
    privateStorage.openPrivateReadStream.mockResolvedValue({ stream });

    const opened = await openDocumentDownload(1, 5);
    expect(opened.stream).toBe(stream);
    expect(opened.filename).toBe('x.pdf');
    expect(opened.mimeType).toBe('application/pdf');
  });
});
