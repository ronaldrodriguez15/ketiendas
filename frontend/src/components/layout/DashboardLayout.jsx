import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import Background from "./Background";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileDialog = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const close = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    const dialog = mobileDialog.current;
    if (!mobileOpen) { dialog.close(); return; }
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);
  return (
    <Background>
      <div className="flex gap-4 p-3 md:p-5 min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <main className="flex-1 min-w-0">
          <Topbar mobileOpen={mobileOpen} onMenuOpen={() => setMobileOpen(true)} />
          <div key={pathname} className="rise mx-auto w-full" style={{ maxWidth: 1600 }}><Outlet /></div>
        </main>
      </div>
      {createPortal(
        <dialog ref={mobileDialog} id="mobile-navigation" className="mobile-navigation" aria-label="Menú principal"
          onCancel={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)}
          onClick={(event) => { if (event.target === event.currentTarget) setMobileOpen(false); }}>
          <div className="mobile-navigation-panel">
            <button type="button" className="chip mobile-menu-close" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} autoFocus><X size={22} /></button>
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </dialog>, document.body
      )}
    </Background>
  );
}
