import { createClient } from '@supabase/supabase-js';

const config = window.NUBYRA_AUTH_CONFIG;
const root = document.querySelector('[data-nubyra-auth]');
const ui = {
  status: document.getElementById('auth-status'),
  detail: document.getElementById('auth-detail'),
  role: document.getElementById('auth-role'),
  login: document.getElementById('auth-login'),
  retry: document.getElementById('auth-retry'),
  logout: document.getElementById('auth-logout')
};

const copy = {
  loggedOut: ['Sin sesión', 'Entra con una cuenta Google autorizada para el piloto.'],
  validating: ['Comprobando el acceso…', ''],
  active: ['Acceso autorizado', 'Tu cuenta está habilitada para el piloto.'],
  pending: ['Acceso pendiente', 'Tu cuenta está registrada, pero aún no tiene un rol aprobado.'],
  denied: ['Acceso denegado', 'Esta cuenta no tiene acceso a NUBYRA.'],
  error: ['No se pudo comprobar el acceso', 'Reintenta cuando la conexión esté disponible.']
};

function render(state, { role = null, hasSession = false } = {}) {
  if (state !== 'active') root.dispatchEvent(new CustomEvent('nubyra:clear-private-view'));
  const [heading, detail] = copy[state];
  ui.status.textContent = heading;
  ui.detail.textContent = detail;
  ui.role.textContent = state === 'active' ? `Rol: ${role}` : '';
  ui.role.hidden = state !== 'active';
  ui.login.hidden = state !== 'loggedOut';
  ui.retry.hidden = state !== 'error';
  ui.logout.hidden = !hasSession;
  root.dataset.state = state;
}

function cleanAuthQuery() {
  const url = new URL(window.location.href);
  for (const param of ['code', 'error', 'error_code', 'error_description', 'state', 'sb_flow_id']) {
    url.searchParams.delete(param);
  }
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

function validConfig(value) {
  if (!value || typeof value !== 'object') return false;
  const { supabaseUrl, supabasePublishableKey, callbackUrl } = value;
  if (typeof supabasePublishableKey !== 'string' ||
      !supabasePublishableKey.startsWith('sb_publishable_') ||
      supabasePublishableKey.includes('REEMPLAZAR')) return false;
  try {
    const service = new URL(supabaseUrl);
    const callback = new URL(callbackUrl);
    return service.protocol === 'https:' && service.hostname.endsWith('.supabase.co') &&
      callback.protocol === 'https:' && callback.origin === window.location.origin &&
      callback.pathname === window.location.pathname && !callback.search && !callback.hash;
  } catch {
    return false;
  }
}

if (!root || Object.values(ui).some((element) => !element)) {
  throw new Error('Falta la estructura de acceso de NUBYRA.');
}

if (!validConfig(config)) {
  render('error');
  ui.detail.textContent = 'La configuración pública del acceso no está lista.';
  ui.retry.hidden = true;
  cleanAuthQuery();
} else {
  const initialQuery = new URL(window.location.href).searchParams;
  const hadOAuthError = initialQuery.has('error');
  const hadAuthCode = initialQuery.has('code');
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  });

  let generation = 0;
  let signInStarted = false;
  let logoutInProgress = false;
  let queued = false;
  let blockedByOAuthError = hadOAuthError;
  let callbackCodePending = hadAuthCode;
  let callbackExchangeFailed = hadOAuthError;

  function scheduleRefresh() {
    if (queued || blockedByOAuthError || logoutInProgress) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (blockedByOAuthError || logoutInProgress) return;
      void refreshAccess();
    });
  }

  async function refreshAccess() {
    const current = ++generation;
    let hasSession = false;
    let exchangeConfirmed = !callbackCodePending;
    render('validating');
    try {
      if (callbackCodePending) {
        // initialize() reutiliza la inicialización automática del SDK y permite
        // detectar un canje fallido sin llamar a exchangeCodeForSession otra vez.
        const { error: initializationError } = await supabase.auth.initialize();
        if (initializationError) throw initializationError;
        // En 2.117.3 el SDK quita `code` solo tras un canje PKCE válido. Si no
        // había verificador, puede recuperar una sesión antigua sin error.
        if (new URL(window.location.href).searchParams.has('code')) {
          throw new Error('El retorno OAuth no se canjeó');
        }
        exchangeConfirmed = true;
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (current !== generation) return;
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        if (callbackCodePending) render('error');
        else render('loggedOut');
        return;
      }
      hasSession = true;
      const { data, error } = await supabase.rpc('resolve_my_access');
      if (current !== generation) return;
      if (error) throw error;
      const validRole = ['admin', 'editor', 'lector'].includes(data?.role);
      if (data?.status === 'active' && validRole) {
        render('active', { role: data.role, hasSession: true });
      } else if (data?.status === 'pending' && data.role === null) {
        render('pending', { hasSession: true });
      } else if (data?.status === 'denied' && data.role === null) {
        render('denied', { hasSession: true });
      } else {
        throw new Error('Respuesta de autorización inválida');
      }
    } catch {
      if (!exchangeConfirmed) {
        callbackExchangeFailed = true;
        blockedByOAuthError = true;
      }
      if (current === generation) render('error', { hasSession });
    } finally {
      if (current === generation) {
        callbackCodePending = false;
        cleanAuthQuery();
      }
    }
  }

  ui.login.addEventListener('click', async () => {
    if (signInStarted) return;
    signInStarted = true;
    ui.login.disabled = true;
    render('validating');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: config.callbackUrl, queryParams: { prompt: 'select_account' } }
      });
      if (error) throw error;
      // El SDK redirige al navegador. Si ese paso no sucede, se permite reintentar.
      window.setTimeout(() => {
        signInStarted = false;
        ui.login.disabled = false;
        render('error');
      }, 10000);
    } catch {
      signInStarted = false;
      ui.login.disabled = false;
      render('error');
    }
  });

  ui.retry.addEventListener('click', () => {
    if (callbackExchangeFailed) {
      // Un callback fallido no recupera automáticamente una sesión anterior.
      // El usuario puede iniciar un flujo nuevo desde el botón Google.
      render('loggedOut');
      return;
    }
    blockedByOAuthError = false;
    scheduleRefresh();
  });

  ui.logout.addEventListener('click', async () => {
    if (logoutInProgress) return;
    logoutInProgress = true;
    generation++;
    render('validating');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
      render('loggedOut');
    } catch {
      render('error', { hasSession: true });
    } finally {
      logoutInProgress = false;
    }
  });

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      generation++;
      render('loggedOut');
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      scheduleRefresh();
    }
  });

  window.addEventListener('focus', scheduleRefresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleRefresh();
  });

  if (hadOAuthError) {
    render('error');
    cleanAuthQuery();
  } else {
    scheduleRefresh();
  }
}
