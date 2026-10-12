// Copiar como config.js tras crear el proyecto Supabase propio de NUBYRA.
// El inicio y el callback del piloto usan directamente la página GitHub Pages indicada.
// La clave publicable de Supabase está diseñada para el navegador; jamás usar service_role.
window.NUBYRA_AUTH_CONFIG = Object.freeze({
  supabaseUrl: "https://REEMPLAZAR.supabase.co",
  supabasePublishableKey: "sb_publishable_REEMPLAZAR",
  callbackUrl: "https://nubyra.es/acceso.html"
});
