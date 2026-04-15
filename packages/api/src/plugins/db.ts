import fp from 'fastify-plugin';
import { createDb } from '../db/index.js';
import type { Database } from '../db/index.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export default fp(
  async (fastify, opts: { databaseUrl?: string }) => {
    const db = createDb(opts.databaseUrl);

    // Run migrations on startup
    const migrationsFolder = path.resolve(__dirname, '../db/migrations');
    migrate(db, { migrationsFolder });

    fastify.decorate('db', db);
  },
  { name: 'kanbang-db' },
);
