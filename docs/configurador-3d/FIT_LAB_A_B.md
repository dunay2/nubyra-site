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
