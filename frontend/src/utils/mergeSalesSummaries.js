export function mergeSalesSummaries(parts, filters) {
  const resumen = { total_ventas: 0, cantidad_ventas: 0, total_credito: 0, cantidad_credito: 0, total_cobrado: 0 };
  for (const part of parts) {
    if (part.meta.parcial) throw new Error('No se pudo completar el resumen del periodo. Intenta de nuevo.');
    for (const key of Object.keys(resumen)) resumen[key] += part.resumen[key];
  }
  resumen.ticket_promedio = resumen.cantidad_ventas ? Math.round(resumen.total_ventas / resumen.cantidad_ventas) : 0;
  const recent = key => parts.flatMap(part => part[key]).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).slice(0, 6);
  return { resumen, dias: parts.flatMap(part => part.dias).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    ultimas: recent('ultimas'), creditos: recent('creditos'),
    meta: { ...filters, parcial: false, dias_fallidos: [], generado_en: parts.at(-1)?.meta.generado_en } };
}
