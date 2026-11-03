// Comprobación manual reproducible con Chrome local: node test/interfaz-browser.js
// Requiere npm start y datos demo. No descarga navegadores ni imprime credenciales.
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
const credenciales = dotenv.parse(await readFile(new URL('../.env.demo.local', import.meta.url)));
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
    await enviar('Page.navigate', { url: 'http://127.0.0.1:3000' });
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
  await evaluar("document.querySelector('#username').value = 'demo.docente'; document.querySelector('#password').value = 'incorrecta-solo-demo'; document.querySelector('#login-form').requestSubmit();");
  await esperar("!document.querySelector('#feedback').hidden");
  assert.equal(await evaluar("document.querySelector('#feedback').textContent"), 'Usuario o contraseña incorrectos.');
  const contrasena = credenciales.DEMO_ADMINISTRADOR_PASSWORD;
  assert.ok(contrasena);
  await evaluar(`document.querySelector('#username').value = 'demo.administrador'; document.querySelector('#password').value = ${JSON.stringify(contrasena)}; document.querySelector('#login-form').requestSubmit();`);
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
  await enviar('Browser.close');
} finally { socket?.close(); proceso.kill(); }
