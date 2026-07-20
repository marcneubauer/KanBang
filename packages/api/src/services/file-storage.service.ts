import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const THUMB_WIDTH = 480;

export interface StoredImage {
  mimeType: string;
  storageKey: string;
  thumbKey: string | null;
  width: number | null;
  height: number | null;
}

export class UnsupportedFileTypeError extends Error {
  statusCode = 400;
  code = 'UNSUPPORTED_FILE_TYPE';
  constructor() {
    super('Only PNG, JPEG, WebP, GIF, and AVIF images are supported');
  }
}

/**
 * Stores uploaded images on disk under a single directory. The database holds
 * metadata only; storage keys are always '<attachmentId>.<ext>' and never
 * derived from user input.
 */
export class FileStorageService {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  resolvePath(storageKey: string): string {
    // Keys come from the DB, but guard against separators anyway
    if (storageKey !== path.basename(storageKey)) throw new Error('Invalid storage key');
    return path.join(this.dir, storageKey);
  }

  exists(storageKey: string): boolean {
    return fs.existsSync(this.resolvePath(storageKey));
  }

  createReadStream(storageKey: string): fs.ReadStream {
    return fs.createReadStream(this.resolvePath(storageKey));
  }

  /** Validate magic bytes, write the original (+ a thumbnail when it helps), return metadata. */
  async storeImage(id: string, buffer: Buffer): Promise<StoredImage> {
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !ALLOWED_MIMES.has(type.mime)) throw new UnsupportedFileTypeError();

    const storageKey = `${id}.${type.ext}`;
    let width: number | null = null;
    let height: number | null = null;
    let thumbKey: string | null = null;

    // Metadata/thumbnail failures are non-fatal — the original still gets stored
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      if (width !== null && width > THUMB_WIDTH) {
        const thumb = await sharp(buffer)
          .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        thumbKey = `${id}.thumb.webp`;
        await this.write(thumbKey, thumb);
      }
    } catch {
      width = null;
      height = null;
      thumbKey = null;
    }

    await this.write(storageKey, buffer);
    return { mimeType: type.mime, storageKey, thumbKey, width, height };
  }

  async remove(...keys: Array<string | null | undefined>): Promise<void> {
    for (const key of keys) {
      if (!key) continue;
      await fsp.rm(this.resolvePath(key), { force: true });
    }
  }

  /**
   * Safety net: delete files whose attachment row no longer exists (rows are
   * normally deleted through the API, which unlinks files itself). Files
   * younger than an hour are skipped so in-flight uploads survive.
   */
  async gc(validIds: Set<string>): Promise<number> {
    let removed = 0;
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const entry of await fsp.readdir(this.dir)) {
      const id = entry.split('.')[0];
      if (validIds.has(id)) continue;
      const full = path.join(this.dir, entry);
      const stat = await fsp.stat(full).catch(() => null);
      if (!stat || !stat.isFile() || stat.mtimeMs > cutoff) continue;
      await fsp.rm(full, { force: true });
      removed++;
    }
    return removed;
  }

  private async write(key: string, buffer: Buffer): Promise<void> {
    const final = this.resolvePath(key);
    const tmp = `${final}.part`;
    await fsp.writeFile(tmp, buffer);
    await fsp.rename(tmp, final);
  }
}
