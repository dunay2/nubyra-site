# NUBYRA · recursos gráficos públicos en Supabase Storage

## Contrato de publicación

- Proyecto de destino: **Nubyra** (`vyeebvzuxarekfaisfdy`).
- Bucket: `nubyra-web` (**lectura pública**).
- URL raíz: `https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/`.
- Los archivos se almacenan **directamente bajo** `01_print_recursos/` y `02_catalogo_recursos/`, sin prefijo `assets/nubyra/` dentro del bucket.
- Subida exclusivamente por personal autorizado mediante herramientas administrativas. **No** se crea una política de inserción anónima.

Ejemplo:

```text
Storage: nubyra-web/01_print_recursos/hero-photo.png
URL: https://vyeebvzuxarekfaisfdy.supabase.co/storage/v1/object/public/nubyra-web/01_print_recursos/hero-photo.png
Respaldo GitHub: /assets/nubyra/01_print_recursos/hero-photo.png
```

## Imágenes requeridas por la landing (9 objetos únicos)

- `01_print_recursos/hero-photo.png`
- `01_print_recursos/team-photo.png`
- `01_print_recursos/configurador-camiseta-frente.png`
- `02_catalogo_recursos/equipacion-oceano.png`
- `02_catalogo_recursos/equipacion-canaria.png`
- `02_catalogo_recursos/equipacion-lava.png`
- `02_catalogo_recursos/equipacion-brisa.png`
- `02_catalogo_recursos/equipacion-cumbre.png`
- `02_catalogo_recursos/equipacion-horizonte.png`

Se pueden cargar los 20 PNG originales del paquete: el resto se reserva para futuras secciones. La paleta CSS se mantiene local; no es una imagen.

## Comportamiento del navegador

`public-assets.js` define el origen público y valida rutas. El HTML utiliza URLs directas del bucket para la portada, galería y miniaturas; `landing.js` también lo utiliza cuando cambia la imagen del configurador. Si una imagen remota falla, el manejador de error recurre a la copia de solo lectura de GitHub Pages y evita un bucle de reintentos.

El metadato `og:image` conserva temporalmente la URL pública de `nubyra.es`; los robots sociales no ejecutan necesariamente JavaScript ni admiten fallback. Migrarlo tras confirmar los objetos.

Este archivo no administra usuarios, roles, RLS del piloto, ni autenticación. `acceso.html` y `config.js` no se modifican.

## Validación obligatoria antes de fusionar

1. Codex confirma por escrito las rutas de los nueve objetos y su subida.
2. Consultar `storage.objects` del proyecto correcto y verificar que los nueve objetos aparecen.
3. Verificar HTTP 200 e `image/png` con al menos portada, una equipación y foto del equipo. Revisar las nueve rutas para detectar nombres distintos o conflictos de mayúsculas.
4. Ejecutar `npm ci && npm test` y comprobar en navegador móvil, escritorio y ultrawide que los recursos provienen de Supabase (pestaña Network). Probar también la caída de una imagen y su fallback.
5. Confirmar que `nubyra.es/acceso.html` sigue operativo por URL directa y no se enlaza públicamente desde la landing.

**No fusionar esta rama hasta terminar la carga en el bucket y la comprobación visual.**

Referencias: https://supabase.com/docs/guides/storage/serving/downloads · https://supabase.com/docs/guides/storage/security/access-control
