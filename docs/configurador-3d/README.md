# NUBYRA · Configurador 3D / primera implementación

Rama de desarrollo para validar la personalización gráfica de una **camiseta femenina de baloncesto**, antes de incorporar patronaje adaptable.

## Estado real

- **Implementado:** UI responsive, dibujo 2D de respaldo, volumen 3D demostrador con Three.js, cámara orbital (frontal, espalda, 3/4 y lateral), 4 paletas, selectores independientes de color, equipo, apellido, dorsal, patrocinadores, carga de escudo raster, importación GLB, exportación PNG y JSON, reglas de cajas y aviso de textos excesivos.
- **No implementado:** modelo industrial femenino licenciado y optimizado, UV/texturas de sublimación calibradas, cálculo de centímetros sobre patrones reales, homologación FCB/FEB, ajuste de pecho/cadera/largo, backend, pedido o persistencia.
- **Dependencias de ejecución:** Three.js 0.180.0 desde jsDelivr mediante import map. No requiere instalar paquetes ni modificar el `package.json` de autenticación de la web. Si no puede cargar Three.js, el editor continúa en 2D y comunica el modo de respaldo.
- **Aislamiento:** no modifica `index.html`, `landing.js`, `landing.css`, `acceso.html`, login Google/Supabase ni los assets públicos. La ruta nueva es `/configurador-3d/`. Publicar requiere autorización.

## Probar en local

Con Node 22:

```sh
node start-3d.mjs
```

Abrir `http://localhost:4173/configurador-3d/`. En Windows, doble clic en `run-local.cmd` si Node está instalado.

Una apertura directa con `file://` no es compatible con importación de módulos del navegador. Para la visualización 3D se necesita conexión al CDN de Three.js y WebGL. Los archivos de datos, escudo y modelo se procesan en el navegador, no se suben a servidores.

## Verificar

```sh
node --test tests/configurador-3d.test.mjs
node --check configurador-3d/app.mjs
node --check configurador-3d/viewer.mjs
```

Las pruebas cubren normalización de dorsal, cajas de texto, separaciones de zonas, entradas y referencias a componentes, pero **no equivalen a pruebas visuales automatizadas de WebGL**. Antes de aprobar la iteración hay que revisar el diseño en navegador, escritorio/móvil y al importar una malla GLB.

## Opción B aprobada: modelo existente

La arquitectura incluye `GLTFLoader` y control de importación de **GLB** con límite de 20 MB. La malla original demostradora **NO es el modelo final**: es un volumen 3D generado para probar cámara, controles, composición y materiales, sin simular confección ni tallaje real. Al cargar un GLB con derechos adecuados reemplaza ese volumen; la impresión mantiene posiciones provisionales que deberán adaptarse al nuevo UV/contorno.

Fuentes **candidatas** para seleccionar y evaluar, no incorporadas ni sublicenciadas:

- [Sev / Basketball Jersey (Sketchfab, CC BY)](https://sketchfab.com/3d-models/basketball-jersey-3ee634a324d5400ab84555b0636416f6) — ≈1,3 millones de triángulos: requiere optimización y comprobar derechos y diseño femenino.
- [CGTrader / Girls basketball shirt mesh](https://www.cgtrader.com/3d-models/character/clothing/girls-basketball-tshirt-mesh-v2) — comprobar precio, derechos de incorporación al software y aptitud técnica.
- [Three.js / GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader).

No se incrustan modelos de terceros sin comprobar licencia, topología, UV y posibilidad de distribución. No se exportan derivados de proveedores comerciales sin permiso.

## Figma e issues

- [Configurador Figma v2](https://www.figma.com/design/8g4x3Rxm9dhaPTUQMixM0G?node-id=78-3)
- [Issue #11 · Composición](https://github.com/dunay2/nubyra-site/issues/11)
- [Issue #12 · Modelo y derechos](https://github.com/dunay2/nubyra-site/issues/12)
- [Issue #13 · Personalización 3D](https://github.com/dunay2/nubyra-site/issues/13)
- [Issue #14 · Pruebas](https://github.com/dunay2/nubyra-site/issues/14)

El `.json` exportado se etiqueta expresamente como **borrador no aprobado para fabricación**. La prenda del piloto exige revisión específica de normativa, rango de tallas y arte de sublimación industrial.

## REV03 — ClothingAxis y formatos de importación (13/10/2026)

- Modelo **seleccionado por NUBYRA**: [Girls Sleeveless Basketball Tshirt – 07](https://www.cgtrader.com/3d-models/character/clothing/girls-sleeveless-basketball-tshirt-07). **No comprado ni empaquetado.** La licencia no autoriza por defecto servir un GLB recuperable en una web pública.
- **Importación local:** GLB autónomo (máximo 35 MB) o glTF junto a BIN y texturas (conjunto máximo 90 MB), archivos extraídos del ZIP del vendedor.
- **Seguridad:** revisión de triángulos, UV, normales, recursos y bloqueo de URLs externas o rutas con `..`. Las dependencias se resuelven mediante URL temporales revocadas al finalizar.
- **Orientación:** ajuste 0°/180° para la previsualización. El atlas sobre la malla sigue siendo provisional y puede requerir seleccionar manualmente superficies y UV.
- **Pruebas:** 17 unitarias locales correctas. Sin ensayo WebGL real del modelo comercial; no anunciar integración final ni cumplimiento de impresión.
- **Contrato y adquisición:** [MODELO_SELECCIONADO.md](MODELO_SELECCIONADO.md).


## REV05 — ensayo sin descarga de proveedor (13/10/2026)

La imposibilidad de descargar temporalmente ClothingAxis no impide ensayar la personalización 3D. En el panel «Escudo y modelo 3D» existe el botón **«Probar camiseta 3D sin descargar archivos»**, que genera una camiseta femenina deportiva con geometría propia de NUBYRA.

- El visor crea frontal, espalda, paneles laterales y ribetes, exporta la geometría como GLB en la sesión e importa el resultado mediante el mismo GLTFLoader utilizado por el modelo comercial.
- Las dos mallas principales se seleccionan automáticamente y sus materiales reciben el atlas dinámico. El pantalón, ribetes y otras zonas se mantienen separados.
- **Sin adquisición, descargas comerciales ni licencias de terceros**. Código y geometría originales del proyecto, derechos reservados.
- [Detalles y referencias de modelos gratuitos](MODELO_PRUEBA_SIN_DESCARGA.md).
- [GitHub Actions: 23 pruebas + 2 pruebas geométricas/GLB correctas](https://github.com/dunay2/nubyra-site/actions/runs/38407478932).

La prueba interna no valida el modelo final ni certifica patronaje, morfología o espacios reglamentarios. La integración ClothingAxis sigue pendiente de recibir su archivo y comprobar la licencia definitiva.
