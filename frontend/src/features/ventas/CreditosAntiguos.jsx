import DataValue from '../../components/ui/DataValue';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DetalleCredito from '../creditos/DetalleCredito';
import DescargarCredito from '../creditos/DescargarCredito';
import { ChevronLeft, ChevronRight, Eye, RefreshCw } from 'lucide-react';
import { creditosQuery } from '../../services/creditosService';
import PageNavigation from '../../components/ui/PageNavigation';
import { cop } from '../../utils/format';
import { todayBogota, shiftDate, shortDate } from '../../utils/salesDates';

export default function CreditosAntiguos() {
  const [selected, setSelected] = useState(null);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const today = todayBogota();
  const cutoff = shiftDate(today, -61);
  const [end, setEnd] = useState(cutoff);
  const [page, setPage] = useState(1);
  const hasta = end > cutoff ? cutoff : end;
  const desde = shiftDate(hasta, -30);
  const filters = { desde, hasta, page, per_page: perPage, q: query };
  const result = useQuery(creditosQuery(filters));
  const { data = [], meta } = result.data || {};
  const move = value => { setEnd(value); setPage(1); };
  return <><section className="glass p-4" aria-label="Listado de créditos">
    <p className="text-sm" style={{ color: 'var(--mut)' }}>Totales por cliente del periodo. Abre el detalle para consultar sus créditos y el saldo actual de la cuenta.</p>
    <div className="flex flex-wrap items-center gap-2 my-3">
      <label className="text-sm">Buscar por nombre <input type="search" className="inp plain" placeholder="Nombre del cliente" maxLength={60} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <button type="button" className="chip flex items-center gap-1" onClick={() => move(shiftDate(hasta, -31))}><ChevronLeft size={16} /> Anteriores</button>
      <label className="text-sm">Periodo hasta <input type="date" className="inp plain" max={cutoff} value={hasta} onChange={event => { if (event.target.value && event.target.value <= cutoff) move(event.target.value); }} /></label>
      <button type="button" className="chip flex items-center gap-1 disabled:opacity-40" disabled={hasta === cutoff} onClick={() => move(shiftDate(hasta, 31) > cutoff ? cutoff : shiftDate(hasta, 31))}>Siguientes <ChevronRight size={16} /></button>
      <button type="button" className="btn sm:ml-auto" disabled={result.isFetching} onClick={() => result.refetch()}><RefreshCw size={17} />Actualizar</button>
    </div>
    <p className="text-xs mb-3" style={{ color: 'var(--mut)' }}>Ventas del {shortDate(desde)} al {shortDate(hasta)}. Usa «Anteriores» para revisar créditos más antiguos.</p>
    {result.isError && <p role="alert">{result.error.message} <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
    {meta?.parcial && <p role="alert">Revisión incompleta: faltan {meta.dias_fallidos.length} días. <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
    <div className="overflow-x-auto" aria-busy={result.isFetching}>
      {result.isFetching && <p role="status" className="text-sm py-2">Cargando créditos...</p>}
      <table className="w-full" style={{ borderCollapse: 'collapse' }}><caption className="sr-only">Créditos agrupados por cliente</caption><thead><tr><th>Cliente</th><th>Ventas</th><th>Primera venta</th><th>Total de ventas</th><th>Crédito original</th><th>Detalles</th></tr></thead><tbody>
{result.isPending ? Array.from({ length: perPage }, (_, i) => <tr key={i} aria-hidden="true">{Array.from({ length: 6 }, (_, j) => <td key={j}><div className="animate-pulse rounded h-5 my-2 bg-green-100" /></td>)}</tr>) : data.map(account => <tr key={account.id}><td className="font-medium"><DataValue value={account.nombre} /><p className="text-xs" style={{ color: 'var(--mut)' }}>{account.cliente_id ? '#' + account.cliente_id : 'Sin cliente identificado'}</p></td><td>{account.cantidad}</td><td>{shortDate(account.primera_venta)}</td><td className="font-semibold">{cop(account.total_ventas)}</td><td><DataValue value={account.total_credito == null ? null : cop(account.total_credito)} /></td><td><button type="button" className="chip" title="Ver detalles" aria-label={'Ver detalles de ' + account.nombre} aria-haspopup="dialog" onClick={() => setSelected(account)}><Eye size={18} /></button> <DescargarCredito account={account} filters={{ desde, hasta }} /></td></tr>)}
      </tbody></table>
    </div>
    {meta && !data.length && !result.isError && <p role="status">{meta.parcial ? 'No se encontraron créditos en los días disponibles.' : 'No hay créditos por revisar en este periodo.'}</p>}
    {meta && <PageNavigation page={meta.page} perPage={perPage} total={meta.total} hasMore={meta.has_more} count={data.length} busy={result.isFetching} sizes={[10, 25, 50]} onPage={setPage} onSize={value => { setPerPage(value); setPage(1); }} />}
  </section>
    {selected && <DetalleCredito account={selected} filters={{ desde, hasta }} onClose={() => setSelected(null)} />}
  </>;
}
