import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
const Login = lazy(() => import("./features/auth/Login"));
const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const Ventas = lazy(() => import("./features/ventas/Ventas"));
const Clientes = lazy(() => import("./features/clientes/Clientes"));
const Proveedores = lazy(() => import("./features/proveedores/Proveedores"));
const Cierre = lazy(() => import("./features/cierre/Cierre"));
const Usuarios = lazy(() => import("./features/usuarios/Usuarios"));
import useLiquidGlass from "./hooks/useLiquidGlass";
import LiquidGlassFilter from "./components/ui/LiquidGlassFilter";

const Creditos = lazy(() => import("./features/creditos/Creditos"));

export default function App() {
  useLiquidGlass();
  return (
    <>
    <LiquidGlassFilter />
    <Suspense fallback={<div className="glass p-5" role="status">Cargando módulo...</div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route element={<ProtectedRoute permiso="ventas.ver" />}>
            <Route path="/creditos" element={<Creditos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/proveedores" element={<Proveedores />} />
          </Route>
          <Route element={<ProtectedRoute permiso="ventas.ver" />}><Route path="/cierre" element={<Cierre />} /></Route>
          <Route element={<ProtectedRoute permiso="usuarios.gestionar" />}><Route path="/usuarios" element={<Usuarios />} /></Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </Suspense>
    </>
  );
}
