# Instalación del control de acceso de NUBYRA

El [manual general de instalación](../INSTALACION.md) recoge dominio, HTTPS,
Pages, Google Cloud, el orden completo de configuración y el registro de estado.
Esta guía detalla la instalación de la base de datos.

Esta carpeta contiene la migración que necesita `acceso.html` para consultar
`public.resolve_my_access()`. Guardarla en GitHub no la ejecuta en Supabase.
GitHub Pages publica archivos estáticos; la instalación de la base de datos es
un paso administrativo separado.

## 1. Verificar el destino

- Proyecto Supabase NUBYRA: `vyeebvzuxarekfaisfdy`.
- URL del proyecto: `https://vyeebvzuxarekfaisfdy.supabase.co`.
- Google Cloud: proyecto `nubyra`; cliente web exclusivo de NUBYRA.

Revisar usuarios, identidades, objetos existentes y copia de seguridad antes de
aplicar SQL. La migración requiere un proyecto dedicado a NUBYRA. No es
idempotente: si los objetos ya existen, investigar el estado en lugar de borrar
datos o repetir la instalación a ciegas.

## 2. Aplicar la migración una sola vez

En el SQL Editor del proyecto verificado, ejecutar el contenido completo de
[20261012000100_identity_access.sql](migrations/20261012000100_identity_access.sql)
mediante una sesión administrativa. El archivo usa una transacción.

Crea:

- `nubyra_private.access_grants`: lista privada de admisión, UUID y rol.
- `public.resolve_my_access()`: RPC sin argumentos de identidad o rol, con
  respuesta JSON `{status, role}` para la sesión actual.
- `nubyra_private.before_user_created(jsonb)`: filtro de altas Google
  preadmitidas; instalar la función no activa el hook.
- `public.nubyra_access_probe`: una fila ficticia protegida por RLS para
  comprobar autorización y revocación desde la API.

La lista de admisión empieza vacía y no se asignan roles. El navegador no puede
leer ni editar esa lista. La RPC comprueba la identidad Google verificada
conservada por Supabase y devuelve `denied` si no hay permiso vigente. Un rol
nulo produce `pending`; los roles admitidos son `admin`, `editor` y `lector`.

## 3. Comprobar los objetos y permisos

Ejecutar [checks/installation.sql](checks/installation.sql) después de instalar.
Todas las filas deben devolver `passed = true`. La consulta es de solo lectura
y no muestra correos ni credenciales. Estas comprobaciones estructurales no
sustituyen las pruebas con tokens firmados y el proveedor Google real.

El 12/10/2026 se ejecutó esta consulta en el proyecto Supabase NUBYRA real:
las **15 comprobaciones devolvieron `true`**. La migración ya está instalada en
ese proyecto; no repetirla para continuar la configuración.

La versión original de esta migración se probó en un PostgreSQL 16 desechable,
sin red y con tablas Auth y claims simulados. Pasaron las comprobaciones de
permisos, admisión/denegación, estado pendiente/activo/suspendido, cambio de
correo y eliminación del usuario. Ese ensayo no demuestra integración con
Supabase Auth real.

## 4. Configurar admisión y proveedores

1. En **Authentication → Auth Hooks → Add hook → Before User Created hook**,
   activar **Enable Before User Created hook**, seleccionar tipo **Postgres**,
   esquema **`nubyra_private`** y función **`before_user_created`**. Revisar los
   permisos mostrados y pulsar **Create hook**. La función ya concede ejecución
   a `supabase_auth_admin`. Confirmar después la tarjeta con el esquema y la
   función correctos y estado **ENABLED**. El titular completó este paso y se
   verificó ese estado el **12/10/2026**. Con la lista de admisión vacía, se
   rechazan las nuevas altas.
2. Introducir las direcciones aprobadas únicamente en una sesión administrativa
   privada en `nubyra_private.access_grants`. Normalizar con `lower(btrim(...))`;
   no normalizar alias de Gmail. Mantener `role = NULL` hasta una decisión
   explícita del titular. Ninguna dirección real debe añadirse a Git.
   Después del alta, [checks/pilot_state.sql](checks/pilot_state.sql) permite
   comprobar solo los recuentos. El 12/10/2026 se verificó una admisión habilitada,
   sin rol/UUID vinculado y cero usuarios Auth. El alta en la lista no crea el
   usuario Auth: el primer login Google admitido lo hará.
3. Auditar usuarios y métodos de entrada. Para el piloto Google, deshabilitar
   Email (contraseña/enlaces/OTP), proveedores alternativos y acceso anónimo.
   El hook de alta no revoca usuarios que ya existan.
   Para Email: abrir **Sign In / Providers → Email**, desactivar **Enable email
   provider**, pulsar **Save** y confirmar **DISABLED**. Mantener las altas
   activadas para que el hook pueda admitir nuevas cuentas Google. Revisar
   también las pantallas Third-Party Auth y Passkeys.
   Revisión completada el 12/10/2026: Email y alternativos integrados
   desactivados, sin proveedores personalizados ni Third-Party Auth,
   Passkeys desactivado. Altas activadas, acceso anónimo y vinculación manual
   desactivados. Google permanecía desactivado, pendiente de habilitar.
4. En el proveedor Google de Supabase, introducir el Client ID y el Client
   Secret directamente en la consola. Mantener desactivados **Skip nonce
   checks** y **Allow users without an email**. La habilitación de Google es un
   paso separado, después de comprobar los controles.
   Para ese paso, activar **Enable Sign in with Google**, pulsar **Save** y
   confirmar **Google ENABLED**. Registrar la comprobación antes de conectar
   la configuración pública del frontend.

## 5. Configurar las URLs exactas

| Lugar | Valor |
| --- | --- |
| Supabase Auth Site URL | `https://nubyra.es/` |
| Supabase Auth Redirect URL | `https://nubyra.es/acceso.html` |
| Google: origen JavaScript | `https://nubyra.es` |
| Google: redirect URI | `https://vyeebvzuxarekfaisfdy.supabase.co/auth/v1/callback` |

El flujo se inicia y termina en `https://nubyra.es/acceso.html`. Google vuelve
primero a Supabase; Supabase vuelve después a NUBYRA. Los permisos Google se
limitan a `openid`, `userinfo.email` y `userinfo.profile`.

## 6. Conectar y comprobar el frontend

Completar `config.js` con la URL del proyecto y su clave publicable
`sb_publishable_…` tras comprobar el destino y los controles. Conservar el
callback `https://nubyra.es/acceso.html`. Los secretos OAuth, las claves
administrativas y las direcciones piloto se guardan fuera del repositorio.

Antes de abrir el piloto, comprobar con Google real y JWT de usuario: admisión
de una cuenta aprobada, rechazo de otra cuenta, estado pendiente sin acceso al
probe, acceso con rol aprobado y denegación inmediata tras `enabled = false`
usando el mismo token. No usar una clave administrativa para simular permisos
de usuario. Todo futuro recurso privado necesita sus propias políticas RLS.

La comprobación de `email_verified` debe confirmarse con la identidad Google
real. Si falta ese dato, la migración deniega acceso; investigar la causa en
lugar de retirar el control.

## Referencias

- [Google en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Auth Hooks y permisos](https://supabase.com/docs/guides/auth/auth-hooks)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
