# Cadera, perneras con holgura y torso superior — primer corte

Base comprobada: `417ae760b87caf9bc815dfd91c4d7fe22e728f94`. Se continúa el Lab existente, sin añadir dependencias ni modificar el solver XPBD, el patrón de camiseta, los controles o la distribución de pantalla.

## Alcance y criterio

El usuario pide menos rigidez en el encuentro cadera–piernas, pies mejor alineados con la cadera, pantalón que no parezca una licra, y una primera mejora de cuello/espalda/pecho. El cuerpo inferior y pantalón siguen siendo referencias visuales paramétricas; las medidas de hombros/cabeza/piernas no se han medido en una persona. Esta entrega no incorpora una simulación textil de pantalón ni una validación antropométrica.

## Cambios

- `outfit-reference.mjs`: ejes de piernas/tobillos/pies más próximos a la cadera, conservando la planta plana y la unión exacta tobillo-pie. Transición superior menos abrupta. El pantalón conserva cintura y capas superiores del corte A; más abajo se separa del perfil de muslo y mantiene una abertura casi vertical. La holgura no procede de escalar toda la prenda.
- Cabeza neutra con transición de mandíbula a cráneo, en vez de una elipse estrecha, sin rasgos faciales. Misma altura nominal cabeza-suelo y contacto con el cuello.
- `body-surface.mjs`: plano de pecho elevado 0,09 unidades (~2,38 cm con altura nominal 160 cm); pecho y cadera conservan los perímetros introducidos. Cuello ligeramente cónico, transición clavícula/trapecio más suave y curvatura escapular contenida. Las posiciones de planos de cadera y cintura no cambian.
- El colisionador se obtiene de la nueva superficie corporal, como antes; no se usa un cuerpo visible distinto del que sostiene la camiseta. La camiseta se vuelve a asentar con el solver existente, sin anclajes nuevos, fuerza de atracción ni trucos de orden de dibujo.
- Actualizada únicamente la aserción de versión del cuerpo en la prueba de navegador anterior. No se rebajan umbrales físicos ni se elimina ninguna prueba anterior.

## DoR

1. Base de producción fijada y fuentes leídas.
2. Casos de imagen reproducidos: 94/96/166, estándar 88/96/160 y extremo fuera de catálogo 117/72/143 con N1-1 manual.
3. Conservar camiseta exterior, pies apoyados, escala, catálogo, personalización y confirmación de barras al soltar/Enter.
4. Sin nueva medición personal ni ampliación de formulario.

## Iteraciones y evidencia

Primera pasada: transición superior de muslo más larga (0,105 del tramo) y pernera independiente. La prueba de capas detectó ~3,05 mm de protrusión adicional en el caso extremo. Se descartó esa transición y se redujo a 0,065 del tramo, todavía más gradual que 0,045 en la base. Las cinco pruebas del corte A volvieron a pasar sin modificar su umbral. Se conserva el diagnóstico separado de intersección total y adicional de pantalón.

Capturas del mismo código del Lab: frontal, lateral, ¾ y espalda, con camiseta, con cuerpo/pantalón y torso sin camiseta. Tres escenarios, 32 imágenes por versión. Las métricas de comparación están en `evidence/hip-torso/metrics.json`. La primera pasada y la refinada se separan en los artefactos; no se presentan como imágenes generadas de un resultado ideal.

## DoD

- Perímetros de pecho/cadera correctos, estatura total y plano de cintura conservados.
- Cuello con anchura decreciente y cabeza asentada; pecho elevado en el modelo, continuidad superficial y contacto comprobados.
- Pies alineados con piernas/cadera, sin deshacer planta ni tobillo.
- Abertura del pantalón más ancha que el cuerpo subyacente y sin estrecharse como el muslo.
- Pruebas anteriores de capas y física correctas. Los casos incompatibles siguen marcados como ensayo fuera de catálogo.
- No trabajo extra de física por arrastrar ni al cambiar textos/colores; pruebas existentes de interacción conservadas.
- Revisión visual de capturas reales y CI del commit final antes de publicación.
- Publicación y repetición de comprobaciones sobre la URL habitual documentadas en la PR, no inferidas de una compilación.

## Coste y límites

En el caso estándar: siguen siendo siete mallas de referencia; 12.296 → 12.352 triángulos y 284.176 → 284.512 bytes de buffers (+336 bytes). La construcción local del torso permanece alrededor de 3 ms y de la referencia alrededor de 10,5 ms (Node 22, una CPU; valores ilustrativos, no FPS ni latencia final). No se cambia el render por fotograma ni se afirma haber eliminado el coste de asentamiento del solver.

La boca de la pernera estándar pasa de ~11,48 a ~14,25 cm de ancho geométrico. La separación entre ejes de pies pasa de ~18,00 a ~16,44 cm. Son decisiones de una referencia sintética, no proporciones antropométricas certificadas. Se mantienen las limitaciones del solver de camiseta (material sin calibrar, sin autocolisión completa) y la ausencia de contacto físico entre ambas prendas.
