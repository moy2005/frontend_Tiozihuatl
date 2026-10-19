// Integration test using an installed Chromium browser, without test dependencies.
// PWA_BROWSER must point to Chrome, Edge, or Chromium. Run after build:pwa.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';
import pwaShell from '../netlify/functions/pwa-shell.mjs';

const executable = process.env.PWA_BROWSER;
assert.ok(executable, 'Indica la ruta del navegador en PWA_BROWSER.');
assert.equal(typeof WebSocket, 'function', 'Esta prueba requiere Node.js 22 o posterior.');
const broken = process.argv.includes('--broken');
const dist = resolve('dist/frontend/browser');
const manifest = JSON.parse(await readFile(join(dist, 'ngsw.json'), 'utf8'));
const html = await readFile(join(dist, 'index.html'), 'utf8');
const injectedHtml = html + '\n<!-- Simulated hosting injection after build -->';
const app = express();
app.get('/index.html', async (req, res) => {
  if (broken) return res.type('html').send(injectedHtml);
  const response = await pwaShell(new Request(`http://localhost${req.originalUrl}`));
  res.status(response.status).set(Object.fromEntries(response.headers)).send(Buffer.from(await response.arrayBuffer()));
});
app.use(express.static(dist, { index: false }));
app.use((req, res) => {
  if (/\.[^/]+$/.test(req.path)) return res.sendStatus(404);
  res.type('html').send(injectedHtml);
});
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
// .localhost remains a secure context in Chromium, but avoids Angular's special
// synchronous initialization for the exact localhost/127.0.0.1 hostnames.
const origin = `http://pwa.localhost:${server.address().port}`;
const profile = await mkdtemp(join(tmpdir(), 'tiozihuatl-pwa-'));
const browser = spawn(executable, [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--host-resolver-rules=MAP pwa.localhost 127.0.0.1',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore', windowsHide: true });
browser.on('error', error => { console.error(error); });
const sockets = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 75_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const result = await check(); if (result) return result; }
    catch (error) { lastError = error; }
    await pause(250);
  }
  throw new Error('Tiempo agotado esperando la PWA.', { cause: lastError });
}
async function connect(url) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  const events = new EventEmitter();
  let documentStatus;
  events.on('Network.responseReceived', event => {
    if (event.type === 'Document') documentStatus = event.response.status;
  });
  const pending = new Map();
  let id = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const call = pending.get(message.id);
      if (!call) return;
      pending.delete(message.id);
      clearTimeout(call.timer);
      if (message.error) call.reject(new Error(JSON.stringify(message.error)));
      else call.resolve(message.result);
    } else events.emit(message.method, message.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout: ${method}`)); }, 30_000);
    pending.set(requestId, { resolve, reject, timer });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Page.enable');
  await send('Network.enable');
  const navigate = async (url, reload = false) => {
    const loaded = once(events, 'Page.loadEventFired', { signal: AbortSignal.timeout(30_000) });
    await send(reload ? 'Page.reload' : 'Page.navigate', reload ? {} : { url });
    await loaded;
    await until(() => evaluate(`!!document.querySelector('app-root app-offline-page, app-root router-outlet')`));
  };
  return { send, evaluate, navigate, documentStatus: () => documentStatus };
}
try {
  const port = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
  const debug = `http://127.0.0.1:${port}`;
  const targets = await (await fetch(`${debug}/json/list`)).json();
  const page = await connect(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await page.navigate(`${origin}/sin-conexion?volver=%2Fmateriales`);
  await until(() => page.evaluate(`!!navigator.serviceWorker.controller`));
  const state = () => page.evaluate(`fetch('/ngsw/state').then(r => r.text())`);
  if (broken) {
    await until(async () => (await state()).includes('Hash mismatch'));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await page.send('Page.reload');
    await until(() => page.documentStatus() === 504);
    console.log('Regresión reproducida: HTML alterado → Hash mismatch → recarga offline HTTP 504.');
  } else {
    const required = [...new Set(manifest.assetGroups.filter(group => group.installMode === 'prefetch').flatMap(group => group.urls))];
    await until(() => page.evaluate(`(async () => {
      const stores = await Promise.all((await caches.keys()).filter(name => name.endsWith(':cache')).map(name => caches.open(name)));
      return (await Promise.all(${JSON.stringify(required)}.map(async path =>
        (await Promise.all(stores.map(store => store.match(path)))).some(response => response?.ok)
      ))).every(Boolean);
    })()`));
    assert.match(await state(), /Driver state: NORMAL/);
    console.log(`Precarga completa: ${required.length} recursos, incluso con inyección en las rutas online.`);
    // Stop the origin as well as emulating offline: worker requests cannot
    // silently use the network even if DevTools only throttles the page target.
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };
    await page.send('Network.emulateNetworkConditions', offline);
    await page.navigate('', true);
    await until(() => page.evaluate(`document.querySelector('.offline-hero h1')?.textContent.includes('Seguimos aquí')`));
    console.log('Recarga offline de /sin-conexion?volver=%2Fmateriales: OK.');
    for (const path of ['/inicio', '/about', '/materiales']) {
      await page.navigate(origin + path);
      if (path === '/materiales') await until(() => page.evaluate(`location.pathname === '/sin-conexion' && !!document.querySelector('.offline-hub')`));
      assert.ok(await page.evaluate(`!!document.querySelector('app-root router-outlet')`));
      console.log(`Navegación de documento sin servidor ${path}: OK.`);
    }
    const target = await (await fetch(`${debug}/json/new?about:blank`, { method: 'PUT' })).json();
    const newPage = await connect(target.webSocketDebuggerUrl);
    await newPage.send('Network.emulateNetworkConditions', offline);
    await newPage.navigate(`${origin}/sin-conexion?volver=%2Fmateriales`);
    await until(() => newPage.evaluate(`!!document.querySelector('.offline-hub')`));
    console.log('Nueva pestaña offline: OK.');
  }
} finally {
  for (const socket of sockets) socket.close();
  browser.kill();
  if (browser.exitCode === null) await Promise.race([once(browser, 'exit'), pause(5000)]);
  server.closeAllConnections();
  server.close();
  // Only remove the fresh test profile created by mkdtemp above.
  assert.equal(resolve(profile), profile);
  assert.ok(profile.startsWith(join(tmpdir(), 'tiozihuatl-pwa-')));
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
