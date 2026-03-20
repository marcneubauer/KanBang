import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { config } from './config.js';

async function start() {
  const app = await buildApp();

  closeWithGrace({ delay: 10000 }, async ({ signal, err }) => {
    if (err) app.log.error(err);
    app.log.info(`${signal} received, shutting down`);
    await app.close();
  });

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
