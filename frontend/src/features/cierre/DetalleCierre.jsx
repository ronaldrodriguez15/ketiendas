import DataValue from '../../components/ui/DataValue';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { X, Receipt } from 'lucide-react';
import { http } from '../../services/http';
import { cop } from '../../utils/format';
import Pagination from '../../components/ui/Pagination';
import Badge from '../../components/ui/Badge';

const hour = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
export default function DetalleCierre({ fecha, forma, onClose }) {
  const dialog = useRef(null);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const result = useQuery({ queryKey: ['cierre-detalle', fecha, forma, page, size],
    queryFn: ({ signal }) => http(`/cierre?${new URLSearchParams({ fecha, forma_pago: forma, page, per_page: size })}`, { signal }),
    staleTime: 30_000, placeholderData: keepPreviousData });
  const { data = [], meta } = result.data || {};
  return createPortal(<dialog ref={dialog} className="cierre-dialog" aria-labelledby="detalle-cierre-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="glass p-5 sm:p-7" style={{ background: 'linear-gradient(135deg,#f6fff9,#e5f6eb)' }}>
      <div className="flex items-start justify-between gap-4 mb-5"><div><div className="flex items-center gap-2 text-sm mb-1" style={{ color: 'var(--g)' }}><Receipt size={17} /> Detalle del cierre · {fecha}</div><h2 id="detalle-cierre-title" className="text-2xl font-bold">{forma}</h2></div><button type="button" className="chip" aria-label="Cerrar detalle" onClick={onClose}><X size={20} /></button></div>
      <div className="flex flex-wrap justify-between gap-3 rounded-2xl p-4 mb-4" style={{ background: 'rgba(22,131,74,.08)' }}><div><p className="text-sm">Importe en {forma}</p><p className="text-2xl font-bold" style={{ color: 'var(--g)' }}>{meta ? cop(meta.total_importe) : '—'}</p></div><div className="text-right"><p className="text-sm">Operaciones</p><p className="text-2xl font-bold">{meta?.total ?? '—'}</p></div></div>
      <p className="text-sm mb-4" style={{ color: 'var(--mut)' }}>El importe corresponde solo a esta forma de pago. El total de la venta puede incluir otros medios.</p>
      {meta?.pagos_sin_monto > 0 && <p role="alert" className="mb-3">Hay pagos sin importe disponible; la suma puede estar incompleta.</p>}
      {result.isError && <p role="alert" className="mb-3">{result.error.message} <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
      <div className="overflow-x-auto" aria-busy={result.isFetching}><table className="w-full"><thead><tr><th>Venta</th><th>Cliente / hora</th><th>Estado</th><th>Total venta</th><th>Importe en este medio</th></tr></thead><tbody>
        {result.isPending ? Array.from({ length: size }, (_, i) => <tr key={i}><td colSpan={5}><div className="animate-pulse h-8 rounded bg-green-100" /></td></tr>) : data.map(row => <tr key={row.id}><td className="font-semibold">#{row.id}</td><td><p><DataValue value={row.cliente} /></p><p className="text-xs" style={{ color: 'var(--mut)' }}>{hour.format(new Date(row.fecha))}</p></td><td><Badge estado={row.estado} /></td><td><DataValue value={row.total_venta == null ? null : cop(row.total_venta)} /></td><td><p className="font-bold" style={{ color: 'var(--g)' }}><DataValue value={row.importe == null ? null : cop(row.importe)} /></p><p className="text-xs" style={{ color: 'var(--mut)' }}>{row.pagos} {row.pagos === 1 ? 'pago' : 'pagos'}{row.sin_monto > 0 ? ' · Importe incompleto' : ''}</p></td></tr>)}
      </tbody></table></div>
      {!result.isPending && !result.isError && !data.length && <p className="text-center py-8">No hay operaciones para esta forma de pago en el día seleccionado.</p>}
      {meta && <Pagination page={meta.page} totalPages={meta.last_page} totalItems={meta.total} from={meta.total ? (meta.page - 1) * size + 1 : 0} to={Math.min(meta.page * size, meta.total)} pageSize={size} sizes={[10, 25, 50]} setPage={setPage} setPageSize={value => { setSize(value); setPage(1); }} />}
    </div>
  </dialog>, document.body);
}
