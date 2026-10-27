# Clientes y proveedores (solo lectura)

## Integración

Se extiende `backend/app/Integrations/PhpPos/PhpPosClient.php` con `getCustomers`,
`getCustomer`, `getSuppliers` y `getSupplier`. Los cuatro métodos reutilizan
`batch()` y `request()`: misma URL, clave, TLS, tiempos de espera, reintentos y
bloqueo de concurrencia que Ventas. No se agrega otro cliente HTTP ni se cambia
la configuración del POS.

Rutas GET autenticadas con Sanctum, usuario activo y permiso `ventas.ver`:

- `/api/customers` y `/api/customers/{id}`.
- `/api/suppliers` y `/api/suppliers/{id}`.

El listado devuelve `{ data, total, offset, limit }`. `total` procede únicamente
de `x-total-records`; si falta o es inválido se responde con un error legible,
sin inventar un total. Cada consulta descarga solo la página solicitada (20 por
defecto, máximo 100). El detalle devuelve `{ data }`.

`ListarContactosRequest` valida búsqueda, campos permitidos, orden, offset,
límite y local (solo clientes). `ContactoController` selecciona el método del
cliente y `ContactoResource` expone exclusivamente los campos autorizados del
directorio. Importes ausentes son `null`, no cero. No se devuelven claves,
campos personalizados, contraseñas ni el cuerpo crudo del POS. Las respuestas
autenticadas usan `no-store`.

Errores: filtros propios inválidos 422; filtros rechazados por el POS 400;
registro inexistente 404; credenciales remotas rechazadas, respuesta inválida o
fallo remoto 502; conexión/timeout 504. Los registros de error contienen solo
el recurso y la categoría, sin búsquedas, datos de contacto ni credenciales.

## Frontend

- `src/services/contactosService.ts`: tipos `Customer`, `Supplier`,
  `PaginatedResponse<T>` y consultas TanStack Query usando el mismo `http` y
  token de sesión que Ventas.
- `src/features/clientes/Clientes.tsx` y `proveedores/Proveedores.tsx`: vistas.
- `src/features/contactos/Contactos.tsx`: tabla común, debounce de 400 ms,
  búsqueda por campo, ordenamiento remoto y paginación compartida.
- `src/features/contactos/DetalleContacto.tsx`: detalle con diálogo nativo,
  Escape, cierre exterior y restauración del foco.
- `App.jsx` y `Sidebar.jsx`: rutas `/clientes`, `/proveedores` y navegación.

La búsqueda, el campo, el orden y el tamaño de página reinician el offset.
El detalle usa su endpoint individual. Tablas desplazables en celular y
botones de detalle accesibles con teclado. Se conserva el estilo del panel.
`http.d.ts` y `tsconfig.json` permiten verificar los módulos nuevos sin migrar
las vistas JSX existentes ni modificar el transporte compartido.

## Probar localmente

1. Usar el `backend/.env` existente con `PHPPOS_URL` (terminado en
   `/index.php/api/v1`) y `PHPPOS_API_KEY`. No copiar la clave al frontend.
2. En `backend`, ejecutar `C:\xampp\php\php.exe artisan serve`.
3. En `frontend`, usar `VITE_API_URL=http://localhost:8000/api` y ejecutar
   `npm.cmd install` y `npm.cmd run dev`.
4. Iniciar sesión con una cuenta activa que tenga acceso a Ventas. Abrir
   Clientes y Proveedores desde el menú.
5. Cambiar páginas y tamaño de página; buscar un nombre, seleccionar un campo
   y ordenar pulsando las cabeceras. Comprobar que vuelve a la primera página
   y que el total corresponde al filtro actual.
6. Pulsar una fila o «Ver detalle», cerrar con el botón y con Escape. Revisar
   dirección, ciudad y, en clientes, límite de crédito y puntos.
7. Revisar ambos módulos en móvil. En Network las solicitudes deben ir solo
   al backend propio: nunca debe enviarse `x-api-key` desde el navegador.
8. Confirmar que Ventas sigue cargando con sus filtros y paginación.

Verificación automatizada: `php artisan test --filter=ContactosTest`, pruebas
existentes de ventas/cierre/dashboard, `npm.cmd run typecheck` y `npm.cmd run build`. Las pruebas usan
respuestas inventadas; no modifican ni consultan registros reales del POS.
