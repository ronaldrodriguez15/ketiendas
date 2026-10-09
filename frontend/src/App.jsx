import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import Login from "./features/auth/Login";
import Dashboard from "./features/dashboard/Dashboard";
import Ventas from "./features/ventas/Ventas";
import Usuarios from "./features/usuarios/Usuarios";
import Reportes from "./features/reportes/Reportes";
import useLiquidGlass from "./hooks/useLiquidGlass";
import LiquidGlassFilter from "./components/ui/LiquidGlassFilter";

export default function App() {
  useLiquidGlass();
  return (
    <>
    <LiquidGlassFilter />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/reportes" element={<Reportes />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  );
}
