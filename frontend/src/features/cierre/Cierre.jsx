import { useState } from 'react';
import { Banknote, ArrowLeftRight, Wallet, Receipt, RefreshCw, CalendarDays, ArrowDownLeft, ArrowUpRight, CreditCard } from 'lucide-react';
import { useCierre } from '../../services/cierreService';
import { cop } from '../../utils/format';
import DetalleCierre from './DetalleCierre';

function today() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const dayLabel = value => new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeZone: 'America/Bogota' }).format(new Date(`${value}T12:00:00-05:00`));
const paymentIcon = name => /efectivo/i.test(name) ? Banknote : /transfer/i.test(name) ? ArrowLeftRight : /cr[eé]dito|tarjeta/i.test(name) ? CreditCard : Wallet;

export default function Cierre() {
  const [fecha, setFecha] = useState(today);
  const [detalle, setDetalle] = useState(null);
  const actual = today();
  const yesterday = new Date(Date.parse(`${actual}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const result = useCierre(fecha);
  const { data: groups = [], resumen, meta } = result.data || {};
  const totalMagnitude = groups.filter(g => !g.es_credito).reduce((sum, g) => sum + Math.abs(g.total), 0);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><div className="flex items-center gap-2 text-sm mb-1" style={{ color: 'var(--g)' }}><Wallet size={17} /> Resumen diario</div><h1 className="text-2xl font-bold">Cierre</h1><p style={{ color: 'var(--mut)' }}>Cada forma de pago, en un solo lugar.</p></div>
      <button data-liquid className="btn" disabled={result.isFetching} onClick={() => result.refetch()}><RefreshCw size={17} className={result.isFetching ? 'animate-spin' : ''} />{result.isFetching ? 'Consultando…' : 'Actualizar'}</button>
    </div>

    <section data-liquid className="glass p-4 flex flex-wrap items-center justify-between gap-4" aria-label="Día del cierre">
      <div className="flex items-center gap-3"><div className="cierre-icon"><CalendarDays size={22} /></div><div><p className="text-xs uppercase tracking-wider" style={{ color: 'var(--mut)' }}>Día seleccionado</p><p className="font-semibold capitalize">{dayLabel(fecha)}</p></div></div>
      <div className="flex flex-wrap items-center gap-2">
        <button data-liquid className={`chip ${fecha === actual ? 'on' : ''}`} onClick={() => setFecha(actual)}>Hoy</button>
        <button data-liquid className={`chip ${fecha === yesterday ? 'on' : ''}`} onClick={() => setFecha(yesterday)}>Ayer</button>
        <label className="sr-only" htmlFor="cierre-fecha">Consultar otro día</label><input id="cierre-fecha" className="inp plain" style={{ width: 'auto' }} type="date" max={actual} value={fecha} onChange={e => { if (e.target.value && e.target.value <= actual) setFecha(e.target.value); }} />
      </div>
    </section>

    {result.isPending && <div className="grid gap-4 md:grid-cols-3" role="status" aria-label="Cargando cierre">{[0, 1, 2].map(i => <div key={i} className="glass p-6 animate-pulse"><div className="h-4 rounded bg-green-100 w-1/2 mb-4" /><div className="h-10 rounded bg-green-100" /></div>)}</div>}
    {result.isError && <div className="glass p-6" role="alert"><h2 className="font-semibold">No se pudo consultar el cierre</h2><p className="my-3">{result.error.message}</p><button className="btn" onClick={() => result.refetch()}>Reintentar</button></div>}

    {resumen && <>
      {meta.incompleto && <div className="glass p-4" role="alert" style={{ borderColor: '#d6ab5e' }}>Hay {resumen.sin_pago} operaciones sin pagos y {resumen.pagos_sin_monto} pagos sin importe. Los totales incluyen solo los importes disponibles; revisa estos registros en el POS.</div>}
      <div className="grid gap-4 md:grid-cols-3">
        <section data-liquid className="glass p-6 cierre-highlight"><div className="flex items-center justify-between mb-4"><span className="text-sm font-medium">Recaudo neto</span><Wallet size={22} /></div><p className="text-3xl font-bold tracking-tight break-words">{cop(resumen.neto)}</p><p className="text-sm mt-2 opacity-80">Ingresos menos salidas · sin crédito</p></section>
        <section data-liquid className="glass p-6"><div className="flex items-center justify-between mb-4"><span className="text-sm" style={{ color: 'var(--mut)' }}>Operaciones del día</span><Receipt size={22} style={{ color: 'var(--g)' }} /></div><p className="text-3xl font-bold">{resumen.operaciones}</p><p className="text-sm mt-2" style={{ color: 'var(--mut)' }}>{resumen.ventas} ventas · {resumen.abonos} abonos · {resumen.devoluciones} devoluciones</p></section>
        <section data-liquid className="glass p-6"><div className="flex items-center justify-between mb-4"><span className="text-sm" style={{ color: 'var(--mut)' }}>Movimiento de dinero</span><ArrowLeftRight size={22} style={{ color: 'var(--g)' }} /></div><div className="flex justify-between gap-2 mb-2"><span className="flex items-center gap-1 text-sm"><ArrowDownLeft size={16} />Ingresos</span><b>{cop(resumen.ingresos)}</b></div><div className="flex justify-between gap-2"><span className="flex items-center gap-1 text-sm"><ArrowUpRight size={16} />Salidas</span><b>{cop(resumen.egresos)}</b></div></section>
      </div>

      <section className="space-y-3"><div className="flex flex-wrap justify-between items-end gap-2"><h2 className="text-lg font-semibold">Desglose por forma de pago</h2><span className="text-sm" style={{ color: 'var(--mut)' }}>{groups.length} formas de pago</span></div>
        {!groups.length ? <div className="glass p-10 text-center"><Wallet size={32} className="mx-auto mb-3" style={{ color: 'var(--g)' }} /><h3 className="font-semibold">No hay pagos para este día</h3><p className="mt-2 text-sm" style={{ color: 'var(--mut)' }}>Selecciona otra fecha para consultar su cierre.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{groups.map(group => {
          const Icon = paymentIcon(group.forma_pago);
          const share = totalMagnitude && !group.es_credito ? Math.round(Math.abs(group.total) / totalMagnitude * 100) : 0;
          return <article key={group.forma_pago} data-liquid className="glass p-5 cierre-payment-card" role="button" tabIndex={0} aria-haspopup="dialog" aria-label={`Ver detalle de ${group.forma_pago}`} onClick={() => setDetalle({ fecha, forma: group.forma_pago })} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetalle({ fecha, forma: group.forma_pago }); } }}>
            <div className="flex items-center justify-between gap-2 mb-5"><div className="flex items-center gap-3"><div className="cierre-icon"><Icon size={22} /></div><h3 className="font-semibold">{group.forma_pago}</h3></div>{group.es_credito && <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Sin recaudo</span>}</div>
            <p className="text-2xl font-bold tracking-tight">{cop(group.total)}</p><p className="text-sm mt-1" style={{ color: 'var(--mut)' }}>{group.cantidad} {group.cantidad === 1 ? 'operación' : 'operaciones'} · {group.pagos} {group.pagos === 1 ? 'pago registrado' : 'pagos registrados'}</p>
            <div className="flex justify-between gap-3 text-xs mt-5 pt-3" style={{ borderTop: '1px solid rgba(22,101,52,.12)', color: 'var(--mut)' }}><span>Ingresos <b>{cop(group.ingresos)}</b></span><span>Salidas <b>{cop(group.egresos)}</b></span></div>
            {group.es_credito ? <p className="text-xs mt-3" style={{ color: '#92400e' }}>El crédito no se suma al recaudo neto.</p> : <><div className="h-1.5 rounded-full mt-4 overflow-hidden" style={{ background: 'rgba(22,101,52,.08)' }}><div className="h-full rounded-full" style={{ width: `${share}%`, background: 'linear-gradient(90deg,#16834a,#7bd9a3)' }} /></div><p className="text-xs mt-1" style={{ color: 'var(--mut)' }}>{share}% del movimiento neto absoluto</p></>}
            {group.sin_monto > 0 && <p className="text-xs mt-2" style={{ color: '#92400e' }}>{group.sin_monto} pagos sin importe disponible</p>}
            <p className="text-sm font-semibold mt-4" style={{ color: 'var(--g)' }}>Ver operaciones →</p>
          </article>;
        })}</div>}
      </section>
    </>}
    {detalle && <DetalleCierre key={`${detalle.fecha}:${detalle.forma}`} {...detalle} onClose={() => setDetalle(null)} />}
  </div>;
}
