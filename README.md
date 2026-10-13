# NUBYRA

Web publicada en [nubyra.es](https://nubyra.es/) mediante GitHub Pages.

- [Manual de instalación y registro de estado](INSTALACION.md)
- [Instalación de Supabase](supabase/README.md)
- [Frontend de autenticación y pruebas](README-login.md)

El manual distingue la configuración comprobada y los pasos pendientes. El
frontend está configurado para el piloto Google con admisión privada en Supabase;
el primer login Google llegó al estado pendiente. Las pruebas API con JWT y la
asignación de roles siguen pendientes. Los secretos
y las cuentas piloto se administran fuera de Git.


## REV02 · Proyección del arte sobre la malla GLB (13/10/2026)

**Problema corregido:** el visor anterior colocaba textos y dorsales sobre planos flotantes delante de un GLB importado. Ahora aplica un atlas dinámico en los **materiales de las superficies seleccionadas** de la malla, ocultando los planos independientes.

- `configurador-3d/model-audit.mjs`: inspección GLB 2.0 previa a la carga (firma, tamaño, primitivas, triángulos, UV, normales y compresiones sin descodificador).
- `configurador-3d/viewer.mjs`: proyección de atlas Canvas 2D sobre triángulos del tejido (0–0,5 frontal / 0,5–1 trasera) sin láminas flotantes.
- `tests/configurador-3d.test.mjs`: 12 pruebas Node correctas, incluyendo rechazos por GLB inválido y separación UV de ambas caras.
- **Cotas UV orientativas:** la proyección NO sustituye al mapa UV industrial, no acredita medidas en cm y requiere comprobación de orientación frontal +Z, patronaje y pruebas reales.

**Malla de ensayo:** disponible en el ZIP REV02 generado durante el trabajo, como `configurador-3d/assets/vest-uv-lab.glb`; no es un modelo comercial. La PR contiene el motor, no una malla profesional aprobada.

### Selección de malla — investigación

- [Female Jersey / Aizhan Saganayeva, Sketchfab](https://sketchfab.com/3d-models/female-jersey-19afb1bb64d946b7a7ce2ecb52ae1326): **CC BY, 8.700 triángulos declarados**. Candidata, falta acceso mediante descarga autorizada y auditar corte, UV y compatibilidad con baloncesto.
- [Basketball Jersey / Sev, Sketchfab](https://sketchfab.com/3d-models/basketball-jersey-3ee634a324d5400ab84555b0636416f6): CC BY, **1,3 millones de triángulos** declarados; debe optimizarse y verificarse patronaje femenino antes de importar.
- [MiniJersey Studio / Francesco Castaldi](https://github.com/FrancescoCastaldi/mini-jersey-studio): código MIT; al inspeccionar el GLB embebido su nodo es `T_Shirt_male`. **Descartado como malla femenina**.

No se ha descargado ni redistribuido ningún activo externo. La implantación comercial de la opción B está pendiente de identificar y adquirir legalmente una malla femenina válida.

**QA pendiente:** el navegador Chromium del entorno bloquea localhost y CDN, por lo que la prueba visual WebGL real no se pudo completar. Las 12 pruebas y la inspección estática no prueban fidelidad 3D. No fusionar a `main` ni desplegar sin revisión humana.
