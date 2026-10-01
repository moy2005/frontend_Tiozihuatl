import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const output = new URL('../dist/frontend/browser/', import.meta.url);
const read = (path) => readFile(new URL(path.replace(/^\//, ''), output));
const manifest = JSON.parse(await read('manifest.webmanifest'));
const sw = JSON.parse(await read('ngsw.json'));
const html = (await read('index.html')).toString();

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.id, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.start_url, '/inicio');
assert.equal(manifest.lang, 'es-MX');
assert.match(html, /<html[^>]+lang="es-MX"/);
assert.match(html, /rel="manifest"[^>]+href="manifest.webmanifest"/);
assert.match(html, /name="theme-color"[^>]+content="#3fa6e8"/);
assert.ok((await read('ngsw-worker.js')).length > 0);

for (const size of [192, 512]) {
  assert.ok(manifest.icons.some((icon) => icon.sizes === `${size}x${size}` && icon.purpose === 'any'));
}
assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
for (const icon of [...manifest.icons,
  { src: 'icons/apple-touch-icon.png', sizes: '180x180' },
  { src: 'icons/favicon-32.png', sizes: '32x32' },
]) {
  const png = await read(icon.src);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', icon.src);
  assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
  assert.ok(sw.hashTable[`/${icon.src}`], `Icono sin precache: ${icon.src}`);
}

assert.deepEqual(sw.dataGroups, [], 'La caché del worker no debe almacenar respuestas de la API.');
assert.ok(sw.hashTable[sw.index], 'El HTML de arranque debe estar versionado.');
assert.ok(sw.hashTable['/manifest.webmanifest']);
for (const [url, hash] of Object.entries(sw.hashTable)) {
  assert.ok(!/^https?:/.test(url), `Recurso remoto inesperado: ${url}`);
  assert.ok(!/^\/(api|uploads)\//.test(url), `Dato dinámico inesperado: ${url}`);
  assert.ok(!/\.(pdf|mjs|map)$/i.test(url), `Archivo fuera del alcance: ${url}`);
  assert.equal(createHash('sha1').update(await read(url)).digest('hex'), hash, url);
}
for (const group of sw.assetGroups) {
  assert.equal(group.installMode, group.name === 'additional-icons' ? 'lazy' : 'prefetch');
  assert.deepEqual(group.patterns, [], 'No se permiten patrones de caché para URLs remotas.');
}
const handlesNavigation = (url) =>
  sw.navigationUrls.some((rule) => rule.positive && new RegExp(rule.regex).test(url)) &&
  !sw.navigationUrls.some((rule) => !rule.positive && new RegExp(rule.regex).test(url));
for (const route of ['/inicio', '/about', '/seguridad', '/contactanos', '/privacidad', '/terminos', '/sin-conexion']) {
  assert.ok(handlesNavigation(route), `La ruta no puede abrir la aplicación: ${route}`);
}
for (const route of ['/api', '/api/catalog', '/api/auth/refresh', '/uploads', '/uploads/libro.pdf', '/missing.js']) {
  assert.ok(!handlesNavigation(route), `La navegación no debe sustituir este recurso por HTML: ${route}`);
}
console.log(`PWA verificada: manifiesto, 5 iconos, worker y ${Object.keys(sw.hashTable).length} archivos íntegros.`);
console.log('API, documentos y recursos externos excluidos de la caché PWA.');
assert.ok(sw.hashTable['/offline/logo.png']);
assert.ok(sw.hashTable['/assets/ionicons/ionicons.esm.js']);
assert.ok(!/https?:\/\/(fonts\.googleapis|unpkg|cdn\.jsdelivr)/.test(html));
const production = await readFile(new URL('../src/app/api/environments/environment.prod.ts', import.meta.url), 'utf8');
assert.match(production, /apiUrl:\s*['"]https:\/\//);
assert.ok(!production.includes('localhost'));
