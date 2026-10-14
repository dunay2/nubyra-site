# Revisión final de alcance — corte A

Se revisan las capturas reales del artefacto `cut-a-refined-before-after` (run 38647484686), correspondientes a la segunda topología de pantalón, no las imágenes de la primera pasada descartada.

La camiseta se lee por fuera del pantalón y se reduce el volumen exagerado del muslo en frontal, lateral, tres cuartos y espalda. La vista del pantalón solo conserva pequeñas irregularidades de teselación en la entrepierna; no se declara una prenda de confección terminada ni ausencia universal de cruces.

El caso 117/72/143 con N1-1 está fuera de cobertura de catálogo y presenta un cruce previo entre camiseta y borde del torso. La medición conserva el exceso total de 1,74 mm y el adicional de pantalón de 0,25 mm; no se presenta el segundo valor como penetración total. El algoritmo se comprueba de manera independiente con cilindros concéntricos y mantiene el umbral total para los casos con cobertura.

La primera pasada uniformemente muestreada ocultaba un borde crítico del torso. Se descartó y se alinearon las filas del pantalón con las del cuerpo. Una variante posterior de mayor holgura se rechazó al aumentar el cruce de capas; no forma parte del código entregado.

Cabeza, cuello, pies, collider, solver y actualización de controles no cambian. La geometría estática adicional cuesta 32.384 bytes en el caso estándar; no añade llamadas al solver. No se atribuye a este corte una mejora del cuello de botella al editar.

La CI de la PR #39 debe validar el commit final. El despliegue y la repetición de los controles sobre la URL pública se registran como comentario en esa PR cuando terminen.
