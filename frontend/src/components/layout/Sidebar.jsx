import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Users, LogOut, PanelLeftClose, PanelLeftOpen, Wallet, Contact, Truck, CreditCard } from "lucide-react";
import Logo from "../ui/Logo";
import { useAuth } from "../../context/AuthContext";

const MENU = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/creditos", label: "Créditos", icon: CreditCard, permission: "ventas.ver" },
  { to: '/clientes', label: 'Clientes', icon: Contact, permission: 'ventas.ver' },
  { to: '/proveedores', label: 'Proveedores', icon: Truck, permission: 'ventas.ver' },
  { to: '/cierre', label: 'Cierre', icon: Wallet },
  { to: "/usuarios", label: "Usuarios", icon: Users },
];

/* En móvil se presenta dentro del menú; escritorio conserva su estado contraído. */
export default function Sidebar({ collapsed, onToggle, mobile = false, onNavigate }) {
  const { logout, can } = useAuth();
  const navigate = useNavigate();
  const label = mobile ? "inline" : collapsed ? "hidden" : "hidden md:inline";

  return (
    <aside
      data-liquid className={`glass liquid-key ${mobile ? "mobile-sidebar flex" : "hidden md:flex"} flex-col p-3 shrink-0 w-16 transition-[width] duration-300 ${collapsed ? "md:w-20" : "md:w-64"}`}
      style={mobile ? undefined : { position: "sticky", top: 20, height: "calc(100vh - 40px)" }}
    >
      <div className="px-1 py-2 mb-4"><Logo nameClass={label} /></div>
      <nav className="space-y-1 flex-1 min-h-0 overflow-y-auto">
        {MENU.filter(({ to, permission }) => can(permission || (to === '/usuarios' ? 'usuarios.gestionar' : to === '/cierre' ? 'ventas.ver' : `${to.slice(1)}.ver`))).map(({ to, label: t, icon: Icon }) => (
          <NavLink key={to} to={to} title={t} onClick={onNavigate} data-liquid className={({ isActive }) => `nav ${isActive ? "on" : ""}`}>
            <Icon size={20} className="shrink-0" /><span className={label}>{t}</span>
          </NavLink>
        ))}
      </nav>
      <div className={mobile ? "hidden" : "hidden md:block mb-1"}>
        <button data-liquid className="nav" onClick={onToggle} title={collapsed ? "Expandir menú" : "Contraer menú"}>
          {collapsed ? <PanelLeftOpen size={20} className="shrink-0" /> : <PanelLeftClose size={20} className="shrink-0" />}
          <span className={label}>Contraer menú</span>
        </button>
      </div>
      <button data-liquid className="nav" title="Cerrar sesión" onClick={async () => { try { await logout(); } catch {} navigate("/login"); }}>
        <LogOut size={20} className="shrink-0" /><span className={label}>Cerrar sesión</span>
      </button>
    </aside>
  );
}
