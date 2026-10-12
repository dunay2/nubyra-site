# Acceso NUBYRA para el dominio propio

Esta rama añade `acceso.html` al repositorio `dunay2/nubyra-site`, que sirve `https://nubyra.es/` desde GitHub Pages. `index.html`, `.nojekyll` y `CNAME` se conservan sin cambios. La configuración de Supabase permanece vacía: la página muestra un estado cerrado y no inicia Google OAuth.

## URLs exactas

- Página de inicio y retorno: `https://nubyra.es/acceso.html`.
- Origen del navegador: `https://nubyra.es`.
- Supabase Auth Site URL propuesta: `https://nubyra.es/`.
- Supabase Auth Redirect URL exacta: `https://nubyra.es/acceso.html`.
- Google OAuth debe volver a `https://<PROJECT_REF_VERIFICADA>.supabase.co/auth/v1/callback`, usando un proyecto exclusivo de NUBYRA. Verificar la referencia en el panel antes de configurarlo.

La ruta del repositorio de prueba `https://dunay2.github.io/nubyra-home/acceso.html` usa otro origen y otro almacenamiento PKCE. No usarla como retorno de este sitio ni pasar por una redirección entre orígenes. `www.nubyra.es` redirige al dominio raíz; iniciar el flujo en el dominio raíz para que el canje se haga en el mismo origen.

## Configuración y permisos

`config.js` contiene URL y clave publicable vacías a propósito. `config.example.js` muestra las tres propiedades esperadas. Completar solo la URL del proyecto NUBYRA verificado y su clave `sb_publishable_…`; no incluir `service_role`, secretos OAuth, correos piloto ni roles en Git. El cliente exige que la página cargada coincida con el origen y la ruta de `callbackUrl` antes de mostrar el botón Google.

El frontend consulta `public.resolve_my_access()` sin argumentos y solo muestra `active` con rol válido. Esa respuesta no sustituye las políticas RLS: cada petición privada debe comprobar el permiso vigente en Supabase. La página no almacena archivos privados. Al salir de `active` emite `nubyra:clear-private-view` para limpiar vistas privadas futuras.

## Construcción y comprobación

Con Node y npm: `npm ci`, `npm run check`, `npm run build`. El paquete fija `@supabase/supabase-js` en `2.117.3` y publica el bundle estático con Pages. `detectSessionInUrl: true` efectúa el canje PKCE automático; el código no ejecuta un segundo canje manual. La build local y el estado cerrado se pueden comprobar sin Supabase.

Antes de habilitar OAuth, verificar el proyecto Google/Supabase, aplicar y probar la migración y el hook de admisión en entorno aislado, y ejecutar Google real y pruebas de denegación API con tokens de usuario. La asignación de roles piloto requiere decisión humana. La publicación estática por sí sola no demuestra que el login funcione.
