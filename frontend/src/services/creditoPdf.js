import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { cop } from '../utils/format.js';
import { shortDate, saleAge, todayBogota } from '../utils/salesDates.js';

// Fetch every page, not just the ten rows visible in the detail dialog.
export async function collectCreditDetails(requestPage) {
  const rows = [], seen = new Set();
  let summary;
  for (let page = 1; ; page++) {
    const result = await requestPage(page);
    if (!Array.isArray(result.data) || !result.resumen || !result.meta || result.meta.parcial) throw new Error('No se pudo obtener el detalle completo del crédito.');
    summary ??= result.resumen;
    if (result.meta.total !== summary.cantidad || result.resumen.total_credito !== summary.total_credito || result.resumen.total_ventas !== summary.total_ventas) throw new Error('Los créditos cambiaron durante la descarga. Intenta nuevamente.');
    for (const row of result.data) {
      if (seen.has(row.id)) throw new Error('El detalle contiene ventas repetidas. Intenta nuevamente.');
      seen.add(row.id); rows.push(row);
    }
    if (!result.meta.has_more) break;
    if (!result.data.length || rows.length >= 10000) throw new Error('El detalle es demasiado grande. Selecciona un periodo menor.');
  }
  if (rows.length !== summary.cantidad) throw new Error('Faltan ventas en el detalle. Intenta nuevamente.');
  return { summary, rows };
}

export async function loadCreditLogo() {
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}logo.webp`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export function createCreditPdf({ summary, rows }, filters, logo, generated = new Date()) {
  const doc = new jsPDF();
  const green = [22, 101, 52], ink = [20, 48, 31], muted = [87, 105, 94];
  const money = value => value == null ? 'Sin información' : cop(value).replace(/\s/g, ' ');
  const text = (value, x, y, size = 10, color = ink, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    doc.text(Array.isArray(value) ? value : String(value), x, y);
  };
  doc.setProperties({ title: `Detalle de créditos - ${summary.nombre}`, author: 'Ké Tiendas', subject: 'Créditos del periodo seleccionado' });
  doc.setFillColor(...green); doc.rect(0, 0, 210, 48, 'F');
  doc.setFillColor(255, 255, 255); doc.roundedRect(15, 10, 28, 28, 5, 5, 'F');
  doc.addImage(logo, 'PNG', 17, 12, 24, 24);
  text('Ké Tiendas', 49, 21, 20, [255, 255, 255], true);
  text('DETALLE DE CRÉDITOS', 49, 31, 10, [220, 252, 231]);
  text('Ventas con más de 60 días de antigüedad', 49, 39, 9, [220, 252, 231]);
  text('CLIENTE', 15, 59, 8, muted, true);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
  const name = doc.splitTextToSize(summary.nombre || 'Sin cliente identificado', 180);
  text(name, 15, 68, 17, ink, true);
  let y = 70 + name.length * 7;
  text(summary.cliente_id ? `Cliente #${summary.cliente_id}` : 'Sin cliente identificado', 15, y, 9, muted);
  text(`Periodo: ${shortDate(filters.desde)} al ${shortDate(filters.hasta)}`, 15, y + 7, 10);
  text(`Emitido: ${new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }).format(generated)} · Bogotá`, 15, y + 14, 8, muted);
  y += 23;
  const cards = [['VENTAS DEL PERIODO', money(summary.total_ventas)], ['CRÉDITO ORIGINAL', money(summary.total_credito)], ['SALDO ACTUAL · CUENTA', money(summary.saldo_actual)]];
  cards.forEach(([label, value], index) => {
    const x = 15 + index * 62;
    doc.setFillColor(239, 248, 242); doc.roundedRect(x, y, 58, 25, 3, 3, 'F');
    text(label, x + 4, y + 8, 7, muted, true);
    text(value, x + 4, y + 18, value.length > 16 ? 10 : 13, green, true);
  });
  y += 36;
  text(`Detalle de ventas (${rows.length})`, 15, y, 12, ink, true);
  const today = todayBogota();
  autoTable(doc, {
    startY: y + 5, margin: { left: 15, right: 15, top: 20, bottom: 23 },
    head: [['Venta', 'Fecha', 'Antigüedad', 'Total venta', 'Crédito original']],
    body: rows.map(row => [`#${row.id}`, shortDate(row.fecha), `${saleAge(row.fecha, today)} días`, money(row.total), money(row.credito_original)]),
    theme: 'plain', styles: { font: 'helvetica', fontSize: 9, cellPadding: 4, textColor: ink, overflow: 'linebreak' },
    headStyles: { fillColor: green, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 249, 246] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    rowPageBreak: 'avoid',
  });
  y = doc.lastAutoTable.finalY + 12;
  if (y > 242) { doc.addPage(); y = 25; }
  text('Información sobre los importes', 15, y, 10, green, true);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...muted);
  doc.text(doc.splitTextToSize('El crédito original corresponde a las ventas del periodo y no descuenta abonos. El saldo actual es el de toda la cuenta en el POS, incluidos otros periodos y abonos; un saldo negativo indica saldo a favor. Este documento es informativo y no reemplaza una factura ni un comprobante de pago.', 180), 15, y + 7);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(218, 232, 222); doc.line(15, 278, 195, 278);
    text('Ké Tiendas · Detalle de créditos · COP', 15, 285, 8, muted);
    text(`${page} / ${pages}`, 180, 285, 8, muted);
    if (page > 1) text('Ké Tiendas / Créditos', 15, 12, 8, green, true);
  }
  return doc;
}
