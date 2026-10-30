# Error 502 del POS en Windows

Si Dashboard y Ventas fallan y `backend/storage/logs/laravel.log` registra
`connection_error: 60`, revisar la validación del certificado HTTPS de PHP.

El 30 de octubre de 2026 se confirmó que Avast Web/Mail Shield inspeccionaba
la conexión al POS. Windows confiaba en su autoridad raíz, pero el archivo
Mozilla configurado en `PHPPOS_CA_BUNDLE` no la incluía. PHP devolvía
`SSL certificate problem: unable to get local issuer certificate`.

Se añadió el certificado público de esa autoridad desde el almacén local
`Cert:\LocalMachine\Root` al archivo local `backend/storage/app/cacert.pem`.
La validación TLS permanece activa. Este archivo pertenece al entorno local;
no se debe distribuir la autoridad de este equipo a producción.

Si Avast renueva su autoridad, comprobar nuevamente el emisor y exportar la
autoridad correspondiente que Windows ya reconoce. No desactivar `verify`
ni descargar certificados raíz de fuentes desconocidas.

Comprobación de solo lectura desde la raíz del proyecto:

```powershell
php backend/tools/measure-pos.php 2026-10-10
```

Debe indicar `status: ok`; las consultas remotas deben registrar HTTP 200 y
`connection_error: 0`. También se comprobaron los resúmenes del 1 al 5 y del
6 al 10 de octubre de 2026: ambos completos, sin días fallidos.
