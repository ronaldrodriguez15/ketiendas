export function generarReporte(ventas, { desde = "", hasta = "", estado = "Todas" } = {}) {
  const filtradas = ventas.filter((venta) => (!desde || venta.fechaISO >= desde)
    && (!hasta || venta.fechaISO <= hasta) && (estado === "Todas" || venta.estado === estado));
  const resumen = { cantidad: filtradas.length, cobrado: 0, pendiente: 0, cancelado: 0, pagadas: 0, ticket: 0 };
  const dias = new Map();
  for (const venta of filtradas) {
    if (!dias.has(venta.fechaISO)) dias.set(venta.fechaISO, { fecha: venta.fechaISO, cantidad: 0, cobrado: 0, pendiente: 0, cancelado: 0 });
    const dia = dias.get(venta.fechaISO);
    dia.cantidad++;
    const campo = { Pagada: "cobrado", Pendiente: "pendiente", Cancelada: "cancelado" }[venta.estado];
    if (campo) { resumen[campo] += venta.total; dia[campo] += venta.total; }
    if (venta.estado === "Pagada") resumen.pagadas++;
  }
  resumen.ticket = resumen.pagadas ? resumen.cobrado / resumen.pagadas : 0;
  return { filtradas, resumen, dias: [...dias.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)) };
}

export function reporteCSV(ventas) {
  const celda = (valor) => {
    const texto = String(valor);
    const seguro = /^[=+\-@\t\r\n]/.test(texto) ? `'${texto}` : texto;
    return `"${seguro.replaceAll('"', '""')}"`;
  };
  const filas = [["Código", "Cliente", "Fecha", "Total COP", "Estado"],
    ...ventas.map((venta) => [venta.id, venta.cliente, venta.fechaISO, venta.total, venta.estado])];
  return "\uFEFF" + filas.map((fila) => fila.map(celda).join(";")).join("\r\n");
}
