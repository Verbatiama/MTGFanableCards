/**
 * Downloads the Scryfall bulk data (if newer) into DATA_DIR and loads it once,
 * reporting the card count and load time (T-A3). `npm run data:download`
 */
import { createCardStore } from '../src/data/card-store.js';
import { DATA_DIR } from '../src/paths.js';

console.log(`Data directory: ${DATA_DIR}`);
const store = createCardStore({ refreshHours: 0 });
await store.ready;
const { heapUsed } = process.memoryUsage();
console.log(`Heap used: ${Math.round(heapUsed / 1e6)} MB`);
