import test from "node:test";
import assert from "node:assert/strict";
import { generarReporte, reporteCSV } from "../src/features/reportes/reportData.js";

const ventas = [
  { id: "V-1", fechaISO: "2026-10-01", cliente: 'Ana "López"', total: 100, estado: "Pagada" },
  { id: "V-2", fechaISO: "2026-10-01", cliente: "Luis", total: 50, estado: "Pendiente" },
  { id: "V-3", fechaISO: "2026-10-02", cliente: "Luz", total: 200, estado: "Cancelada" },
  { id: "V-4", fechaISO: "2026-10-02", cliente: "=SUM(A1)", total: 300, estado: "Pagada" },
];

test("separa cobros, pendientes y cancelaciones; promedio solo de pagadas", () => {
  const { resumen, dias } = generarReporte(ventas);
  assert.deepEqual(resumen, { cantidad: 4, cobrado: 400, pendiente: 50, cancelado: 200, pagadas: 2, ticket: 200 });
  assert.deepEqual(dias.map(d => d.fecha), ["2026-10-02", "2026-10-01"]);
  assert.equal(dias.reduce((s, d) => s + d.cobrado, 0), resumen.cobrado);
});

test("incluye ambos extremos de fecha y combina filtro de estado", () => {
  const resultado = generarReporte(ventas, { desde: "2026-10-01", hasta: "2026-10-01", estado: "Pendiente" });
  assert.deepEqual(resultado.filtradas.map(v => v.id), ["V-2"]);
  assert.equal(resultado.resumen.ticket, 0);
  assert.equal(generarReporte(ventas, { desde: "2026-10-03" }).resumen.cantidad, 0);
  assert.equal(generarReporte(ventas, { desde: "2026-10-03", hasta: "2026-10-01" }).dias.length, 0);
});

test("CSV incluye solo las filas filtradas y escapa texto para hojas de cálculo", () => {
  const csv = reporteCSV(generarReporte(ventas, { estado: "Pagada" }).filtradas);
  assert(csv.startsWith('\uFEFF"Código";"Cliente"'));
  assert.equal(csv.split("\r\n").length, 3);
  assert(csv.includes('"Ana ""López"""'));
  assert(csv.includes('"\'=SUM(A1)"'));
  assert(!csv.includes('"V-2"'));
});
