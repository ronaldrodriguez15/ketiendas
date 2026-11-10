// Browser smoke test with invented data; never signs in to the real backend.
// Usage: node scripts/productos-browser.mjs [absolute Chrome/Edge executable]
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { preview } from 'vite';

const profile = await mkdtemp(path.join(tmpdir(), 'products-browser-'));
const server = await preview({ preview: { host: '127.0.0.1', port: 4189, strictPort: true } });
let browser, socket;
try {
  browser = spawn(process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Browser did not start')), 15000);
    browser.once('error', reject);
    browser.stderr.on('data', data => {
      const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map(); const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  };
  const command = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await command('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => command(method, params, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async expression => {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out: ' + expression);
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('panel_token', 'browser-fixture');
    window.__reportCalls = 0; window.__reportMode = 'data';
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      const address = String(url);
      if (address.endsWith('/me')) return new Response(JSON.stringify({ user: { nombre: 'Usuario de prueba', rol: 'Administrador' }, permisos: ['ventas.ver', 'dashboard.ver', 'usuarios.gestionar'] }), { status: 200 });
      if (address.includes('/reportes/productos?')) {
        window.__reportCalls++;
        if (window.__reportMode === 'error') return new Response(JSON.stringify({ message: 'Error de prueba del POS' }), { status: 502 });
        const data = window.__reportMode === 'empty' ? [] : Array.from({ length: 25 }, (_, i) => ({ id: 'item-' + i, nombre: 'Producto de prueba ' + (i + 1), codigo: 'COD-' + i, categoria: 'Categoría', cantidad: 25 - i, ventas: 2, participacion: (25 - i) / 325 * 100 }));
        return new Response(JSON.stringify({ data, resumen: { unidades: data.length ? 325 : 0, productos: data.length, ventas: 20 }, meta: { desde: '2026-11-01', hasta: '2026-11-09', limite: 100, generado_en: '2026-11-09T12:00:00-05:00' } }), { status: 200 });
      }
      return originalFetch(url, options);
    };` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:4189/productos' });
  await until("document.querySelectorAll('tbody tr').length === 10");
  assert.equal(await evaluate('window.__reportCalls'), 1);
  const click = text => evaluate(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)}).click()`);
  await click('Siguiente'); await until("document.querySelector('tbody tr').textContent.includes('Producto de prueba 11')");
  assert.equal(await evaluate('window.__reportCalls'), 1, 'Pagination must not call POS');
  await click('Esta semana'); await until('window.__reportCalls === 2');
  await click('Hoy'); await until("document.querySelector('tbody tr').textContent.includes('Producto de prueba 1')");
  assert.equal(await evaluate('window.__reportCalls'), 2, 'Returning to a fresh period uses cache');
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    await until(`window.innerWidth === ${width}`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), true, 'Page overflows at ' + width);
    assert.equal(await evaluate("document.querySelectorAll('.product-bar').length"), 10);
    console.log(JSON.stringify({ viewport: `${width}x${height}`, status: 'ok' }));
  }
  await evaluate("window.__reportMode = 'empty'"); await click('Este mes');
  await until("document.body.textContent.includes('No hay productos vendidos en este periodo')");
  await evaluate("window.__reportMode = 'error'"); await click('Actualizar');
  await until("document.body.textContent.includes('Error de prueba del POS')");
  await evaluate("window.__reportMode = 'data'"); await click('Reintentar');
  await until("document.querySelectorAll('tbody tr').length === 10");
  assert.deepEqual(errors, []);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath = path.join(tmpdir(), 'productos-mobile-qa.png');
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log(JSON.stringify({ pagination: 'ok', periodCache: 'ok', empty: 'ok', retry: 'ok', screenshotPath }));
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await new Promise(resolve => { browser.once('exit', resolve); setTimeout(resolve, 2000); });
  }
  await new Promise(resolve => server.httpServer.close(resolve));
  // Only this test's uniquely-created temporary profile is removed.
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(tmpdir()));
  assert.ok(path.basename(profile).startsWith('products-browser-'));
  await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {});
}
