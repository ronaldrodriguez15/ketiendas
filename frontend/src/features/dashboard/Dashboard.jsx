import DataValue from '../../components/ui/DataValue';
import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DollarSign, Receipt, Wallet, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resumenVentasQuery } from '../../services/ventasService';
const SalesCharts = lazy(() => import('./SalesCharts'));
const SalesEvolution = lazy(() => import('./SalesEvolution'));
const ChartLoading = () => <div style={{ minHeight: 300 }} role="status" className="animate-pulse rounded-2xl bg-green-50/60 p-5">Cargando gráficos…</div>;
import Badge from '../../components/ui/Badge';
import { cop } from '../../utils/format';
import { todayBogota, shiftDate, shortDate, salesLink } from '../../utils/salesDates';

export default function Dashboard() {
  const { user } = useAuth();
  const today = todayBogota();
  const [period, setPeriod] = useState('mes');
  const filters = { desde: period === 'mes' ? `${today.slice(0, 7)}-01` : shiftDate(today, -6), hasta: today };
  const result = useQuery(resumenVentasQuery(filters));
  const { resumen, dias = [], ultimas = [], creditos = [], meta } = result.data || {};
  const stats = resumen ? [
    { t: 'Ventas del periodo', v: cop(resumen.total_ventas), c: 'Pagadas y a crédito', i: DollarSign },
    { t: 'Número de ventas', v: resumen.cantidad_ventas, c: 'Sin abonos, devoluciones ni anuladas', i: Receipt },
    { t: 'Ventas a crédito', v: cop(resumen.total_credito), c: `${resumen.cantidad_credito} ventas · total original, no saldo`, i: Wallet },
  ] : [];
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">Hola, {user.nombre.split(' ')[0]}</h1><p style={{ color: 'var(--mut)' }}>Resumen de las ventas reales de tu tienda.</p></div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">{[['mes', 'Este mes'], ['semana', 'Últimos 7 días']].map(([value, label]) => <button key={value} className={`chip ${period === value ? 'on' : ''}`} onClick={() => setPeriod(value)}>{label}</button>)}</div>
      <button className="btn" disabled={result.isFetching} onClick={() => result.refetch()}><RefreshCw size={17} className={result.isFetching ? 'animate-spin' : ''} />{result.isFetching ? 'Consultando…' : 'Actualizar'}</button>
    </div>
    <p className="text-sm" style={{ color: 'var(--mut)' }}>{shortDate(filters.desde)} – {shortDate(filters.hasta)}</p>
    {result.isPending && <div className="glass p-5" role="status">Cargando resumen de ventas…</div>}
    {result.isError && <div className="glass p-5" role="alert">{result.error.message} <button className="chip" onClick={() => result.refetch()}>Reintentar</button></div>}
    {meta?.parcial && <p role="alert" className="glass p-4">Resumen parcial: no se pudieron consultar {meta.dias_fallidos.length} días. Los importes incluyen únicamente los días disponibles. <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
    {resumen && <>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))' }}>{stats.map(stat => <div key={stat.t} data-liquid className="glass hov p-5">
        <div className="flex items-center justify-between gap-2 mb-3"><span className="text-sm" style={{ color: 'var(--mut)' }}>{stat.t}</span><stat.i size={20} style={{ color: 'var(--g)' }} /></div>
        <div className="text-2xl font-bold">{stat.v}</div><div className="text-sm mt-1" style={{ color: 'var(--g)' }}>{stat.c}</div>
      </div>)}</div>
      <Suspense fallback={<ChartLoading />}><SalesCharts dias={dias} resumen={resumen} hasta={today} /></Suspense>
      <div className="grid gap-4 lg:grid-cols-3">
        <section data-liquid className="glass p-5 lg:col-span-2 min-w-0">
          <h2 className="font-semibold mb-1">Evolución de las ventas</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--mut)' }}>Identifica picos de venta y cómo cambia el crédito a lo largo del periodo.</p>
          <Suspense fallback={<ChartLoading />}><SalesEvolution dias={dias} /></Suspense>
          <p className="text-xs" style={{ color: 'var(--mut)' }}>Verde: total de ventas · Ámbar: ventas a crédito, incluidas en el total.</p>
        </section>
        <section data-liquid className="glass p-5 min-w-0">
          <h2 className="font-semibold mb-3">Últimas ventas</h2>
          {!ultimas.length && <p>No hay ventas en el periodo consultado.</p>}
          <div className="space-y-3">{ultimas.map(sale => <div key={sale.id} className="flex items-center justify-between gap-2"><div><div className="text-sm font-medium"><DataValue value={sale.cliente} /></div><div className="text-xs" style={{ color: 'var(--mut)' }}>#{sale.id} · {shortDate(sale.fecha)}</div><Badge estado={sale.estado} /></div><div className="text-sm font-semibold"><DataValue value={sale.total == null ? null : cop(sale.total)} /></div></div>)}</div>
          <Link className="chip inline-block mt-4" to={salesLink(filters)}>Ver ventas del periodo</Link>
        </section>
      </div>
      <section className="glass p-4">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-3"><h2 className="font-semibold">Ventas a crédito del periodo</h2><Link className="chip" to={salesLink({ ...filters, estado: 'A crédito' })}>Ver todas ({resumen.cantidad_credito})</Link></div>
        <p className="text-sm mb-3" style={{ color: 'var(--mut)' }}>Total original de cada venta con crédito; puede incluir otros medios de pago. No equivale a la deuda actual.</p>
        {creditos.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr><th>Venta</th><th>Cliente</th><th>Fecha</th><th>Total de la venta</th></tr></thead><tbody>{creditos.map(sale => <tr key={sale.id}><td>#{sale.id}</td><td><DataValue value={sale.cliente} /></td><td>{shortDate(sale.fecha)}</td><td className="font-semibold"><DataValue value={sale.total == null ? null : cop(sale.total)} /></td></tr>)}</tbody></table></div> : <p>No hay ventas a crédito en los días consultados.</p>}
      </section>
    </>}
  </div>;
}
