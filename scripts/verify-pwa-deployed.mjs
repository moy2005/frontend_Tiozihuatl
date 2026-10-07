import { createHash } from 'node:crypto';

const base = new URL(process.argv[2] || 'https://frontiozihuatl.netlify.app');
if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/') throw new Error('Indica únicamente el origen HTTPS del frontend.');
const read = async (path) => {
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error('Recurso fuera del origen: ' + path);
  url.searchParams.set('ngsw-cache-bust', String(Date.now()));
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: 'no-store' });
  if (!response.ok || new URL(response.url).origin !== base.origin) throw new Error(path + ': HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
};
const manifest = JSON.parse((await read('/ngsw.json')).toString());
const urls = [...new Set(manifest.assetGroups.filter(group => group.installMode === 'prefetch').flatMap(group => group.urls))];
if (!urls.includes(manifest.index) || !manifest.hashTable[manifest.index]) throw new Error('Manifiesto sin HTML de arranque versionado.');
let cursor = 0;
const errors = [];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < urls.length) {
    const path = urls[cursor++];
    try {
      const body = await read(path);
      const actual = createHash('sha1').update(body).digest('hex');
      if (actual !== manifest.hashTable[path]) {
        const clean = body.toString().replace(/<!-- This site is hosted on Netlify\.[\s\S]*?-->\n/, '');
        const injection = createHash('sha1').update(clean).digest('hex') === manifest.hashTable[path];
        errors.push(path + ': contenido distinto al build' + (injection ? ' (comentario de Netlify inyectado después de compilar)' : ''));
      }
    } catch (error) { errors.push(path + ': ' + error.message); }
  }
}));
if (errors.length) {
  console.error(errors.join('\n'));
  console.error('La versión publicada no supera la integridad PWA. Revisa transformaciones del hosting y publica el build completo.');
  process.exitCode = 1;
} else console.log('PWA publicada íntegra: ' + urls.length + ' recursos de precarga verificados.');
