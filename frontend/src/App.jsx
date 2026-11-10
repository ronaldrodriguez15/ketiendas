import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import { moduleLoaders } from './routes/moduleLoaders';
const Login = lazy(moduleLoaders['/login']);
const Dashboard = lazy(moduleLoaders['/dashboard']);
const Ventas = lazy(moduleLoaders['/ventas']);
const Clientes = lazy(moduleLoaders['/clientes']);
const Proveedores = lazy(moduleLoaders['/proveedores']);
const Cierre = lazy(moduleLoaders['/cierre']);
const Usuarios = lazy(moduleLoaders['/usuarios']);
const Productos = lazy(moduleLoaders['/productos']);
import useLiquidGlass from "./hooks/useLiquidGlass";
import LiquidGlassFilter from "./components/ui/LiquidGlassFilter";

const Creditos = lazy(moduleLoaders['/creditos']);

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
            <Route path="/productos" element={<Productos />} />
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
