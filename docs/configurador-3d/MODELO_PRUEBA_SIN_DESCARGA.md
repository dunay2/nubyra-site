# NUBYRA · Prueba 3D sin descargar el modelo comercial (13/10/2026)

## Alcance
Existe una **camiseta deportiva sin mangas 3D de ensayo**, diseñada para NUBYRA y generada localmente. No es el producto ClothingAxis ni un patrón industrial, y no requiere pagar, registrarse ni descargar un asset de un proveedor.

- Código: [free-test-jersey.mjs](../../configurador-3d/free-test-jersey.mjs)
- Interfaz: botón **«Probar camiseta 3D sin descargar archivos»** en el apartado «Escudo y modelo 3D».
- Geometría: frontal, espalda, paneles laterales y ribetes independientes.
- Materiales: cuatro grupos principales; UV presentes.
- Ciclo: Three.js genera geometría → GLTFExporter produce GLB en memoria → GLTFLoader lo importa → usuario personaliza color, nombre, patrocinadores y dorsal.
- Al elegir el modelo de ensayo, el configurador identifica frontal y espalda como las dos superficies aptas para marcajes; no aplica publicidad a ribetes ni paneles hasta indicación.
- Derechos del ejemplo: **creación original para el proyecto NUBYRA; derechos reservados**. No se ha concedido una licencia CC0 sobre el asset propio.
- Todos los datos introducidos y el GLB temporal permanecen en la sesión local. **No se envían al servidor**.

## Cómo probar
1. En una copia de la rama `feat/configurador-3d-visual-mvp`, ejecutar `node start-3d.mjs` (Node.js 22).
2. Abrir `http://localhost:4173/configurador-3d/` en Chrome o Edge con WebGL activado y conexión para cargar Three.js desde CDN.
3. Pulsar «Probar camiseta 3D sin descargar archivos».
4. Comprobar girando la prenda: frente, espalda, 3/4, lateral.
5. Cambiar número, nombre de equipo, apellido y patrocinadores; seleccionar paletas y colores.
6. Revisar que los textos no atraviesan el material ni invaden las sisas.
7. Volver a importar un GLB externo si se desea; la prueba no reemplaza el modelo del proveedor.

## Controles y límites
- Visualización de **ensayo**, no escala de fabricación, talla, patronaje ni cumplimiento deportivo automático.
- El marcaje usa proyección 2D sobre malla, no mapas industriales de sublimación.
- Los controles de pecho/cadera/largo quedan fuera del alcance actual.
- Si falla la importación GLB interna, el editor mantiene su respaldo gráfico; el error aparecerá en la interfaz.
- CI: pruebas de sintaxis, reglas, geometría real mediante Three.js y conversión GLB → GLTFLoader. **La imagen WebGL final sigue requiriendo revisión visual**, no se valida con pruebas de datos.

## Referencias externas candidatas (no integradas)
1. [Style3D · Black Sports Tank Top](https://sketchfab.com/3d-models/black-sports-tank-top-16b544e3185a474a9e8e5f2c0fb8eb7d): modelo femenino deportivo sin mangas, UV y texturas, CC BY; la descarga puede exigir cuenta. No se han verificado sus archivos.
2. [DaaGHrii · Tank Top for Female 1](https://sketchfab.com/3d-models/tank-top-for-female-21556dc736614bb8aa714e59cf81799f): top femenino, CC BY, aproximadamente 13.100 triángulos; no descargado ni validado.
3. **Modelo definitivo aprobado**: [ClothingAxis · Girls Sleeveless Basketball Tshirt 07](https://www.cgtrader.com/3d-models/character/clothing/girls-sleeveless-basketball-tshirt-07). Se mantiene como objetivo; la disponibilidad del archivo comercial y el alcance documental de la autorización siguen pendientes.

No atribuir a los modelos de terceros características de patronaje que sus fichas no acreditan. No copiar activos CC BY al repositorio sin conservar sus licencias y los créditos exigidos.
