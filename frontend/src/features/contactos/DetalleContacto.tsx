import DataValue from '../../components/ui/DataValue';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { contactoQuery } from '../../services/contactosService';
import type { ContactKind } from '../../services/contactosService';
import { cop } from '../../utils/format';

export default function DetalleContacto({ kind, id, onClose }: { kind: ContactKind; id: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const result = useQuery(contactoQuery(kind, id));
  const contact = result.data?.data;
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  const fields = contact ? [
    ['Nombre completo', `${contact.first_name} ${contact.last_name}`.trim()], ['Empresa', contact.company_name],
    ['Correo', contact.email], ['Teléfono', contact.phone_number], ['Número de cuenta', contact.account_number],
    ['Dirección', contact.address_1], ['Ciudad', contact.city], ['Saldo', contact.balance === null ? null : cop(contact.balance)],
    ...('credit_limit' in contact ? [['Límite de crédito', contact.credit_limit === null ? null : cop(contact.credit_limit)], ['Puntos', contact.points === null ? null : String(contact.points)]] : []),
  ] : [];
  return createPortal(<dialog ref={dialog} className="cierre-dialog" style={{ maxWidth: 680 }} aria-labelledby="contact-detail-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="glass p-5 sm:p-7" style={{ background: 'linear-gradient(135deg,#f6fff9,#e5f6eb)' }}>
      <div className="flex items-start justify-between gap-3 mb-5"><div><p className="text-sm" style={{ color: 'var(--mut)' }}>Solo lectura · #{id}</p><h2 id="contact-detail-title" className="text-2xl font-bold">{kind === 'customers' ? 'Detalle del cliente' : 'Detalle del proveedor'}</h2></div><button type="button" className="chip shrink-0" aria-label="Cerrar detalle" onClick={onClose} autoFocus><X size={22} /></button></div>
      {result.isPending && <p role="status">Cargando detalle…</p>}
      {result.isError && <p role="alert">{result.error.message} <button className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
      {contact && <dl className="grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm" style={{ color: 'var(--mut)' }}>{label}</dt><dd className="font-medium break-words">{value || '—'}</dd></div>)}</dl>}
    </div>
  </dialog>, document.body);
}
