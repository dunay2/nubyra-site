# NUBYRA Fit Lab — primer corte de hombros y picos (2026-10-14)

## Alcance y decisión

**Bug reproducido:** puntas superiores visibles en frontal y ¾; bandas delanteras/traseras sin conexión de tela visible. El ensayo original construía triángulos **solo para el solver**, sin geometría 3D de hombro. Había dos parches de anclaje por panel (8 partículas fijadas), y las curvaturas locales del borde superior desarrollaban saltos del orden de 4 cm.

**Primer corte:** eliminar el defecto estructural de las puntas, manteniendo malla del cuerpo, seis configuraciones, selección automática/manual, tres controles de forma, escala métrica, colores y misma implementación XPBD. No se cambia de motor, no se importa el maniquí anatómico como collider y no se recalibran textiles.

## Implementación

- `fit-mesh.mjs`: se elimina la unión ficticia de los bucles superiores (triángulos y enlaces solo en física). Se incorporan **dos mallas renderizadas de hombro** con 6 filas de profundidad y 8 celdas de ancho cada una, parte del mismo material que la camiseta.
- Los vértices de ambas orillas se construyen a partir de los bucles originales de los paneles frontal y dorsal, manteniendo correspondencia exacta de posición y deduplicación en el mismo identificador de partícula XPBD. El reposo es fijo e independiente del cuerpo.
- Las dos bandas participan en el solver mediante triángulos de la propia malla. Su curva superior de reposo se obtiene con interpolación y pequeña elevación de arco; el contacto corporal es el existente.
- Se unifican normales de vértices que comparten partícula simulada. Evita que el sombreado genere una costura falsa en las mitades centrales y entre zonas conectadas.
- Se conserva el anclaje anterior de pequeños parches y se evita introducir pines por vértice o alisar posiciones arbitrariamente después del solver.
- `tests/fit-lab.geometry.test.mjs`: el recuento esperado pasa correctamente de 12 a 14 mallas.
- `tests/fit-lab.shoulder-fabric.test.mjs`: tests explícitos de continuidad de extremos, triangulación, material, picos localizados, continuidad de normales, asentamiento, resto de medidas y geometría de reposo.

## DoR

- [x] Bug observado en screenshots frontal y ¾: picos en extremos de tirantes (2026-10-14).
- [x] Línea base congelada: commit `0dce81fe11a1935d36ee4f5e91835e3a7d0f4e90`.
- [x] Topología localizada: 12 mallas de prenda antes del corte; triángulos de hombro del solver sin malla visible correspondiente.
- [x] Requisito: no perder topología de pecho, largo, catálogo, color ni representación a escala.

## DoD y criterios verificables

| Requisito | Método | Evidencia |
|---|---|---|
| Cintas reales de hombro (dos) | Cada puente tiene vértices e índices de render; extremos coinciden con los ID de la malla frontal y dorsal | Test de topología |
| Sin picos localizados bruscos | Máxima segunda diferencia vertical de las nueve posiciones de cada borde superior, tras XPBD: **<1,2 cm** | Tres casos unitarios; exploración 18 combinaciones |
| Piezas independientes del cuerpo | La geometría de reposo no cambia durante el settle | Deep equality |
| Contacto no peor | Máxima penetración en muestras de centroides triangulares de las pruebas unitarias **<0,1 cm** | Test geométrico |
| Normales coherentes | Duplicados visuales con el mismo ID de simulación tienen igual normal tras sincronización | Test de malla |
| Rendimiento razonable | Partículas ~1.031 → **1.121** (+8,7 %); 14 mallas. No se han introducido nuevas bibliotecas ni endpoints | Diagnóstico del solver |
| Sin regresiones del Lab | `npm test`, compilación y suite Playwright/Chromium | Resultados CI vinculados en PR |
| Sin barras internas / desbordamiento | 1440/1280/768/390/320 px sin scroll anidado ni overflow horizontal | E2E existente |
| Publicación | Publicar commit exacto tras CI verde y repetir inspección sobre URL habitual | Pendiente hasta confirmar despliegue |

## Resultados del laboratorio local

Con **90 frames de settle XPBD**, el caso 88/96 N1-2 pasa de un pico vertical localizado de aproximadamente 4,3 cm a **0,53 cm**. El caso 72/74 con N2-3 manual da **0,79 cm**, y 104/114 N2-2 da **0,95 cm**. Las 18 combinaciones de prueba exploratoria (tres cuerpos, seis camisetas) tienen máximo **1,15 cm**, sin penetración de centroides detectada en el muestreo posterior.

Las pruebas sobre la rama local, antes de CI: 94 correctas, ninguna fallida, una omitida al ejecutar sin `THREE_TEST_DIR`; 11/11 checks de navegador, sin pageerror. En CI se exporta `THREE_TEST_DIR` y no debe quedar ninguna omitida.

**Interpretación:** la medida de pico es un criterio geométrico reproducible de esta malla discreta, no una certificación de ajuste textil. En una combinación físicamente incompatible pueden persistir pliegues y picos de menor amplitud. La exploración extrema ha registrado deformación máxima de arista de hasta ~95 % para prendas deliberadamente demasiado pequeñas en cuerpos máximos; no la ocultamos con clamps cosméticos.

## Fuera de alcance y deuda explícita

- Los tirantes están ahora conectados como superficie y física; no son aún una pieza patronada industrial ni un escote optimizado a todas las morfologías.
- Pueden requerirse bordes/bies de patrón, autocolisión, modelado constitutivo del tejido y una integración posterior con el maniquí GLB de referencia.
- Materiales sin calibrar, sin pruebas con tejido ni usuario final y sin representación anatómica certificada.
- El GLB femenino adulto de `research/female-anthropometry-reference` **se mantiene como referencia visual independiente**, sin sustituir el collider radial del torso sintético de este corte.

## Referencias

- XPBD original: https://matthias-research.github.io/pages/publications/XPBD.pdf
- Nvidia PhysX: surface deformables, attachments y colisiones: https://nvidia-omniverse.github.io/PhysX/ovphysx/latest/simulation_setup/deformables.html
- Blender: física de tela y colisiones: https://docs.blender.org/manual/en/latest/physics/cloth/settings/collisions.html
