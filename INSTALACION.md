# Manual de instalación de NUBYRA

Este es el punto de entrada para instalar y mantener `nubyra.es`. El código y
este manual están en `dunay2/nubyra-site`. Los cambios en GitHub no ejecutan SQL
ni guardan ajustes en las consolas de IONOS, Google Cloud o Supabase.

Última actualización del registro: **12 de octubre de 2026**. Los estados de
abajo describen las comprobaciones realizadas durante esta instalación; antes
de modificar un sistema, confirmar de nuevo su destino y estado.

## 1. Componentes y destinos

| Componente | Destino y función |
| --- | --- |
| IONOS | Dominio `nubyra.es`, DNS y correo |
| GitHub | Repositorio `dunay2/nubyra-site`, rama `main` |
| GitHub Pages | Publica los archivos de la web y gestiona su HTTPS |
| Portada | `https://nubyra.es/` |
| Acceso | `https://nubyra.es/acceso.html` |
| Supabase | Proyecto Nubyra, referencia `vyeebvzuxarekfaisfdy`; Auth, permisos y base de datos |
| API Supabase | `https://vyeebvzuxarekfaisfdy.supabase.co` |
| Google Cloud | Proyecto `nubyra`; cliente OAuth web `NUBYRA Web` |

Google identifica al usuario. Supabase conserva la sesión y aplica la admisión
y los permisos. GitHub Pages sirve la interfaz estática. Los datos privados
requieren políticas RLS en Supabase; una página publicada no protege datos por
sí sola.

## 2. Dominio, DNS y HTTPS

En IONOS, el dominio raíz debe apuntar a GitHub Pages mediante estos registros:

| Tipo | Nombre | Destino |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `dunay2.github.io` |

Conservar los registros del correo: MX, SPF, DKIM y DMARC. Revisar cualquier
registro web que compita con los anteriores, incluido un AAAA o una plantilla
de redirección antigua, antes de cambiarlo.

En **GitHub → nubyra-site → Settings → Pages**:

1. Seleccionar publicación desde la rama **`main`**, carpeta **`/ (root)`**;
   confirmar que es la fuente de Pages.
2. Configurar **Custom domain** como `nubyra.es`.
3. Conservar el archivo raíz `CNAME` con ese dominio y `.nojekyll`.
4. Esperar la validación DNS y la emisión del certificado de Pages.
5. Activar **Enforce HTTPS** cuando esté disponible.
6. Comprobar la portada y `acceso.html` por HTTPS, y el retorno de `www` al
   dominio raíz. Iniciar el login siempre desde el dominio raíz.

Durante esta instalación se retiró la redirección antigua de IONOS. El destino
antiguo `217.160.0.233` devolvía un 403 mientras persistía en las cachés DNS.
Después se verificaron el certificado de Pages, HTTPS obligatorio y las
redirecciones HTTP/www. No se trasladaron certificados de otros dominios.

Un subdominio como `data.otro-dominio.es` puede apuntar a un servicio distinto
y conservar su nombre. NUBYRA puede usar también un dominio propio directamente,
como hace aquí con Pages; no necesita un subdominio ni una redirección a la URL
del repositorio.

## 3. Publicar y mantener los archivos

La versión integrada del acceso está en `main`. La portada es `index.html`; la
página de autenticación es `acceso.html`. La configuración pública está en
`config.js` y el código fuente de acceso en `src/login.js`.

Para cambios de código, desde el repositorio y con Node/npm instalados:

```sh
npm ci
npm run check
npm test
npm run build
```

Revisar y versionar los archivos generados que usa Pages, publicar en `main`,
esperar el despliegue y comprobar la URL real. No cambiar `CNAME`, `.nojekyll`
ni la portada por accidente. Las instrucciones del frontend están en
[README-login.md](README-login.md).

El PR #1 se integró con la corrección de errores OAuth: un callback con error
no recupera una sesión anterior. Las pruebas locales pasaron, incluidas las
regresiones de query/fragmento y dos casos con el SDK real y transporte simulado.
Estas pruebas no equivalen a un login Google real.

## 4. Registrar NUBYRA en Google Cloud

En el proyecto **`nubyra`**, abrir **Google Auth Platform**:

1. **Branding**: nombre `NUBYRA`, contacto de soporte del titular, portada
   `https://nubyra.es/` y dominio autorizado `nubyra.es`.
2. **Audience**: audiencia externa; durante el piloto mantener el estado de
   pruebas y revisar las cuentas de prueba que correspondan. La admisión de
   NUBYRA se controla también en el backend, no solo en esta pantalla.
3. **Data Access**: limitar los permisos a `openid`, `userinfo.email` y
   `userinfo.profile`.
4. **Clients → Create client**: tipo **Web application**, nombre **NUBYRA Web**.
   Usar el origen y retorno de la tabla de URLs de la sección siguiente.
5. Introducir el Client ID y el Client Secret directamente en el proveedor
   Google de Supabase. Guardar el secreto fuera de Git y del frontend.

Google Cloud se utiliza aquí para registrar el login OAuth. Durante la
instalación se comprobó que el proyecto no tenía una cuenta de facturación
vinculada. Esto no constituye una garantía sobre otros servicios que se activen
en el futuro.

Antes de abrir la aplicación al público, publicar y registrar las páginas de
privacidad y condiciones que correspondan, explicar el uso de los datos y
revisar el proceso de publicación/verificación de Google. Esas páginas estaban
pendientes en la última revisión.

## 5. Configurar URLs y proveedor en Supabase

Confirmar primero que se está dentro del proyecto **Nubyra** con referencia
**`vyeebvzuxarekfaisfdy`**. Configurar estas URLs exactas:

| Pantalla | Valor |
| --- | --- |
| Supabase → Authentication → URL Configuration → Site URL | `https://nubyra.es/` |
| Supabase → Redirect URLs | `https://nubyra.es/acceso.html` |
| Google → cliente web → Authorized JavaScript origins | `https://nubyra.es` |
| Google → Authorized redirect URIs | `https://vyeebvzuxarekfaisfdy.supabase.co/auth/v1/callback` |

El recorrido es NUBYRA → Google → Supabase → `acceso.html`. El retorno a
Supabase y el retorno a NUBYRA son URLs diferentes; no intercambiarlas.

En **Authentication → Sign In / Providers → Google**, guardar Client ID y
Client Secret. Mantener desactivados **Skip nonce checks** y **Allow users
without an email**. La habilitación de Google se realiza después de configurar
la admisión y revisar los métodos alternativos.

## 6. Instalar la base de datos y comprobarla

La [guía de Supabase](supabase/README.md) detalla los objetos y sus permisos.
Orden de instalación:

1. Auditar usuarios, identidades y objetos existentes; revisar la copia de
   seguridad. El proyecto debe estar dedicado a NUBYRA.
2. En **SQL Editor**, ejecutar el contenido completo de
   [la migración](supabase/migrations/20261012000100_identity_access.sql) una sola
   vez con una sesión administrativa. Resultado esperado:
   **Success. No rows returned**.
3. En otra consulta, ejecutar
   [installation.sql](supabase/checks/installation.sql). Deben aparecer
   **15 filas**, todas con **`passed = true`**.

La migración no es idempotente. Si los objetos ya existen, comprobar su estado
en lugar de repetirla o borrarlos. En este proyecto ya se instaló: para una
revisión posterior usar las comprobaciones de solo lectura.

El ensayo local usó PostgreSQL 16 aislado y Auth simulado. El 12/10/2026 se
ejecutaron además las comprobaciones estructurales en el Supabase real y las
15 devolvieron `true`. Eso confirma objetos, RLS y permisos; no prueba todavía
el recorrido OAuth ni las políticas con un JWT real de usuario.

## 7. Activar el filtro Before User Created

Crear la función mediante SQL no activa el filtro. En Supabase:

1. **Authentication → Auth Hooks → Add hook → Before User Created hook**.
2. **Enable Before User Created hook**: activado.
3. **Hook type**: **Postgres**.
4. **Postgres Schema**: **`nubyra_private`**.
5. **Postgres function**: **`before_user_created`**.
6. Revisar los permisos mostrados: ejecución para `supabase_auth_admin`, uso del
   esquema y revocación para `authenticated`, `anon` y `public`. Coinciden con
   los permisos previstos en la migración.
7. Pulsar **Create hook**. Después confirmar que la tarjeta muestra el mismo
   esquema/función y el estado **ENABLED**.

**Verificado el 12/10/2026:** el titular creó el hook y se comprobó su tarjeta
con `nubyra_private.before_user_created`, tipo Postgres y estado **ENABLED**.

El filtro rechaza altas que no sean de Google o cuyo correo no esté admitido
y habilitado. No revoca usuarios ya existentes. Una lista de admisión vacía
rechaza las nuevas altas; autorizar las cuentas piloto es un paso separado.

## 8. Autorizar cuentas y decidir roles

El titular debe decidir los correos y roles. Añadir las direcciones reales solo
en una sesión administrativa privada a `nubyra_private.access_grants`; nunca
en el repositorio. Normalizar con `lower(btrim(...))`, sin transformar alias
Gmail. El UUID se vincula desde la identidad Google verificada al consultar la
RPC; no se acepta una identidad o rol enviado por el navegador.

Ejemplo de plantilla para una nueva cuenta, sustituyendo el correo ficticio
antes de ejecutarla y revisando cualquier fila existente:

```sql
insert into nubyra_private.access_grants (email, role, enabled)
values (lower(btrim('cuenta-aprobada@example.invalid')), null, true);
```

Ejecutar una sola vez por cuenta nueva; resultado esperado **Success. No rows
returned**. Añadir una dirección a la lista no crea todavía un usuario Auth:
ese usuario se crea durante el primer login admitido.

Para comprobar el avance sin mostrar correos, ejecutar
[pilot_state.sql](supabase/checks/pilot_state.sql) en una sesión administrativa.
El **12/10/2026**, después del alta realizada por el titular, se verificó:
`grants_total = 1`, `pending_unbound = 1`, `assigned_roles = 0`, `auth_users = 0`.
Esto confirma una admisión habilitada sin rol y sin UUID vinculado; la prueba
Google real sigue pendiente. La dirección se conserva únicamente en Supabase.

| Estado | Resultado |
| --- | --- |
| Cuenta admitida, rol `NULL` | `pending`; sin acceso al recurso de prueba |
| Cuenta admitida, rol aprobado `admin`, `editor` o `lector` | `active` |
| Sin permiso, identidad inválida o `enabled = false` | `denied` |

Asignar un rol solo tras una decisión explícita del titular. Para suspender una
cuenta se cambia `enabled` a `false`; los recursos deben comprobar ese permiso
vigente en cada solicitud. Eliminar un usuario Auth elimina también su fila
de permiso por la relación de la migración: revisar esto antes de cualquier
borrado.

Antes del piloto Google, auditar los usuarios existentes y deshabilitar Email
(contraseña, enlaces y OTP), proveedores alternativos y acceso anónimo. La
comprobación de una identidad Google vinculada no garantiza por sí sola qué
método se usó para iniciar cada sesión; por eso se controla también la
configuración de proveedores. No desactivar globalmente las altas si el piloto
necesita crear usuarios mediante Google y el hook.

Para cerrar el acceso por correo en la consola:

1. **Authentication → Sign In / Providers → Email**.
2. Desactivar **Enable email provider** y pulsar **Save**.
3. Confirmar que Email muestra **DISABLED** en la lista de proveedores.
4. Conservar **Allow new users to sign up** activado: el hook filtra las altas.
   Mantener acceso anónimo y vinculación manual desactivados.
5. Revisar proveedores alternativos, Third-Party Auth y Passkeys antes de abrir
   el piloto. La revisión del 12/10/2026 confirmó **Email DISABLED**, los otros
   proveedores integrados desactivados y ningún proveedor personalizado.
   En las pantallas correspondientes se comprobó que **Third-Party Auth no
   tenía proveedores configurados** y **Enable Passkey authentication** estaba
   desactivado.

También se confirmaron las altas activadas, acceso anónimo desactivado y
vinculación manual desactivada. Después del guardado realizado por el titular,
se confirmó **Google ENABLED** en la lista de proveedores el 12/10/2026.
Abrir un formulario no guarda ningún cambio.

## 9. Conectar el frontend y probar el recorrido real

Tras completar los controles anteriores, habilitar el proveedor Google y
completar `config.js` con la URL del proyecto y su clave **publicable**
`sb_publishable_…`. Conservar `callbackUrl` como
`https://nubyra.es/acceso.html`. La clave publicable se utiliza en el navegador;
las claves administrativas y el secreto Google permanecen fuera de Git.

Para habilitar Google en Supabase:

1. **Authentication → Sign In / Providers → Google**.
2. Confirmar que Client ID y Client Secret están guardados y que el callback
   mostrado corresponde a `vyeebvzuxarekfaisfdy`.
3. Activar **Enable Sign in with Google**.
4. Mantener **Skip nonce checks** y **Allow users without an email** desactivados.
5. Pulsar **Save** y confirmar **Google ENABLED** en la lista de proveedores.

El 12/10/2026 se comprobaron el callback y los dos controles desactivados; el
titular activó y guardó Google y después se verificó **Google ENABLED**.

Para obtener la configuración pública:

1. En el proyecto verificado, abrir **Project Settings → API Keys**.
2. Usar la clave existente de la sección **Publishable key**, con prefijo
   `sb_publishable_…`; no usar ni revelar las claves de la sección Secret keys.
3. Completar las tres propiedades de `config.js`: `supabaseUrl`,
   `supabasePublishableKey` y `callbackUrl`. La URL del proyecto y el callback
   están en la sección 5. La clave publicable se distribuye con la web; no es
   la credencial administrativa ni reemplaza los permisos RLS.
4. Versionar el cambio, publicar en `main`, esperar Pages y comprobar la página
   real por HTTPS antes de realizar el login.

`acceso.html` referencia `config.js` con un parámetro de versión. Actualizar
ese parámetro cuando cambie la configuración pública para que el navegador
solicite la nueva versión del archivo. Durante esta instalación, Chrome
conservaba el estado cerrado tras el primer despliegue de la configuración;
se añadió `?v=20261012-1` para actualizar ese recurso.

**Despliegue comprobado el 12/10/2026:** Pages terminó correctamente, el
`config.js` público respondió HTTP 200 y coincidió con el archivo versionado.
Después del despliegue del parámetro de versión, Chrome mostró **Sin sesión**
y el botón **Continuar con Google** en `https://nubyra.es/acceso.html`. Esto
confirma la carga del frontend configurado; no demuestra todavía un login real.

En esta instalación se obtuvo la clave publicable del proyecto correcto y se
completó `config.js`. Antes de publicar se comprobaron dos peticiones reales a
la API con esa clave y sin sesión de usuario: tanto la RPC `resolve_my_access`
como la lectura de `nubyra_access_probe` devolvieron **HTTP 401**, código Postgres
**42501**, por falta de permisos. Es la denegación esperada; no conceder permisos
a `anon` para eliminarla. Las pruebas con JWT de usuario siguen pendientes.

Publicar y comprobar, con cuentas autorizadas por el titular:

- Alta/login Google admitido y retorno al mismo origen/ruta, con PKCE.
- Rechazo de una cuenta no admitida y de métodos de entrada alternativos.
- Rol pendiente: RPC `pending`, sin filas privadas visibles en el probe.
- Rol aprobado: RPC `active`, lectura de la fila ficticia del probe.
- Suspensión: RPC `denied` y denegación del probe usando el mismo JWT anterior.
- Sin sesión: sin acceso a la RPC ni al probe; sin lectura de la tabla privada
  de admisión en ningún estado del navegador.
- Cierre de sesión y callback con error: no recuperar una sesión previa.

Usar JWT reales de usuario, nunca una clave administrativa para simular estas
pruebas. No pegar tokens en Git, incidencias o capturas. Si falta
`email_verified` en la identidad Google real, investigar: el control deniega
acceso por diseño. Cada futuro recurso privado necesita su propia RLS.

## 10. Costes y condiciones de uso

La instalación actual usa el dominio contratado en IONOS, GitHub Pages y el
plan Free observado en Supabase. Revisar la renovación del dominio y los
límites de los servicios antes de ampliar el uso. No se contrataron aquí
servicios Google de pago ni se vinculó una cuenta de facturación.

No dar por supuesto un coste cero indefinido: nuevos servicios, cambios de
plan, límites y condiciones pueden cambiar. Antes de una ampliación, consultar
las tarifas de [Supabase](https://supabase.com/pricing),
[GitHub](https://github.com/pricing) y
[Google Cloud](https://cloud.google.com/pricing), además del contrato IONOS.

Revisar las [políticas OAuth de Google](https://developers.google.com/identity/protocols/oauth2/policies),
[condiciones de sus APIs](https://developers.google.com/terms) y
[política de datos de usuario](https://developers.google.com/terms/api-services-user-data-policy).
Solicitar solo los datos necesarios y explicar su uso en la política de
privacidad de NUBYRA antes de abrir el servicio al público.

## 11. Registro y siguiente paso

| Paso | Estado registrado a 12/10/2026 |
| --- | --- |
| Dominio, Pages y HTTPS | Configurados y comprobados durante la instalación |
| Página `acceso.html` | Integrada mediante PR #1 y publicada |
| Supabase Site URL / Redirect URL | Guardadas y comprobadas |
| Google: proyecto, cliente, origen, callback y scopes básicos | Configurados y comprobados |
| Google en Supabase | Credenciales guardadas por el titular; **Google ENABLED** comprobado |
| Migración y comprobaciones | Instalación real comprobada; 15/15 `true` |
| Before User Created | **ENABLED**, esquema y función comprobados |
| Cuenta piloto | Una admisión habilitada, sin rol ni UUID; recuento administrativo verificado |
| Usuarios Auth / roles asignados | 0 / 0; primer login y decisión de rol pendientes |
| Email y otros métodos alternativos | Email DISABLED y alternativos integrados desactivados; sin proveedores personalizados ni Third-Party Auth; Passkeys desactivado. Revisión completada |
| `config.js` / frontend | Configuración publicada por Pages y comprobada por HTTPS; Chrome muestra Sin sesión y Continuar con Google |
| API sin sesión | RPC y probe devuelven HTTP 401 / 42501 con la clave publicable real |
| OAuth real y JWT/RLS | Pendientes |
| Privacidad, condiciones y apertura pública | Pendientes |

**Siguiente paso:** abrir `https://nubyra.es/acceso.html`, pulsar **Continuar con
Google** y realizar el primer login con la cuenta admitida. El resultado
esperado es **Acceso pendiente**, sin rol ni acceso privado. Añadir
a este registro las nuevas verificaciones a medida que se completen, sin
incluir correos privados ni credenciales.

## 12. Resolución de incidencias

| Síntoma | Comprobación |
| --- | --- |
| 403 de la web antigua | DNS/caché y antigua redirección IONOS; confirmar que resuelve a Pages |
| HTTPS no válido | DNS, dominio personalizado y emisión de Pages; no trasladar certificados de otros dominios |
| 404 de `acceso.html` | Archivo en `main`, despliegue Pages y ruta publicada |
| Google `redirect_uri_mismatch` | Retorno Google a Supabase exacto; distinguirlo del callback de NUBYRA |
| Error PKCE | Comenzar y terminar en `https://nubyra.es/acceso.html`, mismo navegador y almacenamiento |
| Alta rechazada por el hook | Correo aprobado/habilitado, proveedor Google y estado de la vinculación UUID |
| Login pendiente o denegado | Consultar permiso vigente e identidad verificada; no retirar RLS ni asignar roles desde el cliente |
| Error GitHub al abrir archivos | La copia local versionada sirve para consultar el SQL; el fallo de GitHub no prueba un fallo en Supabase |

### Referencias técnicas

- [Google OAuth en Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Before User Created](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls)
- [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [HTTPS de GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/securing-your-github-pages-site-with-https)
