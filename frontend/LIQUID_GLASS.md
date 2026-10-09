# Liquid Glass — Ké Tiendas

## Interacción

Las superficies `.glass`, `.btn`, `.chip`, `.nav` y `.pg` tienen `data-liquid`.
El hook se monta una vez en App y usa eventos delegados en document, incluidos
pointerenter/pointerleave en captura. Resuelve la superficie más cercana para
evitar mover simultáneamente un control y su contenedor. No bloquea eventos.

Se retiraron los transform de hover independientes y el transform persistente
de las animaciones de entrada. Cada superficie reinicia sus variables para no
heredar desplazamiento/escala del contenedor. Un único transform combina
`--tx`, `--ty`, `--sx`, `--sy` y `--rot`. Los wrappers de las rutas no conservan
transform, para que el modal fijo siga cubriendo la ventana completa.

Un único requestAnimationFrame coordina:

- Resorte de stiffness 120 y damping 26, con cuatro subpasos por frame.
- Desplazamiento total hasta .6 px, rotación hasta .1° y escala por velocidad .998–1.004.
  En superficies `.glass`/`.liquid-key`, desplazamiento e inclinación se reducen a la mitad.
- Compresión .996 al pulsar; al soltar, .996 → 1.003 → .999 → 1.001 → 1 en 220 ms.
  Las escalas de clic y hover no se multiplican para evitar superar los límites.
- Parallax interpolado de hasta 4 px y SVG activo actualizado como máximo a 30 Hz.

No hay setState por movimiento. La geometría se lee una vez por frame de entrada,
antes de escribir estilos. Los resortes que se estabilizan dejan de consumir RAF.
La refracción mantiene RAF solo durante hover y su salida amortiguada. Las ondas
duran 450 ms, tienen opacidad máxima .08 y diámetro del 80 % de la dimensión
menor del elemento; se limitan a una por superficie. Se limpian listeners, timers,
clases y variables al desmontar, cambiar preferencias o perder foco.

## Refracción y fondo

Se exige CSS.supports("backdrop-filter", "url(#liquid)") y Chromium. La detección
de sintaxis por sí sola no garantiza renderizado. Safari/Firefox conservan blur,
brillo, resorte, morfismo y clic. Solo sidebar, topbar, modal y botones principales
pueden recibir el filtro; una sola superficie lo usa a la vez. El desplazamiento
varía hasta 1.5 y baja al salir. El ruido cambia lentamente (derivadas de frecuencia
de .00075/s y .0007/s) y la semilla cambia
cuando la amplitud cruza cero para evitar saltos. Tablas/listas/tarjetas no usan SVG.

Background comparte seis manchas entre login y panel, con colores vivos,
duraciones 32–46 s, recorridos de 9–14 vw/vh y desfases distintos. Animan solo transform y border-radius.
La capa es fija; el parallax usa un contenedor separado para no pisar su animación.
Con reducir movimiento se desactivan las interacciones animadas; las manchas
conservan el 20 % del recorrido y duran cinco veces más. En táctil solo hay toque.
Las superficies tienen más blanco y el texto secundario se oscureció para
mantener legibilidad sobre el nuevo fondo.

Todos los valores de intensidad se afinan en `LIQUID_CONFIG`, exportado desde
`src/hooks/useLiquidGlass.js`. El hook publica las variables CSS del brillo
(máximo .12), borde (.75 px, 6.5 s), sombra y onda una sola vez al montarse.
El fondo y el parallax tienen ajustes independientes de los efectos de las superficies.

## Validación

Con Vite en localhost:5173:

```sh
npm run dev
node scripts/check-liquid.mjs
npm run build
```

El script usa Chrome instalado y CDP, sin dependencias nuevas. `CHROME_PATH`
permite elegir otro ejecutable. Crea un perfil temporal aislado y lo elimina.
Comprueba eventos, brillo calculado, resorte, sidebar, paginación, modal,
displacement SVG, squash/onda/rebote, movimiento reducido y toque. El log temporal
de pointermove se instala y retira solo durante la prueba; la aplicación no
incluye logs. También comprueba el gate de respaldo con user-agent emulado y
toma una muestra de frames. Esta muestra headless no garantiza 60 fps en otros
equipos. Safari/Firefox reales y la apariencia en dispositivos físicos requieren
revisión manual.

La ejecución del Ticket 2 en Chrome headless pasó las comprobaciones y registró 59 fps
con p95 de 17 ms en 115 frames medidos, moviendo el cursor sobre un botón.

El build conserva la advertencia previa de Vite por bundle principal >500 kB.
No se agregaron librerías ni requisitos de servidor. La marca sigue siendo
Ké Tiendas y la tipografía Apple usa Inter de Google Fonts como respaldo.
