// Comprobación manual reproducible con Chrome local: node test/interfaz-browser.js
// Usa la copia temporal de la suite SQL Server. No guarda capturas ni descarga navegadores.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { personalEscolar } from './datos.js';

const pausa = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function verificarInterfaz(base, credenciales, expirarSesion, prepararRegresiones) {
  const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  await access(chrome);
  const perfil = await mkdtemp(join(tmpdir(), 'sice-preview-'));
  const opciones = process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : [];
  const proceso = spawn(chrome, ['--headless=new', ...opciones, '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let socket;
  try {
    let puerto;
    for (let intento = 0; intento < 100; intento++) {
      try { puerto = (await readFile(join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
      catch { await pausa(100); }
    }
    assert.ok(puerto, 'Chrome no inició el puerto de pruebas.');
    const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
    const navegador = await (await fetch(`http://127.0.0.1:${puerto}/json/version`)).json();
    socket = new WebSocket(navegador.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let secuencia = 0, navegaciones = 0, erroresJavaScript = 0, sesionPrincipal;
    // Relaciona cada respuesta de DevTools con su petición y propaga los errores al caso correspondiente.
    const pendientes = new Map();
    socket.addEventListener('message', (evento) => {
      const mensaje = JSON.parse(evento.data);
      if (mensaje.method === 'Runtime.exceptionThrown') erroresJavaScript++;
      if (mensaje.method === 'Page.frameNavigated' && !mensaje.params.frame.parentId && mensaje.sessionId === sesionPrincipal) navegaciones++;
      if (mensaje.method === 'Page.javascriptDialogOpening') enviar('Page.handleJavaScriptDialog', { accept: true }, mensaje.sessionId).catch(() => {});
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
    const enviar = (method, params = {}, sesion = sesionPrincipal) => new Promise((resolve, reject) => {
      const id = ++secuencia;
      const timeout = setTimeout(() => { pendientes.delete(id); reject(new Error(`Chrome no respondió a ${method}.`)); }, 10000);
      pendientes.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params,
        ...(!method.startsWith('Target.') && !method.startsWith('Browser.') && sesion ? { sessionId: sesion } : {}) }));
    });
    sesionPrincipal = (await enviar('Target.attachToTarget', { targetId: paginas.find(p => p.type === 'page').id, flatten: true })).sessionId;
    const evaluar = async (expression, sesion = sesionPrincipal) => {
      const resultado = await enviar('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sesion);
      if (resultado.exceptionDetails) throw new Error('Falló la evaluación de la interfaz.');
      return resultado.result.value;
    };
    const esperar = async (expresion, sesion = sesionPrincipal) => {
      for (let intento = 0; intento < 100; intento++) {
        if (await evaluar(expresion, sesion)) return;
        await pausa(100);
      }
      throw new Error('La interfaz no llegó al estado esperado.');
    };
    await enviar('Page.enable');
    await enviar('Runtime.enable');
    for (const ancho of [1280, 1024, 768]) {
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
      console.log(JSON.stringify({ ancho, ...medidas }));
    }
    await evaluar("document.querySelector('#username').value = 'lramos'; document.querySelector('#password').value = 'incorrecta-solo-local'; document.querySelector('#login-form').requestSubmit();");
    await esperar("!document.querySelector('#feedback').hidden");
    assert.equal(await evaluar("document.querySelector('#feedback').textContent"), 'Usuario o contraseña incorrectos.');
    const contrasena = credenciales.ADMINISTRADOR_PASSWORD;
    const [, nombreAdministrador, apellidoAdministrador, usuarioAdministrador] = personalEscolar.find(([rol]) => rol === 'administrador');
    assert.ok(contrasena);
    await evaluar(`document.querySelector('#username').value = ${JSON.stringify(usuarioAdministrador)}; document.querySelector('#password').value = ${JSON.stringify(contrasena)}; document.querySelector('#login-form').requestSubmit();`);
    await esperar("location.pathname === '/panel.html' && document.querySelector('#workspace')?.hidden === false && document.querySelector('#account-rows')?.children.length > 0");
    assert.equal(await evaluar("document.querySelector('#user-label').textContent"), `${nombreAdministrador} ${apellidoAdministrador} · Administrador`);
    assert.equal(await evaluar("document.cookie.includes('sice_session')"), false);
    assert.equal(await evaluar("document.querySelector('#logout').textContent"), 'Cerrar sesión');
    await enviar('Page.reload');
    await esperar("document.querySelector('#workspace')?.hidden === false && document.querySelector('#account-rows')?.children.length > 0");
    await evaluar("document.querySelector('#logout').click()");
    await esperar("document.querySelector('#login-form')?.hidden === false");
    await verificarCierre();
    await evaluar("document.querySelector('#username').value = 'rsalazar'; document.querySelector('#password').value = 'incorrecta-solo-local'; document.querySelector('#login-form').requestSubmit();");
    await esperar("document.querySelector('#feedback')?.hidden === false");
    assert.equal(await evaluar("document.querySelector('#feedback').textContent"), 'Usuario o contraseña incorrectos.');
    assert.equal(await evaluar("document.querySelector('#session-status').hidden"), true, 'El error del nuevo acceso debe sustituir el aviso de cierre');
    await ingresar('rsalazar', credenciales.DIRECTOR_PASSWORD);
    await evaluar("document.querySelector('#logout').click()");
    await verificarCierre();
    await enviar('Page.reload');
    await esperar("document.querySelector('#login-form')?.hidden === false");
    assert.equal(await evaluar("document.querySelector('#session-status').hidden && document.querySelector('#feedback').hidden"), true, 'Recargar no repite mensajes consumidos');
    await enviar('Page.navigate', { url: base.replace('127.0.0.1', 'localhost') });
    await esperar("document.querySelector('#login-form')?.hidden === false && location.hostname === '127.0.0.1'");
    assert.equal(await evaluar('location.origin'), new URL(base).origin);
    console.log('Interfaz: error de acceso, login, cookie inaccesible a JavaScript, recarga y logout aprobados.');
    async function verificarCierre() {
      await esperar("document.querySelector('#login-form')?.hidden === false");
      assert.equal(await evaluar("document.querySelector('#session-status').textContent"), 'Sesión cerrada correctamente');
      assert.equal(await evaluar("document.querySelector('#feedback').hidden && document.querySelector('#feedback').textContent === ''"), true);
      assert.equal(await evaluar("document.querySelector('#username').value === '' && document.querySelector('#password').value === '' && document.querySelector('#password').type === 'password'"), true);
      assert.equal(await evaluar("new URLSearchParams(location.search).has('sesion')"), false);
      const cookies = await enviar('Network.getCookies', { urls: [base] });
      assert.equal(cookies.cookies.some((cookie) => cookie.name === 'sice_session'), false, 'Cookie eliminada del navegador');
    }
    async function ingresar(nombre, clave) {
      await evaluar(`document.querySelector('#username').value = ${JSON.stringify(nombre)}; document.querySelector('#password').value = ${JSON.stringify(clave)}; document.querySelector('#login-form').requestSubmit();`);
      await esperar("location.pathname === '/panel.html' && document.querySelector('#workspace')?.hidden === false");
    }
    async function verificarPanel(nombre) {
      for (const ancho of [1280, 1024, 768]) {
        await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false });
        await pausa(120);
        const medidas = await evaluar('({ disponible: document.documentElement.clientWidth, contenido: document.documentElement.scrollWidth })');
        if (medidas.contenido !== medidas.disponible) console.log(await evaluar("({tabla:[...document.querySelectorAll('#list-view .table-responsive')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflowX})),otros:[...document.querySelectorAll('body *')].filter(e => !e.closest('.table-responsive') && e.getBoundingClientRect().right>document.documentElement.clientWidth).slice(0,12).map(e=>({tag:e.tagName,id:e.id,clase:e.className,ancho:e.getBoundingClientRect().width}))})"));
        assert.equal(medidas.contenido, medidas.disponible, `${nombre}: desbordamiento a ${ancho}px`);
      }
    }
    const cargos = { director: 'Director', subdirector: 'Subdirector', coordinador_tutoria: 'Coordinador de Tutoría', docente: 'Docente', auxiliar: 'Auxiliar', administrador: 'Administrador' };
    const secuenciaRoles = ['administrador', 'director', 'subdirector', 'administrador', 'coordinador_tutoria', 'docente', 'auxiliar'];
    for (const rol of secuenciaRoles) {
      const [, nombre, apellido, acceso] = personalEscolar.find(([cargo]) => cargo === rol);
      await ingresar(acceso, credenciales[`${rol.toUpperCase()}_PASSWORD`]);
      assert.equal(await evaluar("document.querySelector('#user-label').textContent"), `${nombre} ${apellido} · ${cargos[rol]}`);
      const opciones = await evaluar(`Object.fromEntries(['nav-list', 'nav-new', 'nav-accounts'].map(id => [id, !document.getElementById(id).hidden]))`);
      assert.deepEqual(opciones, { 'nav-list': rol !== 'administrador', 'nav-new': rol !== 'administrador', 'nav-accounts': ['director', 'subdirector', 'administrador'].includes(rol) });
      assert.equal(await evaluar("document.body.textContent.includes('Todos los datos personales de la colección escolar son sintéticos')"), false);
      assert.equal(await evaluar("document.body.innerText.includes('Debe mantenerse al menos una cuenta activa')"), false);
      if (rol === 'administrador') {
        assert.equal(await evaluar("document.querySelector('#list-view').hidden && document.querySelector('#form-view').hidden && document.querySelector('#detail-view').hidden"), true);
        assert.equal(await evaluar("(async () => (await fetch('/api/incidencias')).status)()"), 403);
      }
      const antes = navegaciones;
      await enviar('Page.navigate', { url: base });
      await esperar("location.pathname === '/panel.html' && document.querySelector('#workspace')?.hidden === false");
      await pausa(250);
      assert.equal(navegaciones - antes, 2, `${rol}: entrada con sesión válida sin bucles`);
      assert.equal(await evaluar("document.querySelector('#user-label').textContent"), `${nombre} ${apellido} · ${cargos[rol]}`);
      await evaluar("document.querySelector('#logout').click()");
      await verificarCierre();
      assert.equal(await evaluar("(async () => (await fetch('/api/auth/sesion')).status)()"), 401);
    }
    // Acceso directo sin sesión y caducidad real, tanto al actuar como al recargar.
    await enviar('Page.navigate', { url: `${base}/panel.html` });
    await esperar("document.querySelector('#login-form')?.hidden === false");
    for (const recargar of [false, true]) {
      await ingresar(usuarioAdministrador, contrasena);
      await expirarSesion(usuarioAdministrador);
      const antes = navegaciones;
      if (recargar) await enviar('Page.reload');
      else await evaluar("document.querySelector('#nav-accounts').click()");
      await esperar("document.querySelector('#login-form')?.hidden === false");
      assert.match(await evaluar("document.querySelector('#session-status').textContent"), /Tu sesión ha finalizado/);
      await pausa(250);
      assert.equal(navegaciones - antes, recargar ? 2 : 1, 'La caducidad no genera redirecciones repetidas');
      assert.equal(await evaluar("document.querySelector('#password').value"), '');
    }
    // El historial no debe restaurar un panel cuya sesión ya se cerró.
    await ingresar(usuarioAdministrador, contrasena);
    const historial = await enviar('Page.getNavigationHistory');
    const entradaPanel = historial.entries[historial.currentIndex].id;
    await enviar('Page.navigate', { url: `${base}/api/health` });
    await esperar("location.pathname === '/api/health'");
    assert.equal(await evaluar("(async () => (await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SICE-Request': '1' }, body: '{}' })).status)()"), 204);
    await enviar('Page.navigateToHistoryEntry', { entryId: entradaPanel });
    await esperar("document.querySelector('#login-form')?.hidden === false");
    assert.match(await evaluar("document.querySelector('#session-status').textContent"), /Tu sesión ha finalizado/);
    // Un fallo de conexión se informa sin convertirlo en una cadena de redirecciones.
    await enviar('Network.enable');
    await enviar('Network.setBlockedURLs', { urls: ['*/api/auth/sesion'] });
    await enviar('Page.navigate', { url: `${base}/panel.html` });
    await esperar("document.querySelector('#workspace')?.hidden === false && document.querySelector('#message')?.hidden === false");
    assert.equal(await evaluar("location.pathname"), '/panel.html');
    assert.match(await evaluar("document.querySelector('#message').textContent"), /No se pudo contactar al servidor/);
    assert.equal(await evaluar("document.querySelector('#session-header').hidden && document.querySelector('#nav-list').hidden && document.querySelector('#nav-accounts').hidden"), true);
    await enviar('Network.setBlockedURLs', { urls: [] });
    await enviar('Page.navigate', { url: base });
    await esperar("document.querySelector('#login-form')?.hidden === false");
    console.log('Navegación: seis roles, acceso directo, sesión persistente, logout, caducidad y fallo de conexión sin bucles aprobados.');
    await ingresar(usuarioAdministrador, contrasena);
    await esperar("document.querySelector('#accounts-view')?.hidden === false && document.querySelector('#account-rows').children.length > 0");
    assert.equal(await evaluar("document.querySelector('#nav-list').hidden"), true);
    assert.equal(await evaluar("document.querySelector('#authorization-form').hidden"), true);
    await verificarPanel('cuentas');
    await evaluar("document.querySelector('#logout').click()");
    await esperar("document.querySelector('#login-form')?.hidden === false");
    await ingresar('rsalazar', credenciales.DIRECTOR_PASSWORD);
    await esperar("document.querySelector('#incident-rows')?.children.length > 0");
    assert.equal(await evaluar("(() => { const texto = document.querySelector('#incident-rows').textContent; return texto.toLowerCase().includes('ficticio') || texto.includes('[DEMO-'); })()"), false);
    await verificarPanel('expedientes');
    await evaluar("document.querySelector('#search').value = 'Paginación institucional'; document.querySelector('#search-form').requestSubmit()");
    await esperar("document.querySelector('#page-summary').textContent.endsWith('1–20 de 31 incidencias')");
    assert.equal(await evaluar("document.querySelector('#incident-rows').children.length"), 20);
    assert.equal(await evaluar("document.querySelector('#previous-page').disabled"), true);
    const primeraPagina = await evaluar("[...document.querySelectorAll('#incident-rows tr')].map(f => f.cells[0].textContent)");
    await evaluar("document.querySelector('#next-page').click()");
    await esperar("document.querySelector('#page-summary').textContent.endsWith('21–31 de 31 incidencias')");
    assert.equal(await evaluar("document.querySelector('#next-page').disabled && !document.querySelector('#previous-page').disabled"), true);
    assert.equal(await evaluar("document.querySelector('#page-numbers [aria-current=page]').textContent"), '2');
    const segundaPagina = await evaluar("[...document.querySelectorAll('#incident-rows tr')].map(f => f.cells[0].textContent)");
    assert.equal(new Set([...primeraPagina, ...segundaPagina]).size, 31);
    await evaluar("document.querySelector('#previous-page').click()");
    await esperar("document.querySelector('#page-numbers [aria-current=page]').textContent === '1'");
    assert.deepEqual(await evaluar("[...document.querySelectorAll('#incident-rows tr')].map(f => f.cells[0].textContent)"), primeraPagina);
    await evaluar("[...document.querySelectorAll('#page-numbers button')].find(b => b.textContent === '1').click()");
    await esperar("document.querySelector('#page-summary').textContent.endsWith('1–20 de 31 incidencias')");
    await evaluar("document.querySelector('#next-page').click()");
    await esperar("document.querySelector('#page-numbers [aria-current=page]').textContent === '2'");
    await evaluar("document.querySelector('#search').value = 'sin-coincidencias'; document.querySelector('#search-form').requestSubmit(); document.querySelector('#search').value = 'Paginación institucional 001'; document.querySelector('#search-form').requestSubmit()");
    await esperar("document.querySelector('#page-summary').textContent.endsWith('1–1 de 1 incidencias')");
    assert.equal(await evaluar("document.querySelector('#page-numbers [aria-current=page]').textContent"), '1');
    assert.equal(await evaluar("document.querySelector('#previous-page').disabled && document.querySelector('#next-page').disabled"), true);
    const codigoBuscado = primeraPagina[0];
    await evaluar(`document.querySelector('#search').value = ${JSON.stringify(codigoBuscado)}; document.querySelector('#search-form').requestSubmit()`);
    await esperar(`document.querySelector('#incident-rows').children.length === 1 && document.querySelector('#incident-rows tr').cells[0].textContent === ${JSON.stringify(codigoBuscado)}`);
    await evaluar("document.querySelector('#search').value = '10/11/2026'; document.querySelector('#search-form').requestSubmit()");
    await esperar("document.querySelector('#page-summary').textContent.endsWith('1–2 de 2 incidencias')");
    await evaluar("document.querySelector('#search-state').value = 'confirmada'; document.querySelector('#search-state').dispatchEvent(new Event('change'))");
    await esperar("document.querySelector('#list-empty').hidden === false && document.querySelector('#page-summary').textContent.endsWith('0–0 de 0 incidencias')");
    await evaluar("document.querySelector('#search-state').value = ''; document.querySelector('#search-category').value = 'convivencia'; document.querySelector('#search').value = 'Diego Alonso Quispe Flores'; document.querySelector('#search-form').requestSubmit()");
    await esperar("document.querySelector('#incident-rows').children.length > 0 && document.querySelector('#page-numbers [aria-current=page]').textContent === '1'");
    assert.equal(await evaluar("[...document.querySelectorAll('#incident-rows tr')].every(f => f.cells[2].querySelector('small').textContent === 'Convivencia escolar')"), true);
    await evaluar("document.querySelector('#search-category').value = ''");
    await evaluar("document.querySelector('#search').value = ''; document.querySelector('#search-form').requestSubmit()");
    await esperar("document.querySelector('#incident-rows').children.length === 20");
    await evaluar("document.querySelector('#nav-new').click()");
    await esperar("document.querySelector('#form-view').hidden === false");
    await evaluar("document.querySelector('#category').value = 'salud'; document.querySelector('#category').dispatchEvent(new Event('change'))");
    assert.equal(await evaluar("Boolean(document.querySelector('#field-sintomas_observados')) && !document.querySelector('#field-gravedad_disciplinaria') && document.querySelector('#confidentiality').value === 'restringida'"), true);
    await verificarPanel('formulario-salud');
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
    async function editarLugar(valor, detalle) {
      await evaluar("[...document.querySelectorAll('#detail-content button')].find(b => b.textContent === 'Editar borrador').click()");
      await esperar("document.querySelector('#form-view').hidden === false");
      await evaluar(`document.querySelector('#place').value = ${JSON.stringify(valor)}; document.querySelector('#place').dispatchEvent(new Event('change'));`);
      if (valor === 'otro') {
        assert.equal(await evaluar("document.querySelector('#place-other').checkValidity()"), false);
        await evaluar(`document.querySelector('#place-other').value = ${JSON.stringify(detalle)}; document.querySelector('#place-other').dispatchEvent(new Event('input'));`);
      }
      if (valor === 'Aula') {
        assert.equal(await evaluar("document.querySelector('#place-classroom').checkValidity()"), false);
        await evaluar("document.querySelector('#place-classroom').selectedIndex = 1");
        detalle = await evaluar("document.querySelector('#place-classroom').value");
      }
      await evaluar("document.querySelector('#incident-form').requestSubmit()");
      await esperar("document.querySelector('#detail-view').hidden === false");
      assert.equal(await evaluar(`document.querySelector('#detail-content').textContent.includes(${JSON.stringify(detalle || valor)})`), true);
    }
    await editarLugar('Aula');
    await editarLugar('otro', 'Zona de reunión temporal junto a portería');
    await editarLugar('Patio de primaria');
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
    await verificarPanel('expediente-detalle');
    assert.equal(await evaluar("[...document.querySelectorAll('#detail-content button')].some(b => b.textContent === 'Descargar PDF')"), true);
    // Aísla las cookies de AD, D y SD para comprobar decisiones entre sesiones independientes.
    async function verificarTresSesiones() {
      const sesiones = {};
      const contextos = [];
      for (const rol of ['administrador', 'director', 'subdirector']) {
        const { browserContextId } = await enviar('Target.createBrowserContext'); contextos.push(browserContextId);
        const { targetId } = await enviar('Target.createTarget', { url: base, browserContextId });
        const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
        sesiones[rol] = sessionId;
        await enviar('Page.enable', {}, sessionId);
        await enviar('Runtime.enable', {}, sessionId);
        await enviar('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
        await esperar("document.querySelector('#login-form')?.hidden === false", sessionId);
        const [, , , nombre] = personalEscolar.find(([cargo]) => cargo === rol);
        await evaluar(`document.querySelector('#username').value = ${JSON.stringify(nombre)}; document.querySelector('#password').value = ${JSON.stringify(credenciales[`${rol.toUpperCase()}_PASSWORD`])}; document.querySelector('#login-form').requestSubmit();`, sessionId);
        await esperar("document.querySelector('#workspace')?.hidden === false", sessionId);
        if (rol === 'administrador') await esperar("document.querySelector('#account-rows')?.children.length > 0", sessionId);
        else assert.equal(await evaluar("document.querySelector('#list-view').hidden", sessionId), false);
        assert.equal(await evaluar("(async () => (await (await fetch('/api/auth/sesion')).json()).usuario.rol)()", sessionId), rol);
      }
      const motivo = 'Activar el acceso solicitado por el Administrador desde el panel.';
      const admin = sesiones.administrador;
      await evaluar(`(() => {
        const fila = [...document.querySelectorAll('#account-rows tr')].find(f => f.cells[1].textContent === 'lnavarro');
        [...fila.querySelectorAll('button')].find(b => b.textContent === 'Activar').click();
        document.querySelector('#authorization-reason').value = ${JSON.stringify(motivo)};
        document.querySelector('#authorization-form').requestSubmit();
      })()`, admin);
      await esperar("document.querySelector('#message').textContent.includes('Solicitud registrada')", admin);
      const codigoSolicitud = (await evaluar("document.querySelector('#message').textContent", admin)).match(/SOL-\d+/)?.[0];
      assert.ok(codigoSolicitud, 'La confirmación identifica la solicitud guardada');
      for (const rol of ['director', 'subdirector']) {
        const sesion = sesiones[rol];
        const cantidad = await evaluar("document.querySelector('#nav-pending').textContent", sesion);
        await evaluar("window.dispatchEvent(new Event('focus'))", sesion);
        await esperar(`document.querySelector('#nav-pending').textContent !== ${JSON.stringify(cantidad)}`, sesion);
        assert.equal(await evaluar("document.querySelector('#list-view').hidden", sesion), false);
        await evaluar("document.querySelector('#nav-accounts').click()", sesion);
        await esperar("document.querySelector('#accounts-view').hidden === false", sesion);
        assert.equal(await evaluar(`[...document.querySelectorAll('#authorization-list article')].some(a => a.textContent.includes(${JSON.stringify(motivo)}) && a.querySelectorAll('button').length === 2)`, sesion), true);
        assert.equal(await evaluar(`document.querySelector('#pending-authorization-list').textContent.includes(${JSON.stringify(codigoSolicitud)})`, sesion), true);
        await enviar('Page.reload', {}, sesion);
        await esperar("document.querySelector('#workspace')?.hidden === false", sesion);
        const conteo = await evaluar("(async () => (await (await fetch('/api/cuentas/autorizaciones')).json()).pendientes)()", sesion);
        assert.equal(await evaluar("document.querySelector('#nav-pending').textContent", sesion), `Pendientes: ${conteo}`);
        await evaluar("document.querySelector('#nav-accounts').click()", sesion);
        await esperar(`document.querySelector('#pending-authorization-list')?.textContent.includes(${JSON.stringify(codigoSolicitud)})`, sesion);
        assert.equal(await evaluar("document.querySelectorAll('#pending-authorization-list article').length", sesion), conteo);
      }
      async function revisar(rol, decision, textoMotivo) {
        const sesion = sesiones[rol];
        await evaluar("document.querySelector('#refresh-accounts').click()", sesion);
        await esperar(`[...document.querySelectorAll('#authorization-list article')].some(a => a.textContent.includes(${JSON.stringify(textoMotivo)}))`, sesion);
        await evaluar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(textoMotivo)})).querySelectorAll('button')[${decision === 'aprobar' ? 0 : 1}].click()`, sesion);
        assert.equal(await evaluar(`document.querySelector('#submit-decision').classList.contains(${JSON.stringify(decision === 'aprobar' ? 'btn-success' : 'btn-danger')})`, sesion), true);
        assert.equal(await evaluar("document.querySelector('#submit-decision').textContent", sesion), decision === 'aprobar' ? 'Aprobar' : 'Rechazar');
        assert.equal(await evaluar("document.querySelector('#decision-form').textContent.includes('Si existe un conflicto o la otra autoridad está ausente')", sesion), false);
        await evaluar(`document.querySelector('#decision-reason').value = 'Decisión independiente de la autoridad en la prueba de navegador.'; document.querySelector('#decision-password').value = ${JSON.stringify(credenciales[`${rol.toUpperCase()}_PASSWORD`])}; document.querySelector('#decision-independent').checked = true; document.querySelector('#decision-form').requestSubmit();`, sesion);
        await esperar("document.querySelector('#message').textContent.includes('Decisión registrada')", sesion);
        assert.equal(await evaluar("document.querySelector('#decision-password').value"), '', 'No conservar la contraseña de reautenticación');
      }
      await revisar('director', 'aprobar', motivo);
      await evaluar("document.querySelector('#refresh-accounts').click()", admin);
      await esperar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(motivo)}))?.textContent.includes('Aprobada')`, admin);
      await evaluar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(motivo)})).querySelector('button').click(); document.querySelector('#execution-form').requestSubmit();`, admin);
      await esperar("document.querySelector('#message').textContent.includes('Cambio autorizado ejecutado')", admin);
      assert.equal(await evaluar("[...document.querySelectorAll('#account-rows tr')].find(f => f.cells[1].textContent === 'lnavarro').querySelector('.account-status').textContent", admin), 'Activo');

      const motivoDesactivar = 'Desactivación ordinaria solicitada en el formulario del Administrador.';
      await evaluar(`(() => {
        const fila = [...document.querySelectorAll('#account-rows tr')].find(f => f.cells[1].textContent === 'lnavarro');
        [...fila.querySelectorAll('button')].find(b => b.textContent === 'Desactivar').click();
        document.querySelector('#authorization-reason').value = ${JSON.stringify(motivoDesactivar)};
        document.querySelector('#authorization-form').requestSubmit();
      })()`, admin);
      await esperar("document.querySelector('#message').textContent.includes('Solicitud registrada')", admin);
      for (const rol of ['director', 'subdirector']) {
        await evaluar("window.dispatchEvent(new Event('focus'))", sesiones[rol]);
        await esperar(`[...document.querySelectorAll('#authorization-list article')].some(a => a.textContent.includes(${JSON.stringify(motivoDesactivar)}) && a.querySelectorAll('button').length === 2)`, sesiones[rol]);
      }
      await revisar('subdirector', 'rechazar', motivoDesactivar);
      await evaluar("window.dispatchEvent(new Event('focus'))", sesiones.director);
      await esperar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(motivoDesactivar)}))?.querySelectorAll('button').length === 0`, sesiones.director);

      await evaluar(`(() => {
        const fila = [...document.querySelectorAll('#account-rows tr')].find(f => f.cells[1].textContent === 'mhuaman');
        [...fila.querySelectorAll('button')].find(b => b.textContent === 'Desactivar').click();
        document.querySelector('#authorization-reason').value = 'Comprobar la protección de la última cuenta activa.';
        document.querySelector('#authorization-form').requestSubmit();
      })()`, admin);
      await esperar("document.querySelector('#account-error').hidden === false", admin);
      assert.match(await evaluar("document.querySelector('#account-error').textContent", admin), /al menos una cuenta activa/);
      assert.match(await evaluar("document.querySelector('#account-error').textContent", admin), /única cuenta activa de subdirector/);
      assert.equal(await evaluar("document.querySelector('#message').hidden", admin), true);
      assert.match(await evaluar("document.querySelector('#account-error').textContent", admin), /Solicitud no registrada/);
      await evaluar("document.querySelector('#account-action').value = 'restablecer_clave'; document.querySelector('#account-action').dispatchEvent(new Event('change'))", admin);
      assert.equal(await evaluar("document.querySelector('#account-error').hidden && document.querySelector('#account-error').textContent === ''", admin), true);
      await evaluar("document.querySelector('#nav-accounts').click()", admin);
      await esperar("document.querySelector('#authorization-form').hidden === true", admin);
      assert.equal(await evaluar("document.querySelector('#account-error').hidden"), true);

      const motivoDoble = 'Solicitar un cambio de rol con revisión de ambas autoridades.';
      await evaluar(`(async () => {
        const catalogo = await (await fetch('/api/cuentas/catalogos')).json();
        const fila = [...document.querySelectorAll('#account-rows tr')].find(f => f.cells[1].textContent === 'lnavarro');
        [...fila.querySelectorAll('button')].find(b => b.textContent === 'Cambiar rol').click();
        document.querySelector('#authorization-form').elements.id_rol_objetivo.value = catalogo.roles.find(r => r.codigo === 'auxiliar').id;
        document.querySelector('#authorization-reason').value = ${JSON.stringify(motivoDoble)};
        document.querySelector('#authorization-form').requestSubmit();
      })()`, admin);
      await esperar("document.querySelector('#message').textContent.includes('Solicitud registrada')", admin);
      await revisar('director', 'aprobar', motivoDoble);
      await revisar('subdirector', 'rechazar', motivoDoble);
      await evaluar("document.querySelector('#refresh-accounts').click()", admin);
      await esperar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(motivoDoble)}))?.textContent.includes('Revisión por desacuerdo')`, admin);
      assert.equal(await evaluar(`[...document.querySelectorAll('#authorization-list article')].find(a => a.textContent.includes(${JSON.stringify(motivoDoble)})).querySelectorAll('button').length`, admin), 0);
      for (const rol of Object.keys(sesiones)) {
        const sesion = sesiones[rol];
        for (const ancho of [1280, 1024, 768]) {
          await enviar('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 1, mobile: false }, sesion);
          assert.equal(await evaluar('document.documentElement.scrollWidth === document.documentElement.clientWidth', sesion), true);
        }
      }
      for (const browserContextId of contextos) await enviar('Target.disposeBrowserContext', { browserContextId });
      console.log('Gestión de cuentas: tres sesiones independientes, solicitud, reautenticación, ejecución y desacuerdo bloqueado en navegador.');
    }
    await verificarTresSesiones();
    // Comprueba desde los formularios los cambios de expediente, la matrícula y su autorización.
    const codigoCambio = await evaluar("document.querySelector('#detail-content > .eyebrow').textContent.match(/INC-\\d+/)[0]");
    const abrirCambio = async () => {
      await evaluar("document.querySelector('#nav-list').click()");
      await esperar("document.querySelector('#list-view').hidden === false");
      await evaluar(`document.querySelector('#search').value = ${JSON.stringify(codigoCambio)}; document.querySelector('#search-form').requestSubmit()`);
      await esperar("document.querySelector('#incident-rows').children.length === 1");
      await evaluar("document.querySelector('#incident-rows button').click()");
      await esperar("document.querySelector('#detail-view').hidden === false");
    };
    const operacion = async (boton, contrasena, extra = '') => {
      await evaluar(`[...document.querySelectorAll('#detail-content button')].find(b => b.textContent === ${JSON.stringify(boton)}).click()`);
      await esperar("Boolean(document.querySelector('#sensitive-operation'))");
      await evaluar(`(() => { const f = document.querySelector('#sensitive-operation'); f.elements.motivo.value = 'Fundamento independiente de la prueba de navegador.'; f.elements.contrasena.value = ${JSON.stringify(contrasena)}; f.elements.independencia.checked = true; ${extra} f.requestSubmit(); })()`);
      await esperar("!document.querySelector('#sensitive-operation')");
    };
    await evaluar("[...document.querySelectorAll('#detail-content button')].find(b => b.textContent === 'Solicitar rectificación').click()");
    await esperar("Boolean(document.querySelector('#correction-password'))");
    await evaluar(`document.querySelector('#incident-title').value = 'Título rectificado conservando los hechos'; document.querySelector('#correction-reason').value = 'Corrección material del título.'; document.querySelector('#correction-password').value = ${JSON.stringify(credenciales.DIRECTOR_PASSWORD)}; document.querySelector('#incident-form').requestSubmit()`);
    await esperar("document.querySelector('#detail-view').hidden === false && document.querySelector('#message').textContent.includes('Propuesta presentada')");
    assert.equal(await evaluar("[...document.querySelectorAll('#detail-content button')].some(b => b.textContent === 'Evaluar revisión necesaria')"), false);
    await evaluar("document.querySelector('#logout').click()");
    await esperar("document.querySelector('#login-form')?.hidden === false");
    await ingresar('mhuaman', credenciales.SUBDIRECTOR_PASSWORD);
    await esperar("document.querySelector('#workspace')?.hidden === false");
    await abrirCambio();
    await operacion('Evaluar revisión necesaria', credenciales.SUBDIRECTOR_PASSWORD, "f.elements.revision.value = 'false';");
    await operacion('Aprobar solicitud', credenciales.SUBDIRECTOR_PASSWORD);
    assert.equal(await evaluar("document.querySelector('#detail-content h2').textContent"), 'Título rectificado conservando los hechos');
    await operacion('Cerrar expediente', credenciales.SUBDIRECTOR_PASSWORD);
    assert.equal(await evaluar("document.querySelector('#detail-content > .eyebrow').textContent.includes('cerrada')"), true);
    await operacion('Reabrir expediente', credenciales.SUBDIRECTOR_PASSWORD);
    assert.equal(await evaluar("document.querySelector('#detail-content > .eyebrow').textContent.includes('en seguimiento')"), true);
    await evaluar("document.querySelector('#nav-student').click()");
    await esperar("document.querySelector('#student-view').hidden === false");
    await evaluar(`(() => { const f = document.querySelector('#student-form'); f.elements.nombres.value = 'Estudiante de navegador'; f.elements.apellidos.value = 'Prueba institucional'; f.elements.codigo_estudiante.value = 'BROW-ST01'; f.elements.id_aula.selectedIndex = 1; f.elements.fecha_inicio.value = '2026-03-02'; f.elements.contrasena.value = ${JSON.stringify(credenciales.SUBDIRECTOR_PASSWORD)}; f.requestSubmit(); })()`);
    await esperar("document.querySelector('#message').textContent.includes('BROW-ST01')");
    await abrirCambio();
    const duplicada = await evaluar(`(async () => { const d = await (await fetch('/api/incidencias')).json(); return d.incidencias.find(i => Number(i.id) !== Number(${JSON.stringify(codigoCambio.slice(4))}) && i.estado !== 'borrador' && i.estado !== 'anulada').id; })()`);
    await operacion('Solicitar anulación lógica', credenciales.SUBDIRECTOR_PASSWORD, `f.elements.duplicada.value = ${JSON.stringify(duplicada)};`);
    await evaluar("document.querySelector('#logout').click()");
    await esperar("document.querySelector('#login-form')?.hidden === false");
    await ingresar('rsalazar', credenciales.DIRECTOR_PASSWORD);
    await esperar("document.querySelector('#workspace')?.hidden === false");
    await abrirCambio();
    await operacion('Evaluar revisión necesaria', credenciales.DIRECTOR_PASSWORD, "f.elements.revision.value = 'false';");
    await operacion('Aprobar solicitud', credenciales.DIRECTOR_PASSWORD);
    assert.equal(await evaluar("document.querySelector('#detail-content > .eyebrow').textContent.includes('anulada')"), true);
    assert.equal(await evaluar("[...document.querySelectorAll('#detail-content button')].some(b => b.textContent === 'Reabrir expediente')"), false);
    console.log('Expedientes: rectificación independiente, cierre, reapertura, anulación lógica y estudiante guardados desde Chrome.');
    assert.equal(erroresJavaScript, 0, 'Sin excepciones JavaScript en las sesiones del navegador');
    if (prepararRegresiones) {
      const escenarios = await prepararRegresiones();
      await verificarRegresionesInterfaz({ base, credenciales, enviar, evaluar, esperar, escenarios, erroresJavaScript: () => erroresJavaScript });
    }
    await enviar('Browser.close');
  } finally {
    socket?.close();
    proceso.kill();
    if (proceso.exitCode === null && proceso.signalCode === null) {
      await new Promise(finalizar => {
        proceso.once('exit', finalizar);
        setTimeout(finalizar, 3000).unref();
      });
    }
    // Solo elimina el perfil temporal creado por esta ejecución, después de cerrar Chrome.
    const rutaPerfil = resolve(perfil);
    if (!rutaPerfil.startsWith(resolve(tmpdir()) + sep) || !basename(rutaPerfil).startsWith('sice-preview-')) {
      throw new Error('Ruta temporal inesperada; no se elimina.');
    }
    await rm(rutaPerfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const suite = fileURLToPath(new URL('./desarrollo.integration.js', import.meta.url));
  const ejecucion = spawn(process.execPath, ['--test', suite], {
    env: { ...process.env, TEST_BROWSER: '1' }, stdio: 'inherit', windowsHide: true
  });
  process.exitCode = await new Promise((finalizar, rechazar) => {
    ejecucion.once('error', rechazar);
    ejecucion.once('close', codigo => finalizar(codigo ?? 1));
  });
}

async function verificarRegresionesInterfaz({ base, credenciales, enviar, evaluar, esperar, escenarios, erroresJavaScript }) {

    const auditarCaso = (nombre, prueba) => escenarios.t.test('Regresión: ' + nombre, prueba);
    const credencial=rol=>credenciales[rol.toUpperCase()+'_PASSWORD'];
    async function entrar(rol) {
      await enviar('Network.clearBrowserCookies');
      await enviar('Page.navigate',{url:base});
      await esperar("document.querySelector('#login-form')?.hidden === false");
      const acceso=personalEscolar.find(([r])=>r===rol)[3];
      await evaluar("document.querySelector('#username').value="+JSON.stringify(acceso)+"; document.querySelector('#password').value="+JSON.stringify(credencial(rol))+"; document.querySelector('#login-form').requestSubmit();");
      await esperar("location.pathname==='/panel.html' && document.querySelector('#workspace')?.hidden===false");
    }
    async function salir(){
      await evaluar("document.querySelector('#logout').click()");
      await esperar("document.querySelector('#login-form')?.hidden===false");
    }
    async function abrirId(id) {
      await evaluar("document.querySelector('#nav-list').click()");
      await esperar("document.querySelector('#list-view')?.hidden===false");
      await evaluar("document.querySelector('#search').value="+JSON.stringify('INC-'+id)+";document.querySelector('#search-form').requestSubmit();");
      await esperar("document.querySelectorAll('#incident-rows tr').length===1 && document.querySelector('#incident-rows').textContent.includes("+JSON.stringify(String(id).padStart(6,'0'))+")");
      await evaluar("document.querySelector('#incident-rows button').click()");
      await esperar("document.querySelector('#detail-view')?.hidden===false");
    }
    await enviar('Browser.setDownloadBehavior',{behavior:'deny',eventsEnabled:true});
    await enviar('Page.addScriptToEvaluateOnNewDocument',{source:"const crear=URL.createObjectURL;URL.createObjectURL=function(blob){window.__auditBlob=blob;return crear.call(this,blob)};"});
    await auditarCaso('Chrome: descarga PDF real desde botones, cinco roles y seis categorias', async()=>{
      let rolActual=null, cantidad=0;
      for(const caso of escenarios.pdfs){
        if(rolActual!==caso.rol){if(rolActual)await salir();await entrar(caso.rol);rolActual=caso.rol;}
        await abrirId(caso.id);
        await evaluar("window.__auditBlob=null;[...document.querySelectorAll('#detail-view button')].find(b=>b.textContent==='Descargar PDF').click()");
        await esperar("window.__auditBlob?.size>0");
        const base64=await evaluar("(async()=>{const b=new Uint8Array(await window.__auditBlob.arrayBuffer());let s='';for(const n of b)s+=String.fromCharCode(n);return btoa(s)})()");
        const {getDocument,OPS}=await import('pdfjs-dist/legacy/build/pdf.mjs');
        const pdf=await getDocument({data:new Uint8Array(Buffer.from(base64,'base64')),useSystemFonts:true}).promise;
        const pagina=await pdf.getPage(1);const texto=(await pagina.getTextContent()).items.map(x=>x.str).join(' ');
        assert.ok(texto.includes('20874')&&texto.includes(caso.titulo));
        const operaciones=await pagina.getOperatorList();
        assert.ok(operaciones.fnArray.includes(OPS.paintImageXObject),'Logo como imagen en el PDF');
        let completo=texto;for(let p=2;p<=pdf.numPages;p++)completo+=(await (await pdf.getPage(p)).getTextContent()).items.map(x=>x.str).join(' ');
        assert.ok(completo.includes('Firma del registrador')&&completo.includes('Sello del Director'));
        await pdf.cleanup?.();cantidad++;
      }
      console.log('PDF_INTERFAZ '+cantidad+' documentos verificados en memoria; descargas a disco bloqueadas.');
      if(rolActual)await salir();
    });
    await entrar('director');
    await auditarCaso('Chrome: plazo guardado visible en detalle de seguimiento',async()=>{
      await abrirId(escenarios.plazo);
      const texto=await evaluar("document.querySelector('#detail-view').innerText");
      assert.ok(/18.12.(2026|26)/.test(texto),'El plazo 18/12/2026 guardado no aparece en el detalle');
    });
    await auditarCaso('Chrome: XSS almacenado se presenta como texto sin ejecutarse',async()=>{
      await abrirId(escenarios.xss);
      assert.equal(await evaluar("window.__auditXss===1"),false);
      assert.equal(await evaluar("document.querySelector('#detail-view').innerText.includes('<script>')"),true);
      assert.equal(await evaluar("document.querySelectorAll('#detail-view img[src=x],#detail-view script').length"),0);
    });
    await auditarCaso('Chrome: Anterior, Siguiente, numeros y resultados vacios',async()=>{
      await evaluar("document.querySelector('#nav-list').click();document.querySelector('#search').value='';document.querySelector('#search-form').requestSubmit();");
      await esperar("document.querySelectorAll('#incident-rows tr').length===20");
      const primero=await evaluar("document.querySelector('#incident-rows tr').innerText");
      await evaluar("document.querySelector('#next-page').click()");
      await esperar("document.querySelector('#previous-page').disabled===false");
      assert.notEqual(await evaluar("document.querySelector('#incident-rows tr').innerText"),primero);
      await evaluar("document.querySelector('#previous-page').click()");
      await esperar("document.querySelector('#previous-page').disabled===true");
      assert.equal(await evaluar("document.querySelector('#incident-rows tr').innerText"),primero);
      await evaluar("document.querySelector('#search').value='NO_EXISTE_AUDITORIA';document.querySelector('#search-form').requestSubmit()");
      await esperar("document.querySelector('#list-empty').hidden===false");
      assert.equal(await evaluar("document.querySelectorAll('#incident-rows tr').length"),0);
    });
    await auditarCaso('Chrome: dos envios seguidos de borrador no duplican',async()=>{
      await evaluar("document.querySelector('#nav-new').click()");
      await esperar("document.querySelector('#form-view').hidden===false && document.querySelector('#reporter').options.length>1");
      await evaluar("document.querySelector('#category').value='seguridad';document.querySelector('#category').dispatchEvent(new Event('change'));");
      await evaluar("document.querySelector('#reporter').parentElement.querySelector('[data-person-search] input').value='Salazar';document.querySelector('#reporter').parentElement.querySelector('[data-person-search] button').click()");
      await esperar("[...document.querySelector('#reporter').options].some(o=>o.value==="+JSON.stringify(String(escenarios.personaDirector))+")");
      await evaluar("document.querySelector('#incident-type').selectedIndex=1;document.querySelector('#incident-type').dispatchEvent(new Event('change'));document.querySelector('#incident-title').value='AUDITORIA_DOBLE_ENTER';document.querySelector('#description').value='Se verifica el ingreso durante el recreo.';document.querySelector('#reporter').value="+JSON.stringify(String(escenarios.personaDirector))+";document.querySelector('#reporter').dispatchEvent(new Event('change'));document.querySelector('#reporter-condition').value='personal';document.querySelector('#sensitive').value='false';");
      await evaluar("document.querySelector('#add-person').click();const controles=document.querySelector('#involved-rows [data-person-search]');controles.querySelector('input').value='AUD-CAT-260';controles.querySelector('button').click()");
      await esperar("[...document.querySelector('#involved-rows [data-persona]').options].some(o=>o.value==="+JSON.stringify(String(escenarios.personaPagina))+")");
      await evaluar("document.querySelector('#involved-rows [data-persona]').value="+JSON.stringify(String(escenarios.personaPagina))+";document.querySelector('#involved-rows [data-participacion]').value='testigo';");
      await evaluar("window.__fetchOriginal=window.fetch;let perderRespuesta=true;window.fetch=async(...args)=>{const r=await window.__fetchOriginal(...args);if(perderRespuesta&&args[0]==='/api/incidencias'&&args[1]?.method==='POST'){perderRespuesta=false;throw Error('Respuesta perdida en prueba');}return r;};");
      const resultado=await evaluar("(async()=>{const f=document.querySelector('#incident-form');f.dispatchEvent(new Event('submit',{cancelable:true}));f.dispatchEvent(new Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,1000));return (await (await fetch('/api/incidencias?buscar=AUDITORIA_DOBLE_ENTER')).json()).paginacion.total})()");
      assert.equal(resultado,1,'Dos eventos submit consecutivos guardan '+resultado+' borradores');
      await esperar("document.querySelector('#message').textContent.includes('No se pudo contactar') && !document.querySelector('#save-draft').disabled");
      await evaluar("document.querySelector('#incident-form').dispatchEvent(new Event('submit',{cancelable:true}))");
      await esperar("document.querySelector('#detail-view').hidden===false && document.querySelector('#message').textContent.includes('Borrador guardado')");
      assert.equal(await evaluar("(async()=> (await (await fetch('/api/incidencias?buscar=AUDITORIA_DOBLE_ENTER')).json()).paginacion.total)()"),1);
      await evaluar("window.fetch=window.__fetchOriginal;[...document.querySelectorAll('#detail-view button')].find(b=>b.textContent==='Editar borrador').click()");
      await esperar("document.querySelector('#form-view').hidden===false && document.querySelector('#involved-rows [data-persona]')?.value==="+JSON.stringify(String(escenarios.personaPagina)));
      const control = "document.querySelector('#reporter').parentElement.querySelector('[data-person-search]')";
      await evaluar("[..."+control+".querySelectorAll('button')].find(b=>b.textContent==='Siguiente').click()");
      await esperar(control+".textContent.includes('Página 2')");
      assert.equal(await evaluar("document.querySelector('#reporter').value"),String(escenarios.personaDirector));
    });
    await auditarCaso('Chrome: escritorio y laptop sin errores de consola',async()=>{
      for(const ancho of [1280,1024,768]){
        await enviar('Emulation.setDeviceMetricsOverride',{width:ancho,height:900,deviceScaleFactor:1,mobile:false});
        const medidas=await evaluar("({ancho:document.documentElement.clientWidth,contenido:document.documentElement.scrollWidth})");
        assert.equal(medidas.ancho,medidas.contenido);
      }
      await evaluar("document.querySelector('#nav-student').click()");
      await esperar("document.querySelector('#student-view').hidden===false");
      for (const [nombre, valido] of [['12345',false],['!!!',false],['Álvaro-José',true],["D’Ávila O'Connor",true]]) {
        for (const id of ['student-names','student-surnames']) {
          await evaluar("(()=>{const input=document.getElementById("+JSON.stringify(id)+");input.value="+JSON.stringify(nombre)+";input.dispatchEvent(new Event('input'));})()");
          assert.equal(await evaluar("document.getElementById("+JSON.stringify(id)+").checkValidity()"),valido);
        }
      }
      assert.equal(erroresJavaScript(),0);
    });
    await auditarCaso('Chrome: botones de borrador respetan permiso de registro retirado',async()=>{
      try{
        await escenarios.permisoRegistro(false);
        await entrar('director');
        await abrirId(escenarios.borrador);
        const botones=await evaluar("[...document.querySelectorAll('#detail-view button')].map(b=>b.textContent)");
        const estado=await evaluar("(async()=> (await fetch('/api/incidencias/"+escenarios.borrador+"/confirmar',{method:'POST',headers:{'Content-Type':'application/json','X-SICE-Request':'1'},body:'{}'})).status)()");
        assert.equal(estado,403);
        assert.ok(!botones.includes('Editar borrador')&&!botones.includes('Confirmar incidencia'),'Se ofrecen editar y confirmar aunque el backend devuelve 403');
      }finally{await escenarios.permisoRegistro(true);}
    });
    await auditarCaso('Chrome: seleccion numerica de pagina 2 y vuelta a 1',async()=>{
      await evaluar("document.querySelector('#nav-list').click();document.querySelector('#search').value='';document.querySelector('#search-form').requestSubmit()");
      await esperar("document.querySelectorAll('#incident-rows tr').length===20 && document.querySelectorAll('#page-numbers button').length>1");
      await evaluar("[...document.querySelectorAll('#page-numbers button')].find(b=>b.textContent==='2').click()");
      await esperar("document.querySelector('#page-numbers [aria-current]')?.textContent==='2'");
      assert.equal(await evaluar("document.querySelector('#previous-page').disabled"),false);
      await evaluar("[...document.querySelectorAll('#page-numbers button')].find(b=>b.textContent==='1').click()");
      await esperar("document.querySelector('#page-numbers [aria-current]')?.textContent==='1'");
    });

}
