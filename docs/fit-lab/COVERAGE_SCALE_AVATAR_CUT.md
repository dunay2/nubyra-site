# Cobertura, escala comparativa y apariencia

Base: 0c5e754. No modificar la anatomía, patrones ni su longitud para esconder los huecos.

El stencil de la silueta completa de camiseta deshabilitaba píxeles del pantalón aun cuando la cara de camiseta que escribió la máscara estaba detrás. Se elimina ese pase sin profundidad; las dos prendas físicas utilizan el z-buffer normal. Se añaden medidas independientes de los bajos para distinguir un artefacto de render de una longitud real desigual.

La foto mantiene su proporción original, se alinea con los pies y usa los mismos píxeles verticales por cm proyectado que el avatar. Los marcadores de cabeza/pies siguen siendo de una referencia sintética de escenario, no antropometría medida. Pan y zoom siguen libres y actualizan también la foto.

Ojos: iris centrados más definidos, esclerótica sombreada y material ocular separado del labio/cejas. Pelo: mechones menos uniformes y recogido con capas, puntas afinadas y caída curvada. Apariencia estilizada y render-only.

Rendimiento: fetch paralelo de malla, bootstrap y catálogo; plantillas del short construidas sólo al usarse; recorrido BVH exacto con invalidación sobre triángulos móviles; menos asignaciones en contactos por centro de triángulo. No se reducen pasos ni se altera el tejido. Una comparación local R08 pasó de 16,604 a 13,138 segundos (no tiempo de descarga), con posiciones Float32 de ambas prendas idénticas.

Se requiere revisión HTTP/WebGL en CI antes de publicar. El Chromium local no permite navegar a loopback y no dispone de contexto WebGL; no se cambia esa política.
