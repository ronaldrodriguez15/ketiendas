import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Users, LogOut, PanelLeftClose, PanelLeftOpen, FileBarChart } from "lucide-react";
import Logo from "../ui/Logo";
import { useAuth } from "../../context/AuthContext";

const MENU = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/reportes", label: "Reportes", icon: FileBarChart },
  { to: "/usuarios", label: "Usuarios", icon: Users },
];

/* En móvil siempre muestra solo iconos; desde md se puede expandir/contraer. */
export default function Sidebar({ collapsed, onToggle }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const label = collapsed ? "hidden" : "hidden md:inline";

  return (
    <aside
      data-liquid className={`glass liquid-key flex flex-col p-3 shrink-0 w-16 transition-[width] duration-300 ${collapsed ? "md:w-20" : "md:w-64"}`}
      style={{ position: "sticky", top: 20, height: "calc(100vh - 40px)" }}
    >
      <div className="px-1 py-2 mb-4"><Logo nameClass={label} /></div>
      <nav className="space-y-1 flex-1">
        {MENU.map(({ to, label: t, icon: Icon }) => (
          <NavLink key={to} to={to} title={t} data-liquid className={({ isActive }) => `nav ${isActive ? "on" : ""}`}>
            <Icon size={20} className="shrink-0" /><span className={label}>{t}</span>
          </NavLink>
        ))}
      </nav>
      <div className="hidden md:block mb-1">
        <button data-liquid className="nav" onClick={onToggle} title={collapsed ? "Expandir menú" : "Contraer menú"}>
          {collapsed ? <PanelLeftOpen size={20} className="shrink-0" /> : <PanelLeftClose size={20} className="shrink-0" />}
          <span className={label}>Contraer menú</span>
        </button>
      </div>
      <button data-liquid className="nav" title="Cerrar sesión" onClick={() => { logout(); navigate("/login"); }}>
        <LogOut size={20} className="shrink-0" /><span className={label}>Cerrar sesión</span>
      </button>
    </aside>
  );
}
