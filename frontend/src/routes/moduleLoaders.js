// A shared loader lets navigation warm only the module the user is about to open.
export const moduleLoaders = {
  '/login': () => import('../features/auth/Login'),
  '/dashboard': () => import('../features/dashboard/Dashboard'),
  '/ventas': () => import('../features/ventas/Ventas'),
  '/productos': () => import('../features/productos/Productos'),
  '/clientes': () => import('../features/clientes/Clientes'),
  '/proveedores': () => import('../features/proveedores/Proveedores'),
  '/cierre': () => import('../features/cierre/Cierre'),
  '/usuarios': () => import('../features/usuarios/Usuarios'),
  '/creditos': () => import('../features/creditos/Creditos'),
};

export function preloadModule(path) {
  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;
  // A failed prefetch must not interrupt navigation; React.lazy can retry the import.
  moduleLoaders[path]?.().catch(() => {});
}
