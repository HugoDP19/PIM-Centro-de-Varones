const form = document.getElementById('login-form');
const panel = document.getElementById('session-panel');
const feedback = document.getElementById('feedback');
const status = document.getElementById('session-status');
const password = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const roleNames = { director: 'Director', subdirector: 'Subdirector', coordinador_tutoria: 'Coordinador de Tutoría', docente: 'Docente', auxiliar: 'Auxiliar', administrador: 'Administrador' };

function mostrarError(mensaje) {
  feedback.textContent = mensaje;
  feedback.hidden = false;
}

function mostrarSesion(usuario) {
  status.hidden = true;
  feedback.hidden = true;
  form.hidden = Boolean(usuario);
  panel.hidden = !usuario;
  document.getElementById('access-title').textContent = usuario ? 'Tu sesión institucional' : 'Iniciar sesión';
  document.getElementById('access-description').textContent = usuario ? 'Has ingresado de forma segura a tu cuenta.' : 'Ingresa con tu cuenta institucional para continuar.';
  password.value = '';
  if (!usuario) return;
  document.getElementById('session-name').textContent = usuario.nombre;
  document.getElementById('session-role').textContent = roleNames[usuario.rol] || usuario.rol;
  document.getElementById('session-username').textContent = usuario.nombre_usuario;
  document.getElementById('session-scope').textContent = usuario.rol === 'administrador'
    ? 'Tu rol se limita a cuentas y permisos autorizados. No concede acceso a expedientes de incidencias.'
    : 'Las acciones disponibles dependen de los permisos y del alcance institucional autorizado.';
}

async function solicitar(ruta, datos) {
  const response = await fetch(`/api/auth/${ruta}`, {
    method: datos ? 'POST' : 'GET', credentials: 'same-origin',
    headers: datos ? { 'Content-Type': 'application/json', 'X-SICE-Request': '1' } : {},
    body: datos ? JSON.stringify(datos) : undefined, signal: AbortSignal.timeout(15000)
  });
  const resultado = response.status === 204 ? {} : await response.json();
  return { response, resultado };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  feedback.hidden = true;
  loginButton.disabled = true;
  loginButton.textContent = 'Verificando…';
  try {
    const { response, resultado } = await solicitar('login', { usuario: document.getElementById('username').value.trim(), contrasena: password.value });
    if (response.ok) mostrarSesion(resultado.usuario);
    else mostrarError(resultado.error || 'No se pudo iniciar sesión.');
  } catch { mostrarError('No se pudo contactar al servidor. Comprueba la conexión e inténtalo de nuevo.'); }
  finally { password.value = ''; loginButton.disabled = false; loginButton.textContent = 'Iniciar sesión'; }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    const { response, resultado } = await solicitar('logout', {});
    if (response.ok || response.status === 401) {
      mostrarSesion(null);
      status.textContent = 'Has cerrado la sesión.';
      status.hidden = false;
      document.getElementById('username').focus();
    } else mostrarError(resultado.error || 'No se pudo cerrar la sesión. Vuelve a intentarlo.');
  } catch { mostrarError('No se pudo confirmar el cierre de sesión. Recupera la conexión y vuelve a intentarlo.'); }
  finally { logoutButton.disabled = false; }
});

document.getElementById('show-password').addEventListener('click', (event) => {
  const mostrar = password.type === 'password';
  password.type = mostrar ? 'text' : 'password';
  event.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(mostrar));
});

async function recuperarSesion() {
  try {
    const { response, resultado } = await solicitar('sesion');
    mostrarSesion(response.ok ? resultado.usuario : null);
    if (!response.ok && response.status !== 401) mostrarError(resultado.error || 'No se pudo comprobar la sesión.');
  } catch { mostrarSesion(null); mostrarError('No se pudo comprobar la sesión. Comprueba tu conexión.'); }
}
recuperarSesion();
