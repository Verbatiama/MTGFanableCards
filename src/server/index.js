import http from 'node:http';
import { pathToFileURL } from 'node:url';

/**
 * Backend API (D9). Only a health check for now; card generation routes are
 * added in T-A12 / T-S3.
 */
export function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => {
    console.log(`MTG Fannable Cards API listening on http://localhost:${port}`);
  });
}
