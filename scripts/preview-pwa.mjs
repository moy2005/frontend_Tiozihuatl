import express from 'express';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const browserDist = fileURLToPath(new URL('../dist/frontend/browser/', import.meta.url));
const port = Number(process.env.PWA_PORT || 4201);

for (const file of ['index.html', 'manifest.webmanifest', 'ngsw.json', 'ngsw-worker.js']) {
  try {
    await access(`${browserDist}/${file}`);
  } catch {
    console.error(`Falta ${file}. Ejecuta primero npm run build:pwa.`);
    process.exit(1);
  }
}

const app = express();
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(browserDist, { index: false, cacheControl: false }));
app.use((req, res) => {
  const isNavigation = ['GET', 'HEAD'].includes(req.method) && req.accepts('html');
  const isFileOrApi = /\.[^/]+$/.test(req.path) || /^\/(api|uploads)(\/|$)/.test(req.path);
  if (!isNavigation || isFileOrApi) {
    res.sendStatus(404);
    return;
  }
  res.sendFile(`${browserDist}/index.html`, { cacheControl: false });
});
app.listen(port, 'localhost', () => {
  console.log(`PWA local: http://localhost:${port}/inicio`);
  console.log('Solo sirve el frontend compilado. No despliega ni inicia el backend.');
  console.log('Detén el servidor con Ctrl+C.');
});
