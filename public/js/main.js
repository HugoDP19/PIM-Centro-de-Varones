const formulario = document.getElementById('login-form');
const avisoAcceso = document.getElementById('feedback');
const estadoSesion = document.getElementById('session-status');
const contrasena = document.getElementById('password');
const botonAcceso = document.getElementById('login-button');
let redirigiendo = false;

function limpiarAvisos() {
  for (const mensaje of [avisoAcceso, estadoSesion]) {
    mensaje.hidden = true;
    mensaje.textContent = '';
  }
}

function mostrarError(mensaje) {
  limpiarAvisos();
  avisoAcceso.textContent = mensaje;
  avisoAcceso.hidden = false;
}

function abrirPanel() {
  if (redirigiendo) {
    return;
  }
  redirigiendo = true;
  formulario.hidden = true;
  contrasena.value = '';
  location.replace('/panel.html');
}

function mostrarAcceso() {
  limpiarAvisos();
  formulario.reset();
  contrasena.type = 'password';
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
  estadoSesion.textContent = mensajes[motivo] || '';
  estadoSesion.hidden = !estadoSesion.textContent;
  formulario.hidden = false;
  contrasena.value = '';
}

async function solicitar(ruta, datos) {
  const respuesta = await fetch(`/api/auth/${ruta}`, {
    method: datos ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: datos ? { 'Content-Type': 'application/json', 'X-SICE-Request': '1' } : {},
    body: datos ? JSON.stringify(datos) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  const resultado = respuesta.status === 204 ? {} : await respuesta.json();
  return { respuesta, resultado };
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (botonAcceso.disabled || redirigiendo) {
    return;
  }
  limpiarAvisos();
  botonAcceso.disabled = true;
  botonAcceso.textContent = 'Verificando…';
  try {
    const { respuesta, resultado } = await solicitar('login', {
      usuario: document.getElementById('username').value.trim(),
      contrasena: contrasena.value
    });
    if (respuesta.ok) {
      abrirPanel();
    } else {
      mostrarError(resultado.error || 'No se pudo iniciar sesión.');
    }
  } catch {
    mostrarError('No se pudo contactar al servidor. Comprueba la conexión e inténtalo de nuevo.');
  } finally {
    contrasena.value = '';
    botonAcceso.disabled = false;
    botonAcceso.textContent = 'Iniciar sesión';
  }
});

formulario.addEventListener('input', limpiarAvisos);

document.getElementById('show-password').addEventListener('click', (evento) => {
  const mostrar = contrasena.type === 'password';
  contrasena.type = mostrar ? 'text' : 'password';
  evento.currentTarget.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  evento.currentTarget.setAttribute('aria-pressed', String(mostrar));
});

async function recuperarSesion() {
  redirigiendo = false;
  formulario.hidden = true;
  avisoAcceso.hidden = true;
  estadoSesion.textContent = 'Comprobando tu sesión…';
  estadoSesion.hidden = false;
  try {
    const { respuesta, resultado } = await solicitar('sesion');
    if (respuesta.ok) {
      return abrirPanel();
    }
    mostrarAcceso();
    if (!respuesta.ok && respuesta.status !== 401) {
      mostrarError(resultado.error || 'No se pudo comprobar la sesión.');
    }
  } catch {
    mostrarAcceso();
    mostrarError('No se pudo comprobar la sesión. Comprueba tu conexión.');
  }
}
window.addEventListener('pagehide', () => {
  formulario.hidden = true;
  formulario.reset();
  limpiarAvisos();
});
window.addEventListener('pageshow', (evento) => {
  if (evento.persisted) {
    recuperarSesion();
  }
});
recuperarSesion();
