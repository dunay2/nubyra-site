# Referencia holgada y torso superior: implementación acotada

Base real comprobada: `417ae760b87caf9bc815dfd91c4d7fe22e728f94` (corte A). Este cambio modifica únicamente dos módulos de ejecución: `outfit-reference.mjs` y `body-surface.mjs`. No cambia el motor XPBD, el patrón de camiseta, el catálogo ni la interacción de controles.

## DoR

- Caso de usuario: 94 cm de pecho, 96 cm de cadera, 166 cm de estatura; inspección frontal, lateral y tres cuartos.
- Defectos: el pantalón copia el estrechamiento de la pierna y se lee como licra; el cuello parece una columna y la transición torácica resulta baja/tubular.
- Prioridades: mantener la cadera y los muslos compactos aprobados; aumentar holgura de **prenda**, no anchura de cuerpo. Mantener el comportamiento camiseta por fuera.
- Conservar perímetros corporales y escala real, no inferir nuevas medidas antropométricas.

## Cambios

1. **Pantalón:** conserva las secciones de cadera bajo la camiseta. Bajo el inicio de la pernera pasa de seguir el contorno de la pierna a una envolvente longitudinal con abertura independiente de la rodilla. La transición es quintica y conserva la cuadrícula alineada al cuerpo. No se amplían los muslos ni se mueven pies/rodillas. No se ocultan caras y no se altera la profundidad de dibujo.
2. **Pecho:** se sube de forma localizada la zona medida (~1,60 cm para estatura 160) y se integra con la parte alta del tórax. Las secciones inferiores de cadera y los contornos introducidos se conservan. El collider se sigue generando de los mismos vértices renderizados.
3. **Espalda/cuello:** perfil superior suavizado, con algo más de volumen dorsal y cuello que se estrecha hacia arriba; se conserva el apoyo del hombro. La cabeza baja su borde inferior para asentarse en el cuello, con la misma altura de coronación.
4. **Coste:** mismo número de vértices, índices, mallas, materiales y texturas que la base. No se añade trabajo por fotograma ni llamadas nuevas al solver. No se afirma que el asentamiento físico sea más rápido.

## Métricas geométricas, caso de referencia 88/96/160

- Anchura de abertura de pernera: 11,48 → 15,80 cm; profundidad: 12,48 → 16,78 cm. Son medidas del volumen visual, no talla recomendada.
- Elevación de la sección de pecho: 1,60 cm; pecho y cadera permanecen 88/96 cm.
- Borde inferior de cabeza: 2,12 cm más bajo; coronación y suelo no cambian.
- Cuerpo más referencia completa: 8 mallas, 20.136 triángulos y 427.024 bytes de buffers antes y después (excluye camiseta).

## DoD y comprobación

- Borde inferior del pantalón con holgura respecto a la pierna y sin taper de compresión: pruebas de ancho/profundidad en referencia y caso reportado.
- Cadera y secciones por debajo de tórax intactas; muslos/rodillas/pies del corte A conservados.
- Perímetros exactos y alturas ordenadas para 20 combinaciones de estatura/pecho/cadera; control de pie/tobillo existente conservado.
- Mismo número de grupos/materiales de pantalón y sin nuevos buffers por fotograma.
- Regresión del corte A y contacto de camiseta: suite previa **sin relajar umbrales**.
- Cuatro vistas con cuerpo solo, pantalón/cuerpo y equipación: 48 capturas comparativas estándar y caso 94/96/166; revisión manual de los PNG antes de publicar.
- UI sin cambios; confirmar medidas al soltar, color y personalización se mantienen. Repetir tests de navegador en la URL pública.

`tests/fit-lab.contained-shape.test.mjs` añade cuatro pruebas. La prueba E2E actualiza exclusivamente la versión esperada de torso a `nubyra.shoulder-torso/1.1`; conserva el resto de las comprobaciones.

## Límites

**El pantalón sigue siendo una referencia estática con holgura, no una simulación textil.** No se anuncian caída física del pantalón, autocolisión entre prendas ni antropometría validada. La cabeza sigue siendo neutra/simplificada. Los casos fuera del catálogo mantienen sus advertencias y se reportan intersecciones previas, no se simula un ajuste garantizado. La elevación pectoral y perfiles superiores son una mejora paramétrica de ensayo, no una medición individual.

El emparejamiento actual 117/72 queda fuera del catálogo; la referencia no convierte esa combinación en una recomendación válida.
