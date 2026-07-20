import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import formAutoContent from 'form-auto-content';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  createTestApp,
  registerUser,
  authHeader,
  createBoard,
  createList,
  createCard,
} from './helpers.js';
import { cards } from '../../src/db/schema.js';
import { FileStorageService } from '../../src/services/file-storage.service.js';

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 60, b: 60 } },
  })
    .png()
    .toBuffer();
}

function uploadForm(buffer: Buffer, filename = 'photo.png', contentType = 'image/png') {
  return formAutoContent({
    file: { value: buffer, options: { filename, contentType } },
  });
}

describe('Attachment routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let cardId: string;
  let uploadsDir: string;

  beforeEach(async () => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanbang-att-test-'));
    app = await createTestApp({ uploadsDir });
    const { sessionCookie } = await registerUser(app);
    cookie = sessionCookie!;
    const { body: boardBody } = await createBoard(app, cookie);
    const { body: listBody } = await createList(app, cookie, boardBody.board.id);
    const { body: cardBody } = await createCard(app, cookie, listBody.list.id);
    cardId = cardBody.card.id;
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  async function upload(buffer: Buffer, filename?: string) {
    const form = uploadForm(buffer, filename);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/cards/${cardId}/attachments`,
      headers: { ...authHeader(cookie), ...form.headers },
      payload: form.payload,
    });
    return { response, body: JSON.parse(response.body) };
  }

  it('uploads an image, stores original + thumbnail, records dimensions', async () => {
    const png = await makePng(600, 400);
    const { response, body } = await upload(png);

    expect(response.statusCode).toBe(201);
    const att = body.attachment;
    expect(att.mimeType).toBe('image/png');
    expect(att.width).toBe(600);
    expect(att.height).toBe(400);
    expect(att.sizeBytes).toBe(png.length);
    expect(att.filename).toBe('photo.png');
    // Internal fields must not leak through serialization
    expect(att.storageKey).toBeUndefined();
    expect(att.userId).toBeUndefined();

    expect(fs.existsSync(path.join(uploadsDir, `${att.id}.png`))).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, `${att.id}.thumb.webp`))).toBe(true);
  });

  it('skips the thumbnail for small images and falls back on /thumb', async () => {
    const png = await makePng(100, 80);
    const { body } = await upload(png);
    const att = body.attachment;

    expect(fs.existsSync(path.join(uploadsDir, `${att.id}.thumb.webp`))).toBe(false);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/files/${att.id}/thumb`,
      headers: authHeader(cookie),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('serves the original bytes with cache headers', async () => {
    const png = await makePng(60, 60);
    const { body } = await upload(png);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/files/${body.attachment.id}`,
      headers: authHeader(cookie),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.rawPayload.equals(png)).toBe(true);
  });

  it('rejects files whose magic bytes are not an allowed image', async () => {
    const { response, body } = await upload(Buffer.from('hello, not an image'), 'evil.png');
    expect(response.statusCode).toBe(400);
    expect(body.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects uploads over the size limit with 413', async () => {
    const smallApp = await createTestApp({ uploadMaxBytes: 1024 });
    try {
      const { sessionCookie } = await registerUser(smallApp, {
        email: 'small@example.com',
        username: 'smalluser',
      });
      const smallCookie = sessionCookie!;
      const { body: boardBody } = await createBoard(smallApp, smallCookie);
      const { body: listBody } = await createList(smallApp, smallCookie, boardBody.board.id);
      const { body: cardBody } = await createCard(smallApp, smallCookie, listBody.list.id);

      const form = uploadForm(await makePng(600, 400));
      const res = await smallApp.inject({
        method: 'POST',
        url: `/api/v1/cards/${cardBody.card.id}/attachments`,
        headers: { ...authHeader(smallCookie), ...form.headers },
        payload: form.payload,
      });
      expect(res.statusCode).toBe(413);
    } finally {
      await smallApp.close();
    }
  });

  it('requires auth and blocks other users', async () => {
    const png = await makePng(50, 50);
    const form = uploadForm(png);
    const unauthed = await app.inject({
      method: 'POST',
      url: `/api/v1/cards/${cardId}/attachments`,
      headers: form.headers,
      payload: form.payload,
    });
    expect(unauthed.statusCode).toBe(401);

    const { body } = await upload(png);
    const { sessionCookie: otherCookie } = await registerUser(app, {
      email: 'other@example.com',
      username: 'otheruser',
    });
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/files/${body.attachment.id}`,
      headers: authHeader(otherCookie!),
    });
    expect(res.statusCode).toBe(404);
  });

  it('lists attachments for a card', async () => {
    await upload(await makePng(50, 50), 'a.png');
    await upload(await makePng(50, 50), 'b.png');

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${cardId}/attachments`,
      headers: authHeader(cookie),
    });
    const { attachments: list } = JSON.parse(res.body);
    expect(list).toHaveLength(2);
    expect(list.map((a: { filename: string }) => a.filename).sort()).toEqual(['a.png', 'b.png']);
  });

  it('delete removes the row, the files, and clears covers pointing at it', async () => {
    const { body } = await upload(await makePng(600, 400));
    const attId = body.attachment.id;

    // Plant an attachment cover directly (PATCH-level support arrives in phase 2)
    await app.db
      .update(cards)
      .set({ coverType: 'attachment', coverValue: attId })
      .where(eq(cards.id, cardId));

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/attachments/${attId}`,
      headers: authHeader(cookie),
    });
    expect(res.statusCode).toBe(200);

    expect(fs.existsSync(path.join(uploadsDir, `${attId}.png`))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, `${attId}.thumb.webp`))).toBe(false);

    const cardRes = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${cardId}`,
      headers: authHeader(cookie),
    });
    const { card } = JSON.parse(cardRes.body);
    expect(card.coverType).toBeNull();
    expect(card.coverValue).toBeNull();

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${cardId}/attachments`,
      headers: authHeader(cookie),
    });
    expect(JSON.parse(listRes.body).attachments).toHaveLength(0);
  });

  it('gc removes stale orphans but keeps valid and fresh files', async () => {
    const { body } = await upload(await makePng(50, 50));
    const validId = body.attachment.id;

    const staleOrphan = path.join(uploadsDir, 'orphan1.png');
    const freshOrphan = path.join(uploadsDir, 'orphan2.png');
    fs.writeFileSync(staleOrphan, 'x');
    fs.writeFileSync(freshOrphan, 'x');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(staleOrphan, twoHoursAgo, twoHoursAgo);

    const storage = new FileStorageService(uploadsDir);
    const removed = await storage.gc(new Set([validId]));

    expect(removed).toBe(1);
    expect(fs.existsSync(staleOrphan)).toBe(false);
    expect(fs.existsSync(freshOrphan)).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, `${validId}.png`))).toBe(true);
  });
});
