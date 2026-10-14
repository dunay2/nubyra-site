# Fit Lab — pies apoyados y pantalón continuo

Fecha: 14-10-2026. Base verificada en producción: `fd63c6aff1518684a310b0a1a5607ff20c5f3725`.
Alcance runtime: **solo `outfit-reference.mjs`**. No se modifica solver, collider, patrón de camiseta, catálogo, estado de medidas, controles o interfaz.

## Diagnóstico reproducido

- Los pies eran esferas escaladas de 0,46 unidades de largo y 0,23 de alto (~12,2 × 6,1 cm a estatura 160). Carecían de planta plana y la pierna se unía a un volumen redondo, lo que daba la lectura de muñón señalada por el usuario.
- Piernas construidas por interpolación lineal: tangentes discontinuas en rodilla/pantorrilla/tobillo.
- Pantalón: transición por rama a otra sección en la base del torso, además de usar una elipse de máximos en vez de los puntos de la superficie corporal. La holgura superior de 0,05 unidades (~13,2 mm) sobresalía respecto al contacto de la camiseta (~1,85 mm). No había un material horizontal de «costura» que borrar: parte del defecto era geométrico y parte era intersección visual entre prendas.
- Duplicados en cierre angular recibían normales distintas. La revisión se realiza con y sin camiseta para distinguir uniones del pantalón de solapamiento con la prenda superior.

## Corrección

Pies construidos mediante secciones de tobillo, empeine, talón y punta; base plana triangulada. El borde superior coincide con el extremo de la pierna y comparte normales. Estatura nominal cabeza-suelo invariable. Perfil de pierna cúbico continuo y tobillo más estrecho que la pantorrilla. Las dimensiones siguen siendo **suposiciones de referencia visual**, no antropometría validada.

Pantalón que utiliza las secciones reales del cuerpo en la parte superior; transición gradual a las secciones inferiores y holgura creciente, en vez de un salto. Capa superior de referencia de 0,0035 unidades (~0,93 mm), dentro de la separación de la camiseta en los casos comprobados, sin alterar su física. Se suavizan las normales de cierres y se mantienen exclusivamente dos grupos de material por pierna: principal y franja lateral vertical. No se añade ningún aro de material.

Este cambio no añade colisión entre prendas. Una referencia estática no sustituye una simulación textil del pantalón: no garantiza ausencia de toda intersección en cualquier configuración dinámica futura.

## Dos pasadas

1. Pies con planta y transición continua, eliminación de perfil elíptico superior y comparación de capturas frontal/lateral/¾ en el estado estándar y en el caso del usuario (117/72 cm, 143 cm, N1-1, largo solicitado 52 cm).
2. Las pruebas detectaron diferencia de perímetro entre pie y tobillo al cambiar cadera/altura: corregida sin relajar el test. Corregida orientación de las caras inferiores. Se sustituyó el promedio global de normales por reconciliación de vecinos topológicos: menos asignaciones y menor coste de creación.

## DoR / DoD

| Criterio | Comprobación |
|---|---|
| Base exacta y defecto reproducido | Commit anterior y 12 capturas del mismo Lab, con/sin camiseta |
| Pie extendido y apoyado | Longitud mayor que 2 veces anchura; punta anterior >2 veces extensión del talón; perímetro y centro de planta a cota suelo |
| Tobillo integrado | Coincidencia exacta de posiciones y normales pie-pierna; tobillo <60% del ancho de pantorrilla |
| Escala conservada | Cabeza-suelo coincide con altura nominal; 27 cruces de estatura/cadera/largo de pantalón |
| Sin falsa costura horizontal | Grupos solo longitudinales; normales periódicas iguales; pantalón superior dentro de separación de camiseta en casos estándar y reportado |
| Rendimiento | 7 mallas como antes; 12.696 → 10.856 triángulos; buffers 295.024 → 251.792 bytes (~14,7% menos) |
| No regresión funcional | Suite Node, E2E previo, equipación/commit-on-release/personalización y nuevas vistas |
| Publicación | Solo commit validado; comprobar `/release.json` y repetir vistas/controles sobre URL pública |

## Rendimiento medido localmente

Node 22 / 1 CPU, 15 calentamientos y 30 muestras: creación mediana 4,68 → 3,93 ms; P95 14,42 → 8,77 ms. Son tiempos de creación de la referencia, no FPS de GPU; varían entre ejecuciones. El número de mallas y llamadas de dibujo no aumenta, y el trabajo del solver se conserva byte a byte. La primera versión con un hash de coordenadas para todas las normales costaba más; no se entrega esa variante.

## Límites preservados

Cuerpo inferior y pantalón: `anthropometryValidated: false`, `clothSimulated: false`. No se modifica el aviso ni se atribuyen medidas clínicas al modelo. No hay cambios de UI, scroll, personalización, alta/baja de datos ni despliegue de otro producto. La equipación inferior sigue siendo de referencia, no patronaje de fabricación.
