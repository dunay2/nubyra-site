# Corrección de picos del delantero y anclajes — 14/10/2026

Base: `92774025de4d24e537fba0c987aa54bff97545d0` (XPBD ya existente). Corrección localizada; se conserva el solver, el catálogo y los tres controles de forma.

## Caso reproducible comunicado

Pecho 72 cm, cadera 74 cm, largo deseado 84 cm; forma frontal/lateral/posterior 1/6/0; selección manual N2-3 (124/135/72 cm). Son medidas del modelo sintético. Una prenda así tiene exceso de tejido y no debe estrecharse artificialmente para aparentar una talla adecuada.

## Causas comprobadas y cambio

1. El ribete usaba tres partículas próximas por distancia, no necesariamente del mismo triángulo, más un desplazamiento fijo en coordenadas del mundo. Tras deformarse la tela, podía separarse del delantero. Ahora cada vértice del ribete queda vinculado a un triángulo real del panel mediante coordenadas baricéntricas; el pequeño espesor sigue la normal deformada. La vinculación se calcula en reposo y es independiente del cuerpo.
2. Los anclajes proyectaban individualmente una banda superior sobre el torso. En el caso comunicado comprimían algunos segmentos fijados un 36,74 %. Se sustituyen por cuatro pequeños apoyos de dos vértices en los tirantes. Cada pareja se traslada rígidamente: conserva su longitud de reposo. La actualización de medidas reutiliza exactamente este cálculo.

El escote en V se mantiene. No se ocultan los ribetes, no se altera la medida corporal y no se reduce la camiseta para disimular el problema.

## Comparación numérica

Entrada anterior, 640 subpasos XPBD de 1/240 s, sin viento. Distancias entre los vértices del ribete delantero y los triángulos de su panel:

| Indicador | Antes | Después |
|---|---:|---:|
| Separación máxima del ribete | 1,6915 cm | 0,1587 cm |
| Separación media del ribete | 0,5993 cm | 0,0799 cm |
| Anclajes rígidos | 44 | 8 |
| Relación mínima de longitud entre puntos fijados / reposo | 0,6326 | 1,0000 |
| Variación P95 de longitud de aristas | 5,32 % | 6,39 % |
| Variación máxima de longitud de aristas | 36,74 % | 27,65 % |

Las distancias usan la escala geométrica del modelo, no precisión antropométrica. No se afirma que todas las medidas de deformación hayan mejorado: el P95 sube ligeramente y permanece bajo el límite de prueba del 10 %. No es tensión ni fuerza de un tejido calibrado.

## DoR y DoD

DoR: capturas y parámetros disponibles; reproducción exacta; comparación de vínculos y anclajes contra la rama base; invariantes de contornos y reposo definidos antes de cambiar el código.

DoD ejecutado sobre la corrección:
- 91 pruebas Node correctas, sin fallos ni omitidas; se conservan las 87 previas.
- Cuatro nuevas pruebas: caso comunicado e impulso; cambio de cuerpo/altura; seis variantes; independencia de los vínculos respecto al cuerpo.
- Espesor de vínculo acotado a 0,006 unidades (aprox. 1,59 mm), pesos baricéntricos dentro del triángulo y suma uno.
- Longitud entre los dos puntos de cada apoyo conservada al cambiar cuerpo y altura.
- Catálogo de camiseta, reposo y contornos corporales sin alteración por la corrección.
- Diez comprobaciones Chromium/WebGL correctas: se añade el caso 72/74 N2-3 y capturas frontal, lateral y tres cuartos; se mantienen las comprobaciones de interacción, movimiento, contacto muestreado y responsive.
- Build autocontenido correcto. Capturas laterales antes/después inspeccionadas visualmente.

Reproducción: `npm ci`, `THREE_TEST_DIR=$PWD npm test`, `npm run build:fit-lab`, `npm run test:e2e:fit-lab`. La CI publica capturas y resultados como artefactos. Para probar un despliegue: `FIT_LAB_URL=https://nubyra-fit-lab-preview.vercel.app/fit-lab/ EVIDENCE_DIR=/tmp/neckline-evidence npm run test:e2e:fit-lab`.

La publicación requiere verificar el commit y repetir la suite de navegador sobre la URL desplegada. Los resultados de CI y publicación quedan registrados en la PR, no se deducen del estado READY.

## Modelados y referencias contrastadas

- Blender, Cloth Shape: distingue anclaje, costura y forma de reposo. https://docs.blender.org/manual/en/5.0/physics/cloth/settings/shape.html
- CLO, Particle Distance: diferencia resolución de simulación y calidad final; aumentar polígonos no corrige por sí solo anclajes incompatibles. https://support.clo3d.com/hc/en-us/articles/115000414447-Particle-Distance-Setting
- Three.js, Triangle: punto más cercano, coordenadas baricéntricas y normal. Son las operaciones usadas para fijar el ribete a una superficie real. https://threejs.org/docs/pages/Triangle.html

No se importa un avatar de terceros ni se presenta esta malla tubular como anatomía femenina validada. Se mantiene pendiente mejorar el avatar, la topología/resolución de la prenda, la autocolisión y la calibración del tejido. Esta corrección resuelve vínculos y apoyos defectuosos; no garantiza ausencia de toda intersección o pliegue irregular en cualquier configuración.
