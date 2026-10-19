import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Netlify does not inject HTML snippets into function responses. Serve the exact
// build bytes so Angular can validate /index.html against ngsw.json.
export default async function pwaShell(request) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const html = await readFile(resolve(process.cwd(), 'dist/frontend/browser/index.html'));
  return new Response(request.method === 'HEAD' ? null : html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Permissions-Policy': 'microphone=(self)',
    },
  });
}
