import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function ProtectedRoute({ permiso }) {
  const { user, cargando, can } = useAuth();
  if (cargando) return <div className="glass p-8" role="status">Validando sesión…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permiso && !can(permiso)) return <div className="glass p-8"><h1 className="text-2xl font-bold">403 · Acceso restringido</h1><p>No tienes permiso para acceder a esta sección.</p></div>;
  return <Outlet />;
}
