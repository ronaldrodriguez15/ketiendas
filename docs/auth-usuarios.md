# Autenticación y Usuarios

Tokens Bearer de Sanctum en sessionStorage, con duración de 480 minutos. No se
usan cookies para autenticar la API. Estado y permisos se comprueban en backend.
Desactivar, eliminar o cambiar contraseña revoca todos los tokens. Logout revoca
solo el actual. Las respuestas autenticadas usan Cache-Control: no-store.

## Configuración

Las migraciones de tokens y campos de usuarios están aplicadas en la BD local.
En otro entorno ejecutar php artisan migrate --force desde backend.
Configurar ADMIN_NOMBRE, ADMIN_EMAIL y ADMIN_PASSWORD directamente en backend/.env.
Contraseña: mínimo 10 caracteres, mayúscula, minúscula y número. Luego ejecutar:

```
php artisan config:clear
php artisan db:seed --class=AdminUserSeeder
```

El seeder no modifica correos existentes, incluso eliminados. DatabaseSeeder ya
no crea cuentas demo. No versionar credenciales. Configurar FRONTEND_URL con el
origen exacto y VITE_API_URL con Laravel incluyendo /api. En producción, HTTPS y
APP_DEBUG=false. La caché Query se vacía al entrar, salir o expirar sesión.

## Permisos

Administrador: Dashboard, Ventas, Reportes y Usuarios. Vendedor: Dashboard y
Ventas. Contador: Dashboard, Ventas y Reportes. UsuarioPolicy y Gates protegen la
API. Dashboard y Reportes conservan sus módulos sin nuevos endpoints; sus futuras
APIs deben aplicar los Gates correspondientes.

Las mutaciones bloquean administradores activos en orden de ID en una transacción
para proteger al último administrador. Auditorías: solo acción e IDs después del
commit. SoftDelete mantiene reservado el correo.

## Verificación

Tests aislados con SQLite y datos inventados: autenticación, expiración, throttle,
permisos, CRUD, filtros, paginación, validación, seeder, protección de administrador,
revocación y whitelist. Ventas se verifica con Bearer y Http::fake. No se realizó
prueba visual. Login inicial y prueba POS real requieren configurar ADMIN_*.
