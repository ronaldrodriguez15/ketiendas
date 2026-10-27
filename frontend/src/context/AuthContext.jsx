import { notify } from '../services/notifications';
import { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { http, tokenStore } from '../services/http';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const client = useQueryClient();
  const [session, setSession] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const clear = () => { setSession(null); client.clear(); };
    const expired = () => { clear(); notify.warning('Tu sesión venció. Inicia sesión de nuevo.'); };
    window.addEventListener('session-expired', expired);
    if (tokenStore.get()) {
      http('/me', { signal: controller.signal }).then(setSession).catch(error => {
        if (error.name !== 'AbortError') { tokenStore.clear(); clear(); notify.error(error); }
      }).finally(() => { if (!controller.signal.aborted) setCargando(false); });
    } else setCargando(false);
    return () => { controller.abort(); window.removeEventListener('session-expired', expired); };
  }, [client]);
  const login = async (email, password) => {
    const result = await http('/login', { method: 'POST', body: { email, password }, anonymous: true });
    client.clear(); tokenStore.set(result.token); setSession({ user: result.user, permisos: result.permisos }); notify.success('Bienvenido al panel');
  };
  const logout = async () => {
    try { await http('/logout', { method: 'POST' }); notify.success('Sesión cerrada'); }
    catch (error) { notify.error(error); throw error; }
    finally { tokenStore.clear(); setSession(null); client.clear(); }
  };
  return <AuthContext.Provider value={{ user: session?.user, rol: session?.user?.rol, can: permission => session?.permisos?.includes(permission) || false, cargando, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
