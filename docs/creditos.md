# Créditos mayores de 60 días

El módulo incluye ventas con más de 60 días calendario en America/Bogota.
Exactamente 60 días queda excluido. El periodo inicial cubre de 61 a 91 días;
«Anteriores» permite recorrer periodos anteriores de 31 días.

La búsqueda por nombre filtra todos los clientes del periodo antes de paginar,
ignorando mayúsculas y tildes. Espera 300 ms después de escribir. No busca fuera
del periodo seleccionado.

La carga completa usa una cola de hasta cinco consultas simultáneas al POS,
sin esperar bloques completos. El resumen del periodo se conserva 30 minutos
en el backend para reutilizarlo al buscar, paginar y abrir detalles. El navegador
reutiliza resultados durante cinco minutos. «Actualizar» consulta el backend,
que puede responder desde caché. El saldo actual se consulta al abrir el detalle
y conserva su caché independiente de 30 segundos.

`CreditosTest` verifica el límite de 60/61 días, búsqueda, paginación, caché,
consulta de los 31 días y errores remotos. Los totales corresponden al periodo
completo; los días fallidos no se consideran días sin ventas.
