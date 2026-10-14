# NUBYRA Fit Lab — tirantes, contacto y rendimiento

Fecha: 2026-10-14. Base publicada: `9ae270a7343a5f597584d9e715eee2ded79f2116`. Rama: `feat/fit-lab-natural-shoulder-contact`.

## Decisión y alcance

Se conserva el motor XPBD y el patrón de reposo independiente. No se añade adhesión artificial al cuerpo, otro motor ni nuevas dependencias. La distancia numérica de colisión se reduce de 0,012 a 0,007 unidades (3,17 a 1,85 mm). La flexión de restricciones próximas a los tirantes usa compliance 0,0015 frente a 0,003 en la tela general. El viento ilustrativo carga menos los hombros y más el bajo libre.

Estos coeficientes son de un modelo de ensayo: no son propiedades de un tejido identificado. No se sustituye el torso sintético por el GLB femenino adulto ni se infieren nuevas medidas de las jugadoras.

## Dos pasadas

1. **Apoyo y estabilidad.** Comparación de soporte de cuatro puntos en la coronación, desplazamientos de anclajes, márgenes de contacto y rigidez local. Se descartaron las alternativas que aumentaban deformación local o separación. Se mantiene el soporte de ocho vértices y se ajustan contacto/flexión. Ninguna posición se alisa después del solver para esconder el error.
2. **Movimiento y pantalla.** Menos carga de viento en las bandas; reposo detectado por velocidad baja durante 32 subpasos. Render bajo demanda: al quedar quieta la tela no se siguen consumiendo fotogramas. Los cambios de cámara, color y capas vuelven a dibujar; cambios físicos e impulso reactivan la simulación. La sombra del material no se utiliza para ocultar penetraciones.

## Correcciones de sincronización y fallos

El caché SVG anterior no se invalidaba al editar el cuerpo: se corrige la invalidación inmediata. Las proyecciones animadas se muestrean como máximo cada 700 ms; los cambios explícitos invalidan el caché sin esperar ese intervalo. Los grupos de normales compartidas se calculan una vez, evitando reconstruir mapas en cada frame. Color y cambio de vista no reconstruyen el cuerpo ni la camiseta. Los recursos de la prenda anterior se liberan al seleccionar otra configuración.

El visor gestiona pérdida y recuperación de contexto WebGL conservando parámetros. Una deformación numérica máxima superior al 50 % muestra un aviso de revisión; es un umbral interno conservador del ensayo, no un límite de elasticidad textil.

## Evidencia numérica antes/después

Se ejecuta `scripts/fit-lab-contact-report.mjs` sobre ambas versiones con los mismos parámetros y 90 frames de asentamiento. Las regiones se fijan en la geometría de reposo: los porcentajes son **área de reposo ponderada con distancia del centroide de cada triángulo**, no porcentaje de personas ni una medida clínica. La distancia es la del collider sintético.

| Caso | Mediana distancia tirante/cuerpo antes → después | Área de tirante a ≤1 cm antes → después | Quiebro superior antes → después |
|---|---|---|---|
| A: 88/96, N1-2 | 4,65 → 3,86 mm | 85,0 → 90,0 % | 5,39 → 5,42 mm |
| B: 72/74, N2-3 manual | 6,07 → 4,85 mm | 62,2 → 72,4 % | 7,93 → 7,51 mm |
| C: 104/114, N2-2 | 5,11 → 3,80 mm | 78,2 → 71,8 % | 9,58 → 8,28 mm |

En C mejora la mediana y el quiebro, pero empeora el porcentaje de superficie bajo 1 cm y la cola P95 de separación: no se presenta como mejora uniforme. La tela B sigue holgada abajo: mediana 3,28 cm, en vez de pegar una prenda demasiado grande al cuerpo.

Matriz completa: tres cuerpos × seis camisetas, 18 cruces por versión. Penetración muestreada máxima: 0 mm en los estados asentados analizados, sin garantía de toda la superficie o de todos los instantes. Máximo quiebro: 12,06 → 10,84 mm. A/N2-3 excede por 0,84 mm el objetivo de 10 mm; queda señalado para revisión y **no se rebaja el objetivo**. En los tres casos principales el quiebro es inferior a 10 mm.

Sin aumento de partículas o restricciones: 1.121 partículas, 6.080 restricciones, ocho apoyos. Buffers geométricos: 170.832 bytes; arrays del solver: 116.584 bytes. Estos tamaños no incluyen objetos JS, GPU ni todo el navegador. Los tiempos CPU de asentamiento medidos están alrededor de 1,6–1,7 s en un sandbox de un núcleo; no se declara una aceleración del solver por cambiar materiales.

## Fuentes primarias aplicadas

- XPBD (Macklin et al., 2016): https://matthias-research.github.io/pages/publications/XPBD.pdf
- Three.js: render bajo demanda, cámara y colores: https://threejs.org/manual/pages/rendering-on-demand.html
- Blender: una distancia de colisión excesiva puede dar apariencia de tela suspendida: https://docs.blender.org/manual/en/latest/physics/cloth/settings/collisions.html

## DoR

- [x] Capturas aportadas: bandas retorcidas, extremos levantados y separación superior.
- [x] Commit de partida y URL publicados verificados antes de modificar.
- [x] Patrón de reposo, cuerpos, catálogo y controles conservados.
- [x] Regiones de medida y tolerancias definidas antes de comparar.
- [x] Causas y alternativas identificadas y medidas.

## DoD de la entrega de software

- [x] Superficies y uniones reales de ambos tirantes conservadas, separación de costura 0 en las muestras.
- [x] Tres casos principales: quiebro <1 cm y penetración muestreada <1 mm; patrón de reposo sin alterar.
- [x] Movimiento de bajo mayor que hombros; recuperación comprobable después de quitar viento.
- [x] Caché de referencia corporal invalidado al cambiar medidas; color no ejecuta la física.
- [ ] Suite completa Node y navegador, artefactos de CI y capturas revisados (resultado final en PR).
- [ ] Despliegue del commit exacto y repetición de pruebas sobre URL pública (resultado final en PR).

## Límites que NO se dan por cerrados

- [ ] Todos los cruces del catálogo por debajo de 1 cm de quiebro: un caso holgado requiere revisión.
- [ ] Calibración real de tejido, espesor, fricción, elasticidad y patronaje.
- [ ] Autocolisión y detección continua de intersecciones en toda la superficie.
- [ ] Validación anatómica y física del piloto infantil con supervisión y medidas autorizadas.

Los ensayos de escritorio y móvil son viewports de Chromium, no teléfonos físicos. Los tiempos de `renderer.render` son tiempo CPU de envío de trabajo; no equivalen a tiempo GPU ni a FPS de un dispositivo real. La validación del software no certifica el ajuste textil.
