# Pelvis continua, proyección del busto y guía de sujetador

Base pública comprobada: `0258ad066255383fab125c6f62b17bdbc51cb165`. Fecha de ensayo: 2026-10-15.

## DoR
- Se reprodujo la discontinuidad horizontal y los triángulos superpuestos de entrepierna en las capturas del usuario (94/96/166).
- Inspección del código: las dos mitades del pantalón dibujaban paredes interiores coplanares por encima de la bifurcación; las piernas nacían de dos semisecciones con un cierre plano.
- El usuario autoriza una guía opcional tipo sujetador para revisar el busto, no para inferir medidas anatómicas ni simular soporte.
- Mantener patrón/solver de camiseta, perímetros introducidos, escala, control al soltar, diseño y el corte A (camiseta por fuera).

## Implementación
1. **Pelvis y entrepierna:** se construye una costura central curva compartida (saddle) desde la pelvis a dos aberturas de pierna. Se eliminan las paredes internas del pantalón; no se ocultan defectos mediante renderOrder ni depthTest. Se comparten normales en la costura y se iguala la resolución angular con el torso, evitando microhuecos por triangulaciones distintas.
2. **Pantalón:** conserva su caída geométrica holgada, largo nominal y las dos bandas laterales. La curva interior acompaña la nueva entrepierna; el borde inferior permanece plano. No se ha añadido un solver de pantalón ni colisión física entre prendas.
3. **Pecho:** se aumenta la contribución frontal de la forma, recalibrando siempre el perímetro poligonal al valor introducido. Se eleva la zona del pecho de forma localizada, sin mover caderas ni hombros. En 94/96/166: +0,90 cm del plano y +1,28 cm de proyección anterior frente a la base. Es redistribución de forma, no aumento del contorno declarado.
4. **Guía:** `bust-reference.mjs` recorta los triángulos de la misma malla corporal para formar banda inferior y tirantes/aberturas laterales. Desplazamiento superficial nominal de 1,5 mm; no hay fuerzas de soporte, compresión, recomendación de talla ni medidas clínicas. Casilla desactivada por defecto en «Datos del ensayo y diagnóstico». Activar/desactivar no reinicia física ni recalcula cuerpo; se reconstruye solo cuando cambian sus medidas.

## DoD / evidencia
- Topología de pantalón y piernas: una abertura de cintura, dos inferiores, característica de Euler -1 tras soldado virtual; cero aristas no-manifold, orientaciones incompatibles, ramas de borde y triángulos degenerados en los casos unitarios.
- Perímetros pecho/cadera conservados a precisión numérica; respuesta monotónica del frontal en 0/3/6/10 a 143/160/190 cm.
- Guía desmontable sin mutar posiciones corporales, vértices finitos y cercanos a la superficie; dos grupos de material.
- La cuadrícula angular de piernas y tobillos pasa de 32 a 56 para coincidir con torso y pantalón. Se actualiza la prueba antigua que usaba un offset fijo 33: ahora comprueba TODAS las coordenadas en función de la resolución real. No se reduce la tolerancia.
- Se actualiza el test de elevación prevista del pecho de 1,1–2,1 cm a 1,7–3,2 cm respecto al torso original anterior a PR41: es un cambio explícito de geometría solicitado, no un umbral de colisión o calidad relajado.
- El diagnóstico de capas ahora usa la altura real de cada vértice (las filas de entrepierna ya no son planas) y no trata vértices internos sin caras como superficie. Se conservan sus pruebas de control y umbral del corte A.
- Capturas antes/después frontal, lateral, ¾ y espalda: cuerpo solo, pantalón, conjunto y guía. Las pruebas de CI finales y producción deben confirmarse antes de publicar.

## Iteraciones y límites
Se descartó una transición demasiado prolongada que provocaba protrusión adicional de 9 mm en la combinación extrema fuera de catálogo. Se mantuvieron los umbrales y se ajustó la transición. La primera guía se generaba por un loft diferente al cuerpo y producía intersecciones locales; se sustituyó por recorte de sus propios triángulos. La guía final reutiliza vértices y no necesita nuevas dependencias.

Presupuesto de referencia 88/96/160, torso incluido: 8 mallas como antes; 20.136 → 22.232 triángulos y 427.024 → 504.112 bytes de buffers. La guía añade de forma opcional una malla, 2.040 vértices y 3.530 triángulos en ese caso. No se declara mejora de FPS ni del tiempo de asentamiento del solver; se conserva render bajo demanda.

Sigue siendo una geometría sintética, no antropometría individual ni validación juvenil. La altura del busto y línea de la guía son supuestos de diseño. El material textil, autocolisión y todas las intersecciones dinámicas no están certificados. La entrepierna y forma de guía deben seguir revisándose visualmente; una topología válida no equivale a acabado industrial.
