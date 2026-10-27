import { http } from './http';
import { shiftDate } from '../utils/salesDates';

export const exportColumns = {
  ventas: [['id', 'Venta'], ['cliente', 'Cliente'], ['fecha', 'Fecha'], ['forma_pago', 'Forma de pago'], ['total', 'Total', 'money'], ['estado', 'Estado']],
  dashboard: [['fecha', 'Fecha'], ['total', 'Ventas', 'money'], ['credito', 'Ventas a crédito', 'money']],
  cierre: [['fecha', 'Fecha'], ['forma_pago', 'Forma de pago'], ['cantidad', 'Operaciones'], ['pagos', 'Pagos'], ['ingresos', 'Ingresos', 'money'], ['egresos', 'Salidas', 'money'], ['total', 'Neto', 'money'], ['es_credito', 'Es crédito'], ['sin_monto', 'Pagos sin importe']],
  usuarios: [['id', 'ID'], ['nombre', 'Nombre'], ['email', 'Correo'], ['rol', 'Rol'], ['activo', 'Activo'], ['creado_en', 'Creado'], ['ultimo_acceso', 'Último acceso']],
  customers: [['person_id', 'ID'], ['first_name', 'Nombre'], ['last_name', 'Apellido'], ['company_name', 'Empresa'], ['email', 'Correo'], ['phone_number', 'Teléfono'], ['account_number', 'Cuenta'], ['balance', 'Saldo', 'money']],
};
exportColumns.suppliers = exportColumns.customers;

export async function collectExport(kind, filters, range, signal, progress) {
  let rows = [];
  const request = async (path, params) => {
    signal.throwIfAborted();
    const result = await http(`${path}?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}`, { signal });
    if (result.meta?.parcial || result.stale || result.meta?.stale) throw new Error('Los datos están incompletos o desactualizados. Actualiza antes de exportar.');
    return result;
  };
  if (kind === 'dashboard' || kind === 'cierre') {
    for (let day = range.desde; day <= range.hasta; day = shiftDate(day, 1)) {
      const result = kind === 'cierre' ? await request('/cierre', { fecha: day }) : await request('/ventas/resumen', { desde: day, hasta: day });
      if (result.meta?.incompleto) throw new Error(`El cierre del ${day} tiene importes incompletos. Revisa los pagos antes de exportar.`);
      rows.push(...(kind === 'cierre' ? result.data.map(row => ({ ...row, fecha: day })) : result.dias));
      progress(`${rows.length} registros preparados · ${day}`);
    }
  } else {
    const seen = new Set();
    for (let page = 1; ; page++) {
      const params = { ...filters, ...(kind === 'ventas' ? range : {}), page, per_page: kind === 'usuarios' ? 50 : 100 };
      const result = await request(`/${kind}`, params);
      const batch = result.data;
      if (!Array.isArray(batch)) throw new Error('La respuesta no contiene registros válidos.');
      for (const row of batch) {
        const id = row.id ?? row.person_id;
        if (seen.has(id)) throw new Error('Los registros cambiaron durante la exportación. Intenta de nuevo.');
        seen.add(id);
      }
      rows.push(...batch);
      progress(`${rows.length} registros preparados`);
      const meta = result.meta ?? result;
      const more = typeof meta.has_more === 'boolean' ? meta.has_more : page < meta.last_page;
      if (!more) break;
      if (!batch.length || rows.length >= 10000) throw new Error('La exportación es demasiado grande. Reduce el rango o aplica filtros (máximo 10.000 registros).');
      // Pace pagination to avoid exhausting the shared API rate limit.
      await new Promise(resolve => setTimeout(resolve, 1100));
      signal.throwIfAborted();
    }
  }
  if (kind === 'usuarios') rows = rows.filter(row => row.creado_en && new Date(row.creado_en) >= new Date(`${range.desde}T00:00:00-05:00`) && new Date(row.creado_en) <= new Date(`${range.hasta}T23:59:59.999-05:00`));
  return rows;
}

export async function saveExcel(kind, rows, range, signal) {
  const { default: ExcelJS } = await import('exceljs');
  signal.throwIfAborted();
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Registros');
  sheet.columns = exportColumns[kind].map(([key, header, type]) => ({ key, header, width: key.includes('fecha') ? 26 : 24, style: type === 'money' ? { numFmt: '"$"#,##0.00' } : {} }));
  rows.forEach(row => sheet.addRow(Object.fromEntries(exportColumns[kind].map(([key]) => [key, row[key] == null || row[key] === '' ? 'Sin información' : typeof row[key] === 'boolean' ? (row[key] ? 'Sí' : 'No') : row[key]]))));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: sheet.columns.length } };
  const info = book.addWorksheet('Información');
  info.addRows([['Módulo', kind], ['Desde', range?.desde ?? 'Directorio actual'], ['Hasta', range?.hasta ?? 'Directorio actual'], ['Registros', rows.length], ['Zona horaria', 'America/Bogota'], ['Generado', new Date().toISOString()]]);
  info.columns.forEach(column => { column.width = 28; });
  const buffer = await book.xlsx.writeBuffer();
  signal.throwIfAborted();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = `${kind}-${range ? `${range.desde}_${range.hasta}` : 'directorio'}.xlsx`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
