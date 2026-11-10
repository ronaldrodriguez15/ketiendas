# Informe de ventas por cliente

Clientes utiliza `/api/reportes/ventas-clientes`, con autenticación y permiso
`ventas.ver`. Proveedores y los endpoints `/customers` conservan su comportamiento.
El periodo inicial incluye hoy y los 29 días anteriores en America/Bogota;
se admiten intervalos de hasta 31 días. La búsqueda se aplica antes de paginar.

Fuentes consultadas el 30 de octubre de 2026:
- https://phppointofsale.com/api.php
- https://demo.phppointofsale.com/index.php/api/v1/yaml

La especificación documenta `/reports/summary_customers`, pero la instalación
conectada devuelve 404. Se usa `/sales`, comprobado en esta instalación, y
`/items/{id}` para identificar servicios. El informe no requiere una actualización
del POS ni modifica datos remotos.

Se suman `subtotal`, `total`, `tax` y `profit` originales, conservando decimales.
Se agrupa por `customer_id`, no por nombre. Los datos de contacto provienen de
la venta más reciente del periodo. Las ventas anuladas y suspendidas se excluyen;
las devoluciones conservan sus importes originales. Los abonos se incluyen en
importes y número de transacciones para reproducir el informe aportado por el usuario.
Por esta razón sus totales pueden diferir del Dashboard, que excluye abonos.

El recibo promedio es total / transacciones. El promedio de unidades excluye
servicios (`is_service`) y artículos de abonos; conserva cantidades fraccionarias
y negativas. Un artículo sin identificador resoluble (por ejemplo un kit no
desglosado) deja el promedio sin información, nunca inventa un cero.

La primera consulta solicita los días del intervalo en paralelo (máximo cinco
solicitudes simultáneas), porque el POS trunca las consultas mensuales grandes.
Valida la integridad
con `x-total-records` si existe. Una respuesta truncada, duplicada o fuera del
periodo falla explícitamente. Se conservan días históricos durante 30 minutos
y hoy durante 2 minutos, en una caché diaria compartida con Ventas, Dashboard,
Cierre, Créditos y Productos. Las entradas antiguas sin campos de reporte se
renuevan al necesitarlos. Las clasificaciones
de artículos se cargan en paralelo, hasta cinco a la vez, solo para la página
visible, y se conservan 30 minutos. Buscar y paginar reutiliza las ventas cargadas.

Pruebas: `php artisan test --filter=CustomerSalesReportTest` desde backend.
Cubren importes originales, devoluciones, abonos, servicios, cantidades decimales,
límites de fechas, búsqueda, paginación, truncamiento y actualización de cachés antiguas.
