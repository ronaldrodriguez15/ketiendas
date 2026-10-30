import test from 'node:test';
import assert from 'node:assert/strict';
import { collectCreditDetails, createCreditPdf } from '../src/services/creditoPdf.js';

const summary = { nombre: 'María López', cliente_id: 7, cantidad: 101, total_ventas: 101000, total_credito: 80800, saldo_actual: 70000 };
const rows = Array.from({ length: 101 }, (_, index) => ({ id: index + 1, fecha: '2026-08-01', total: 1000, credito_original: 800 }));
test('descarga todas las páginas del detalle', async () => {
  const pages = [];
  const result = await collectCreditDetails(async page => {
    pages.push(page);
    return { resumen: summary, data: rows.slice((page - 1) * 100, page * 100), meta: { total: 101, has_more: page === 1 } };
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(result.rows.length, 101);
});
test('rechaza detalles incompletos y ventas duplicadas', async () => {
  await assert.rejects(collectCreditDetails(async () => ({ resumen: summary, data: rows.slice(0, 10), meta: { total: 101, has_more: false } })), /Faltan ventas/);
  await assert.rejects(collectCreditDetails(async () => ({ resumen: { ...summary, cantidad: 2 }, data: [rows[0], rows[0]], meta: { total: 2, has_more: false } })), /repetidas/);
});
test('genera un PDF con varias páginas, importes desconocidos y todas las ventas', () => {
  const logo = { data: new Uint8ClampedArray([22, 101, 52, 255]), width: 1, height: 1 };
  const pdf = createCreditPdf({ summary: { ...summary, total_credito: null, saldo_actual: null }, rows }, { desde: '2026-08-01', hasta: '2026-08-31' }, logo);
  assert.ok(pdf.getNumberOfPages() > 1);
  const output = pdf.output();
  assert.ok(output.startsWith('%PDF-'));
  assert.ok(output.includes('#101'));
  assert.ok(output.includes('Sin informaci'));
  assert.ok(output.includes('/Subtype /Image'));
});
