jest.mock('../../../src/services/sql/customerDocumentSqlService', () => ({
  listByUserId: jest.fn(),
  upsert: jest.fn(),
  remove: jest.fn(),
  findById: jest.fn(),
  findByIdForUser: jest.fn(),
}));

jest.mock('../../../src/services/sql/reservationSqlService', () => ({
  findByIdForUser: jest.fn(),
}));

jest.mock('../../../src/services/storage/privateStorageService', () => ({
  storePrivateFile: jest.fn(),
  deletePrivateFile: jest.fn(),
  openPrivateReadStream: jest.fn(),
}));

jest.mock('../../../src/middleware/fileUpload/uploadUtils', () => ({
  removeUploadedFile: jest.fn(),
}));

const documentSql = require('../../../src/services/sql/customerDocumentSqlService');
const reservationSql = require('../../../src/services/sql/reservationSqlService');
const privateStorage = require('../../../src/services/storage/privateStorageService');
const { removeUploadedFile } = require('../../../src/middleware/fileUpload/uploadUtils');
const { uploadDocument } = require('../../../src/services/account/accountDocumentService');

describe('accountDocumentService.uploadDocument ownership', () => {
  const file = {
    path: '/tmp/upload.pdf',
    originalname: 'license.pdf',
    mimetype: 'application/pdf',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    documentSql.listByUserId.mockResolvedValue([]);
    privateStorage.storePrivateFile.mockResolvedValue({
      storageKey: 'customer/key',
      mimeType: 'application/pdf',
      sizeBytes: 12,
    });
    documentSql.upsert.mockResolvedValue({
      document: {
        id: 1,
        docType: 'driver_license',
        originalFilename: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        reservationId: null,
        createdAt: new Date().toISOString(),
      },
      replaced: false,
    });
  });

  test('rejects linking a document to a reservation the user does not own', async () => {
    reservationSql.findByIdForUser.mockResolvedValue(null);

    await expect(
      uploadDocument('user-1', {
        file,
        docType: 'driver_license',
        reservationId: '999',
      })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      message: 'Reservation not found.',
    });

    expect(reservationSql.findByIdForUser).toHaveBeenCalledWith('999', 'user-1');
    expect(removeUploadedFile).toHaveBeenCalledWith(file);
    expect(privateStorage.storePrivateFile).not.toHaveBeenCalled();
    expect(documentSql.upsert).not.toHaveBeenCalled();
  });

  test('links document when reservation belongs to the user', async () => {
    reservationSql.findByIdForUser.mockResolvedValue({ id: 42 });
    documentSql.upsert.mockResolvedValue({
      document: {
        id: 1,
        docType: 'driver_license',
        originalFilename: 'license.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        reservationId: '42',
        createdAt: new Date().toISOString(),
      },
      replaced: false,
    });

    const result = await uploadDocument('user-1', {
      file,
      docType: 'driver_license',
      reservationId: '42',
    });

    expect(documentSql.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        reservationId: 42,
        docType: 'driver_license',
      })
    );
    expect(result.reservationId).toBe('42');
  });
});
