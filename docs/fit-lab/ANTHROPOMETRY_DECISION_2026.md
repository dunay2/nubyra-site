# NUBYRA — auditoría antropométrica y maniquí femenino de referencia

**Estado:** investigación de referencia (no integrada automáticamente en el Fit Lab). **Fecha:** 14-10-2026.

## Decisión

El modelo actual funciona como **geometría sintética de demostración**. No debe calificarse como antropométricamente validado: tres entradas de cuerpo (pecho/cadera/altura) y tres controles de volumen no identifican de forma única la forma femenina, la longitud del tronco, la cintura, anchura acromial, inclinación de hombros, cavidad de la sisa ni perfil pectoral. La clasificación y la simulación de una prenda deben mantenerse independientes.

La memoria actual de NUBYRA acota el piloto a **un equipo femenino infantil**: un maniquí adulto no debe convertirse en talla patrón juvenil. Se conserva el alcance de entrada reducido (pecho, cadera y largo solicitado), pero se separan **medidas conocidas**, **suposiciones geométricas** y **resultados del fitting**.

## Evidencia normativa y poblacional

1. ISO 8559-1:2017 (confirmada en 2026): definiciones anatómicas de medida para ropa y maniquíes de ajuste. No prescribe un cuerpo de forma única para dos perímetros. https://www.iso.org/es/contents/data/standard/06/16/61686.html
2. Estudio antropométrico español del Ministerio de Sanidad (2008): 10.415 mujeres de 12–70 años, 130 medidas, 3 morfotipos (diábolo 39 %, cilindro 36 %, campana 25 %); estatura media del grupo 12–13 años = **157,7 cm**. Documento histórico, no distribución específica de jugadoras canarias en 2026. https://www.lamoncloa.gob.es/paginas/archivo/080208-enlaceantropometrico.aspx
3. ANSUR II, mujer adulta militar (2012; n=1.986, 93 medidas, mm; no representativa de la población española ni de menores). Fuentes primaria y distribución pública: https://ph.health.mil/topics/workplacehealth/ergo/Pages/Anthropometric-Database.aspx ; https://www.openlab.psu.edu/ansur2/ . Se empleó copia sin modificar de las filas públicas https://raw.githubusercontent.com/jocimarcan/antopometric-database/master/ANSUR_II_FEMALE_Public.csv . No se redistribuyen registros individuales.
4. Estudios sobre forma del torso femenino y deporte: cintura y las diferencias pecho-cintura/cintura-cadera son discriminantes morfológicos (Applied Ergonomics 2023 https://doi.org/10.1016/j.apergo.2022.103904); el grupo de 117 deportistas de fútbol de contacto mostró variaciones relevantes para prendas deportivas (https://pubmed.ncbi.nlm.nih.gov/32301393/).

### Referencia cuantitativa de ANSUR II (solo mujeres adultas militares de EE. UU.; cm)

| Parámetro ANSUR II | P05 | Mediana | P95 |
|---|---:|---:|---:|
| Estatura | 152,5 | 162,6 | 174,0 |
| Contorno de pecho ("chestcircumference") | 82,4 | 94,0 | 109,4 |
| Cintura ("waistcircumference") | 71,0 | 85,2 | 104,0 |
| Contorno de glúteos ("buttockcircumference") | 90,1 | 101,8 | 115,6 |
| Anchura biacromial (landmarks de hombros) | 33,5 | 36,5 | 39,6 |
| Anchura bideltoidea (contorno externo de hombros) | 40,6 | 45,0 | 49,9 |

Las definiciones *chest* y *buttock* del ANSUR no se deben tratar automáticamente como equivalentes exactas a la medida textil ISO del busto y cadera. La muestra es una población militar adulta: **no construir tallas infantiles ni tablas españolas a partir de ella**.

### Contraste con los números sintéticos del Fit Lab

Estado por defecto: pecho **88 cm**, cadera **96 cm**, altura **160 cm**.

* Cintura geométrica mínima: **80,86 cm**, no introducida ni medida.
* Anchura exterior a altura de hombros: **39,40 cm**, de una fórmula interna: no equivale de forma demostrada a biacromial ni a bideltoidea.
* Altura de la pieza geométrica: **73,52 cm**; no es la distancia anatómica validada hombro-cadera.

Se seleccionaron para análisis exploratorio 217 mujeres adultas ANSUR II dentro de ±3 cm de estatura 160, ±5 cm de chestcircumference 88 y ±5 cm de buttockcircumference 96. En ese subgrupo:

| Variable observada | P05 | Mediana | P95 |
|---|---:|---:|---:|
| Cintura | 71,5 | 78,8 | 87,8 |
| Biacromial | 33,5 | 36,1 | 38,2 |
| Bideltoidea | 40,6 | 43,0 | 45,5 |

**Resultado fundamental:** cuerpos con pecho, glúteos y estatura similares presentan diferencias sustanciales en la cintura y hombros. La transformación de NUBYRA podría representar *una* morfología, pero no inferir con seguridad la de una jugadora real.

## Maniquí femenino de referencia descargable

*Archivo:* `assets/mannequins/adult-female-reference-cc0.glb` — malla femenina anatómica de referencia, **solo cuerpo superior, no cuerpo completo**, 16.731 vértices, 31.754 triángulos, GLB 2.0, color neutro, métricas en metros, tamaño aprox. 594 KB. **Validación Khronos: cero errores y avisos**.

**Procedencia y licencia:** derivación de la malla corporal "Riley" de Innerscene, basada en los assets principales MakeHuman/MPFB; ambas partes se presentan como CC0. Fuente y atribución de trazabilidad: https://www.innerscene.com/tools/library/3d-parts/riley-3d-person-woman-standing-8d40398f ; licencia original de recursos principales de MakeHuman: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md . El archivo se generó desde el GLB original con SHA-256 `c9c84386d6c019a8d4c415cc5d6ed9111c27d624189b1a2e0676f2b276a086e6`, conservando la escala global del nodo, sin ropa, pelo ni imágenes externas.

**Limitaciones:** es una forma anatómica visual, no un escaneo validado de NUBYRA, no es de una niña, no contiene variables reales de perímetro/waist/shoulder y no se puede conectar directamente al collider radial del solver actual. No atribuirle medidas corporales nominales ni venderla como patrón certificado.

Se puede abrir en Blender, Three.js / GLTFLoader u otros visores glTF y comparar frontal, lateral y hombros.

## Recomendación de arquitectura (sin añadir formularios)

- **Modo A — validación visual:** conservar torso sintético existente y alternar con el maniquí CC0 para inspección de hombros, sisas y pecho. Mantener avisos de diferencia.
- **Modo B — ajuste geométrico:** usar un collider del mismo modelo visual, sobre un SDF/BVH genérico o representación simplificada verificada, no reutilizar el collider radial de secciones cuando cambie la topología.
- **Modo C — piloto infantil:** no extrapolar tallas adultas. Recoger las tres medidas autorizadas más evaluación durante fitting, probar la hipótesis de patrón-base y posición de ajuste y auditar los errores. Considerar anchura de hombros solo como *dato auxiliar de validación* con autorización, no imponer una cuarta entrada de usuario.

### DoR para integración en el Fit Lab
- Acordar finalidad del activo: referencia visual adulta, **no maniquí infantil calibrado**.
- Verificar CC0, archivo SHA-256, coordenadas y orientación Y-up.
- Confirmar referencia anatómica de mediciones, postura y bra deportivo en las pruebas.
- Mantener separación entre cuerpo, camiseta, material y selección.

### DoD exigible
- El visor alterna modelo geométrico y modelo de referencia sin cambiar entradas ni valores.
- Etiquetas de "sintético" y "visual adulto CC0" explícitas; sin falsas medidas antropométricas.
- Renderiza frontal/lateral/¾ sin fallos; pruebas responsivas y rendimiento establecidos.
- No hay interferencia con la recomendación de talla ni el solver existente.
- Para comercialización: validación de patronista y mínimo una iteración de fitting infantil autorizado.

**Estado de decisión:** existe maniquí descargable para investigación. **No se ha integrado ni publicado como maniquí del Fit Lab** hasta completar las pruebas de compatibilidad anatómica y colisiones.
