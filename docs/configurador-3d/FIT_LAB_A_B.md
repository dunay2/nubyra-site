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
