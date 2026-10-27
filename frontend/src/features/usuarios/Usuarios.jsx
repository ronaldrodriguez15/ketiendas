import DataValue from '../../components/ui/DataValue';
import { notify } from '../../services/notifications';
import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import Switch from '../../components/ui/Switch';
import Badge from '../../components/ui/Badge';
import { iniciales } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useUsuarios, useCrearUsuario, useEditarUsuario, useCambiarActivo, useEliminarUsuario } from '../../services/usuariosService';
const ROLES = ['Administrador', 'Vendedor', 'Contador'];
const EMPTY = { nombre: '', email: '', rol: 'Vendedor', password: '', password_confirmation: '' };
const date = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' });
export default function Usuarios() {
  const { user, logout } = useAuth();
  const [filters, setFilters] = useState({ q: '', rol: '', activo: '', page: 1, per_page: 10 });
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [errors, setErrors] = useState({});

  const [failure, setFailure] = useState('');
  const listing = useUsuarios(filters);
  const create = useCrearUsuario(), edit = useEditarUsuario(), toggle = useCambiarActivo(), remove = useEliminarUsuario();
  const busy = create.isPending || edit.isPending || toggle.isPending || remove.isPending;
  const change = values => setFilters(old => ({ ...old, ...values, page: 1 }));
  useEffect(() => { const timer = setTimeout(() => setFilters(old => old.q === q.trim() ? old : { ...old, q: q.trim(), page: 1 }), 400); return () => clearTimeout(timer); }, [q]);
  const { data = [], meta } = listing.data || {};
  useEffect(() => { if (meta && !listing.isPlaceholderData && filters.page > meta.last_page) setFilters(old => ({ ...old, page: meta.last_page })); }, [meta, listing.isPlaceholderData, filters.page]);
  const open = target => { setEditing(target || {}); setForm(target ? { nombre: target.nombre, email: target.email, rol: target.rol, password: '', password_confirmation: '' } : EMPTY); setErrors({}); setFailure(''); };
  const save = async e => {
    e.preventDefault(); setErrors({}); setFailure('');
    try {
      await (editing.id ? edit : create).mutateAsync({ ...form, ...(editing.id ? { id: editing.id } : {}) });
      notify.success(editing.id ? 'Cambios guardados' : 'Usuario creado'); setEditing(null);
      if (editing.id === user.id && (form.password || form.rol !== user.rol)) { try { await logout(); } catch {} }
    } catch (error) { setErrors(error.campos || {}); setFailure(error.message); }
  };
  const setActive = async target => {
    setFailure('');
    try { await toggle.mutateAsync({ id: target.id, activo: !target.activo }); notify.success(target.activo ? 'Usuario desactivado' : 'Usuario activado'); }
    catch (error) { setFailure(error.message); }
  };
  const destroy = async () => {
    setFailure('');
    try { await remove.mutateAsync(deleting.id); setDeleting(null); notify.success('Usuario eliminado'); }
    catch (error) { setFailure(error.message); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Usuarios</h1><p style={{ color: 'var(--mut)' }}>Gestiona quién tiene acceso al panel.</p></div><button data-liquid className="btn" onClick={() => open()}><UserPlus size={18} /> Nuevo usuario</button></div>
    {failure && !editing && !deleting && <p role="alert">{failure}</p>}
    <div data-liquid className="glass p-4">
      <input className="inp plain mb-3" aria-label="Buscar por nombre o correo" placeholder="Buscar por nombre o correo" maxLength={60} value={q} onChange={e => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-2 mb-3">{['Todos', ...ROLES].map(rol => <button data-liquid key={rol} className={`chip ${(filters.rol || 'Todos') === rol ? 'on' : ''}`} onClick={() => change({ rol: rol === 'Todos' ? '' : rol })}>{rol}</button>)}
        <select className="inp plain" style={{ width: 'auto' }} aria-label="Filtrar por estado" value={filters.activo} onChange={e => change({ activo: e.target.value })}><option value="">Todos los estados</option><option value="true">Activos</option><option value="false">Inactivos</option></select>
      </div>
      {listing.isError && <p role="alert">{listing.error.message} <button className="btn" onClick={() => listing.refetch()}>Reintentar</button></p>}
      <div className="overflow-x-auto" aria-busy={listing.isFetching}><table className="w-full" style={{ borderCollapse: 'collapse' }}><thead><tr><th>Usuario</th><th>Rol</th><th>Último acceso</th><th>Acceso</th><th>Acciones</th></tr></thead><tbody>
        {listing.isPending ? Array.from({ length: filters.per_page }, (_, i) => <tr key={i} aria-hidden="true"><td colSpan={5}><div className="animate-pulse h-8 my-2 rounded" style={{ background: 'rgba(22,163,74,.12)' }} /></td></tr>) : data.map(target => <tr key={target.id}>
          <td><div className="flex items-center gap-3"><div className="flex items-center justify-center font-bold" style={{ width: 38, height: 38, borderRadius: 12, background: '#bbf7d0', color: '#166534' }}>{iniciales(target.nombre)}</div><div><div className="font-medium"><DataValue value={target.nombre} /></div><div className="text-xs" style={{ color: 'var(--mut)' }}><DataValue value={target.email} /></div></div></div></td>
          <td><Badge estado={target.rol} /></td><td>{target.ultimo_acceso ? date.format(new Date(target.ultimo_acceso)) : 'Nunca'}</td>
          <td><fieldset disabled={target.id === user.id || busy} className="flex items-center gap-2"><Switch checked={target.activo} onChange={() => setActive(target)} label={`Cambiar acceso de $<DataValue value={target.nombre} />`} /><span>{target.activo ? 'Activo' : 'Inactivo'}</span></fieldset></td>
          <td><div className="flex gap-2"><button className="chip" disabled={busy} onClick={() => open(target)}>Editar</button><button className="chip" disabled={target.id === user.id || busy} onClick={() => { setDeleting(target); setFailure(''); }}>Eliminar</button></div></td>
        </tr>)}
      </tbody></table></div>
      {!listing.isPending && !listing.isError && !data.length && <p className="text-center py-10">No hay usuarios con estos filtros.</p>}
      {meta && <Pagination page={meta.page} totalPages={meta.last_page} totalItems={meta.total} from={meta.total ? (meta.page - 1) * meta.per_page + 1 : 0} to={Math.min(meta.page * meta.per_page, meta.total)} pageSize={filters.per_page} sizes={[10, 25, 50]} setPage={page => setFilters(old => ({ ...old, page }))} setPageSize={per_page => change({ per_page })} />}
    </div>
    {editing && <Modal title={editing.id ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => { if (!busy) setEditing(null); }}><form onSubmit={save}><div className="space-y-3">
      {['nombre', 'email', 'rol', 'password', 'password_confirmation'].map(key => <label className="block text-sm" key={key}>{({ nombre: 'Nombre completo', email: 'Correo', rol: 'Rol', password: editing.id ? 'Contraseña (opcional)' : 'Contraseña', password_confirmation: 'Confirmar contraseña' })[key]}
        {key === 'rol' ? <select className="inp plain" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}>{ROLES.map(rol => <option key={rol}>{rol}</option>)}</select> : <input className="inp plain" type={key.startsWith('password') ? 'password' : key === 'email' ? 'email' : 'text'} autoComplete={key.startsWith('password') ? 'new-password' : 'off'} value={form[key]} required={!key.startsWith('password') || !editing.id || Boolean(form.password)} onChange={e => setForm({ ...form, [key]: e.target.value })} />}
        {errors[key] && <span role="alert" style={{ color: '#991b1b' }}>{errors[key].join(' ')}</span>}
      </label>)}
      <p className="text-xs" aria-live="polite">{form.password.length >= 10 ? '✓' : '○'} 10 caracteres · {/[A-Z]/.test(form.password) && /[a-z]/.test(form.password) ? '✓' : '○'} Mayúscula y minúscula · {/\d/.test(form.password) ? '✓' : '○'} Número</p>
      {failure && <p role="alert">{failure}</p>}
      </div><button type="submit" className="btn w-full mt-5" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></form></Modal>}
    {deleting && <Modal title="Eliminar usuario" onClose={() => { if (!busy) setDeleting(null); }}><p>¿Eliminar a {deleting.nombre}?</p><p>Esta acción cerrará su sesión de inmediato.</p>{failure && <p role="alert">{failure}</p>}<div className="flex gap-3 mt-5"><button className="chip" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="btn" disabled={busy} onClick={destroy}>{busy ? 'Eliminando…' : 'Eliminar'}</button></div></Modal>}
  </div>;
}
