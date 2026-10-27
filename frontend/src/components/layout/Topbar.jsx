import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { iniciales } from "../../utils/format";

export default function Topbar({ mobileOpen, onMenuOpen }) {
  const { user } = useAuth();
  return (
    <header data-liquid className="glass liquid-key panel-topbar flex items-center justify-between gap-3 px-4 py-3 mb-5">
      <button type="button" className="chip mobile-menu-toggle md:hidden shrink-0" aria-label="Abrir menú" aria-expanded={mobileOpen} aria-controls="mobile-navigation" aria-haspopup="dialog" onClick={onMenuOpen}><Menu size={22} /></button>
      <div className="relative min-w-0 topbar-search" style={{ flex: "0 1 380px" }}>
        <Search size={18} className="absolute" style={{ left: 12, top: 13, color: "var(--mut)" }} />
        <input className="inp" aria-label="Buscar en el panel" placeholder="Buscar en el panel" />
      </div>
      <div className="flex items-center gap-3">
        <button data-liquid className="chip" style={{ padding: ".5rem" }} aria-label="Notificaciones"><Bell size={18} /></button>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center font-bold" style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg,#34d399,#16a34a)", color: "#fff" }}>
            {iniciales(user.nombre)}
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-sm font-semibold">{user.nombre}</div>
            <div className="text-xs" style={{ color: "var(--mut)" }}>{user.rol}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
