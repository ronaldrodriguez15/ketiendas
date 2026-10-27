import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  perPage: number;
  count: number;
  total: number | null;
  hasMore: boolean;
  busy?: boolean;
  sizes?: number[];
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}
export default function PageNavigation({ page, perPage, count, total, hasMore, busy = false, sizes = [10, 25, 50, 100], onPage, onSize }: Props) {
  const from = count ? (page - 1) * perPage + 1 : 0;
  const to = count ? from + count - 1 : 0;
  return <div className="panel-pagination flex flex-wrap items-center justify-between gap-3 pt-4" style={{ borderTop: '1px solid rgba(22,163,74,.12)' }}>
    <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--mut)' }}><span>Mostrando {from}–{to}{total !== null ? ` de ${total}` : ''}</span><select className="inp plain" style={{ width: 'auto', padding: '.3rem .6rem' }} aria-label="Filas por página" value={perPage} disabled={busy} onChange={event => onSize(Number(event.target.value))}>{sizes.map(size => <option key={size} value={size}>{size} filas</option>)}</select></div>
    <div className="flex items-center gap-2"><button type="button" className="chip flex items-center gap-1 disabled:opacity-40" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={18} /> Anterior</button><span className="text-sm">Página {page}</span><button type="button" className="chip flex items-center gap-1 disabled:opacity-40" disabled={busy || !hasMore} onClick={() => onPage(page + 1)}>Siguiente <ChevronRight size={18} /></button></div>
  </div>;
}
