import DataValue from '../../components/ui/DataValue';
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, RefreshCw } from 'lucide-react';
import PageNavigation from '../../components/ui/PageNavigation';
import { contactosQuery } from '../../services/contactosService';
import type { ContactFilters, ContactKind, SortColumn } from '../../services/contactosService';
import { cop } from '../../utils/format';
import DetalleContacto from './DetalleContacto';

const columns: { key: SortColumn; label: string }[] = [
  { key: 'first_name', label: 'Nombre completo' }, { key: 'company_name', label: 'Empresa' },
  { key: 'email', label: 'Correo' }, { key: 'phone_number', label: 'Teléfono' },
  { key: 'account_number', label: 'Número de cuenta' }, { key: 'balance', label: 'Saldo' },
];

export default function Contactos({ kind }: { kind: ContactKind }) {
  const customers = kind === 'customers';
  const title = customers ? 'Clientes' : 'Proveedores';
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ContactFilters>({ search: '', search_field: '', sort_col: 'first_name', sort_dir: 'asc', page: 1, per_page: 10 });
  const [selected, setSelected] = useState<number | null>(null);
  const change = (values: Partial<ContactFilters>) => setFilters(old => ({ ...old, ...values, page: 1 }));
  useEffect(() => {
    const timer = setTimeout(() => setFilters(old => old.search === search.trim() ? old : { ...old, search: search.trim(), page: 1 }), 400);
    return () => clearTimeout(timer);
  }, [search]);
  const result = useQuery({ ...contactosQuery(kind, filters), placeholderData: keepPreviousData });
  const page = result.data;
  useEffect(() => {
    if (page && !result.isPlaceholderData && page.page > 1 && (page.page - 1) * page.per_page >= page.total) {
      setFilters(old => ({ ...old, page: Math.max(1, Math.ceil(page.total / page.per_page)) }));
    }
  }, [page, result.isPlaceholderData]);
  const sort = (key: SortColumn) => change({ sort_col: key, sort_dir: filters.sort_col === key && filters.sort_dir === 'asc' ? 'desc' : 'asc' });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">{title}</h1><p style={{ color: 'var(--mut)' }}>Consulta los datos de {customers ? 'tus clientes' : 'tus proveedores'}. Solo lectura.</p></div><button type="button" data-liquid className="btn" disabled={result.isFetching} onClick={() => result.refetch()}><RefreshCw size={17} className={result.isFetching ? 'animate-spin' : ''} /> Actualizar</button></div>
    <section data-liquid className="glass p-4">
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <label className="block text-sm">Buscar {title.toLowerCase()}<div className="relative mt-1"><Search size={18} className="absolute" style={{ left: 12, top: 13, color: 'var(--mut)' }} /><input type="search" className="inp" placeholder="Escribe para buscar…" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} /></div></label>
        <label className="block text-sm">Campo de búsqueda<select className="inp plain mt-1" value={filters.search_field} onChange={event => change({ search_field: event.target.value })}>
          <option value="">Todos los campos</option><option value="first_name">Nombre</option><option value="last_name">Apellido</option><option value="email">Correo</option><option value="phone_number">Teléfono</option><option value="account_number">Número de cuenta</option>
          {!customers && <option value="company_name">Empresa</option>}{Array.from({ length: 10 }, (_, i) => <option key={i} value={`custom_field_${i + 1}_value`}>Campo personalizado {i + 1}</option>)}
        </select></label>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm mb-3" style={{ color: 'var(--mut)' }}><span>{page ? `${page.total} ${title.toLowerCase()}` : 'Consulta del directorio'}</span><span>Pulsa una fila para ver el detalle.</span></div>
      {result.isError && <p role="alert" className="mb-3">{result.error.message} <button type="button" className="chip" onClick={() => result.refetch()}>Reintentar</button></p>}
      <div role="status" className="text-sm mb-2">{result.isFetching ? 'Cargando registros…' : ''}</div>
      <div className="overflow-x-auto" aria-busy={result.isFetching}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}><caption className="sr-only">Listado de {title.toLowerCase()}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={filters.sort_col === column.key ? (filters.sort_dir === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="flex items-center gap-2" onClick={() => sort(column.key)} aria-label={`Ordenar por ${column.label.toLowerCase()}`}>
          {column.label}{filters.sort_col !== column.key ? <ArrowUpDown size={14} /> : filters.sort_dir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button></th>)}<th scope="col"><span className="sr-only">Detalle</span></th></tr></thead><tbody>
          {result.isPending ? Array.from({ length: filters.per_page }, (_, i) => <tr key={i} aria-hidden="true"><td colSpan={7}><div className="animate-pulse h-8 rounded bg-green-100" /></td></tr>) : page?.data.map(contact => <tr key={contact.person_id} className="cursor-pointer" onClick={() => setSelected(contact.person_id)}>
            <td className="font-medium"><DataValue value={[contact.first_name, contact.last_name].filter(Boolean).join(" ")} /></td><td>{contact.company_name || '—'}</td><td>{contact.email || '—'}</td><td>{contact.phone_number || '—'}</td><td>{contact.account_number || '—'}</td><td className="font-semibold"><DataValue value={contact.balance == null ? null : cop(contact.balance)} /></td>
            <td><button type="button" className="chip" aria-label={`Ver detalle de ${`${contact.first_name} ${contact.last_name}`.trim() || contact.company_name || `registro ${contact.person_id}`}`} onClick={event => { event.stopPropagation(); setSelected(contact.person_id); }}>Ver detalle</button></td>
          </tr>)}
        </tbody></table>
      </div>
      {!result.isPending && !result.isError && page?.total === 0 && <p className="text-center py-10">No hay {title.toLowerCase()} con estos filtros.</p>}
      {page && <PageNavigation page={page.page} perPage={page.per_page} total={page.total} hasMore={page.has_more} count={page.data.length} busy={result.isFetching || result.isPlaceholderData} sizes={[10, 20, 50, 100]} onPage={value => setFilters(old => ({ ...old, page: value }))} onSize={per_page => change({ per_page })} />}
    </section>
    {selected !== null && <DetalleContacto kind={kind} id={selected} onClose={() => setSelected(null)} />}
  </div>;
}
