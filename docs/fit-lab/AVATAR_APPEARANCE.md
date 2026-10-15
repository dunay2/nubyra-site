# Avatar: pelo recogido y piel natural

Base: c743651356e5a97bacfb1080bbaf9f1c1dca75b9 (PR #44, pantalón suelto sobre rodilla).

## Cambio solicitado
La intervención se realiza sobre el muñeco 3D del Lab. La imagen comercial generada en el chat no modificó la aplicación.

- Material de piel cálido #c99377, acabado no metálico.
- Cabello castaño oscuro con recogido compacto. La capa se recorta sobre los triángulos del cuero cabelludo de la malla aprobada; acompaña la transformación exacta de la cabeza al cambiar la estatura.
- Dos mallas visuales adicionales, construidas una vez. Sin animación capilar ni trabajo de pelo por fotograma.
- La apariencia se carga únicamente en el visor; no se importa en el Worker ni se añade al BVH corporal. Se conservan GLB, posiciones, índices, medidas y colisiones del cuerpo.
- Visibilidad heredada del cuerpo y liberación explícita de materiales/geometrías.
- La caché del pantalón deja de depender del largo de camiseta. Se conserva el corte holgado de la PR #44.

## Validación
Se añaden pruebas de invariancia de los buffers y el BVH, seguimiento en tres estaturas, posición sobre hombros, visibilidad y liberación de recursos. La CI existente captura el muñeco real desde frontal, lateral, tres cuartos y espalda, además de ejecutar regresiones del Worker, controles y pantalón.

Revisar CI y capturas antes de publicar. No fusionar automáticamente. El pelo es una representación geométrica sencilla, no simulación capilar. No se cambia la antropometría ni se atribuye validación física al pantalón estático. Este cambio no resuelve el intercambio pendiente de la camiseta mientras llega una nueva revisión del Worker.
