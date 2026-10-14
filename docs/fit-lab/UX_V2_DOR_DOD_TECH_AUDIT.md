# NUBYRA Fit Lab — DoR, DoD y deuda técnica (UX v2)

Fecha: 2026-10-14. Estado: prototipo de investigación; sin validación de patronaje.

## Definition of Ready (DoR)
- [x] Problema registrado: scroll interno del visor/editor, escala fuera de la zona de comparación y prenda demasiado separada.
- [x] Alcance de la iteración: una única zona de comparación, scroll único del documento, proximidad visual acotada y estado sincronizado.
- [x] Restricciones: conservar los ID del DOM, controles, catálogo discreto, independencia entre geometría corporal y prenda y alternativa accesible.
- [x] Criterios observables acordados: ausencia de `overflow-y:auto` efectivo en paneles; escala visible junto al visor; controles con valores consistentes en todas las vistas.
- [ ] Criterio físico contrastado con patronista y tejidos reales: **no disponible**. La deformación NO es simulación de gravedad/contacto textil.

## Definition of Done (DoD) — requisitos de salida
| ID | Criterio y método | Estado |
|---|---|---|
| UX-01 | Visor + escala en el mismo bloque (inspección DOM/CSS y viewport desktop/móvil) | Implementado, prueba visual pendiente |
| UX-02 | Ningún scroll vertical anidado en `.view-panel` ni `.editor-panels` | Implementado, prueba visual pendiente |
| UX-03 | Textos redundantes reducidos sin quitar avisos críticos de no validación | Implementado |
| GEO-01 | Proyección frontal permite acercamiento acotado al cuerpo, también para separación excesiva | Implementado, prueba geométrica pendiente |
| GEO-02 | No se afirma física de tejido, gravedad, contacto o validación industrial | Cumplido |
| SYNC-01 | Cambio de pecho, cadera, largo o perfil actualiza entradas, gráfico 2D, recomendación y mallas 3D según su dependencia | Revisión de rutas completada; prueba E2E de navegador pendiente |
| ACCESS-01 | Pestañas y controles accesibles por teclado, sin bloqueo de contenido | Revisión pendiente |
| BUILD-01 | Smoke DOM y test geométrico completos en CI | Pendiente ejecución con Three.js |
| FIG-01 | Figma editable en la cuenta drios5@uoc.edu con layout y principios | Creado |
| RELEASE-01 | Preview Vercel comprobado, PR revisada, sin regresiones y sin sobrescribir URL estable | Pendiente |

## Responsabilidades de estado
- `app.mjs`: único objeto `state`; `redraw()` sincroniza controles, etiquetas, propuesta, referencia SVG y geometría.
- `fit-geometry.mjs`: separación cuerpo/prenda, parámetros de entrada y configuración discreta.
- `fit-drape.mjs`: aproximación geométrica acotada, NO solución física.
- `scale-diagram.mjs`: proyecciones y métricas 2D.
- `fit-viewer.mjs`: geometría WebGL y cámara, sin decisiones de patronaje.
- `styles.css`: composición visual y responsive.

## Auditoría de racionalización (no borrar sin evidencia)
1. **Deuda alta — CSS acumulativo:** varias reglas para `.view-panel`, `.editor-panels`, `.scene` y media queries. Consolidar por componentes tras aprobar esta distribución; evitar CSS overrides indefinidamente.
2. **Deuda alta — física aparente:** `drapedPoint` aplica una curva prescrita y un camino delantero; sin colisiones, densidad, deformación mecánica, masa ni fricción. Investigar PBD/XPBD únicamente si demuestra necesidad y coste admisible.
3. **Deuda media — estado de UI monolítico:** `app.mjs` integra eventos, DOM, estado y proyecciones. Separar modelo puro de estado y adaptadores DOM solo cuando existan pruebas para un refactor sin regresiones.
4. **Deuda media — valores duplicados:** configuración de medidas en HTML, `LIMITS` y catálogo. Definir contrato de campos canónico sin alterar el formato actual a ciegas.
5. **Deuda baja — texto largo en ayuda:** pasar explicaciones metodológicas a un acordeón accesible «Cómo se calcula», fuera del recorrido principal.
6. **Código muerto:** no se declara ninguno sin prueba de ausencia de consumidores y pruebas; auditoría por imports/referencias pendiente.
7. **Duplicación del visor:** `fit-viewer.mjs` usa componentes `free-test-jersey.mjs`, pero el laboratorio se mantiene aislado del configurador productivo por ahora.

## Mapa Figma → código
| Componente de diseño | Implementación actual | Estrategia |
|---|---|---|
| ComparisonViewport | `view-panel`, `scene`, `fit-canvas` | Mantener DOM/WebGL; Figma proporciona layout y tokens |
| MetricReference | `scale-card`, `fit-scale-diagram` | SVG semántico existente, sincronizado |
| FitField | `fit-field` + `changeValue` | Componente reutilizable tras reducir duplicación |
| CameraTabs | `camera-controls` | Reutilizar HTML accesible |
| ProcessTabs | `editor-tabs` | Conservar aria-selected y teclado |
| StatusPill | `pill` | Extraer token visual sin dependencia runtime |
| GeometryFeedback | `geometry-feedback` | Mantener diagnósticos como vista avanzada |

**Decisión:** no exportar código generado automáticamente desde Figma para reemplazar WebGL ni el controlador actual. Implementar el diseño existente con CSS/HTML y compartir tokens, evitando un segundo framework.

## Fuentes y ejemplos técnicos
- Three.js: https://threejs.org/docs/
- Three.js Cloth example histórico: https://threejs.org/examples/?q=cloth
- Rapier JS physics (sólidos rígidos, no sustituye física de tela): https://rapier.rs/docs/user_guides/javascript/getting_started/
- CLO: https://www.clo3d.com/es/clo/features
- Figma: https://www.figma.com/design/Byrj7Bv9PsYbCeUOaxW5P8

## Regla de evidencia
Un despliegue READY no acredita corrección geométrica, ergonomía o ausencia de regresiones. Sin prueba de navegador no marcar DoD completo. Sin material y patronista, no afirmar simulación de gravedad real.

## Evidencia de barrido de dependencias (2026-10-14)

Inventario Fit Lab: `app.mjs` 405 líneas, `fit-geometry.mjs` 293, `fit-viewer.mjs` 210, `size-classifier.mjs` 153, `fit-drape.mjs` 135, `scale-diagram.mjs` 125, `garment-catalog.mjs` 79, `discrete-states.mjs` 49. El primer objetivo de racionalización es `app.mjs`, no una eliminación masiva.

Barrido léxico de exports sin referencia en **otros módulos de Fit Lab** (candidatos a revisar, no código muerto acreditado):
- `discrete-states.mjs`: `DEFAULT_LABELS`, `normalizeLabel`, `normalizeLabels`, `effectFor`, `labelKeyForMeasure`.
- `size-classifier.mjs`: `normalizeBase`, `bandOf`, `getBand`, `nearestBase`, `initialValuesForBase`, `demoGarmentTargetsFromBody`, `RECOMMENDATION_FIELDS`.
- `fit-geometry.mjs`: `getBodyExtentAt`, entre otros símbolos usados directamente en pruebas.
- `garment-catalog.mjs`: `availableConfigurations`.
- `scale-diagram.mjs`: `estimatedEllipseHalfWidthCm`.

**No eliminar aún:** el barrido no resuelve consumidores fuera de Fit Lab, uso desde tests ni importaciones externas. Gate de retirada: grep del repositorio completo + revisión de tests + una PR específica pequeña con no regresión.
