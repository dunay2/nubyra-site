# Acceso NUBYRA para el dominio propio

El [manual de instalación](INSTALACION.md) reúne los pasos, verificaciones y
trabajo pendiente de dominio, publicación y autenticación.

`acceso.html` está integrado en `main` del repositorio `dunay2/nubyra-site`, que sirve `https://nubyra.es/` desde GitHub Pages. `index.html`, `.nojekyll` y `CNAME` se conservan sin cambios. `config.js` contiene la URL del proyecto NUBYRA y su clave publicable para el piloto Google. La admisión y los roles se deciden en Supabase; la configuración del frontend no concede un rol.

## URLs exactas

- Página de inicio y retorno: `https://nubyra.es/acceso.html`.
- Origen del navegador: `https://nubyra.es`.
- Supabase Auth Site URL: `https://nubyra.es/`.
- Supabase Auth Redirect URL exacta: `https://nubyra.es/acceso.html`.
- Google OAuth vuelve a `https://vyeebvzuxarekfaisfdy.supabase.co/auth/v1/callback`, del proyecto exclusivo de NUBYRA. Verificar la referencia en el panel antes de cambiar la configuración.

La ruta del repositorio de prueba `https://dunay2.github.io/nubyra-home/acceso.html` usa otro origen y otro almacenamiento PKCE. No usarla como retorno de este sitio ni pasar por una redirección entre orígenes. `www.nubyra.es` redirige al dominio raíz; iniciar el flujo en el dominio raíz para que el canje se haga en el mismo origen.

## Configuración y permisos

`config.js` contiene la configuración pública del proyecto `vyeebvzuxarekfaisfdy`. `config.example.js` muestra las tres propiedades esperadas. Para otra instalación, completar solo la URL del proyecto NUBYRA verificado y su clave `sb_publishable_…`; no incluir `service_role`, secretos OAuth, correos piloto ni roles en Git. El cliente exige que la página cargada coincida con el origen y la ruta de `callbackUrl` antes de mostrar el botón Google.

El frontend consulta `public.resolve_my_access()` sin argumentos y solo muestra `active` con rol válido. Esa respuesta no sustituye las políticas RLS: cada petición privada debe comprobar el permiso vigente en Supabase. La página no almacena archivos privados. Al salir de `active` emite `nubyra:clear-private-view` para limpiar vistas privadas futuras.

## Construcción y comprobación

La [guía de instalación de Supabase](supabase/README.md) contiene la migración
versionada, las comprobaciones estructurales y los pasos para configurar el
hook de admisión, las cuentas permitidas y las URLs de Google/Supabase.

Con Node y npm: `npm ci`, `npm run check`, `npm test`, `npm run build`. El paquete fija `@supabase/supabase-js` en `2.117.3` y publica el bundle estático con Pages. `detectSessionInUrl: true` efectúa el canje PKCE automático; el código no ejecuta un segundo canje manual. La build local y el estado cerrado se pueden comprobar sin Supabase.

Los errores OAuth en query y fragmento bloquean la recuperación de una sesión anterior. El cliente también comprueba el resultado de `initialize()` antes de consultar la sesión y elimina los parámetros del callback en ambas partes de la URL. `npm test` cubre estas regresiones, roles, revocación, errores RPC y cierre de sesión con un SDK simulado. Dos casos adicionales usan el SDK real con sesiones sintéticas y transporte HTTP simulado; esas pruebas no sustituyen una prueba OAuth real ni verifican RLS.

Antes de abrir el piloto al público, verificar el proyecto Google/Supabase, aplicar y probar la migración y el hook de admisión, y completar Google real y las pruebas de denegación API con tokens de usuario. La asignación de roles piloto requiere decisión humana. La publicación estática por sí sola no demuestra que el login funcione. El 12/10/2026 el titular aportó la captura del primer login con estado pendiente; Supabase confirmó un usuario con identidad Google verificada y permiso vinculado sin rol. La aceptación API/RLS completa sigue pendiente.
