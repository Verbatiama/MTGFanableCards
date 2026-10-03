import { pathToFileURL } from 'node:url';
import { createArtFetcher } from '../art/art-cache.js';
import { createSetSymbolFetcher } from '../art/set-symbols.js';
import { createCardStore } from '../data/card-store.js';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';

/**
 * Starts the backend API (T-C1, D26, D30): `npm start`.
 *
 * Loads the Scryfall data in the background (the API answers health checks
 * meanwhile, and jobs wait for it) and refreshes it every
 * SCRYFALL_REFRESH_HOURS. On SIGTERM or SIGINT it stops taking requests and
 * new jobs, and lets running jobs finish before exiting (3.6.5).
 */
export async function startServer(config = loadConfig()) {
  const app = await buildApp({
    config,
    logger: true,
    services(log) {
      const store = createCardStore({ log });
      store.ready.catch((error) => log.error(error, 'card data could not be loaded'));
      const artFetcher = createArtFetcher({ log });
      const setSymbols = createSetSymbolFetcher({ log });
      return {
        get db() {
          return store.db;
        },
        loaded: store.loaded,
        fetchArt: artFetcher.fetchArt,
        fetchSetSymbol: setSymbols.fetchSetSymbol,
        async close() {
          store.stop();
          await artFetcher.flush();
        },
      };
    },
  });

  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, async () => {
      if (closing) return;
      closing = true;
      app.log.info(`${signal} received: finishing running jobs, then exiting`);
      await app.close();
      process.exit(0);
    });
  }

  await app.listen({ port: config.port, host: config.host });
  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
