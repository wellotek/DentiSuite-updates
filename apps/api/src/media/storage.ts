/**
 * Minimal S3-compatible object storage abstraction.
 * Production: Cloudflare R2. Tests/dev without credentials: MemoryObjectStorage.
 */

export type SignedUpload = {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: Date;
};

export type SignedDownload = {
  downloadUrl: string;
  expiresAt: Date;
};

export type ObjectHead = {
  exists: boolean;
  size?: number;
  contentType?: string;
};

export interface ObjectStorage {
  readonly provider: string;
  createUploadUrl(
    key: string,
    opts: {
      contentType: string;
      contentLength: number;
      expiresInSeconds: number;
    },
  ): Promise<SignedUpload>;
  createDownloadUrl(
    key: string,
    opts: { expiresInSeconds: number; filename?: string },
  ): Promise<SignedDownload>;
  headObject(key: string): Promise<ObjectHead>;
  deleteObject(key: string): Promise<void>;
  /** Server-side PUT used by staging APPLY (not the public signed-upload flow). */
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Staging APPLY/sign-off download of stored bytes (not DICOMWeb). */
  getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;
}

type MemoryObject = {
  body: Buffer;
  contentType: string;
};

/**
 * In-memory object store for tests and local API without R2 credentials.
 * Clients "upload" by calling {@link putObject} with the server storageKey
 * (tests simulate the signed PUT destination).
 */
export class MemoryObjectStorage implements ObjectStorage {
  readonly provider = 'memory';
  private readonly objects = new Map<string, MemoryObject>();
  private readonly uploadTokens = new Map<
    string,
    { key: string; contentType: string; contentLength: number; exp: number }
  >();
  private readonly downloadTokens = new Map<
    string,
    { key: string; exp: number; filename?: string }
  >();

  clear(): void {
    this.objects.clear();
    this.uploadTokens.clear();
    this.downloadTokens.clear();
  }

  async createUploadUrl(
    key: string,
    opts: {
      contentType: string;
      contentLength: number;
      expiresInSeconds: number;
    },
  ): Promise<SignedUpload> {
    const token = `up_${cryptoRandom()}`;
    const expiresAt = new Date(Date.now() + opts.expiresInSeconds * 1000);
    this.uploadTokens.set(token, {
      key,
      contentType: opts.contentType,
      contentLength: opts.contentLength,
      exp: expiresAt.getTime(),
    });
    return {
      uploadUrl: `memory://upload/${encodeURIComponent(token)}`,
      method: 'PUT',
      headers: {
        'Content-Type': opts.contentType,
        'Content-Length': String(opts.contentLength),
      },
      expiresAt,
    };
  }

  async createDownloadUrl(
    key: string,
    opts: { expiresInSeconds: number; filename?: string },
  ): Promise<SignedDownload> {
    const token = `dl_${cryptoRandom()}`;
    const expiresAt = new Date(Date.now() + opts.expiresInSeconds * 1000);
    this.downloadTokens.set(token, {
      key,
      exp: expiresAt.getTime(),
      filename: opts.filename,
    });
    return {
      downloadUrl: `memory://download/${encodeURIComponent(token)}`,
      expiresAt,
    };
  }

  async headObject(key: string): Promise<ObjectHead> {
    const obj = this.objects.get(key);
    if (!obj) return { exists: false };
    return {
      exists: true,
      size: obj.body.length,
      contentType: obj.contentType,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  /** Simulate client PUT to a memory signed upload URL. */
  async putViaSignedUploadUrl(
    uploadUrl: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    const token = parseMemoryToken(uploadUrl, 'upload');
    const meta = this.uploadTokens.get(token);
    if (!meta || meta.exp < Date.now()) {
      throw new Error('upload_token_invalid');
    }
    if (body.length !== meta.contentLength) {
      throw new Error('upload_size_mismatch');
    }
    this.objects.set(meta.key, {
      body,
      contentType: contentType ?? meta.contentType,
    });
    this.uploadTokens.delete(token);
  }

  /** Direct put used by tests that already know the storage key. */
  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return { body: Buffer.from(obj.body), contentType: obj.contentType };
  }

  getDownloadMeta(downloadUrl: string): { key: string; filename?: string } | null {
    const token = parseMemoryToken(downloadUrl, 'download');
    const meta = this.downloadTokens.get(token);
    if (!meta || meta.exp < Date.now()) return null;
    return { key: meta.key, filename: meta.filename };
  }

  /** Inspect TTL remaining for a signed download URL (tests). */
  getDownloadExpiresAt(downloadUrl: string): Date | null {
    const token = parseMemoryToken(downloadUrl, 'download');
    const meta = this.downloadTokens.get(token);
    if (!meta) return null;
    return new Date(meta.exp);
  }
}

function parseMemoryToken(url: string, kind: 'upload' | 'download'): string {
  const prefix = `memory://${kind}/`;
  if (!url.startsWith(prefix)) throw new Error('invalid_memory_url');
  return decodeURIComponent(url.slice(prefix.length));
}

function cryptoRandom(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Optional custom endpoint; defaults to https://{accountId}.r2.cloudflarestorage.com */
  endpoint?: string;
};

/**
 * Cloudflare R2 via S3-compatible API.
 * Loaded only when configured — keeps test installs free of R2 credentials.
 */
export class R2ObjectStorage implements ObjectStorage {
  readonly provider = 'r2';
  private clientPromise: Promise<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PutObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    GetObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HeadObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    DeleteObjectCommand: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSignedUrl: any;
  }> | null = null;

  constructor(private readonly config: R2Config) {}

  private async sdk() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } =
          await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        const endpoint =
          this.config.endpoint ??
          `https://${this.config.accountId}.r2.cloudflarestorage.com`;
        const client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey,
          },
        });
        return {
          client,
          PutObjectCommand,
          GetObjectCommand,
          HeadObjectCommand,
          DeleteObjectCommand,
          getSignedUrl,
        };
      })();
    }
    return this.clientPromise;
  }

  async createUploadUrl(
    key: string,
    opts: {
      contentType: string;
      contentLength: number;
      expiresInSeconds: number;
    },
  ): Promise<SignedUpload> {
    const { client, PutObjectCommand, getSignedUrl } = await this.sdk();
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: opts.contentType,
      ContentLength: opts.contentLength,
    });
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: opts.expiresInSeconds,
    });
    return {
      uploadUrl,
      method: 'PUT',
      headers: {
        'Content-Type': opts.contentType,
        'Content-Length': String(opts.contentLength),
      },
      expiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000),
    };
  }

  async createDownloadUrl(
    key: string,
    opts: { expiresInSeconds: number; filename?: string },
  ): Promise<SignedDownload> {
    const { client, GetObjectCommand, getSignedUrl } = await this.sdk();
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ...(opts.filename
        ? {
            ResponseContentDisposition: `attachment; filename="${opts.filename.replace(/"/g, '')}"`,
          }
        : {}),
    });
    const downloadUrl = await getSignedUrl(client, command, {
      expiresIn: opts.expiresInSeconds,
    });
    return {
      downloadUrl,
      expiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000),
    };
  }

  async headObject(key: string): Promise<ObjectHead> {
    const { client, HeadObjectCommand } = await this.sdk();
    try {
      const out = await client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      return {
        exists: true,
        size: typeof out.ContentLength === 'number' ? out.ContentLength : undefined,
        contentType: out.ContentType,
      };
    } catch {
      return { exists: false };
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, PutObjectCommand } = await this.sdk();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    const { client, GetObjectCommand } = await this.sdk();
    try {
      const out = await client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
        }),
      );
      const bytes = out.Body ? await out.Body.transformToByteArray() : new Uint8Array();
      return {
        body: Buffer.from(bytes),
        contentType: typeof out.ContentType === 'string' ? out.ContentType : 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { client, DeleteObjectCommand } = await this.sdk();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
      }),
    );
  }
}

export function buildPatientMediaStorageKey(params: {
  organizationId: string;
  patientId: string;
  mediaId: string;
  ext: string;
}): string {
  const ext = params.ext.startsWith('.') ? params.ext.toLowerCase() : '';
  return `org/${params.organizationId}/patients/${params.patientId}/media/${params.mediaId}${ext}`;
}

export function assertTenantStorageKey(
  key: string,
  organizationId: string,
): boolean {
  return key.startsWith(`org/${organizationId}/`);
}
