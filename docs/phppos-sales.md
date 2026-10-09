# Ventas PHP POS — diagnóstico y contrato

## Fase 0 (2026-10-09, antes de implementar)

Consultas exclusivamente GET con curl, secuenciales, clave enviada por stdin desde
backend/.env. Respuestas procesadas en memoria: no se guardaron cuerpos ni datos
de clientes. `backend/tools/diagnose-sales.php` reproduce el diagnóstico y emite
solo métricas, conteos y hashes de IDs, nunca nombres ni credenciales.

| Consulta | Filas | x-total-records | Segundos | Bytes |
|---|---:|---:|---:|---:|
| 1–7 oct, limit=5 offset=0 | 5 | 584 | 0.907 | 15527 |
| 1–7 oct, limit=5 offset=5 | 5 | 584 | 0.677 | 22367 |
| 2 oct, sin limit | 104 | 104 | 2.305 | 509699 |
| 1–7 oct, sin limit | 500 | 584 | 8.567 | 2580111 |
| 9 sep–9 oct (31 días), sin limit | 500 | 2364 | 9.028 | 2683085 |

Las dos páginas de cinco IDs son disjuntas: limit/offset sí funcionan. Existe
tope predeterminado de 500. El rango de siete días devolvió como fecha más antigua
1 oct 18:08; el de 31 días, 2 oct 15:24: no son rangos completos sin paginación.
sort_col=sale_time y sort_dir=asc/desc produjeron los mismos cinco IDs y orden;
no confiar en orden remoto. Se ordena por fecha descendente en Laravel, con ID
descendente como desempate.

Zona horaria: para 9 oct 01:00–02:00, `-05:00` y sin zona devolvieron la misma
venta a las 01:41 (un registro, 2711 bytes, 0.661/0.741 s); Z devolvió cero.
Para 2 oct 00:00–05:00, Z devolvió resultados fuera de ese intervalo local;
`-05:00` y sin zona devolvieron cero. Se adopta ISO con offset explícito `-05:00`,
inicio 00:00:00 y fin 23:59:59 de America/Bogota, sin conversiones implícitas.

Se observaron modos sale/store_account_payment y pago Línea de crédito. No se
observaron anuladas, devoluciones o suspendidas en estas muestras; esas prioridades
siguen el contrato del ticket y se verifican con datos inventados, no se presentan
como confirmadas por producción.

## Decisiones

Descarga diaria paginada de 100; rango inicial de siete días. Solo filas reducidas
en caché, filtros y totales sobre todo el rango; únicamente la página sale al
navegador. Se exige completar un día antes de cachearlo; truncamientos, páginas
repetidas o total cambiante invalidan ese día y activan el aviso parcial.

El ticket prohíbe datos personales pero autoriza expresamente `cliente` en la
whitelist: se transmite únicamente ese nombre acotado, sin contacto, dirección,
saldo ni información financiera adicional. Para `cliente_id`, la caché incluye
un ID técnico interno `_cliente_id` que el Resource nunca expone.

## Autenticación y despliegue

TODO — el login de React todavía es simulado. **No desplegar sin conectarlo a una
sesión Sanctum real.** Las rutas mantienen `auth:sanctum`: sin sesión devuelven 401,
no se ha dejado un bypass de desarrollo. El servicio frontend usa cookies con
credentials: include. Configurar FRONTEND_URL y SANCTUM_STATEFUL_DOMAINS al origen
real; CORS no usa comodines. VITE_API_URL apunta a Laravel, nunca al POS.

El archivo .env del backend conserva la única clave real. .env.example contiene
solo variables sin secretos. No se ha modificado la base de datos del POS.
