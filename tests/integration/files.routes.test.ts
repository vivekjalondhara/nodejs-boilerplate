import request from 'supertest';
import { PutObjectCommand, DeleteObjectsCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { fileUploadStreamData, getFileFromWasabi, generatePublicURL, deleteFileFromWasabi, deletePublicFileFromWasabi, generateUploadPresignedURL } from '../../src/common/file-storage';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';

const mockSend = jest.fn();
const mockS3Client = S3Client as jest.MockedClass<typeof S3Client>;
jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual('@aws-sdk/client-s3'),
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend, destroy: jest.fn() })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
jest.mock('@aws-sdk/lib-storage', () => ({ Upload: jest.fn() }));

const key = 'standalone/files/report.pdf';
const apiKey = 'test-files-api-key-with-at-least-32-characters';
const pdf = Buffer.from('%PDF-1.4\nfixture');
const app = createApp();

beforeEach(() => {
  Object.assign(env, {
    filesApiKey: apiKey,
    filesKeyPrefix: 'standalone/',
    wasabiBucket: 'test-private',
    wasabiRegion: 'us-east-1',
    wasabiUrl: 'wasabisys.com',
    wasabiAccessKeyId: 'test-access',
    wasabiSecretAccessKey: 'test-secret',
    wasabiPublicBucket: 'test-public',
    wasabiPublicRegion: 'us-east-1',
  });
  mockSend.mockReset().mockResolvedValue({});
  jest.mocked(getSignedUrl).mockResolvedValue('https://storage.example/signed');
});

describe('standalone file HTTP flow', () => {
  it('rejects missing and incorrect credentials before touching storage', async () => {
    for (const supplied of ['', 'wrong', apiKey.toUpperCase()]) {
      const response = await request(app).get('/api/files').set('X-Files-API-Key', supplied).query({ keyPath: key });
      expect(response.status).toBe(401);
      expect(response.body.responseType).toBe('error');
    }
    expect(getSignedUrl).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('fails closed when the file API key or storage configuration is absent', async () => {
    env.filesApiKey = '';
    const disabled = await request(app).get('/api/files').query({ keyPath: key });
    expect(disabled.status).toBe(503);
    env.filesApiKey = apiKey;
    env.wasabiBucket = '';
    const unconfigured = await request(app).get('/api/files').set('X-Files-API-Key', apiKey).query({ keyPath: key });
    expect(unconfigured.status).toBe(503);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('uploads multipart bytes and uses the returned key to read and delete', async () => {
    const uploaded = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .query({ folder_name: 'documents' }).attach('files', pdf, { filename: 'report.pdf', contentType: 'application/pdf' });
    expect(uploaded.status).toBe(200);
    const file = uploaded.body.data[0];
    expect(file).toMatchObject({ path: file.key, bucket: 'test-private', mimetype: 'application/pdf', size: pdf.length });
    expect(file.key).toMatch(/^standalone\/documents\/[0-9a-f-]+_report\.pdf$/);
    expect(mockSend.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(mockSend.mock.calls[0][0].input).toMatchObject({ Bucket: 'test-private', Key: file.key, Body: pdf });

    const read = await request(app).get('/api/files').set('X-Files-API-Key', apiKey).query({ keyPath: file.key });
    expect(read.status).toBe(200);
    expect(read.body.data).toEqual({ url: 'https://storage.example/signed', expiresIn: 86400 });
    const command = jest.mocked(getSignedUrl).mock.calls[0][1];
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toMatchObject({ Bucket: 'test-private', Key: file.key, ResponseContentDisposition: 'attachment' });

    const deleted = await request(app).delete('/api/files').set('X-Files-API-Key', apiKey).send({ keyPaths: [file.key] });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deleted).toEqual([file.key]);
    expect(mockSend.mock.calls[1][0]).toBeInstanceOf(DeleteObjectsCommand);
    expect(mockSend.mock.calls[1][0].input).toMatchObject({ Bucket: 'test-private', Delete: { Objects: [{ Key: file.key }] } });
  });

  it('rejects traversal, keys outside the application prefix, and unsafe folder names', async () => {
    for (const badKey of ['another-app/files/report.pdf', 'standalone/../secret', 'standalone//report', 'standalone/%2e%2e/secret']) {
      const response = await request(app).get('/api/files').set('X-Files-API-Key', apiKey).query({ keyPath: badKey });
      expect(response.status).toBe(422);
      expect(response.body.responseType).toBe('error');
    }
    const badFolder = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .query({ folder_name: '../other' }).attach('files', pdf, 'report.pdf');
    expect(badFolder.status).toBe(422);
    expect(mockSend).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('generates unique upload keys and returns the required PUT header and expiry', async () => {
    const payload = { keyPath: { name: 'report.pdf', type: 'application/pdf' } };
    const first = await request(app).post('/api/files/presigned-url').set('X-Files-API-Key', apiKey).send(payload);
    const second = await request(app).post('/api/files/presigned-url').set('X-Files-API-Key', apiKey).send(payload);
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ url: 'https://storage.example/signed', expiresIn: 10800, headers: { 'Content-Type': 'application/pdf' } });
    expect(first.body.data.keyPath).toMatch(/^standalone\/temp\/uploads\/.*_report\.pdf$/);
    expect(first.body.data.keyPath).not.toBe(second.body.data.keyPath);
    expect(jest.mocked(getSignedUrl).mock.calls[0][1].input).toMatchObject({ Bucket: 'test-private', Key: first.body.data.keyPath, ContentType: 'application/pdf' });
  });

  it('rejects invalid expiry, empty deletion, and unsupported uploads', async () => {
    const expiry = await request(app).get('/api/files').set('X-Files-API-Key', apiKey).query({ keyPath: key, expiresIn: 604801 });
    expect(expiry.status).toBe(422);
    const empty = await request(app).delete('/api/files').set('X-Files-API-Key', apiKey).send({ keyPaths: [] });
    expect(empty.status).toBe(422);
    const html = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .attach('files', Buffer.from('<script/>'), { filename: 'x.html', contentType: 'text/html' });
    expect(html.status).toBe(422);
    const spoofed = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .attach('files', Buffer.from('<script/>'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(spoofed.status).toBe(422);
    const none = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey);
    expect(none.status).toBe(422);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('rejects oversized multipart files without uploading any bytes', async () => {
    const directoriesBefore = (await readdir(tmpdir())).filter(name => name.startsWith('standalone-upload-')).sort();
    const response = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .attach('files', Buffer.alloc(25 * 1024 * 1024 + 1), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(response.status).toBe(413);
    expect(mockSend).not.toHaveBeenCalled();
    expect((await readdir(tmpdir())).filter(name => name.startsWith('standalone-upload-')).sort()).toEqual(directoriesBefore);
  });

  it('rolls back an earlier object when the second upload fails', async () => {
    const directoriesBefore = (await readdir(tmpdir())).filter(name => name.startsWith('standalone-upload-')).sort();
    mockSend.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('storage down')).mockResolvedValueOnce({});
    const response = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .attach('files', pdf, 'first.pdf').attach('files', pdf, 'second.pdf');
    expect(response.status).toBe(500);
    expect(mockSend).toHaveBeenCalledTimes(3);
    const uploadedKey = mockSend.mock.calls[0][0].input.Key;
    expect(mockSend.mock.calls[2][0].input.Delete.Objects).toEqual([{ Key: uploadedKey }]);
    expect((await readdir(tmpdir())).filter(name => name.startsWith('standalone-upload-')).sort()).toEqual(directoriesBefore);
  });

  it('does not report partial storage deletion as success', async () => {
    mockSend.mockResolvedValue({ Errors: [{ Key: key, Code: 'AccessDenied' }] });
    const response = await request(app).delete('/api/files').set('X-Files-API-Key', apiKey).send({ keyPaths: [key] });
    expect(response.status).toBe(502);
    expect(response.body.responseType).toBe('error');
  });

  it('supports reusable stream upload, raw reads, and encoded public URLs', async () => {
    const done = jest.fn().mockResolvedValue({ Key: key });
    jest.mocked(Upload).mockImplementation(() => ({ done } as unknown as Upload));
    await fileUploadStreamData({ key, streamData: pdf, contentType: 'application/pdf' });
    expect(Upload).toHaveBeenCalledWith(expect.objectContaining({ params: { Bucket: 'test-private', Key: key, Body: pdf, ContentType: 'application/pdf' } }));
    expect(done).toHaveBeenCalledTimes(1);
    mockSend.mockResolvedValue({ Body: pdf });
    expect(await getFileFromWasabi(key)).toMatchObject({ Body: pdf });
    expect(mockSend.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(generatePublicURL({ keyPath: 'standalone/files/my report.pdf' })).toBe('https://s3.us-east-1.wasabisys.com/test-public/standalone/files/my%20report.pdf');
  });

  it('strips JPEG metadata and rejects corrupted image bytes', async () => {
    const jpeg = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .jpeg().withMetadata({ exif: { IFD0: { Artist: 'Private metadata' } } }).toBuffer();
    expect((await sharp(jpeg).metadata()).exif).toBeDefined();
    const response = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .attach('profile_image', jpeg, { filename: 'avatar.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(200);
    const stored = mockSend.mock.calls[0][0].input.Body;
    const metadata = await sharp(stored).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    mockSend.mockClear();
    const corrupt = await request(app).post('/api/files/upload').set('X-Files-API-Key', apiKey)
      .attach('files', Buffer.from('not an image'), { filename: 'avatar.jpg', contentType: 'image/jpeg' });
    expect(corrupt.status).toBe(422);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('signs PUT URLs with the content-type header using the real signer without network access', async () => {
    const { S3Client: ActualS3Client } = jest.requireActual<typeof import('@aws-sdk/client-s3')>('@aws-sdk/client-s3');
    const actualSigner = jest.requireActual<typeof import('@aws-sdk/s3-request-presigner')>('@aws-sdk/s3-request-presigner');
    mockS3Client.mockImplementationOnce(() => new ActualS3Client({
      region: 'us-east-1', endpoint: 'https://s3.us-east-1.wasabisys.com', forcePathStyle: true,
      credentials: { accessKeyId: 'test-access', secretAccessKey: 'test-secret' },
    }));
    jest.mocked(getSignedUrl).mockImplementationOnce(actualSigner.getSignedUrl);
    const signed = await generateUploadPresignedURL({ keyPath: key, fileType: 'application/pdf', expiresIn: 120 });
    const url = new URL(signed.url);
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-type;host');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('120');
    expect(url.pathname).toBe('/test-private/standalone/files/report.pdf');
  });

  it('deletes a single private or public key using the selected bucket', async () => {
    env.wasabiPublicAccessKeyId = 'test-public-access';
    env.wasabiPublicSecretAccessKey = 'test-public-secret';
    await deleteFileFromWasabi(key);
    await deletePublicFileFromWasabi(key);
    expect(mockSend.mock.calls[0][0].input).toMatchObject({ Bucket: 'test-private', Delete: { Objects: [{ Key: key }] } });
    expect(mockSend.mock.calls[1][0].input).toMatchObject({ Bucket: 'test-public', Delete: { Objects: [{ Key: key }] } });
  });

  it('keeps a raw download connection alive until its stream is consumed', async () => {
    const body = Readable.from([pdf]);
    mockSend.mockResolvedValue({ Body: body });
    const result = await getFileFromWasabi(key);
    const client = mockS3Client.mock.results.slice(-1)[0].value;
    expect(client.destroy).not.toHaveBeenCalled();
    const chunks = [];
    for await (const chunk of result.Body as Readable) chunks.push(chunk);
    expect(Buffer.concat(chunks)).toEqual(pdf);
    expect(client.destroy).toHaveBeenCalled();
  });
});
