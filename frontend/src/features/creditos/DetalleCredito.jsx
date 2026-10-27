import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Receipt, Wallet } from 'lucide-react';
import { detalleCreditoQuery } from '../../services/creditosService';
import DataValue from '../../components/ui/DataValue';
import PageNavigation from '../../components/ui/PageNavigation';
import { cop } from '../../utils/format';
import { shortDate, saleAge, todayBogota } from '../../utils/salesDates';

export default function DetalleCredito({ account, filters, onClose }) {
  const dialog = useRef(null);
  const [page, setPage] = useState(1);
  const result = useQuery(detalleCreditoQuery(account.id, { ...filters, page, per_page: 10 }));
  const { resumen, data = [], meta } = result.data || {};
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} className="cierre-dialog" aria-labelledby="credito-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="glass p-5 sm:p-7" style={{ background: 'linear-gradient(135deg,#f6fff9,#e5f6eb)' }}>
      <header className="flex justify-between items-start gap-4 mb-5"><div><p className="text-sm mb-1" style={{ color: 'var(--g)' }}>Detalle de créditos</p><h2 id="credito-title" className="text-2xl font-bold">{account.nombre}</h2><p className="text-sm mt-2" style={{ color: 'var(--mut)' }}>{shortDate(filters.desde)} al {shortDate(filters.hasta)}</p></div><button className="chip" aria-label="Cerrar detalle" onClick={onClose}><X size={20} /></button></header>
      {result.isError && <p role="alert" className="mb-4">{result.error.message} <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
      {resumen && <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <section className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(125deg,#14532d,#21824b)' }}><div className="flex justify-between mb-3"><span>Saldo actual de la cuenta</span><Wallet size={21} /></div><p className="text-3xl font-bold"><DataValue value={resumen.saldo_actual == null ? null : cop(resumen.saldo_actual)} /></p><p className="text-xs mt-3">Saldo del POS de todos los periodos, incluidos abonos. Un valor negativo es saldo a favor.</p></section>
        <section className="rounded-2xl bg-white/80 border border-green-900/10 p-5"><h3 className="flex gap-2 items-center font-semibold mb-3"><Receipt size={19} />Resumen del periodo</h3><p>{resumen.cantidad} ventas a crédito</p><p className="mt-2">Total de ventas: <b>{cop(resumen.total_ventas)}</b></p><p className="mt-2">Crédito original: <b><DataValue value={resumen.total_credito == null ? null : cop(resumen.total_credito)} /></b></p></section>
      </div>}
      <p className="text-sm mb-4" style={{ color: 'var(--mut)' }}>El crédito original no descuenta abonos y no equivale al saldo pendiente de cada venta.</p>
      {result.isFetching && <p role="status" className="mb-3">Cargando detalle...</p>}
      <div className="overflow-x-auto" aria-busy={result.isFetching}><table className="w-full" style={{ borderCollapse: 'collapse' }}><thead><tr><th>Venta</th><th>Fecha</th><th>Antigüedad</th><th>Total venta</th><th>Crédito original</th></tr></thead><tbody>{data.map(sale => <tr key={sale.id}><td>#{sale.id}</td><td>{shortDate(sale.fecha)}</td><td>{saleAge(sale.fecha, todayBogota())} días</td><td>{cop(sale.total)}</td><td><DataValue value={sale.credito_original == null ? null : cop(sale.credito_original)} /></td></tr>)}</tbody></table></div>
      {meta && <PageNavigation page={meta.page} perPage={10} total={meta.total} hasMore={meta.has_more} count={data.length} busy={result.isFetching} sizes={[10]} onPage={setPage} onSize={() => {}} />}
      <footer className="flex justify-end mt-5"><button className="btn" onClick={onClose}>Cerrar detalle</button></footer>
    </div>
  </dialog>, document.body);
}
