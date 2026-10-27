import DataValue from '../../components/ui/DataValue';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Badge from '../../components/ui/Badge';
import PageNavigation from '../../components/ui/PageNavigation';
import { shiftDate } from '../../utils/salesDates';
import { ventasQuery } from '../../services/ventasService';
import { cop } from '../../utils/format';
const STATES = ['Todas', 'Pagada', 'A crédito', 'Abono', 'Devolución', 'Anulada', 'Suspendida'];
const dateFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
function range(label) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find(p => p.type === type).value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  const shift = (n) => new Date(Date.parse(`${today}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  return { desde: label === 'Ayer' ? shift(-1) : label === '7 días' ? shift(-6) : label === 'Este mes' ? `${today.slice(0, 7)}-01` : today, hasta: label === 'Ayer' ? shift(-1) : today };
}
export default function Ventas() {
  const [params] = useSearchParams();
  return <Listado key={params.toString()} params={params} />;
}
function Listado({ params }) {
  const [q, setQ] = useState(() => (params.get('q') || '').slice(0, 60));
  const [filters, setFilters] = useState(() => ({ ...range('7 días'),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(params.get('desde') || '') ? { desde: params.get('desde') } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(params.get('hasta') || '') ? { hasta: params.get('hasta') } : {}),
    q: (params.get('q') || '').slice(0, 60), estado: STATES.includes(params.get('estado')) && params.get('estado') !== 'Todas' ? params.get('estado') : '', page: 1, per_page: 10 }));
  const change = (values) => setFilters(old => ({ ...old, ...values, page: 1 }));
  useEffect(() => {
    const timer = setTimeout(() => setFilters(old => old.q === q.trim() ? old : { ...old, q: q.trim(), page: 1 }), 400);
    return () => clearTimeout(timer);
  }, [q]);
  const days = (Date.parse(filters.hasta) - Date.parse(filters.desde)) / 86400000 + 1;
  const valid = Boolean(filters.desde && filters.hasta && days >= 1 && days <= 31);
  const result = useQuery({ ...ventasQuery(filters), enabled: valid, placeholderData: keepPreviousData });
  const { data, meta } = result.data || { data: [], meta: null };
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">Ventas</h1><p style={{ color: 'var(--mut)' }}>{meta?.total_cobrado == null ? 'Cobrado en esta página: ' : 'Cobrado en el rango: '}<b style={{ color: 'var(--g)' }}>{meta ? cop(meta.total_cobrado ?? meta.cobrado_pagina) : '—'}</b></p></div>
    <div data-liquid className="glass p-4">
      <div className="flex flex-wrap gap-2 mb-3">
        {['Hoy', 'Ayer', '7 días', 'Este mes'].map(label => <button key={label} data-liquid className={`chip ${filters.desde === range(label).desde && filters.hasta === range(label).hasta ? "on" : ""}`} onClick={() => change(range(label))}>{label}</button>)}
        <label>Desde <input className="inp plain" type="date" min={filters.hasta ? shiftDate(filters.hasta, -30) : undefined} max={filters.hasta || undefined} value={filters.desde} onChange={e => change({ desde: e.target.value })} /></label>
        <label>Hasta <input className="inp plain" type="date" min={filters.desde || undefined} max={filters.desde ? shiftDate(filters.desde, 30) : undefined} value={filters.hasta} onChange={e => change({ hasta: e.target.value })} /></label>
      </div>
      {!valid && <p role="alert">Selecciona un rango válido de máximo 31 días.</p>}
      <input className="inp plain mb-3" aria-label="Buscar por cliente o código" placeholder="Buscar por cliente o código" maxLength={60} value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex gap-2 flex-wrap mb-3">{STATES.map(state => <button key={state} data-liquid className={`chip ${(filters.estado || 'Todas') === state ? 'on' : ''}`} onClick={() => change({ estado: state === 'Todas' ? '' : state })}>{state}</button>)}</div>
      {result.isError && <div role="alert">{result.error.message} <button className="btn" disabled={!valid} onClick={() => result.refetch()}>Reintentar</button></div>}
      <div role="status">{result.isFetching && !result.isPending ? 'Actualizando ventas…' : ''}</div>
      <div className="overflow-x-auto" aria-busy={result.isFetching}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead><tr>{['Código', 'Cliente', 'Fecha', 'Forma de pago', 'Total', 'Estado'].map(title => <th key={title}>{title}</th>)}</tr></thead>
          <tbody>{result.isPending && valid ? Array.from({ length: filters.per_page }, (_, i) => <tr key={i} aria-hidden="true">{Array.from({ length: 6 }, (_, j) => <td key={j}><div className="animate-pulse rounded h-5 my-2" style={{ background: 'rgba(22,163,74,.12)' }} /></td>)}</tr>) : data.map(sale => <tr key={sale.id}>
            <td className="font-medium">#{sale.id}</td><td><DataValue value={sale.cliente} /></td><td>{dateFormat.format(new Date(sale.fecha))}</td><td>{sale.forma_pago || '—'}</td><td className="font-semibold"><DataValue value={sale.total == null ? null : cop(sale.total)} /></td><td><Badge estado={sale.estado} /></td>
          </tr>)}</tbody>
        </table>
        {!result.isPending && !result.isError && !data.length && <p className="text-center py-10">No hay ventas en este rango. Prueba con otras fechas.</p>}
      </div>
      {meta && <PageNavigation page={meta.page} perPage={meta.per_page} total={meta.total} hasMore={meta.has_more} count={data.length} busy={!valid || result.isFetching || result.isPlaceholderData} onPage={page => setFilters(old => ({ ...old, page }))} onSize={per_page => change({ per_page })} />}
    </div>
  </div>;
}
