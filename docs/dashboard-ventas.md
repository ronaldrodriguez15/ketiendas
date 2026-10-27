# Dashboard con ventas reales

`GET /api/ventas/resumen?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` usa los permisos,
la caché diaria y el límite de 31 días de Ventas. Agrega todas las páginas del
periodo y devuelve indicadores, serie diaria y seis ventas/créditos recientes.
Los campos internos de las ventas no se exponen.

Los indicadores incluyen ventas Pagadas y A crédito; excluyen abonos,
devoluciones, suspendidas y anuladas. El total de ventas a crédito es el importe
original de esas ventas, incluidos otros medios en pagos mixtos: no es el saldo
actual ni el importe financiado. Los días fallidos aparecen como huecos en el
gráfico y activan un aviso de resumen parcial.

## Créditos antiguos

El usuario confirmó contar días calendario desde la venta en America/Bogota,
estrictamente más de 45 días. El filtro `credito_antiguo=1` se aplica antes de
paginar. Las alertas son créditos por revisar, no deudas pendientes confirmadas.

Las alertas aparecen al inicio de Dashboard y Ventas, independientes del periodo
actual de ventas. Inicialmente cubren entre 46 y 76 días de antigüedad. Anteriores,
Siguientes y la fecha final permiten recorrer el histórico en periodos de 31 días.
La cobertura se muestra explícitamente; no es un conteo de toda la cartera.
La consulta inicial espera a la principal para reducir competencia por el POS.

`DashboardSalesTest` verifica agregación completa, pagos mixtos, estados excluidos,
privacidad de campos internos, días fallidos, límite de 45/46 días, paginación,
autenticación y validación con datos inventados.
