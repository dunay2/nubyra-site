# Corte A — camiseta por fuera y muslos menos abiertos

Base: `7aafe251a2c83440da09c72aef27105bb4ac5b2a`, verificada en la URL habitual. Alcance aprobado: encuentro camiseta–pantalón y volumen superior de muslos. Cabeza, cuello y optimización del render quedan fuera de este corte.

## Diagnóstico y cambio localizado

El pantalón es una referencia estática y sigue las secciones de los muslos. La transición anterior aumentaba su profundidad al bajar de la cadera (20,55 → 23,51 cm en el caso estándar), y ese volumen atravesaba el bajo de la camiseta simulada. No es un problema de orden de dibujo. La sola reducción de la holgura en cintura no soluciona el volumen inferior.

Único archivo de ejecución modificado: `configurador-3d/fit-lab/outfit-reference.mjs`.

- Perfil del muslo superior más compacto, sin crecimiento en profundidad por debajo de la cadera. Reducción gradual hacia las secciones de rodilla existentes.
- Transición más temprana del contorno de cadera a cada muslo, manteniendo la interpolación quintica continua en los extremos.
- Holgura visual de pantalón menor y progresiva (0,0008 unidades arriba, hasta 0,022 abajo; misma escala de 64/2,42 cm por unidad).
- Mallas, suelas, puntos de rodilla, tobillo, cabeza y altura nominal conservados. No se estira, traslada ni altera el patrón o simulación de la camiseta.
- No se cambia `renderOrder`, `depthTest`, `depthWrite`, recorte ni se ocultan caras para tapar el defecto.

## DoR

- Reproducir estándar 88/96/160 N1-2 y captura reportada 117/72/143 N1-1 manual, largo deseado 52 cm.
- Conservar los últimos controles por confirmación, dos colores y dorsal.
- Separar el análisis de referencia visual de cualquier afirmación de simulación de pantalón o antropometría real.
- Fijar antes/después al mismo patrón, estado, tiempo de asentamiento y cámara.

## DoD verificable

- Frontal/lateral/¾/espalda: camiseta por fuera, sin el abultamiento de referencia atravesando su bajo en los dos casos capturados.
- La anchura y profundidad superiores disminuyen sin mover rodilla, tobillo, pie ni altura total.
- Muestreo radial de la superficie de camiseta real frente a vértices del pantalón, tras 90 frames de asentamiento: exceso adicional atribuible al pantalón < 0,05 cm. En casos con cobertura de catálogo también se exige exceso total < 0,05 cm. Un cruce preexistente de camiseta/cuerpo en un caso fuera de catálogo se conserva en el informe total, no se oculta ni se atribuye al pantalón. Es un diagnóstico discreto de superficies, no detección continua de colisión.
- Tests de medición, colores, inputs, física y modo Equipación completa continúan funcionando.
- Siete mallas como antes. El pantalón alinea sus secciones con las del cuerpo para evitar piel atravesando su superficie: en el caso estándar, 10.856 → 12.296 triángulos y 251.792 → 284.176 bytes de buffers (+32.384 bytes). El número de filas depende del largo. No se añade trabajo de simulación por frame ni librerías, pero sí más geometría estática; no se declara mejora de FPS.
- Publicar únicamente tras CI y revisión de las capturas; confirmar el commit servido y probar el caso reportado sobre la URL pública.

## Resultados numéricos previos a publicación

Sección de muslo en fila 4/32 (cm; no es una medida antropométrica certificada):

| Cadera / altura | Ancho antes → después | Profundidad antes → después |
|---|---|---|
| 72 / 143 | 12,04 → 8,91 | 17,63 → 10,69 |
| 96 / 160 | 16,09 → 11,96 | 23,51 → 14,28 |
| 130 / 160 | 21,84 → 16,31 | 31,86 → 19,38 |

Protrusión radial máxima muestreada del pantalón respecto a la camiseta asentada (cm): estándar 0,168 → 0; reportado 2,936 → 0,174; volumen alto 5,114 → 0; holgada 0,018 → 0. La cuadrícula refinada mide también el borde exacto inferior del torso: el residual total del caso reportado fuera de catálogo es 1,74 mm. El cuerpo/camiseta ya se intersecta allí; el exceso añadido por el pantalón es 0,25 mm. Ambos valores se conservan, sin anunciar cero intersecciones. La primera pasada de cuadrícula uniforme había omitido ese borde, por lo que su resultado de 0,1 mm no era una medición suficiente.

`tests/fit-lab.cut-a-layering.test.mjs` añade cinco pruebas: proporciones superiores, capas en cuatro escenarios, y control del propio algoritmo de secciones sobre cilindro conocido, separación explícita de cruce preexistente/adicional con cilindros concéntricos, y coincidencia de las filas del pantalón con las del cuerpo. `scripts/fit-lab-cut-a-review.mjs` captura 16 vistas por versión, con los mismos colores/textos y camiseta activada/desactivada. `scripts/fit-lab-layering-probe.mjs` genera evidencia numérica reutilizable.

## Límites explícitos

El cuerpo inferior y el pantalón siguen siendo referencias sintéticas, sin simulación de contacto entre prendas. No puede garantizarse separación en toda talla, pose, movimiento o entrada fuera del catálogo. No se modifica el cuerpo real de colisión ni se introduce un nuevo motor para simular shorts. La revisión de cuello/cabeza (corte B) y el profiling del render (corte C) no están realizados aquí.

## Segunda inspección y cambio explícito del criterio

No se publicó la primera pasada. Las capturas sin camiseta mostraron piel atravesando el pantalón porque las cuadrículas tenían alturas y ángulos diferentes. La referencia ahora utiliza las alturas originales del torso/piernas y 56 segmentos angulares superiores. El diagnosticado de capas conserva el cruce total y distingue el adicional causado por el pantalón, mediante una prueba independiente sobre cilindros concéntricos. No se amplía silenciosamente el umbral original: se documenta el fallo residual de 1,74 mm en la combinación fuera del catálogo y se mantiene el umbral total en las combinaciones con cobertura. El límite de 0,5 mm del exceso añadido pasa en las cuatro. Cabeza/cuello y el defecto previo en el corte del torso quedan fuera del corte A.
