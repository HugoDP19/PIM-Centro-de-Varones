const form = document.getElementById('login-form');
const feedback = document.getElementById('feedback');
const status = document.getElementById('session-status');
const password = document.getElementById('password');
const loginButton = document.getElementById('login-button');
let redirigiendo = false;

// Evita mezclar el resultado del acceso actual con avisos de una sesión anterior.
function limpiarAvisos() {
  for (const mensaje of [feedback, status]) {
    mensaje.hidden = true;
    mensaje.textContent = '';
  }
}

function mostrarError(mensaje) {
  limpiarAvisos();
  feedback.textContent = mensaje;
  feedback.hidden = false;
}

function abrirPanel() {
  if (redirigiendo) return;
  redirigiendo = true;
  form.hidden = true;
  password.value = '';
  location.replace('/panel.html');
}

// Restablece el formulario y consume el motivo de cierre para no repetirlo al recargar.
function mostrarAcceso() {
  limpiarAvisos();
  form.reset();
  password.type = 'password';
  document.getElementById('show-password').textContent = 'Mostrar';
  document.getElementById('show-password').setAttribute('aria-pressed', 'false');
  const mensajes = {
    expirada: 'Tu sesión ha finalizado o ya no es válida. Inicia sesión nuevamente.',
    cerrada: 'Sesión cerrada correctamente'
  };
  const direccion = new URL(location.href);
  const motivo = direccion.searchParams.get('sesion');
  if (direccion.searchParams.has('sesion')) {
    direccion.searchParams.delete('sesion');
    history.replaceState(null, '', direccion.pathname + direccion.search + direccion.hash);
  }
  status.textContent = mensajes[motivo] || '';
  status.hidden = !status.textContent;
  form.hidden = false;
  password.value = '';
}

// Centraliza las peticiones de acceso con cookies del mismo origen y tiempo límite.
async function solicitar(ruta, datos) {
  const response = await fetch(`/api/auth/${ruta}`, {
    method: datos ? 'POST' : 'GET', credentials: 'same-origin',
    headers: datos ? { 'Content-Type': 'application/json', 'X-SICE-Request': '1' } : {},
    body: datos ? JSON.stringify(datos) : undefined, signal: AbortSignal.timeout(15000)
  });
  const resultado = response.status === 204 ? {} : await response.json();
  return { response, resultado };
}

// Bloquea envíos repetidos mientras comprueba el acceso y limpia la contraseña al terminar.
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (loginButton.disabled || redirigiendo) return;
  limpiarAvisos();
  loginButton.disabled = true;
  loginButton.textContent = 'Verificando…';
  try {
    const { response, resultado } = await solicitar('login', { usuario: document.getElementById('username').value.trim(), contrasena: password.value });
    if (response.ok) abrirPanel();
    else mostrarError(resultado.error || 'No se pudo iniciar sesión.');
  } catch { mostrarError('No se pudo contactar al servidor. Comprueba la conexión e inténtalo de nuevo.'); }
  finally { password.value = ''; loginButton.disabled = false; loginButton.textContent = 'Iniciar sesión'; }
});

form.addEventListener('input', limpiarAvisos);

document.getElementById('show-password').addEventListener('click', (event) => {
  const mostrar = password.type === 'password';
  password.type = mostrar ? 'text' : 'password';
  event.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(mostrar));
});

// Consulta la sesión real antes de mostrar el acceso o redirigir al panel.
async function recuperarSesion() {
  redirigiendo = false;
  form.hidden = true;
  feedback.hidden = true;
  status.textContent = 'Comprobando tu sesión…';
  status.hidden = false;
  try {
    const { response, resultado } = await solicitar('sesion');
    if (response.ok) return abrirPanel();
    mostrarAcceso();
    if (!response.ok && response.status !== 401) mostrarError(resultado.error || 'No se pudo comprobar la sesión.');
  } catch { mostrarAcceso(); mostrarError('No se pudo comprobar la sesión. Comprueba tu conexión.'); }
}
window.addEventListener('pagehide', () => { form.hidden = true; form.reset(); limpiarAvisos(); });
window.addEventListener('pageshow', (event) => { if (event.persisted) recuperarSesion(); });
recuperarSesion();
