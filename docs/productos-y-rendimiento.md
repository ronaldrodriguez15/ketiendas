# Productos más vendidos y carga del panel

El menú **Más vendidos** abre `/productos`. El endpoint local
`GET /api/reportes/productos?periodo=dia|semana|mes` requiere una sesión activa
y el permiso `ventas.ver`. Acepta `local_id` opcional.

Los periodos usan America/Bogota: hoy, lunes de esta semana hasta hoy y día 1
del mes hasta hoy. La tabla muestra hasta 100 productos ordenados por unidades;
la búsqueda y paginación se resuelven en el navegador sin nuevas solicitudes.
Las gráficas muestran los diez principales y la participación de los cinco
primeros frente al resto. Sus totales se calculan sobre todo el periodo, no
sobre la página ni solo sobre los 100 productos mostrados.

Se incluyen ventas pagadas y a crédito, con cantidades positivas. Se excluyen
anuladas, suspendidas, devoluciones y abonos. No es un reporte de unidades netas
después de devoluciones. Las variantes se agrupan por item_id; los kits tienen
un identificador separado. Se mantienen cantidades fraccionarias. «Ventas» es
el número de recibos que contienen el producto, aunque aparezca en varias líneas.
Se incluyen los artículos/servicios que el POS registra en el carrito; no se
consulta el catálogo completo ni se infieren ingresos a partir de precios.

## Fuente y compatibilidad

Documentación revisada el 9 de noviembre de 2026:

- https://phppointofsale.com/api.php
- https://demo.phppointofsale.com/index.php/api/v1/yaml

La documentación describe `/reports/top_sellers`, pero la instalación conectada
responde 404. Por eso el módulo usa `/sales` y los campos reales de `cart_items`
verificados con una consulta de solo lectura. Las fechas se envían como límites
UTC equivalentes al día de Colombia. No se piden todas las ventas del mes en
una sola solicitud: se conserva la validación de días y `x-total-records` para
detectar respuestas truncadas. Un error no se convierte en un ranking vacío.

## Cambios de rendimiento

- Caché diaria compartida por Ventas, Dashboard, Clientes, Cierre, Créditos y
  Productos. Las entradas antiguas se enriquecen solo cuando hace falta.
- Días históricos: 30 minutos; día actual: 2 minutos. Ranking agregado: 2 minutos.
  Los datos son una instantánea, no tiempo real; ambas capas pueden acumular edad.
- Consultas recientes permanecen en memoria del navegador hasta 30 minutos;
  cada módulo mantiene su ventana de frescura. No se consulta de nuevo por
  cambiar de pestaña. Actualizar continúa disponible; respeta la caché del servidor.
- Cierre no repite automáticamente solicitudes lentas fallidas; el cliente POS
  conserva su reintento limitado de conexión. No se altera la invalidación de Usuarios.
- Precarga del código de una ruta al apuntar, enfocar o tocar su enlace, excepto
  en ahorro de datos o conexiones 2G. No se precargan consultas de todos los módulos.
- El menú y encabezado permanecen montados mientras carga la siguiente pantalla.
- Se elimina la hoja externa de fuentes: el diseño ya prioriza las fuentes del sistema.
- Gráficas del nuevo módulo hechas en HTML/SVG; no descargan Recharts ni nuevas librerías.

Medición local de servicio contra el POS (no tiempo total del navegador): hoy
2.90 s con una consulta remota y 0.63 ms al repetir; mes 7.48 s con ocho días
adicionales y 0.40 ms al repetir. La semana coincidía con hoy (lunes), por lo que
no generó consultas adicionales. Los tiempos dependen del POS, red y caché.

## Verificación

Desde `backend`: `php vendor/phpunit/phpunit/phpunit`.
Desde `frontend`: `npm run build` y `npm run typecheck`.
Diagnóstico manual de solo lectura: `php tools/inspect-top-sellers.php --measure`.
Este último imprime tiempos, número de solicitudes y filas, no ventas ni credenciales.

La ejecución completa pasó con 62 pruebas de backend (585 aserciones) y seis
pruebas de exportación existentes. La prueba `node scripts/productos-browser.mjs`
se ejecuta desde frontend después del build, con Chrome instalado (acepta la
ruta de otro Chrome/Edge como argumento). Usa datos ficticios y comprueba
paginación sin red, caché entre periodos, estados vacío/error/reintento y ausencia
de desbordamiento de página a 1440×1000, 768×1024 y 390×844. No sustituye las
pruebas en dispositivos físicos iOS/Android o Safari.
