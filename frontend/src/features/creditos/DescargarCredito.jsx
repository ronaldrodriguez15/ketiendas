import { useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { http } from '../../services/http';

export default function DescargarCredito({ account, filters }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  const download = async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller; setBusy(true);
    try {
      const { collectCreditDetails, loadCreditLogo, createCreditPdf } = await import('../../services/creditoPdf');
      const [details, logo] = await Promise.all([
        collectCreditDetails(page => http(`/creditos/${encodeURIComponent(account.id)}?${new URLSearchParams({ ...filters, page, per_page: 100 })}`, { signal: controller.signal })),
        loadCreditLogo(),
      ]);
      controller.signal.throwIfAborted();
      const name = (account.nombre || account.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 60);
      createCreditPdf(details, filters, logo).save(`credito-${name}-${filters.desde}-${filters.hasta}.pdf`);
    } catch (error) {
      if (!controller.signal.aborted) toast.error(error.message || 'No se pudo descargar el PDF. Intenta nuevamente.');
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return <button type="button" className="chip inline-flex items-center gap-1 disabled:opacity-50" title="Descargar detalle en PDF" aria-label={`Descargar PDF de ${account.nombre}`} aria-busy={busy} disabled={busy} onClick={download}>
    {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />} {busy ? 'Generando…' : 'PDF'}
  </button>;
}
