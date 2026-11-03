// Comprobación manual reproducible con Chrome local: node test/interfaz-browser.js
// Requiere npm start y colección escolar. No descarga navegadores ni imprime credenciales.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
await access(chrome);
const perfil = await mkdtemp(join(tmpdir(), 'sice-preview-'));
const proceso = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
const credenciales = dotenv.parse(await readFile(new URL('../.env.escolar.local', import.meta.url)));
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const salida = new URL('../.local/verificacion/', import.meta.url);
await mkdir(salida, { recursive: true });
let socket;
try {
  let puerto;
  for (let intento = 0; intento < 100; intento++) {
    try { puerto = (await readFile(join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await pausa(100); }
  }
  assert.ok(puerto, 'Chrome no inició el puerto de pruebas.');
  const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  socket = new WebSocket(paginas.find((p) => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let secuencia = 0;
  const pendientes = new Map();
  socket.addEventListener('message', (evento) => {
    const mensaje = JSON.parse(evento.data);
    const promesa = pendientes.get(mensaje.id);
    if (!promesa) return;
    pendientes.delete(mensaje.id);
    clearTimeout(promesa.timeout);
    if (mensaje.error) promesa.reject(new Error('Falló una instrucción del navegador.'));
    else promesa.resolve(mensaje.result);
  });
  socket.addEventListener('close', () => {
    for (const promesa of pendientes.values()) {
      clearTimeout(promesa.timeout);
      promesa.reject(new Error('Se cerró la conexión de pruebas con Chrome.'));
    }
    pendientes.clear();
  });
  const enviar = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++secuencia;
    const timeout = setTimeout(() => { pendientes.delete(id); reject(new Error(`Chrome no respondió a ${method}.`)); }, 10000);
    pendientes.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluar = async (expression) => {
    const resultado = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (resultado.exceptionDetails) throw new Error('Falló la evaluación de la interfaz.');
    return resultado.result.value;
  };
  const esperar = async (expresion) => {
    for (let intento = 0; intento < 100; intento++) {
      if (await evaluar(expresion)) return;
      await pausa(100);
    }
    throw new Error('La interfaz no llegó al estado esperado.');
  };
  await enviar('Page.enable');
  for (const ancho of [1280, 768, 320]) {
    await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
    await enviar('Page.navigate', { url: base });
    await esperar("document.querySelector('#login-form')?.hidden === false && document.querySelector('.school-logo')?.complete");
    const medidas = await evaluar(`(() => {
      const logo = document.querySelector('.school-logo');
      const boton = document.querySelector('#login-button').getBoundingClientRect();
      return { viewport: innerWidth, disponible: document.documentElement.clientWidth, documento: document.documentElement.scrollWidth,
        logo: logo.naturalWidth > 0, formulario: !document.querySelector('#login-form').hidden,
        botonDentro: boton.left >= 0 && boton.right <= innerWidth,
        bootstrap: getComputedStyle(document.querySelector('.container')).maxWidth !== 'none' };
    })()`);
    assert.equal(medidas.documento, medidas.disponible, `Desbordamiento a ${ancho}px`);
    assert.ok(medidas.logo && medidas.formulario && medidas.botonDentro);
    const captura = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(new URL(`login-${ancho}.png`, salida), Buffer.from(captura.data, 'base64'));
    console.log(JSON.stringify({ ancho, ...medidas }));
  }
  await evaluar("document.querySelector('#username').value = 'lramos'; document.querySelector('#password').value = 'incorrecta-solo-local'; document.querySelector('#login-form').requestSubmit();");
  await esperar("!document.querySelector('#feedback').hidden");
  assert.equal(await evaluar("document.querySelector('#feedback').textContent"), 'Usuario o contraseña incorrectos.');
  const contrasena = credenciales.ADMINISTRADOR_PASSWORD;
  assert.ok(contrasena);
  await evaluar(`document.querySelector('#username').value = 'vgutierrez'; document.querySelector('#password').value = ${JSON.stringify(contrasena)}; document.querySelector('#login-form').requestSubmit();`);
  await esperar("!document.querySelector('#session-panel').hidden");
  assert.equal(await evaluar("document.querySelector('#session-role').textContent"), 'Administrador');
  assert.equal(await evaluar("document.cookie.includes('sice_session')"), false);
  assert.equal(await evaluar("document.querySelector('#password').value"), '');
  await enviar('Page.reload');
  await esperar("document.querySelector('#session-panel')?.hidden === false");
  await evaluar("document.querySelector('#logout-button').click()");
  await esperar("!document.querySelector('#login-form').hidden");
  assert.equal(await evaluar("document.querySelector('#session-status').textContent"), 'Has cerrado la sesión.');
  console.log('Interfaz: error de acceso, login, cookie inaccesible a JavaScript, recarga y logout aprobados.');
  async function ingresar(nombre, clave) {
    await evaluar(`document.querySelector('#username').value = ${JSON.stringify(nombre)}; document.querySelector('#password').value = ${JSON.stringify(clave)}; document.querySelector('#login-form').requestSubmit();`);
    await esperar("!document.querySelector('#session-panel').hidden");
    await enviar('Page.navigate', { url: `${base}/panel.html` });
  }
  async function capturarPanel(nombre) {
    for (const ancho of [1280, 768, 320]) {
      await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
      await pausa(120);
      const medidas = await evaluar('({ disponible: document.documentElement.clientWidth, contenido: document.documentElement.scrollWidth })');
      if (medidas.contenido !== medidas.disponible) console.log(await evaluar("({tabla:[...document.querySelectorAll('#list-view .table-responsive')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX})),otros:[...document.querySelectorAll('body *')].filter(e => !e.closest('.table-responsive') && e.getBoundingClientRect().right>document.documentElement.clientWidth).slice(0,12).map(e=>({tag:e.tagName,id:e.id,clase:e.className,ancho:e.getBoundingClientRect().width}))})"));
      assert.equal(medidas.contenido, medidas.disponible, `${nombre}: desbordamiento a ${ancho}px`);
      const captura = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      await writeFile(new URL(`${nombre}-${ancho}.png`, salida), Buffer.from(captura.data, 'base64'));
    }
  }
  await ingresar('vgutierrez', contrasena);
  await esperar("document.querySelector('#accounts-view')?.hidden === false && document.querySelector('#account-rows').children.length > 0");
  assert.equal(await evaluar("document.querySelector('#nav-list').hidden"), true);
  assert.equal(await evaluar("document.querySelector('#authorization-form').hidden"), true);
  await capturarPanel('cuentas');
  await evaluar("document.querySelector('#logout').click()");
  await esperar("document.querySelector('#login-form')?.hidden === false");
  await ingresar('rsalazar', credenciales.DIRECTOR_PASSWORD);
  await esperar("document.querySelector('#incident-rows')?.children.length > 0");
  assert.equal(await evaluar("(() => { const texto = document.querySelector('#incident-rows').textContent; return texto.toLowerCase().includes('ficticio') || texto.includes('[DEMO-'); })()"), false);
  await capturarPanel('expedientes');
  await evaluar("document.querySelector('#nav-new').click()");
  await esperar("document.querySelector('#form-view').hidden === false");
  await evaluar("document.querySelector('#category').value = 'salud'; document.querySelector('#category').dispatchEvent(new Event('change'))");
  assert.equal(await evaluar("Boolean(document.querySelector('#field-sintomas_observados')) && !document.querySelector('#field-gravedad_disciplinaria') && document.querySelector('#confidentiality').value === 'restringida'"), true);
  await capturarPanel('formulario-salud');
  await evaluar(`(async () => {
    const catalogo = await (await fetch('/api/incidencias/catalogos')).json();
    document.querySelector('#category').value = 'seguridad'; document.querySelector('#category').dispatchEvent(new Event('change'));
    document.querySelector('#incident-type').value = catalogo.tipos.find(t => t.categoria === 'seguridad' && Number(t.minimo_estudiantes) === 0).id;
    document.querySelector('#incident-title').value = 'Agua acumulada advertida antes del paso del grupo';
    document.querySelector('#description').value = 'Durante la revisión del pasillo antes del recreo se observó agua acumulada junto al lavadero. Se mantuvo al grupo alejado del sector y se solicitó apoyo para secarlo. No hubo caídas ni estudiantes afectados. Se registran las medidas preventivas y queda pendiente revisar si la acumulación se repite.';
    document.querySelector('#place').value = 'Pasillo de primaria';
    document.querySelector('#sensitive').value = 'false';
    document.querySelector('#field-riesgo_identificado').value = 'Superficie mojada en una ruta de circulación.';
    document.querySelector('#field-riesgo_persistente').value = 'false';
    document.querySelector('#reporter').value = catalogo.personas.find(p => p.nombres === 'Lucía Patricia').id;
    document.querySelector('#reporter').dispatchEvent(new Event('change'));
    document.querySelector('#reporter-condition').value = 'personal';
    document.querySelector('#incident-form').requestSubmit();
  })()`);
  await esperar("document.querySelector('#detail-view').hidden === false && document.querySelector('#detail-content').textContent.includes('Agua acumulada advertida')");
  await evaluar("[...document.querySelectorAll('#detail-content button')].find(b => b.textContent === 'Confirmar incidencia').click()");
  await esperar("document.querySelector('#detail-content > .eyebrow').textContent.includes('confirmada')");
  assert.equal(await evaluar("[...document.querySelectorAll('#detail-content button')].some(b => b.textContent === 'Editar borrador')"), false);
  await evaluar(`(() => {
    const form = document.querySelector('#detail-content form');
    form.elements.detalle.value = 'Se secó el sector y se comprobó que el grupo podía circular sin atravesar una superficie húmeda. Se comunicó la observación para revisar el lavadero.';
    form.elements.contenido_sensible.value = 'false';
    form.requestSubmit();
  })()`);
  await esperar("document.querySelector('#detail-content > .eyebrow').textContent.includes('en seguimiento')");
  await capturarPanel('expediente-detalle');
  assert.equal(await evaluar("[...document.querySelectorAll('#detail-content button')].some(b => b.textContent === 'Descargar PDF')"), true);
  await evaluar("document.querySelector('#nav-accounts').click()");
  await esperar("document.querySelector('#accounts-view').hidden === false && document.querySelector('#authorization-form').hidden === false");
  const motivo = `Ratificar la continuidad del acceso docente según la revisión de ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC.`;
  await evaluar(`(async () => {
    const datos = await (await fetch('/api/cuentas/catalogos')).json();
    const cuenta = datos.usuarios.find(u => u.nombre_usuario === 'lramos');
    document.querySelector('#account-action').value = 'actualizar_cuenta'; document.querySelector('#account-action').dispatchEvent(new Event('change'));
    const form = document.querySelector('#authorization-form');
    form.elements.id_usuario_objetivo.value = cuenta.id; form.elements.id_rol_objetivo.value = cuenta.id_rol;
    form.elements.nombre_usuario.value = cuenta.nombre_usuario; form.elements.activo.value = 'true';
    document.querySelector('#authorization-reason').value = ${JSON.stringify(motivo)};
    form.requestSubmit();
  })()`);
  await esperar("document.querySelector('#message').textContent.includes('Autorización registrada')");
  await evaluar("document.querySelector('#logout').click()");
  await esperar("document.querySelector('#login-form')?.hidden === false");
  await ingresar('vgutierrez', contrasena);
  await esperar("document.querySelector('#accounts-view')?.hidden === false && document.querySelector('#authorization-list').children.length > 0");
  await evaluar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(motivo)})).querySelector('button').click()`);
  await esperar("document.querySelector('#execution-form').hidden === false");
  assert.equal(await evaluar("document.querySelector('#execution-password-group').hidden"), true);
  await evaluar("document.querySelector('#execution-form').requestSubmit()");
  await esperar("document.querySelector('#message').textContent.includes('Cambio autorizado ejecutado')");
  await evaluar("document.querySelector('#logout').click()");
  await esperar("document.querySelector('#login-form')?.hidden === false");
  console.log('Panel: autorización por Director y ejecución por Administrador; listado, formularios, guardado, confirmación y seguimiento aprobados a 320/768/1280 px.');
  await enviar('Browser.close');
} finally { socket?.close(); proceso.kill(); }
