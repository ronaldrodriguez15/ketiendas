import { useState } from "react";
import { UserPlus } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import Switch from "../../components/ui/Switch";
import { usePagination } from "../../hooks/usePagination";
import { USUARIOS } from "../../data/usuarios";
import { iniciales } from "../../utils/format";

const VACIO = { nombre: "", email: "", rol: "Vendedor" };

export default function Usuarios() {
  const [users, setUsers] = useState(USUARIOS);
  const [abrir, setAbrir] = useState(false);
  const [form, setForm] = useState(VACIO);
  const pg = usePagination(users, 5);

  const guardar = (e) => {
    e.preventDefault();
    setUsers([...users, { id: Date.now(), ...form, activo: true }]);
    setForm(VACIO);
    setAbrir(false);
  };
  const toggle = (id) => setUsers(users.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u)));
  const campo = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p style={{ color: "var(--mut)" }}>Gestiona quién tiene acceso al panel.</p>
        </div>
        <button data-liquid className="btn" onClick={() => setAbrir(true)}><UserPlus size={18} /> Nuevo usuario</button>
      </div>

      <div data-liquid className="glass p-4">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead><tr><th>Usuario</th><th>Rol</th><th>Acceso</th></tr></thead>
            <tbody>
              {pg.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center font-bold" style={{ width: 38, height: 38, borderRadius: 12, background: "#bbf7d0", color: "#166534" }}>{iniciales(u.nombre)}</div>
                      <div>
                        <div className="font-medium">{u.nombre}</div>
                        <div className="text-xs" style={{ color: "var(--mut)" }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge role">{u.rol}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Switch checked={u.activo} onChange={() => toggle(u.id)} />
                      <span className="text-sm" style={{ color: "var(--mut)" }}>{u.activo ? "Activo" : "Inactivo"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...pg} sizes={[5, 10, 20]} />
      </div>

      {abrir && (
        <Modal title="Nuevo usuario" onClose={() => setAbrir(false)}>
          <form onSubmit={guardar}>
            <div className="space-y-3">
              <input className="inp plain" placeholder="Nombre completo" value={form.nombre} onChange={campo("nombre")} required />
              <input className="inp plain" type="email" placeholder="Correo electrónico" value={form.email} onChange={campo("email")} required />
              <select className="inp plain" value={form.rol} onChange={campo("rol")}>
                <option>Administrador</option><option>Vendedor</option><option>Contador</option>
              </select>
            </div>
            <button type="submit" data-liquid className="btn w-full mt-5">Crear usuario</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
