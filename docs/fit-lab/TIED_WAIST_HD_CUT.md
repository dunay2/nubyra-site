# Cintura sujeta y referencias HD

Partida: `9f3df80fa1b03a75bf17d33f768592b865444d28`.

La vista normal presupone el cordón atado en la cintura anatómica del avatar (`waistY`). Se elimina el descenso gravitatorio de una cinturilla rígida sin sujeción. No es una predicción del elástico: es una condición de contorno explícita para el prototipo. Una talla con contorno insuficiente se rechaza; el cordón no amplía el patrón.

Cada plantilla mantiene sus medidas en reposo, tiro y largo. Una copia para visualización recoge únicamente los 12 cm superiores contra la sección corporal, sin desplazar vértices en Y ni tocar el cuerpo o las perneras. El JSON exportado registra el amarre asumido y el ajuste local. La camiseta sigue exterior mediante el acabado de contacto existente; no se certifica contacto textil entre prendas.

Se sustituyen los ocho recortes de baja resolución por ocho retratos sintéticos individuales, de 1086 × 1448 px. Los originales de la usuaria no se sobreescriben. Los retratos son referencias visuales, no sujetos medidos: estatura, peso y contornos siguen siendo datos de escenario. No se deriva talla de una fotografía ni del peso. Recursos WebP separados y miniaturas pequeñas evitan descargar los ocho retratos completos al abrir el Lab. El manifiesto registra dimensiones, puntos visuales cabeza/suela, bytes y SHA-256.

Conservado: visor interactivo central, referencias a la derecha, foto original seleccionable, caída en vivo de la camiseta, pelo 2.1 y patrones independientes.

La ampliación fotográfica de la chica original no forma parte de estos ocho retratos; sigue disponible intacta. La física del elástico y un sistema deformable completo de pantalón continúan sin calibración.

Validación: suite Node completa y revisión de navegador `scripts/fit-lab-waist-hd-review.mjs`, junto a galería y visor humano existentes. Las capturas de cintura se inspeccionan antes de asignar el alias del laboratorio. El navegador local restringe navegación a localhost; la validación HTTP/WebGL se ejecuta en GitHub Actions, sin modificar esa política local.

## Revisión visual posterior

La primera ejecución mostró dos pequeñas penetraciones en la zona posterior inferior. Se añadió un acabado de contacto local frente/espalda sobre vértices, centros y aristas, con un máximo de 3 cm y sin cambiar Y, longitud, tiro ni plantilla. No se oculta el cuerpo. El código rechaza el conjunto antes del intercambio cuando ese límite no basta; por ejemplo, el patrón de tiro fijo actual no resuelve el caso de 200 cm. Se conserva el cuerpo vestido anterior y se explica la incompatibilidad. No se trata de una restricción por altura: es el contacto geométrico del patrón con el cuerpo concreto.

La revisión de navegador comprueba 18 combinaciones en cuerpos de 145, 153 y 170 cm y añade un caso explícito de rechazo de 200 cm. Las ocho miniaturas ahora usan un área de retrato mayor, sin deformar la imagen.
