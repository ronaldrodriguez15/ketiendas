// Browser regression checks using Chrome DevTools Protocol, no test dependencies.
// Usage: node scripts/check-liquid.mjs (Vite must be running on localhost:5173).
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(join(tmpdir(), 'ke-liquid-'));
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
browser.stderr.on('data', data => { if (process.env.LIQUID_DEBUG) process.stderr.write(data); });
let socket;
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
try {
  let target;
  for (let i = 0; i < 80; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page'); } catch {}
    if (target) break;
    await pause(100);
  }
  assert(target, 'Chrome started');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('close', event => { if (process.env.LIQUID_DEBUG) console.log('Socket closed', event.code, event.reason); });
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map(), errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.id) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`CDP timeout: ${method}, socket=${socket.readyState}`)), 10000);
    pending.set(++id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const point = (selector, fx = .7, fy = .5) => evaluate(`(() => { const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width*${fx},y:r.top+r.height*${fy}} })()`);
  const move = async (selector, fx, fy) => { const p = await point(selector, fx, fy); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p }); await pause(180); return p; };
  const click = async (selector) => { const p = await point(selector); await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p }); };
  const hoverCheck = async (selector) => {
    await move(selector);
    const value = await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)});return {hover:n.classList.contains('liquid-hover'),opacity:getComputedStyle(n,'::before').opacity,transform:getComputedStyle(n).transform,tx:n.style.getPropertyValue('--tx'),pe:getComputedStyle(n,'::after').pointerEvents}})()`);
    assert(value.hover, `${selector} hover class`);
    assert.equal(value.opacity, '1', `${selector} highlight visible`);
    assert.equal(value.pe, 'none');
    assert.notEqual(parseFloat(value.tx), 0, `${selector} spring displacement`);
    const limits = await evaluate(`(() => {const n=document.querySelector(${JSON.stringify(selector)}),s=getComputedStyle(n);return {large:n.matches('.glass,.liquid-key'),distance:Math.hypot(parseFloat(s.getPropertyValue('--tx')),parseFloat(s.getPropertyValue('--ty'))),rotation:Math.abs(parseFloat(s.getPropertyValue('--rot'))),sx:parseFloat(s.getPropertyValue('--sx')),sy:parseFloat(s.getPropertyValue('--sy'))}})()`);
    assert(limits.distance <= (limits.large ? .3 : .6) + .0001, 'bounded hover distance');
    assert(limits.rotation <= (limits.large ? .05 : .1), 'bounded tilt');
    assert(limits.sx >= .998 && limits.sx <= 1.004 && limits.sy >= .998 && limits.sy <= 1.004, 'bounded hover scale');
    console.log('PASS hover', selector, value.tx);
  };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173' });
  await pause(1800);
  console.log('Media', await evaluate(`({hover:matchMedia('(hover:hover)').matches,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches})`));
  // Temporary diagnostic lives only in this test and is removed before navigation.
  await evaluate(`window.__liquidEvents=0;window.__liquidLog=e=>{window.__liquidEvents++;console.debug('liquid pointermove',e.target.tagName)};document.addEventListener('pointermove',window.__liquidLog,true)`);
  await hoverCheck('form .btn');
  // Switching hover between the card and its children must never replay its entrance fade.
  const loginOpacity = await evaluate(`new Promise(resolve => {
    const form=document.querySelector('form'),button=form.querySelector('.btn');let count=0,min=1;
    function sample(){
      const node=count%12<6?form:button,r=node.getBoundingClientRect();
      node.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+10,clientY:r.top+10}));
      min=Math.min(min,Number(getComputedStyle(form).opacity),Number(getComputedStyle(form.parentElement).opacity));
      if(++count<48)requestAnimationFrame(sample);else resolve(min);
    }requestAnimationFrame(sample);
  })`);
  assert.equal(loginOpacity, 1, 'login stays opaque across hover changes');
  assert(await evaluate('window.__liquidEvents > 0'), 'delegated input reaches document');
  await evaluate(`document.removeEventListener('pointermove',window.__liquidLog,true);delete window.__liquidLog;delete window.__liquidEvents`);
  await click('form .btn'); await pause(1300);
  for (const selector of ['.glass.hov', '.nav', '.chip']) await hoverCheck(selector);
  // Empty regions of structural surfaces, not their nested controls.
  await move('aside', .5, .7);
  assert(await evaluate(`document.querySelector('aside').classList.contains('liquid-hover')`));
  await move('header', .55, .8);
  assert(await evaluate(`document.querySelector('header').classList.contains('liquid-hover')`));
  const width = await evaluate(`document.querySelector('aside').offsetWidth`);
  await click('aside .hidden.md\\:block button'); await pause(700);
  assert(await evaluate(`document.querySelector('aside').offsetWidth`) < width, 'sidebar collapses');
  await click('a[href="/usuarios"]'); await pause(500);
  await hoverCheck('.pg:not(:disabled)');
  await click('.pg[aria-label="Página siguiente"]'); await pause(500);
  assert.equal(await evaluate(`document.querySelector('.pg[aria-current="page"]').textContent`), '2');
  await click('main .btn'); await pause(400);
  await move('.pop [data-liquid]', .03, .5);
  assert(await evaluate(`document.querySelector('.pop [data-liquid]').classList.contains('liquid-hover')`), 'modal hover');
  const modalOpacity = await evaluate(`new Promise(resolve => {
    const shell=document.querySelector('.pop'),card=shell.querySelector('[data-liquid]'),input=card.querySelector('input'),button=card.querySelector('.btn');let count=0,min=1;
    function sample(){
      const node=count%12<6?card:button,r=node.getBoundingClientRect();
      node.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+10,clientY:r.top+10}));
      if(count%8===0){
        const target=count%16===0?input:card,rect=target.getBoundingClientRect();
        const init={bubbles:true,pointerType:'mouse',isPrimary:true,pointerId:1,button:0,clientX:rect.left+10,clientY:rect.top+10};
        target.dispatchEvent(new PointerEvent('pointerdown',init));
        target.dispatchEvent(new PointerEvent('pointerup',init));
        target.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
      }
      min=Math.min(min,Number(getComputedStyle(card).opacity),Number(getComputedStyle(shell).opacity));
      if(++count<48)requestAnimationFrame(sample);else resolve({min,open:card.isConnected});
    }requestAnimationFrame(sample);
  })`);
  assert.equal(modalOpacity.min, 1, 'modal stays opaque across hover and clicks');
  assert(modalOpacity.open, 'clicks inside do not close modal');
  await move('.pop [data-liquid]', .03, .5);
  await pause(1400);
  const displacement = Number(await evaluate(`document.querySelector('#liquid feDisplacementMap').getAttribute('scale')`));
  assert(displacement > 0 && displacement <= 1.5, 'subtle animated SVG displacement');
  await click('button[aria-label="Cerrar"]'); await pause(300);
  const p = await point('.chip');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p }); await pause(70);
  assert(await evaluate(`document.querySelector('.chip .liquid-ripple') !== null`), 'press ripple');
  assert.equal(parseFloat(await evaluate(`document.querySelector('.chip').style.getPropertyValue('--sx')`)), .996, 'subtle press squash');
  const wave = await evaluate(`(() => {const n=document.querySelector('.chip'),w=n.querySelector('.liquid-ripple');return {size:parseFloat(w.style.width),limit:Math.min(n.offsetWidth,n.offsetHeight),opacity:parseFloat(getComputedStyle(w).opacity)}})()`);
  assert(wave.size <= wave.limit * .8 && wave.opacity <= .08, 'ripple size and opacity');
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p }); await pause(80);
  const releaseScale = parseFloat(await evaluate(`document.querySelector('.chip').style.getPropertyValue('--sx')`));
  assert(releaseScale > 1 && releaseScale <= 1.003, 'subtle release overshoot');
  await pause(210);
  assert.equal(parseFloat(await evaluate(`getComputedStyle(document.querySelector('.chip')).getPropertyValue('--sx')`)), 1, 'release settled before 300 ms');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await pause(120);
  await move('.chip');
  assert.equal(await evaluate(`document.querySelectorAll('.liquid-hover,.liquid-ripple').length`), 0, 'reduced motion resets effects');
  const quiet = await evaluate(`({name:getComputedStyle(document.querySelector('.blob')).animationName,duration:getComputedStyle(document.querySelector('.blob')).animationDuration,count:document.querySelectorAll('.blob').length})`);
  assert.equal(quiet.name, 'liquid-drift-quiet'); assert.equal(quiet.duration, '180s'); assert.equal(quiet.count, 6);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = await point('.chip');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] }); await pause(60);
  assert(await evaluate(`document.querySelector('.chip .liquid-ripple') !== null`), 'touch ripple');
  assert.equal(await evaluate(`document.querySelectorAll('.liquid-hover').length`), 0, 'touch has no hover');
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await move('main .btn');
  const performanceSample = await evaluate(`new Promise(resolve => {
    const times=[]; let last=performance.now(); const node=document.querySelector('main .btn');
    const r=node.getBoundingClientRect();
    function sample(now){
      times.push(now-last);last=now;
      node.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+r.width*(.5+.3*Math.sin(times.length/8)),clientY:r.top+r.height/2}));
      if(times.length<120)requestAnimationFrame(sample);
      else {const sorted=times.slice(5).sort((a,b)=>a-b);resolve({fps:Math.round(1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length)),p95ms:Math.round(sorted[Math.floor(sorted.length*.95)]),frames:sorted.length});}
    }requestAnimationFrame(sample);
  })`);
  console.log('Headless frame sample (not a hardware guarantee)', performanceSample);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1420, y: 980 }); await pause(1500);
  assert.equal(await evaluate(`document.querySelectorAll('.liquid-water').length`), 0, 'refraction settles on exit');
  await click('a[href="/reportes"]'); await pause(500);
  assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'Reportes');
  assert.equal(await evaluate(`document.querySelector('[aria-label="Ventas registradas"] .text-2xl').textContent`), '47');
  await evaluate(`const select=document.querySelector('[aria-label="Filtros del reporte"] select');select.value='Pagada';select.dispatchEvent(new Event('change',{bubbles:true}))`);
  await pause(150);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Ventas registradas"] .text-2xl').textContent`), '31');
  assert.equal(await evaluate(`document.querySelector('main .btn').disabled`), false, 'CSV export enabled');
  await click('[aria-label="Filtros del reporte"] .chip'); await pause(150);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Ventas registradas"] .text-2xl').textContent`), '47');
  console.log('PASS Reportes navigation, totals, filter and reset');
  // Exercise the fallback gate; actual Safari/Firefox still require device testing.
  await send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 Firefox/143.0' });
  await send('Page.reload'); await pause(1100);
  assert.equal(await evaluate(`document.documentElement.classList.contains('liquid-refraction')`), false, 'fallback disables SVG');
  await hoverCheck('form .btn');
  assert.deepEqual(errors, [], 'no runtime exceptions');
  console.log('PASS sidebar, pagination, modal, SVG, press/release, reduced motion, six blobs, touch; no runtime exceptions');
  await send('Browser.close');
} finally {
  socket?.close(); browser.kill();
  await pause(500);
  assert(profile.startsWith(join(tmpdir(), 'ke-liquid-')), 'cleanup limited to generated test profile');
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
