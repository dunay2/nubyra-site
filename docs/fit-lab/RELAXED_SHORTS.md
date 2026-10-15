# Pantalón suelto por encima de la rodilla

Base pública verificada: `2a850821b6542f67e1ea6bf6fb8f198603ab97eb`.

## DoR y alcance

El usuario precisa que el pantalón termina por encima de la rodilla y es suelto salvo una condición de ajuste excesivo. El modo actual no dispone de patrón ni tabla de tallas de pantalón: no se puede inferir compresión a partir de la cadera sola. Se corrige la referencia por defecto a un corte suelto, conservando cuerpo, camiseta, colisionador y Worker.

El defecto provenía de obtener la prenda como copia desplazada del cuerpo: las perneras copiaban el estrechamiento del muslo. Una camiseta más larga reducía además casi toda la separación numérica del pantalón en esa zona.

## Cambio mínimo

- Se conserva la topología de la pelvis humana y su transición conectada. No se modifica la anatomía ni se añaden cilindros independientes.
- A partir de una sección de muslo, la pernera mantiene una envolvente con holgura hacia el bajo. La interpolación superior es suave; el bajo no se estrecha como una prenda de compresión. Holgura de diseño de 1,4 cm por radio en el maniquí de 170 cm, acotada en la cara interior para no unir las piernas.
- El bajo se limita por una referencia de rodilla del activo aprobado (altura fuente 0,53 m), dejando como mínimo 3 cm a estatura 170 cm, escalados con la estatura. Es un landmark del modelo, no una medida anatómica validada del usuario.
- Se distingue largo solicitado de largo aplicado. La interfaz muestra el máximo válido de la referencia; no presenta un largo ficticio cuando el bajo está limitado.
- Cambiar solo el pantalón no reconstruye el cuerpo, la camiseta, el BVH ni reinicia el Worker. Se mantienen dos grupos de material y los dos colores.

## DoD

Pruebas numéricas nuevas: 27 combinaciones de estatura, cadera y largo; geometría finita y por encima de la rodilla; posiciones del cuerpo intactas; anchura/profundidad de pernera mantenida hacia el bajo; holgura respecto a la pierna y ausencia de penetración en los vértices muestreados de la pernera; números no finitos y límites.

Prueba de navegador reproducible: `node scripts/fit-lab-shorts-review.mjs`. Compara 40 y 45 cm, frontal/lateral/¾, con y sin camiseta (12 capturas por versión), a idénticas medidas y cámaras. Comprueba que cambiar pantalón no cambia los pasos de tela ni las reconstrucciones de cuerpo/camiseta/Worker. Estatura corta modifica el máximo permitido. No hay scroll horizontal ni anidado.

Se conserva la suite completa de cuerpo humano y benchmark anterior. La validación numérica no sustituye la revisión visual; revisar las capturas antes de publicar.

## Límites

Pantalón estático de referencia, con forma holgada: no es una nueva simulación textil. No detecta automáticamente si una talla real aprieta, porque todavía no existe un catálogo medido de pantalones. No se certifican ajuste ni holgura industrial, ni ausencia de toda intersección camiseta-pantalón en estados dinámicos o fuera de catálogo. La malla humana adulta, el patrón y la física de camiseta no se modifican.
