import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search } from 'lucide-react';
import { http } from '../../services/http';
import PageNavigation from '../../components/ui/PageNavigation';
import { todayBogota, shiftDate, shortDate } from '../../utils/salesDates';
import { cop } from '../../utils/format';

const columns = [
  ['person_id', 'Id. de la persona'], ['cliente', 'Cliente'], ['phone_number', 'Teléfono'],
  ['email', 'Correo electrónico'], ['address_1', 'Dirección 1'], ['address_2', 'Dirección 2'],
  ['city', 'Ciudad'], ['state', 'Estado/Provincia'], ['zip', 'C.P.'],
  ['subtotal', 'Total parcial', 'money'], ['total', 'Totales', 'money'], ['tax', 'Impuestos', 'money'],
  ['profit', 'Ganancia', 'money'], ['transactions', 'Número de transacciones'],
  ['average_receipt', 'Tamaño promedio del recibo', 'money'],
  ['average_quantity', 'Cantidad de artículos promedio por transacción', 'number'],
];
const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });
const value = (row, key, type) => row[key] == null || row[key] === '' ? '—' : type === 'money' ? cop(row[key]) : type === 'number' ? number.format(row[key]) : row[key];

export default function CustomerSalesReport() {
  const today = todayBogota();
  const [filters, setFilters] = useState({ desde: shiftDate(today, -29), hasta: today, page: 1, per_page: 20, q: '' });
  const [dates, setDates] = useState({ desde: filters.desde, hasta: filters.hasta });
  const [search, setSearch] = useState('');
  const [dateError, setDateError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setFilters(old => ({ ...old, q: search.trim(), page: 1 })), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const result = useQuery({ queryKey: ['customer-sales-report', filters], staleTime: 120_000, gcTime: 1_800_000,
    retry: false, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => http('/reportes/ventas-clientes?' + new URLSearchParams(filters), { signal }),
  });
  const { data = [], meta } = result.data || {};
  const applyDates = event => {
    event.preventDefault();
    if (!dates.desde || !dates.hasta || dates.hasta < dates.desde || dates.hasta > shiftDate(dates.desde, 30)) {
      setDateError('Selecciona un periodo válido de hasta 31 días.'); return;
    }
    setDateError(''); setFilters(old => ({ ...old, ...dates, page: 1 }));
  };
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Clientes</h1><p style={{ color: 'var(--mut)' }}>Informe de ventas por cliente</p></div>
      <button className="btn" disabled={result.isFetching} onClick={() => result.refetch()}><RefreshCw size={17} className={result.isFetching ? 'animate-spin' : ''} />Actualizar</button>
    </header>
    <section className="glass p-4">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <form onSubmit={applyDates} className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Desde<input required type="date" className="inp plain mt-1" value={dates.desde} onChange={e => setDates(old => ({ ...old, desde: e.target.value }))} /></label>
          <label className="text-sm">Hasta<input required type="date" className="inp plain mt-1" value={dates.hasta} onChange={e => setDates(old => ({ ...old, hasta: e.target.value }))} /></label>
          <button className="btn" type="submit">Consultar</button>
          <button className="chip" type="button" onClick={() => { const range = { desde: shiftDate(today, -29), hasta: today }; setDates(range); setDateError(''); setFilters(old => ({ ...old, ...range, page: 1 })); }}>Últimos 30 días</button>
        </form>
        <label className="text-sm flex-1 min-w-48">Buscar cliente<div className="relative mt-1"><Search size={17} className="absolute left-3 top-3" /><input className="inp" type="search" maxLength={60} placeholder="Nombre, teléfono o ID" value={search} onChange={e => setSearch(e.target.value)} /></div></label>
      </div>
      {dateError && <p role="alert" className="mb-3">{dateError}</p>}
      <p className="text-sm mb-2" style={{ color: 'var(--mut)' }}>Ventas del {shortDate(filters.desde)} al {shortDate(filters.hasta)} · {meta ? `${meta.total} clientes` : 'Consultando clientes'}</p>
      {meta && <p className="text-xs mb-2" style={{ color: 'var(--mut)' }}>Generado: {new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(meta.generado_en))}</p>}
      {meta && <p className="text-xs mb-2" style={{ color: 'var(--mut)' }}>Generado: {new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(new Date(meta.generado_en))}</p>}
      <p className="text-xs mb-4" style={{ color: 'var(--mut)' }}>Incluye ventas, devoluciones y abonos como el informe del POS; excluye anuladas y suspendidas. El promedio de artículos excluye servicios y abonos. Contacto de la venta más reciente del periodo. — indica información no disponible.</p>
      {result.isError && <p role="alert" className="mb-3">{result.error.message} <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
      {result.isFetching && <p role="status" className="mb-3">Cargando informe de clientes…</p>}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Informe de ventas por cliente" aria-busy={result.isFetching}>
        <table className="w-full"><caption className="sr-only">Ventas por cliente del periodo seleccionado</caption>
          <thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
          <tbody>{data.map(row => <tr key={row.person_id}>{columns.map(([key, , type]) => <td key={key} className={type || key === 'transactions' ? 'text-right tabular-nums' : key === 'cliente' ? 'font-medium' : ''}>{value(row, key, type)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {!result.isPending && !result.isError && !data.length && <p className="py-8 text-center">No hay ventas de clientes con estos filtros.</p>}
      {meta && <PageNavigation page={meta.page} perPage={meta.per_page} total={meta.total} hasMore={meta.has_more} count={data.length} busy={result.isFetching} sizes={[10, 20, 50, 100]} onPage={page => setFilters(old => ({ ...old, page }))} onSize={per_page => setFilters(old => ({ ...old, per_page, page: 1 }))} />}
    </section>
  </div>;
}
