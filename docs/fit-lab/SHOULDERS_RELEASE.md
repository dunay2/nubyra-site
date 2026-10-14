# Torso hasta los hombros — revisión verificable

14-10-2026. Base funcional: `e51b988e2f365394ceacf227b7400f65919d3527` (PR #30, ribetes vinculados a la superficie). Alcance: corregir primero el cuerpo, su contacto y su integración; conservar catálogo, selección, medidas y controles.

## Problema comprobado

La superficie anterior terminaba como un tubo abierto a la altura superior del tórax. No tenía hombros ni transición al cuello. Las sujeciones de la prenda se colocaban en el último anillo, que no representaba una superficie de hombro. La corrección previa de ribetes de PR #30 se conserva.

## Investigación aplicada

- Blender/Blender Studio, Human Base Meshes: topología estructurada y volúmenes cerrados como base de modelado. https://developer.blender.org/docs/release_notes/3.6/asset_bundles/
- Actualización de topologías y simetría: https://developer.blender.org/docs/release_notes/4.0/asset_bundles/
- CLO, Avatar Editor: distingue contornos, altura y forma; advierte de distorsiones al mezclar medidas y formas independientes. https://support.clo3d.com/hc/en-us/articles/33854094900633-Adjust-Avatar-Size
- Browzwear, Olivia: hombros, pendiente y cuello son dimensiones separadas de pecho. Referencia de estructura, no tabla de tallas NUBYRA. https://help.browzwear.com/en/articles/13065659-olivia-size-set

No se importan modelos, escaneos o licencias de estos proveedores. Se desarrolla una superficie paramétrica original y acotada, reutilizando Three.js y el solver existente. No hay dataset antropométrico que permita inferir los hombros reales de una persona con nuestros tres parámetros.

## Implementación

`body-surface.mjs` concentra geometría corporal y contacto: volumen cerrado de cadera a hombros y base del cuello, pendientes suaves, simetría y continuidad angular. Las secciones de pecho y cadera conservan el perímetro poligonal introducido. Los tres controles de forma se mantienen combinables. La anchura de hombros y el cuello son proporciones de referencia explícitamente sintéticas.

El collider interpola las alturas reales de los anillos (ya no uniformemente espaciados). El contacto sobre hombros tiene componente vertical y contempla las tapas, en lugar de empujar toda penetración exclusivamente hacia fuera. Las sujeciones se apoyan sobre la pendiente real del hombro y mantienen las longitudes del parche. La prenda se coloca inicialmente a la altura del soporte mediante una traslación rígida; no se modifica su reposo para forzar el ajuste.

La escala común no cambia. Se amplía de forma fija el encuadre ortográfico para incluir la nueva base de cuello; no se reescala el cuerpo frente a la camiseta. La referencia SVG sigue saliendo de los mismos triángulos del visor.

## Iteraciones y autocorrección

1. Superficie cerrada y hombros. Se ejecutaron las 91 pruebas anteriores: 90 pasaron. La captura frontal mostró un quiebro entre el perfil pectoral original y las nuevas secciones superiores; se corrigió heredando la sección completa y mezclándola progresivamente, no solo copiando su máximo.
2. Colocación inicial coherente con los hombros. Se detectó una tensión artificial al desplazar únicamente los puntos fijados de la prenda. Se trasladó el conjunto antes de fijar los soportes. La prueba anterior de caída por gravedad volvió a pasar SIN rebajar su umbral. Se revisaron frontal, lateral, tres cuartos y espalda, con y sin camiseta.
3. Pruebas adicionales de superficie cerrada, normales, simetría, 36 combinaciones extremas, continuidad, collider, tapas y reproducción 72/74, forma 1/6/0, N2-3 manual.

## DoR

- Caso de usuario identificado: pecho 72, cadera 74, forma 1/6/0, N2-3 manual; largo solicitado 84 y largo de prenda 72 distintos deliberadamente.
- Base de comparación fijada y comprobada: 91 pruebas Node y 10 de navegador.
- Alcance corporal hasta hombros, sin cabeza ni brazos completos ni medición por cámara.
- Mantener geometría de reposo, perímetros, automatismo/manual, accesibilidad y trabajo de PR #30.

## DoD y evidencia

| Criterio | Resultado ejecutado |
|---|---|
| Volumen cerrado y orientación coherente | Cada arista soldada pertenece a dos caras opuestas; volumen positivo y Euler = 2 |
| Sin triángulos degenerados | Área positiva en todas las caras comprobadas |
| Hombros y base de cuello | Dimensiones diferenciadas; prueba de jerarquía vertical y simetría |
| Perímetros y forma | 36 combinaciones extremas; error numérico de pecho/cadera < 0,001 cm |
| Continuidad visual y angular | Mezcla del anillo original y normales soldadas; cuatro vistas inspeccionadas |
| Apoyos y contacto | Sujeciones sobre hombro, reposo inmutable, pruebas de vértices y centroides |
| Regresión completa | 96/96 pruebas Node, cero fallos y cero omitidas |
| Navegador real | 11/11 comprobaciones Chromium/WebGL; cero pageerror |
| Responsive | 1440, 1280, 768, 390 y 320 px sin overflow horizontal ni scroll anidado |
| Publicación | Debe comprobarse el mismo código desplegado y registrar el resultado en la PR |

Comandos: `npm ci --ignore-scripts`; `THREE_TEST_DIR=$PWD npm test`; `npm run build:fit-lab`; `npm run test:e2e:fit-lab`. Las capturas PNG completas se generan en el artefacto de CI; resumen y comparación en `evidence/shoulders/`.

## Límites y resultados numéricos

En 480 subpasos deterministas: referencia 88/96 N1-2, separación media muestreada ~1,22 cm; caso 72/74 N2-3, ~3,62 cm. El segundo caso es una prenda deliberadamente sobredimensionada: no se encoge el patrón para pegarla artificialmente al cuerpo.

Penetración máxima de vértices y centroides: 0 en ambos ensayos. No prueba ausencia de intersecciones en toda la superficie y todo instante. Variación P95 de longitud de aristas: ~6,87 % y ~6,36 %; máximos locales ~37,71 % y ~36,34 %. Estos valores son deformación numérica, no tensión ni confort de un tejido real; señalan que la calibración del tejido y la resolución local del solver siguen pendientes.

Es un torso sintético para ensayos de interfaz y geometría. Pendientes: escáner/medidas de hombro reales, validación con patronista, material calibrado, autocolisión y detección continua completa. No se califica como avatar anatómico exacto ni como prueba industrial.
