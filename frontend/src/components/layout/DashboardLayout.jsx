import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Background from "./Background";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  return (
    <Background>
      <div className="flex gap-4 p-3 md:p-5 min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <main className="flex-1 min-w-0">
          <Topbar />
          <div key={pathname} className="rise mx-auto w-full" style={{ maxWidth: 1600 }}><Outlet /></div>
        </main>
      </div>
    </Background>
  );
}
