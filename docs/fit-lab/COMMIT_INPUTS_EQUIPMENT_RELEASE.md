# Fit Lab — confirmar medidas, vista de equipación y personalización

Base comprobada: `1c86fa500c23928b3ca1f4d79006df1006d54248`, 14-10-2026.

## DoR

- El usuario observa reconstrucciones intermedias durante el arrastre; el controlador escuchaba `input` y `change` y ejecutaba física en cada fotograma.
- Petición: aplicar solo al soltar/confirmar, incorporar cuerpo inferior para altura y referencia de pantalón, recuperar nombre, equipo, dorsal y dos colores.
- Conservar simulación XPBD del torso/camiseta y seis configuraciones. No introducir una física nueva en este corte.

## Implementación

`commit-fields.mjs` mantiene borradores locales. `input` actualiza solo números y ayudas; el estado físico y el recomendador se actualizan en `change`/soltar, Enter o pérdida de foco. Teclas mantenidas agrupan hasta `keyup`. Escape y cancelación de puntero descartan el borrador. Un número vacío o fuera de rango nunca se convierte en cero. Un commit repetido del mismo valor se descarta. Mientras se edita se suspende el cálculo del tejido, no la lectura ni la cámara. Se conservan los valores aplicados en el visor y la exportación, separados de los pendientes.

`kit-design.mjs` reutiliza normalización de texto, dorsal, colores y ajuste tipográfico de `configurador-3d/layout.mjs`. Dos CanvasTextures se actualizan sin reconstruir la malla ni recalcular física. Los textos se aplican en las UV del material y se deforman con la camiseta, no son carteles flotantes. Nombre detrás, equipo/dorsal/patrocinador, color principal y secundario. No envía estos datos a un servicio ni los persiste sin acción; exportación local del ensayo incluye diseño. Texturas liberadas al destruir el visor.

`outfit-reference.mjs` añade, bajo «Equipación completa», piernas, pies y cabeza neutra para completar la referencia de estatura, y pantalón con largo independiente. Todos usan la misma conversión métrica que el torso. La regla va desde el suelo hasta la altura nominal. Se conserva «Torso» para inspeccionar el ajuste sin reducir la escala visible de la camiseta. La vista 2D toma las mismas geometrías. Pantalón con dos grupos de material por pierna (no un draw call por triángulo).

**Límite explícito:** el cuerpo inferior es una referencia sintética de proporciones, no anatomía personalizada deducida del pecho/cadera; el pantalón es un volumen de diseño y largo, no una talla ni una prenda simulada. No se ha añadido contacto camiseta-pantalón ni colisiones con las piernas al solver. Su referencia queda etiquetada en la interfaz y el JSON. No usar para afirmar ajuste industrial. No se modifican cuerpo/collider ni catálogo existentes.

## DoD y pruebas

- 40 eventos `input` en una barra: cero reconstrucciones/actualizaciones físicas intermedias; `change` más `pointerup`: una actualización final.
- Edición numérica: sin cálculo al escribir, una actualización al pulsar Enter, ninguna duplicada al salir del campo; borrado inválido y Escape conservan estado anterior.
- Textos/segundo color: cambian la textura con el mismo contador de geometría y los mismos pasos de física.
- Vista completa: diferencia cabeza-suelo igual a estatura nominal, misma escala; activar o desactivar no altera el ajuste de camiseta.
- Largo de pantalón: independiente del solver; límites 25–60 cm de maqueta, no recomendación de talla.
- Límites de estatura 125/160/190 cm verificados; geometría finita y plantilla de torso intacta.
- Repetir cambios de vista sin fuga de geometrías, responsive 1280/768/390/320 px sin scroll anidado.
- Suite previa de física conservada. Los helpers E2E confirman los inputs con `change`, conforme al nuevo contrato; no se rebajan umbrales físicos.
- Capturas frontal/espalda con marcajes y cuatro vistas de equipación completa, más móvil.

## Evidencia inicial

Ensayo Chromium software 1 vCPU: cuarenta borradores se procesaron en ~2,7 ms de manejadores JS; cero trabajo físico. Es una medida de la interacción, no del tiempo de asentamiento. Aplicar la medida final aún tiene el coste del solver existente. Las siete comprobaciones E2E nuevas pasaron, pendientes de la ejecución final de CI y verificación pública.

## Referencias

- MDN, `input`: https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event
- MDN, `change`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event
- Three.js CanvasTexture: https://threejs.org/docs/pages/CanvasTexture.html
- Liberación de texturas: https://threejs.org/manual/pages/how-to-dispose-of-objects.html

## Deuda acotada

No se declara resuelta la calibración textil, el acabado de sisa ni el patronaje de pantalón. El siguiente trabajo de pantalones requiere medidas y catálogo propios; no ampliar silenciosamente el contrato actual de pecho/cadera/largo. Tampoco se vincula una malla anatómica adulta al piloto infantil.
