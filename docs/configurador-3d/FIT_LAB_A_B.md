# NUBYRA · Experimento A/B de independencia entre cuerpo y camiseta

**Estado:** demostrador experimental; no representa a ninguna jugadora, no contiene un avatar calibrado y no valida fabricación. 

**Preview:** https://nubyra-fit-lab-preview.vercel.app/fit-lab/  
**Código:** /configurador-3d/fit-lab/  
**Referencia:** issue #21 y PR #20; este experimento está en PR #22.

## Objetivo
Verificar que el cuerpo y la camiseta se pueden cambiar por separado. Antes de introducir morfotipos/fenotipos, controles de pellizco y selección N1/N2, el experimento debe demostrar dos situaciones:

- **A · Cuerpo cambia:** aumenta o disminuye pecho/cadera corporal y la camiseta permanece con la misma geometría. Esto permite observar si un volumen sintético ocupa más espacio que la prenda representada.
- **B · Camiseta cambia:** aumenta pecho/cadera del tejido o largo inferior, pero el cuerpo mantiene exactamente su geometría. Se mueven todas las piezas de la prenda (frente, espalda, laterales y ribetes) mediante una transformación suave, con preservación de coordenadas UV.

La **altura corporal** se guarda como escala auxiliar de referencia y **no modifica automáticamente la camiseta**.

## Advertencias de validación
1. Los valores en centímetros son **entradas ilustrativas para explorar diferencias**, todavía NO perímetros calibrados sobre secciones reales de estas mallas. El código usa proporciones y funciones de influencia para visualizar el efecto.
2. Los resultados "camiseta − cuerpo" son **diferencias aritméticas nominales**, no holgura medida, contacto físico, tensión o predicción del ajuste.
3. El cuerpo es una malla sintética abstracta creada por el proyecto; **no contiene modelos, fotos ni datos identificativos de menores**.
4. El visor no incorpora tejido elástico, gravedad, colisión/solución física, cálculos de costuras reales o patronaje profesional.
5. No se utilizan MPFB2, OxiHuman ni BVH en esta POC; son candidatos de arquitectura para después y requieren ensayos independientes.
6. La camiseta se construye con la topología propia NUBYRA **v2** de PR #20. No incorpora el asset comercial ClothingAxis.

## Controles
- Modo **A** o **B**. La interfaz bloquea los controles de la malla que debe permanecer fija.
- Sliders vinculados a cajas numéricas: cuerpo (pecho, cadera), prenda (volumen de pecho, cadera y largo).
- Referencia auxiliar de altura corporal sin cambio de malla.
- Visibilidad del cuerpo, transparencia de camiseta, *wireframe* y vistas 3/4, frontal, lateral y espalda.
- Restablecer cada conjunto o todos; exportar estado experimental en JSON; sin backend.

## Arquitectura
- **fit-geometry.mjs:** estados, límites ilustrativos y cálculo determinista de vértices desde posiciones iniciales inmutables almacenadas en WeakMap, con funciones Gaussianas de influencia para pecho/cadera y una función suave de distribución del largo bajo el hombro.
- **fit-viewer.mjs:** genera y manipula dos meshes totalmente independientes, malla corporal de anillos elípticos y malla de camiseta NUBYRA v2. Actualiza normales y límites de volumen cuando cambia una entrada.
- **app.mjs:** modo A/B, binding de controles, estado único en la sesión y exportación local.
- **fit-lab.test.mjs y fit-lab.geometry.test.mjs:** verificación del esquema, independencia de mallas, profundidad, anchura, largo, UV y restablecimiento.

## Siguientes gates (no implementados)
1. Calibración de contornos en sección transversal para traducir centímetros corporales a geometría y de geometría a prenda; holguras por talla validadas por patronista.
2. Prueba de topologías importadas de Blender/MPFB2 con *shape keys* y material textil.
3. Perfiles morfológicos neutrales, sin encasillar corporalmente a menores.
4. Puntos de arrastre por regiones, con estados reversibles y control de no autointersección.
5. Patrón N1/N2 y tres posiciones laterales tras ajuste/fitting del piloto; no deducir la solución de fabricación de una deformación 3D libre.

**No fusionar automáticamente en main ni publicar en nubyra.es antes de revisión visual WebGL y decisión explícita del promotor.**


## Revisión 13/10/2026: talla base propuesta y discretización métrica de ensayo (PR #24)

El usuario ha detectado que el pecho seguía creciendo visualmente sobre todo hacia adelante. Se han aplicado dos cambios verificables:

**Expansión posterior:** el pecho modifica coordenadas X positivas/negativas y Z positiva/negativa. En la vista **Espalda** se dibujan los contornos de una sección real en dos trazos: ámbar = geometría original; azul = geometría actual. Las pruebas geométricas comprueban que los valores Z de la parte trasera son más negativos al aumentar el pecho.

**Jerarquía de producto:**
1. Seleccionar o recibir propuesta de **patrón base N1/N2**.
2. Ajustar pecho, cadera y largo mediante controles en centímetros.
3. Mostrar la etiqueta **−1/0/+1** derivada del valor en centímetros *respecto a esa base*. Al pulsar la etiqueta se fija un representante en centímetros y el deslizador se mueve.
4. Recalcular la **propuesta automática de camiseta** cuando varían las medidas. En el experimento A, aceptar esa propuesta es una acción explícita, para no modificar la prenda mientras se modifica solo el cuerpo.

### Valores numéricos provisionales del demostrador (NO tallaje de fabricación)

| Referencia simulada | Pecho corporal | Cadera corporal | Pecho prenda | Cadera prenda | Largo prenda |
|---|---:|---:|---:|---:|---:|
| N1 | 88 | 96 | 102 | 110 | 64 |
| N2 | 106 | 116 | 120 | 130 | 72 |

Pasos ilustrativos para tres etiquetas: **8 cm pecho, 10 cm cadera y 6 cm largo**. El estado 0 abarca la referencia ± medio paso; −1 valores inferiores y +1 superiores. Se selecciona el tamaño candidato con la menor distancia normalizada (cuadrática) entre medidas y referencias de ensayo; en A se emplean las medidas corporales y en B las de camiseta. La camiseta **activa** puede diferir de la **propuesta**; el cambio solo se aplica cuando se acepta.

Estos rangos, distancias y representantes sirven exclusivamente para verificar la UX y la deformación de malla. **No proceden del patronista, no están respaldados por pruebas de fitting y no autorizan fabricación**.

La memoria vigente de subvención estipula **dos patrones base de camiseta y tres posiciones laterales de ajuste cada uno**; sin embargo, NO detalla los rangos en centímetros. Por tanto, **las etiquetas de pecho/cadera/largo −1/0/+1 no equivalen automáticamente a las posiciones laterales industriales 1/2/3**. Queda pendiente establecer esa relación con patronaje y ensayos físicos.

#### Evidencia y controles de calidad
- [PR #24](https://github.com/dunay2/nubyra-site/pull/24) — clasificación bidireccional y propuesta dinámica.
- [CI #38445862481](https://github.com/dunay2/nubyra-site/actions/runs/38445862481) — 89/89 pruebas completas y 11/11 pruebas geométricas reales correctas.
- Verificar manualmente el trazado ámbar/azul de la espalda, la actualización bidireccional entre centímetros y etiquetas, las propuestas N1/N2 y la separación cuerpo/camiseta.
- nubyra.es debe mantenerse sin modificaciones hasta aprobación.


## Revisión de interfaz: patrón como resultado, no como entrada

**Decisión de producto 13/10/2026:** el usuario introduce medidas y comprueba el ajuste 3D antes de ver la propuesta técnica. N1/N2 son nombres internos de patrones candidatos y **se muestran únicamente en la última pestaña**; no se exige escoger uno al inicio.

La pantalla mantiene un **único visor 3D fijo** (cuerpo sintético y prenda independientes) y el panel derecho cambia entre tres pestañas sin navegar a páginas nuevas:

1. **Medidas.** Pecho corporal, cadera corporal y **largo solicitado de camiseta**. La altura es auxiliar. Este largo es un campo separado del largo de la camiseta que se observa en el visor, de modo que modificar el requisito no modifica silenciosamente la prenda congelada.
2. **Ajuste 3D.** Experimento A (cuerpo cambia / prenda fija) y B (prenda cambia / cuerpo fijo) con barras/cajas sincronizadas, etiquetas visuales -1/0/+1 y rotación del mismo visor siempre visible.
3. **Propuesta.** El recomendador compara **pecho corporal, cadera corporal y largo solicitado** con dos referencias sintéticas N1/N2 usando distancia cuadrática normalizada. Presenta candidato, justificación, estado fuera de cobertura de laboratorio, desglose de medidas y **las seis combinaciones N1-1...N2-3 marcadas como sin validar**. No asigna ninguna posición lateral porque faltan los parámetros industriales y pruebas de patronaje. La camiseta observada solo se sustituye si se pulsa la acción explícita de aplicar; cambiar las medidas solo recalcula la propuesta.

**Prohibición de interpretación industrial:** ni el candidato de patrón ni los intervalos de cm ni la posición lateral son una recomendación validada de talla. Los códigos N1-1...N2-3 representan la arquitectura prevista en la memoria, no seis configuraciones con rangos métricos ya resueltos. El sistema debe permitir «revisión manual» si los valores quedan fuera de las referencias de laboratorio. Los valores de holgura corporal/prenda siguen siendo diferencias **nominales**, no holguras físicas.

**Control de regresión:** pestañas accesibles con roles y flechas, visor persistente, estados independientes, campos de largo solicitado/visual distintos, cuerpo A separado de prenda B, calibración expresamente pendiente, JSON con candidato y posición industrial = null.

**No incorporar en nubyra.es** hasta aprobación visual de la preview aislada de Vercel.


## 13/10/2026 — Camiseta fija, caída estimada, capas y escala 2D

Decisión funcional: no se genera una nueva talla de camiseta continuamente mientras cambian las medidas del cuerpo. La camiseta corresponde a **una configuración finita**, con dimensiones de reposo definidas, pero una misma configuración puede **caer de manera diferente** sobre distintas formas de cuerpo. Una mayor prominencia del busto puede consumir recorrido delantero de tejido y **elevar el bajo frontal**, sin que la camiseta aumente su cantidad de material ni que la espalda corporal crezca.

### Catálogo de ensayo: seis, no infinitas

Se han modelado seis **maquetas sintéticas y discretas** N1-1, N1-2, N1-3, N2-1, N2-2, N2-3. Todas surgen de los dos patrones base y tres posiciones previstas por la memoria; **las cotas numéricas de las seis maquetas son inventadas exclusivamente para probar el software, no homologadas**. Las posiciones reales 1/2/3 deberán definirse industrialmente; el sufijo elegido en pantalla **no equivale a una orden de fabricación aprobada**.

Las dimensiones de reposo se recuperan de ese catálogo, no de los sliders corporales. Los antiguos controles libres de medida de camiseta son **solo lectura**. El motor propone una de las seis maquetas como simulación de comparación, pero no cambia la camiseta mostrada sin acción explícita. Si la medida queda fuera de referencias sintéticas, se marca revisión manual. No se asigna posición industrial validada.

### Caída del tejido: hipótesis de modelado, NO física certificada

El motor:
1. Recalcula el cuerpo de referencia según pecho/cadera y el perfil geométrico seleccionado (frontal, lateral o torácico). Un perfil pectoral **frontal** no aumenta artificialmente Z posterior.
2. Recrea la misma geometría de reposo de una de las seis camisetas, idéntica para dos cuerpos distintos.
3. Comprueba la sección frontal de pecho y determina el desplazamiento delantero visual necesario a una distancia de referencia *en unidades de la malla*, no en cm.
4. Aplica ese desplazamiento a la zona frontal con transición a costados y calcula una subida acotada del bajo frontal para preservar **aproximadamente una única trayectoria central del panel delantero**.
5. Mantiene fijo el reverso geométrico si el único cambio es el busto frontal, conservando UV, y expone diagnósticos: proyección frontal y subida del bajo con equivalencia en cm *solo ilustrativa* según el largo nominal.

No hay simulación de elementos finitos, XPBD validado, gravedad, mecánica de fibras, holgura garantizada, contacto completo, rozamiento, tensión certificada ni fitting industrial. Una sola trayectoria conservada no garantiza conservar todas las longitudes y áreas de panel. Antes de afirmaciones comerciales hace falta patronaje, material real y pruebas.

### Capas 3D y silueta 2D proporcional

- Controles independientes **Cuerpo** / **Camiseta** permiten mostrar ambas capas o solo una. Se evita el estado vacío de ambas apagadas.
- El visor añade una vista **3/4 posterior** y mantiene frontal, lateral y espalda.
- Imagen 2D dinámica en **vista frontal y lateral** con altura del cuerpo y longitud nominal de camiseta a la **misma escala vertical** de 1.26 píxeles por cm. Altera la silueta al cambiar medidas y perfil sintético. Permite visualizar caída inferior delantera y trasera de forma proporcional.
- El anclaje estimado de hombro al **82 % de la altura**, el ancho/depth corporal deducidos mediante una sección elíptica y la estimación de caída son **supuestos gráficos**, no landmarks personales ni proporciones antropométricas verificadas. Escala fiel de longitud vertical no significa reproducción exacta del cuerpo.
- La altura sigue siendo **auxiliar**; el largo solicitado y la longitud real de la camiseta elegida son datos distintos.

### QA indispensable

- Las seis alternativas son discretas y ninguna variación corporal modifica sus dimensiones de reposo.
- A igualdad de talla, distintas proyecciones frontales pueden cambiar la caída del delantero sin mover artificialmente la espalda.
- El perfil torácico explícito es el único que permite proyectar incremento de tórax hacia atrás.
- Las capas 3D/2D se sincronizan; los campos permanecen accesibles y la navegación por pestañas funciona.
- La silueta 2D mantiene escala vertical común y no presenta predicciones de calidad o ajuste.
- La aplicación de una propuesta cambia la **variante de reposo**, no el cuerpo.
- **nubyra.es no se modifica** antes de revisión visual humana y aprobación de integración.


## 13/10/2026 — Restricción: cero de busto es plano, nunca una cavidad

**Observación del usuario (captura de visor lateral):** el motor había permitido que una variación negativa de perímetro redujera la profundidad pectoral por debajo de su superficie de referencia. Esto creaba una falsa depresión/pecho hacia dentro, físicamente injustificable para el objetivo de esta POC.

**Corrección del contrato geométrico:**
- El **contorno de pecho corporal en centímetros** y la **proyección frontal del busto** son variables distintas. Un perímetro por sí solo no fija la protrusión anterior.
- Se añade un **nivel explícito de proyección 0 a 10**, experimental y **NO medido en cm**, con **0 = superficie torácica neutra, sin relieve de busto**. Los valores negativos se limitan a cero y los mayores a 10. No se interpreta el nivel 0 como ausencia de tórax: el torso mantiene su espesor.
- Se elimina el relieve positivo pectoral codificado en la profundidad geométrica de la **malla de cuerpo neutra**. La proyección adicional frontal se suma **solo con amplitud no negativa**, modulada por perfil, altura y lateralidad; nunca se calcula multiplicando la profundidad frontal por una variación de contorno negativa.
- Una reducción del perímetro de pecho puede cambiar la **anchura** del tórax, pero no hace retroceder la superficie anterior ni dibuja una cavidad. Una modificación posterior se reserva al perfil torácico explícito, no al busto.
- La **silueta lateral 2D** utiliza el mismo nivel 0 a 10: con 0 se dibuja superficie torácica base, con 1-10 relieve positivo. Se mantiene la escala vertical de altura/largo y se indica expresamente que los centímetros gráficos horizontales son ilustrativos, no metrología.
- Los controles de Medidas y Ajuste 3D se sincronizan, tienen min=0 y max=10, y el JSON conserva el nivel y su valor acotado.

**Pruebas de aceptación:** cualquier entrada negativa produce exactamente la misma geometría que 0; cambiar el contorno corporal por debajo de 88 cm con proyección 0 **no reduce la profundidad frontal neutra**; subir proyección a 3 y 10 aumenta el relieve frontal de manera monótona sin cambiar la espalda para el perfil frontal; representación 2D coherente; la camiseta continúa siendo una de las seis variantes finitas y solo cambia su caída estimada.

No se ha construido un maniquí antropométrico real ni se ha demostrado física textil, contacto integral o fitting industrial. Esta corrección asegura la **restricción no negativa del relieve**, no la fidelidad anatómica integral.
