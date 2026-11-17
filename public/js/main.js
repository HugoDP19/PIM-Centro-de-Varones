const form = document.getElementById('login-form');
const feedback = document.getElementById('feedback');
const status = document.getElementById('session-status');
const password = document.getElementById('password');
const loginButton = document.getElementById('login-button');
let redirigiendo = false;

function mostrarError(mensaje) {
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

function mostrarAcceso() {
  const mensajes = {
    expirada: 'Tu sesión ha finalizado o ya no es válida. Inicia sesión nuevamente.',
    cerrada: 'Has cerrado la sesión.'
  };
  const motivo = new URLSearchParams(location.search).get('sesion');
  status.textContent = mensajes[motivo] || '';
  status.hidden = !status.textContent;
  form.hidden = false;
  password.value = '';
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
  if (loginButton.disabled || redirigiendo) return;
  feedback.hidden = true;
  loginButton.disabled = true;
  loginButton.textContent = 'Verificando…';
  try {
    const { response, resultado } = await solicitar('login', { usuario: document.getElementById('username').value.trim(), contrasena: password.value });
    if (response.ok) abrirPanel();
    else mostrarError(resultado.error || 'No se pudo iniciar sesión.');
  } catch { mostrarError('No se pudo contactar al servidor. Comprueba la conexión e inténtalo de nuevo.'); }
  finally { password.value = ''; loginButton.disabled = false; loginButton.textContent = 'Iniciar sesión'; }
});

document.getElementById('show-password').addEventListener('click', (event) => {
  const mostrar = password.type === 'password';
  password.type = mostrar ? 'text' : 'password';
  event.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  event.currentTarget.setAttribute('aria-pressed', String(mostrar));
});

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
window.addEventListener('pagehide', () => { form.hidden = true; password.value = ''; });
window.addEventListener('pageshow', (event) => { if (event.persisted) recuperarSesion(); });
recuperarSesion();
