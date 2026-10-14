# Fit Lab — selección, tela y tres controles de forma

Versión de trabajo: 14-10-2026. Base: `73f8973b8988fb635a7c231d4dc2a3b1a018c7e6`.

## Cambios

La selección automática reutiliza el recomendador de seis configuraciones. Manual conserva la prenda; un caso fuera de catálogo conserva la última elección y pide revisión. El largo solicitado es un criterio de selección, nunca una deformación arbitraria del patrón.

Tres deslizadores combinables —frontal, lateral y posterior— distribuyen la forma. Pecho y cadera se normalizan mediante el perímetro de los polígonos de sección: cambiar forma no altera los centímetros. La altura cambia la proporción sintética del torso, no representa un cuerpo anatómico completo.

El nuevo solver XPBD aplica gravedad, restricciones de longitud, flexión aproximada, costuras interpoladas y apoyos de hombro. El contacto se evalúa sobre el torso radial obtenido de la malla, tanto para vértices como para centroides de triángulos. El movimiento procede de velocidades/fuerzas y amortiguación, no de una animación sinusoidal de los vértices. Los ribetes siguen a los paneles.

La referencia SVG ahora se obtiene de cortes de los mismos triángulos que se dibujan en 3D. No es una segunda aproximación corporal independiente. Las medidas están dentro del visor; una regla 3D comparte unidades con ambas mallas.

## Dos pasadas y resultados

1. Sustitución del motor, selección automática/manual y pantalla compacta. La retícula inicial de 3.681 partículas resultó costosa y tenía un P95 de deformación cercano al 18 %; se redujo a 1.031 partículas, manteniendo las costuras y los elementos de la prenda. Se inspeccionó `pass1-desktop.png`.
2. Contacto de centroides además de vértices, corrección de las siluetas dentadas mediante cortes de triángulos, controles de movimiento reducido y lectura de diagnóstico vivo. Se corrigió el desfase del snapshot detectado por el navegador. Se volvieron a ejecutar las pruebas y capturas de escritorio, lateral y móvil.

Escenario reproducible de referencia: pecho 88, cadera 96, forma 3/5/5, N1-2, 480 subpasos de 1/240 s. Un solo vCPU de prueba:

- 1.031 partículas, 2.847 restricciones de longitud, 2.601 de flexión aproximada, 56 costuras y 48 apoyos.
- Separación media de vértices frente al collider: ~2,31 cm antes de asentar; ~1,23 cm después. Es promedio espacial, NO holgura industrial.
- ~411 vértices de contacto; descenso medio ~3,92 cm.
- Penetración máxima de vértices y centroides: 0 en este escenario. No garantiza ausencia de intersecciones en toda superficie, otros cuerpos o todo instante.
- P95 de variación de longitud de aristas: ~4,98 %. Máximo ~14,79 %. No es tensión del tejido ni fuerza calibrada.
- Error de perímetros de pecho/cadera en el escenario: inferior a 0,001 cm (precisión numérica del modelo sintético, no precisión de una medición humana).

## DoR

- Alcance explícito: selección y dinámica de una camiseta de ensayo; sin cámaras ni datos personales.
- Estado canónico, catálogo finito y límites de forma definidos; sin inferir morfología de una medida aislada.
- Comparador disponible: rama base, pruebas previas y captura de primera pasada.
- Criterios de salida observables definidos abajo.

## DoD y evidencia

| Criterio | Evidencia |
|---|---|
| Auto/manual y caso fuera de catálogo | Pruebas unitarias de transiciones y navegador |
| Tres controles independientes; perímetros conservados | Pruebas de geometría en extremos y comparación de SVG/3D en navegador |
| Caída por gravedad, contacto y apoyos | Pruebas sobre posiciones, restricciones, contacto y rest inmutable |
| Repetibilidad y límites | Misma entrada/subpasos = posiciones idénticas; valores extremos finitos |
| Movimiento y pausa | Impulso real, amortiguación, parada/reanudación, preferencia reduced-motion |
| UI sin scroll anidado ni overflow horizontal | Navegador real a 1440, 1280, 768, 390 y 320 px |
| Sin errores de ejecución | Registro de pageerror vacío |
| Sin regresión del resto de web | `THREE_TEST_DIR=$PWD npm test` |
| Reproducibilidad | `npm ci`, `npm run build:fit-lab`, `npm run test:e2e:fit-lab` |

Resultados y capturas: carpeta `evidence/`. La publicación debe utilizar el mismo commit y superar una comprobación de la URL habitual. READY no sustituye estas pruebas.

## Racionalización y deuda

Se retiran `fit-geometry.mjs`, `fit-drape.mjs` y `scale-diagram.mjs`, sin consumidores runtime tras la sustitución. Las pruebas específicas de las antiguas fórmulas y del DOM duplicado se migran a los contratos nuevos y a un navegador real. El configurador general y su generador original de camiseta permanecen intactos.

Se eliminan los formularios duplicados de medidas, modos A/B superpuestos a la selección y los parches acumulados de CSS. Las medidas aparecen una vez como entrada; sus lecturas contextualizadas junto al visor son deliberadas. Diagnósticos, altura auxiliar y advertencias metodológicas pasan a un desplegable. La separación de responsabilidades queda en estado puro, geometría/contacto, solver, visor y adaptador DOM.

Límites pendientes: propiedades reales de tejido, densidad y masa calibradas; autocolisión; detección continua y completa de intersecciones de triángulos; pliegues de alta resolución; avatar anatómico; pruebas en teléfonos físicos; validación con patronista. No se presentan resultados de este prototipo como tallaje aprobado.

## Investigación y elección

- Macklin, Müller y Chentanez (2016), XPBD, ecuaciones 17–18 y algoritmo 1: https://matthias-research.github.io/pages/publications/XPBD.pdf
- Biblioteca de referencia PBD/XPBD: https://github.com/InteractiveComputerGraphics/PositionBasedDynamics. No se integra su pila C++ ni se copia su código; se implementa un solver pequeño en JavaScript desde el algoritmo publicado.
- Alternativa WebGPU examinada: https://github.com/jspdown/cloth. No se hace depender el piloto de WebGPU.
- Referencia profesional de separación de colisión: https://support.clo3d.com/hc/en-us/articles/115002798068-Adjust-Collision-Thickness. La separación de colisión es un parámetro numérico, no una talla ni una medición de confort.

No se ha contratado ni calibrado CLO. La implementación es original y reutiliza la geometría de camiseta existente de NUBYRA y Three.js 0.180.0. El empaquetado de producción evita cargar Three.js desde un CDN externo.
