const $ = (id) => document.getElementById(id);
const categorias = { convivencia: 'Convivencia escolar', disciplina: 'Disciplina', salud: 'Salud y bienestar', seguridad: 'Accidentes y seguridad', bienes: 'Bienes y pertenencias', proteccion_estudiantil: 'Protección estudiantil' };
const cargos = { director: 'Director', subdirector: 'Subdirector', coordinador_tutoria: 'Coordinador de Tutoría', docente: 'Docente', auxiliar: 'Auxiliar', administrador: 'Administrador' };
const nombresPermisos = { 'sesion.consultar': 'Consultar sesión', 'cuentas.consultar': 'Consultar cuentas', 'cuentas.autorizar': 'Autorizar cambios de cuentas', 'cuentas.administrar': 'Ejecutar administración autorizada',
  'cuentas.solicitar': 'Solicitar cambios de cuentas', 'cuentas.ejecutar': 'Ejecutar cambios aprobados',
  'incidencias.registrar': 'Registrar incidencias', 'incidencias.consultar': 'Consultar incidencias', 'incidencias.seguimiento': 'Agregar seguimiento', 'incidencias.exportar': 'Descargar informes PDF', 'incidencias.restringidas': 'Acceder a expedientes restringidos' };
const campos = {
  convivencia: [['ambito_convivencia', 'Ámbito', ['presencial', 'digital', 'mixto']], ['requiere_mediacion', '¿Requiere mediación?', 'booleano']],
  disciplina: [['gravedad_disciplinaria', 'Gravedad disciplinaria', ['por_evaluar', 'leve', 'grave', 'muy_grave']], ['norma_referida', 'Norma referida, si se conoce', 'texto']],
  salud: [['sintomas_observados', 'Síntomas u observaciones, sin diagnóstico', 'area'], ['requiere_atencion_inmediata', '¿Requiere atención inmediata?', 'booleano']],
  seguridad: [['riesgo_identificado', 'Riesgo observado', 'area'], ['riesgo_persistente', '¿Persiste el riesgo?', 'booleano']],
  bienes: [['descripcion_dano', 'Descripción de la afectación o pérdida', 'area'], ['monto_estimado', 'Importe estimado, si se conoce', 'numero'], ['moneda', 'Moneda del importe (por ejemplo, PEN)', 'texto']],
  proteccion_estudiantil: [['riesgo_inmediato', '¿Existe riesgo inmediato?', 'booleano'], ['requiere_derivacion', '¿Requiere derivación?', 'booleano']]
};
let usuario, catalogo, detalleActual, borradorId = null, cuentaCatalogo, autorizaciones, ejecucion;
let paginaActual = 1, busquedaActual = '', revisionLista = 0;
let redirigiendo = false;
let decisionActual;
let actualizandoSolicitudes = false;
const lugares = ['Aula', 'Patio de formación', 'Patio de primaria', 'Patio de secundaria', 'Pasillo', 'Pasillo de primaria',
  'Servicios higiénicos', 'Biblioteca', 'Sala de cómputo', 'Losa deportiva', 'Escaleras', 'Ingreso', 'Ingreso de secundaria',
  'Acceso al patio', 'Acceso de secundaria', 'Portería', 'Dirección', 'Atención a familias', 'Espacio de orientación', 'Espacio de atención reservada'];
const puede = (permiso) => usuario.permisos.includes(permiso);
const fecha = (valor) => valor ? new Date(valor).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'No precisada';
const estado = (valor) => String(valor).replaceAll('_', ' ');
const codigo = (id) => `INC-${String(id).padStart(6, '0')}`;

function elemento(etiqueta, contenido, clase) {
  const el = document.createElement(etiqueta);
  if (contenido !== undefined) el.textContent = contenido;
  if (clase) el.className = clase;
  return el;
}
function aviso(mensaje, error = false) { if (redirigiendo) return; $('message').textContent = mensaje; $('message').className = `alert alert-${error ? 'danger' : 'success'}`; $('message').hidden = false; }
function limpiarAviso() {
  for (const id of ['message', 'account-error']) { $(id).hidden = true; $(id).textContent = ''; }
}
function mostrar(vista) { for (const id of ['list-view', 'form-view', 'detail-view', 'accounts-view']) $(id).hidden = id !== vista; limpiarAviso(); }
function volverAlAcceso(motivo) {
  if (redirigiendo) return;
  redirigiendo = true;
  $('workspace').hidden = true;
  $('session-header').hidden = true;
  $('user-label').textContent = '';
  usuario = null;
  location.replace(`/?sesion=${motivo}`);
}
async function api(ruta, method = 'GET', datos) {
  let response;
  try {
    response = await fetch(`/api/${ruta}`, { method, credentials: 'same-origin',
      headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-SICE-Request': '1' },
      body: method === 'GET' ? undefined : JSON.stringify(datos || {}), signal: AbortSignal.timeout(20000) });
  } catch { throw new Error('No se pudo contactar al servidor. Comprueba tu conexión e inténtalo de nuevo.'); }
  if (response.status === 401) { volverAlAcceso(ruta === 'auth/logout' ? 'cerrada' : 'expirada'); throw new Error('La sesión ha finalizado.'); }
  if (!response.ok) { const resultado = await response.json(); throw new Error(resultado.error || 'No se pudo completar la solicitud.'); }
  return response;
}
const json = async (ruta, method, datos) => (await api(ruta, method, datos)).json();
function accion(etiqueta, tarea, clase = 'btn btn-sm btn-outline-primary') {
  const boton = elemento('button', etiqueta, clase); boton.type = 'button';
  boton.addEventListener('click', async () => { boton.disabled = true; try { await tarea(); } catch (error) { aviso(error.message, true); } finally { boton.disabled = false; } });
  return boton;
}
function opciones(select, filas, valor, etiqueta, seleccionado = '') {
  select.replaceChildren(new Option('Seleccionar', ''));
  for (const fila of filas) select.add(new Option(etiqueta(fila), String(valor(fila))));
  select.value = String(seleccionado ?? '');
}

async function listar(pagina = paginaActual) {
  const revision = ++revisionLista;
  mostrar('list-view');
  const parametros = new URLSearchParams({ buscar: busquedaActual, pagina });
  const { incidencias, paginacion } = await json(`incidencias?${parametros}`);
  if (revision !== revisionLista || redirigiendo) return;
  paginaActual = paginacion.pagina;
  $('incident-rows').replaceChildren();
  for (const fila of incidencias) {
    const tr = elemento('tr');
    tr.append(elemento('td', codigo(fila.id)), elemento('td', fecha(fila.registrada_en)));
    const asunto = elemento('td'); asunto.append(elemento('small', categorias[fila.categoria], 'text-secondary d-block'), elemento('span', fila.titulo));
    const est = elemento('td'); est.append(elemento('span', estado(fila.estado), 'status-label'));
    const ver = elemento('td'); ver.append(accion('Ver', () => abrir(fila.id)));
    tr.append(asunto, est, elemento('td', fila.prioridad), ver);
    [...tr.children].forEach((td, indice) => { if (indice < 5) td.dataset.label = ['Código', 'Fecha', 'Categoría y título', 'Estado', 'Prioridad'][indice]; });
    $('incident-rows').append(tr);
  }
  $('list-empty').hidden = incidencias.length !== 0;
  mostrarPaginacion(paginacion);
}

function mostrarPaginacion({ pagina, paginas, total, desde, hasta }) {
  $('page-summary').textContent = `${desde}–${hasta} de ${total} incidencias`;
  $('previous-page').disabled = pagina === 1; $('next-page').disabled = pagina === paginas;
  $('page-numbers').replaceChildren();
  const numeros = [...new Set([1, pagina - 2, pagina - 1, pagina, pagina + 1, pagina + 2, paginas])]
    .filter(numero => numero >= 1 && numero <= paginas).sort((a, b) => a - b);
  numeros.forEach((numero, indice) => {
    if (indice && numero > numeros[indice - 1] + 1) $('page-numbers').append(elemento('span', '…', 'align-self-center'));
    const boton = accion(String(numero), () => listar(numero), `btn btn-sm ${numero === pagina ? 'btn-primary' : 'btn-outline-primary'}`);
    boton.setAttribute('aria-label', `Página ${numero}`);
    if (numero === pagina) boton.setAttribute('aria-current', 'page');
    $('page-numbers').append(boton);
  });
}

function camposCategoria(valores = {}) {
  $('specific-fields').replaceChildren();
  for (const [nombre, etiqueta, tipo] of campos[$('category').value] || []) {
    const grupo = elemento('div', undefined, tipo === 'area' ? 'col-12' : 'col-md-6');
    const label = elemento('label', etiqueta, 'form-label'); label.htmlFor = `field-${nombre}`;
    const input = elemento(Array.isArray(tipo) || tipo === 'booleano' ? 'select' : tipo === 'area' ? 'textarea' : 'input');
    input.id = `field-${nombre}`; input.dataset.field = nombre; input.dataset.tipo = tipo === 'booleano' ? tipo : '';
    input.className = input.tagName === 'SELECT' ? 'form-select' : 'form-control';
    if (Array.isArray(tipo)) opciones(input, tipo, (v) => v, estado);
    else if (tipo === 'booleano') opciones(input, ['true', 'false'], (v) => v, (v) => v === 'true' ? 'Sí' : 'No');
    else if (tipo === 'numero') { input.type = 'number'; input.min = '0'; input.step = '0.01'; }
    else input.maxLength = tipo === 'area' ? 5000 : 100;
    const valor = valores[nombre];
    input.value = valor === null || valor === undefined ? '' : tipo === 'booleano' ? String(Boolean(valor)) : valor;
    grupo.append(label, input); $('specific-fields').append(grupo);
  }
  const reserva = ['salud', 'proteccion_estudiantil'].includes($('category').value);
  if (reserva) $('confidentiality').value = 'restringida';
  $('confidentiality').disabled = reserva;
}
function tipos(id) {
  opciones($('incident-type'), catalogo.tipos.filter((t) => t.categoria === $('category').value), (t) => t.id, (t) => t.nombre, id);
  minimo();
}
function minimo() { const tipo = catalogo.tipos.find((t) => String(t.id) === $('incident-type').value); $('minimum').textContent = tipo ? `Al confirmar: mínimo ${tipo.minimo_estudiantes} estudiante(s).` : ''; }
function condicion(valor = '') {
  const p = catalogo.personas.find((p) => String(p.id) === $('reporter').value);
  const lista = p ? [p.es_personal ? 'personal' : null, p.es_estudiante ? 'estudiante' : null, p.es_apoderado ? 'apoderado' : null].filter(Boolean) : [];
  if (p && !lista.length) lista.push('externo');
  opciones($('reporter-condition'), lista, (v) => v, estado, valor);
}
function involucrado(valores = {}) {
  const fila = elemento('div', undefined, 'row g-2 involved-row align-items-end');
  function selector(etiqueta, clase) {
    const grupo = elemento('div', undefined, clase), label = elemento('label', etiqueta, 'form-label'), select = elemento('select', undefined, 'form-select');
    label.append(select); grupo.append(label); fila.append(grupo); return select;
  }
  const persona = selector('Persona', 'col-md-4'), participacion = selector('Participación', 'col-md-3'), matricula = selector('Matrícula, si corresponde', 'col-md-4');
  persona.dataset.persona = ''; participacion.dataset.participacion = ''; matricula.dataset.matricula = '';
  opciones(persona, catalogo.personas, (p) => p.id, (p) => `${p.nombres} ${p.apellidos}`, valores.id_persona);
  opciones(participacion, ['afectado', 'testigo', 'involucrado'], (v) => v, estado, valores.participacion);
  function cargarMatricula(id) { opciones(matricula, catalogo.matriculas.filter((m) => String(m.id_persona) === persona.value), (m) => m.id, (m) => `${m.nivel} · ${m.grado}.º ${m.seccion} · ${m.anio_lectivo}`, id); }
  cargarMatricula(valores.id_matricula); persona.addEventListener('change', () => cargarMatricula());
  persona.required = true; participacion.required = true;
  const quitar = elemento('div', undefined, 'col-md-1'); quitar.append(accion('Quitar', () => fila.remove())); fila.append(quitar); $('involved-rows').append(fila);
}
async function formulario(datos) {
  catalogo = await json('incidencias/catalogos');
  $('incident-form').reset(); $('involved-rows').replaceChildren();
  borradorId = datos?.incidencia.id || null;
  $('form-title').textContent = borradorId ? `Editar borrador ${codigo(borradorId)}` : 'Registrar incidencia';
  opciones($('category'), Object.keys(categorias), (v) => v, (v) => categorias[v], datos?.version.categoria);
  opciones($('reporter'), catalogo.personas, (p) => p.id, (p) => `${p.nombres} ${p.apellidos}`, datos?.version.id_reportante);
  condicion(datos?.version.condicion_reportante); $('registrar').value = `${usuario.nombre} · ${cargos[usuario.rol]}`;
  tipos(datos?.version.id_tipo); camposCategoria(datos?.version);
  prepararLugar(datos?.version.lugar);
  if (datos) {
    const v = datos.version;
    for (const [campo, valor] of Object.entries({ 'incident-title': v.titulo, description: v.descripcion, priority: datos.incidencia.prioridad, confidentiality: datos.incidencia.confidencialidad })) $(campo).value = valor || '';
    if (v.ocurrida_en) $('occurred').value = new Date(new Date(v.ocurrida_en).getTime() - 5 * 3600000).toISOString().slice(0, 16);
    $('sensitive').value = String(datos.incidencia.confidencialidad === 'restringida');
    datos.involucrados.forEach(involucrado);
  }
  mostrar('form-view');
}
function prepararLugar(valor = '') {
  opciones($('place'), lugares, lugar => lugar, lugar => lugar);
  $('place').options[0].textContent = 'Sin precisar';
  $('place').add(new Option('Otro lugar', 'otro'));
  const aulas = catalogo.aulas.map(aula => `Aula de ${aula.grado}.º de ${aula.nivel} ${aula.seccion}`);
  opciones($('place-classroom'), aulas, aula => aula, aula => aula);
  if (aulas.includes(valor)) { $('place').value = 'Aula'; $('place-classroom').value = valor; }
  else {
    // Los borradores históricos conservan su texto exacto, aunque no figure en el selector.
    if (valor && !lugares.includes(valor)) $('place').add(new Option(valor, valor));
    $('place').value = valor || '';
  }
  actualizarLugar();
}
function actualizarLugar() {
  const aula = $('place').value === 'Aula', otro = $('place').value === 'otro';
  $('place-classroom-group').hidden = !aula; $('place-classroom').required = aula; $('place-classroom').disabled = !aula;
  $('place-other-group').hidden = !otro; $('place-other').required = otro; $('place-other').disabled = !otro;
  $('place-other').setCustomValidity(otro && !$('place-other').value.trim() ? 'Especifica el otro lugar.' : '');
}
function contenidoFormulario() {
  const cuerpo = { id_tipo: $('incident-type').value, titulo: $('incident-title').value.trim(), descripcion: $('description').value.trim(),
    lugar: $('place').value === 'Aula' ? $('place-classroom').value : $('place').value === 'otro' ? $('place-other').value.trim() : $('place').value,
    ocurrida_en: $('occurred').value ? new Date(`${$('occurred').value}-05:00`).toISOString() : null,
    id_reportante: $('reporter').value, condicion_reportante: $('reporter-condition').value,
    prioridad: $('priority').value, confidencialidad: $('confidentiality').value, contenido_sensible: $('sensitive').value === 'true',
    involucrados: [...$('involved-rows').children].map((fila) => ({ id_persona: fila.querySelector('[data-persona]').value, id_matricula: fila.querySelector('[data-matricula]').value || null, participacion: fila.querySelector('[data-participacion]').value })) };
  for (const input of $('specific-fields').querySelectorAll('[data-field]')) cuerpo[input.dataset.field] = input.value === '' ? null : input.dataset.tipo === 'booleano' ? input.value === 'true' : input.type === 'number' ? Number(input.value) : input.value.trim();
  return cuerpo;
}

function bloque(titulo, contenedor) { const section = elemento('section', undefined, 'record-block'); section.append(elemento('h3', titulo)); contenedor.append(section); return section; }
function metadatos(destino, pares) { const dl = elemento('dl', undefined, 'record-meta'); for (const [titulo, valor] of pares) { const div = elemento('div'); div.append(elemento('dt', titulo), elemento('dd', valor || 'No precisado')); dl.append(div); } destino.append(dl); }
function mostrarEncabezado(datos, destino) {
  const { incidencia, version } = datos;
  destino.append(elemento('p', `${codigo(incidencia.id)} · ${estado(incidencia.estado)} · ${incidencia.confidencialidad}`, 'eyebrow'), elemento('h2', version.titulo, 'h3'));
  const botones = elemento('div', undefined, 'd-flex flex-wrap gap-2 my-3');
  botones.append(accion('Volver', listar));
  if (incidencia.estado === 'borrador' && String(incidencia.id_registrador) === String(usuario.id)) {
    botones.append(accion('Editar borrador', () => formulario(datos)));
    botones.append(accion('Confirmar incidencia', async () => {
      const respuesta = await json(`incidencias/${incidencia.id}/confirmar`, 'POST', {});
      if (respuesta.acceso) await abrir(incidencia.id); else { await listar(); aviso(`${codigo(incidencia.id)} recibido y confirmado. Tu rol no tiene acceso posterior al contenido restringido.`); }
    }, 'btn btn-primary'));
  } else if (puede('incidencias.exportar')) botones.append(accion('Descargar PDF', async () => {
    const blob = await (await api(`incidencias/${incidencia.id}/pdf`)).blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${codigo(incidencia.id)}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'btn btn-primary'));
  destino.append(botones);
  metadatos(destino, [['Categoría', categorias[version.categoria]], ['Tipo', version.tipo], ['Fecha del hecho', fecha(version.ocurrida_en)], ['Lugar', version.lugar], ['Prioridad', incidencia.prioridad], ['Registrador', `${incidencia.nombre_registrador} · ${incidencia.cargo_registrador}`], ['Reportante', `${version.nombre_reportante} · ${version.condicion_reportante}`], ['Registro', fecha(incidencia.registrada_en)]]);
}

function mostrarHechos(datos, destino) {
  const { version, involucrados } = datos;
  const personas = bloque('Personas involucradas', destino);
  for (const persona of involucrados) personas.append(elemento('p', `${persona.nombre} · ${persona.participacion}${persona.nivel ? ` · ${persona.nivel} · ${persona.grado}.º ${persona.seccion}` : ' · Sin matrícula relacionada'}`));
  if (!involucrados.length) personas.append(elemento('p', 'Sin personas involucradas identificadas.'));
  bloque('Descripción de los hechos', destino).append(elemento('p', version.descripcion, 'record-text'));
  const especificos = bloque('Datos de la categoría', destino);
  for (const [campo, etiqueta, tipo] of campos[version.categoria]) if (version[campo] !== null) especificos.append(elemento('p', `${etiqueta}: ${tipo === 'booleano' ? (version[campo] ? 'Sí' : 'No') : version[campo]}`));
}

function mostrarSeguimiento(datos, destino) {
  const { incidencia, actuaciones, responsables } = datos;
  const seguimiento = bloque('Actuaciones y seguimiento', destino);
  actuaciones.forEach((actuacion) => { const entry = elemento('article', undefined, 'history-entry'); entry.append(elemento('strong', `${estado(actuacion.tipo)} · ${fecha(actuacion.realizada_en)}`), elemento('p', actuacion.detalle, 'record-text'), elemento('small', `${actuacion.autor} · ${actuacion.cargo_autor} · Responsable: ${actuacion.responsable || 'No asignado'}${actuacion.id_actuacion_corregida ? ' · Corrige una actuación anterior' : ''}`, 'text-secondary')); seguimiento.append(entry); });
  if (puede('incidencias.seguimiento') && ['confirmada', 'en_seguimiento'].includes(incidencia.estado)) {
    const form = elemento('form', undefined, 'row g-3 mt-2');
    form.innerHTML = `
      <h4 class="h6">Agregar seguimiento</h4><div class="col-md-4"><label class="form-label">Tipo<select name="tipo" class="form-select"><option value="actuacion">Actuación</option><option value="observacion">Observación</option></select></label></div>
      <div class="col-md-4"><label class="form-label">Responsable<select name="responsable" class="form-select" required></select></label></div>
      <div class="col-md-4"><label class="form-label">Plazo, si corresponde<input name="plazo" class="form-control" type="date"></label></div>
      <div class="col-12"><label class="form-label d-block">Detalle<textarea name="detalle" class="form-control" required maxlength="10000" rows="3"></textarea></label></div>
      <div class="col-12"><label class="form-label">Corrección de una actuación, si corresponde<select name="correccion" class="form-select"></select></label></div>
      <div class="col-12"><button class="btn btn-primary">Agregar actuación</button></div>
      `;
    opciones(form.elements.responsable, responsables, (r) => r.id, (r) => r.nombre, usuario.id);
    const grupoReserva = elemento('div', undefined, 'col-12');
    const etiquetaReserva = elemento('label', '¿El seguimiento contiene información sensible?', 'form-label d-block');
    const reserva = elemento('select', undefined, 'form-select'); reserva.name = 'contenido_sensible'; reserva.required = true;
    opciones(reserva, ['true', 'false'], (version) => version, (version) => version === 'true' ? 'Sí, proteger el expediente completo' : 'No');
    reserva.addEventListener('change', () => opciones(form.elements.responsable, reserva.value === 'true' ? responsables.filter((r) => ['director', 'subdirector'].includes(r.rol)) : responsables, (r) => r.id, (r) => r.nombre));
    etiquetaReserva.append(reserva); grupoReserva.append(etiquetaReserva); form.insertBefore(grupoReserva, form.lastElementChild);
    opciones(form.elements.correccion, actuaciones, (actuacion) => actuacion.id, (actuacion) => `${fecha(actuacion.registrada_en)} · ${actuacion.detalle.slice(0, 80)}`);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const boton = form.querySelector('button'); boton.disabled = true;
      try {
        const respuesta = await json(`incidencias/${incidencia.id}/actuaciones`, 'POST', { tipo: form.elements.tipo.value,
          detalle: form.elements.detalle.value, id_responsable: form.elements.responsable.value,
          fecha_limite: form.elements.plazo.value || null, id_actuacion_corregida: form.elements.correccion.value || null,
          contenido_sensible: reserva.value === 'true' });
        if (respuesta.acceso) await abrir(incidencia.id);
        else { await listar(); aviso(`Actuación recibida en ${codigo(incidencia.id)}. El expediente quedó restringido y tu rol no tiene acceso posterior.`); }
      } catch (error) { aviso(error.message, true); boton.disabled = false; }
    });
    seguimiento.append(form);
  }
}

function mostrarDocumentos(datos, destino) {
  if (datos.solicitudes.length) {
    const seccion = bloque('Solicitudes conservadas', destino);
    for (const solicitud of datos.solicitudes) {
      seccion.append(elemento('p', `${estado(solicitud.tipo)} · ${estado(solicitud.estado)} · ${solicitud.justificacion}`));
      seccion.append(elemento('p', solicitud.fundamento_decision || 'Decisión pendiente.'));
    }
    seccion.append(elemento('small', 'Los flujos para presentar y resolver nuevas solicitudes requieren los criterios institucionales pendientes.', 'text-secondary'));
  }
  if (datos.versiones.length > 1) {
    const seccion = bloque('Versiones conservadas', destino);
    for (const version of datos.versiones) {
      const contenido = elemento('details');
      contenido.append(elemento('summary', 'Versión ' + version.numero_version + ' → ' + version.estado_version));
      contenido.append(elemento('p', version.descripcion, 'record-text'));
      seccion.append(contenido);
    }
  }
}

function mostrarHistorial(historial, destino) {
  const seccion = bloque('Historial del expediente', destino);
  for (const evento of historial) {
    const descripcion = `${fecha(evento.ocurrido_en)} · ${evento.actor} · ${estado(evento.accion.replace(/^demo_/, ''))}`;
    const entrada = elemento('p', descripcion, 'small history-entry');
    if (evento.campo && evento.campo !== 'escenario') {
      entrada.append(elemento('span', ` · ${evento.campo}: ${evento.valor_anterior ?? 'sin valor'} → ${evento.valor_nuevo ?? 'sin valor'}`));
    }
    seccion.append(entrada);
  }
}

async function abrir(id) {
  detalleActual = await json('incidencias/' + id);
  mostrar('detail-view');
  const destino = $('detail-content');
  destino.replaceChildren();
  mostrarEncabezado(detalleActual, destino);
  mostrarHechos(detalleActual, destino);
  mostrarSeguimiento(detalleActual, destino);
  mostrarDocumentos(detalleActual, destino);
  mostrarHistorial(detalleActual.historial, destino);
}

function campoCuenta(nombre, etiqueta, filas, valor, mostrar) {
  const grupo = elemento('div', undefined, 'col-md-6'); const label = elemento('label', etiqueta, 'form-label');
  const input = elemento(filas ? 'select' : 'input', undefined, filas ? 'form-select' : 'form-control'); input.name = nombre; input.required = true;
  if (filas) opciones(input, filas, valor || ((f) => f.id), mostrar || ((f) => f.nombre));
  label.append(input); grupo.append(label); $('authorization-fields').append(grupo); return input;
}
function camposAutorizacion() {
  limpiarAviso();
  $('authorization-fields').replaceChildren(); const tipo = $('account-action').value;
  if (tipo === 'crear_cuenta') campoCuenta('id_persona', 'Personal sin cuenta', cuentaCatalogo.personas);
  if (['editar_cuenta', 'activar_cuenta', 'desactivar_cuenta', 'restablecer_clave', 'cambiar_rol'].includes(tipo)) campoCuenta('id_usuario_objetivo', 'Cuenta objetivo', cuentaCatalogo.usuarios.filter((u) => String(u.id) !== String(usuario.id)));
  if (['crear_cuenta', 'cambiar_rol', 'asignar_permiso', 'retirar_permiso'].includes(tipo)) campoCuenta('id_rol_objetivo', 'Rol', cuentaCatalogo.roles);
  if (['asignar_permiso', 'retirar_permiso'].includes(tipo)) campoCuenta('id_permiso', 'Permiso', cuentaCatalogo.permisos, (p) => p.id, (p) => nombresPermisos[p.codigo] || p.codigo);
  if (['crear_cuenta', 'editar_cuenta'].includes(tipo)) { const input = campoCuenta('nombre_usuario', 'Nombre de usuario'); input.minLength = 3; input.maxLength = 60; input.pattern = '[a-zA-Z0-9._\\-]{3,60}'; }
  actualizarModoCuenta();
}

function operacionDirecta() {
  if (!puede('cuentas.administrar')) return false;
  const formulario = $('authorization-form');
  const tipo = $('account-action').value;
  const cuenta = cuentaCatalogo.usuarios.find(c => String(c.id) === formulario.elements.id_usuario_objetivo?.value);
  const rol = cuentaCatalogo.roles.find(r => String(r.id) === formulario.elements.id_rol_objetivo?.value);
  const cargo = tipo === 'crear_cuenta' ? rol?.codigo : cuenta?.rol;
  return ['crear_cuenta', 'editar_cuenta'].includes(tipo) && cargo && !['director', 'subdirector', 'administrador'].includes(cargo);
}

function actualizarModoCuenta() {
  const directa = operacionDirecta();
  const crear = $('account-action').value === 'crear_cuenta';
  $('initial-password-group').hidden = !(directa && crear);
  $('initial-password').required = Boolean(directa && crear);
  if (!directa || !crear) $('initial-password').value = '';
  $('submit-account-change').textContent = directa ? 'Guardar cambio' : 'Enviar solicitud';
  $('account-mode').textContent = crear
    ? 'La cuenta se crea inactiva para personal existente. Su activación se solicita y aprueba por separado. Los roles de autoridad requieren autorización.'
    : directa ? 'La edición básica solo cambia el nombre de usuario y queda registrada en el historial.'
      : 'Se enviarán los valores exactos para aprobación independiente. El cambio aún no se aplicará.';
}

function prepararCuenta(tipo, cuenta) {
  $('account-error').hidden = true; limpiarAviso();
  $('authorization-form').reset();
  $('account-action').value = tipo;
  camposAutorizacion();
  if (cuenta) {
    $('authorization-form').elements.id_usuario_objetivo.value = String(cuenta.id);
    if (tipo === 'editar_cuenta') $('authorization-form').elements.nombre_usuario.value = cuenta.nombre_usuario;
  }
  actualizarModoCuenta();
  $('authorization-form').hidden = false;
  $('authorization-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function verHistorialCuenta(cuenta) {
  const { historial } = await json(`cuentas/${cuenta.id}/historial`);
  $('account-history-title').textContent = `Historial de ${cuenta.nombre}`;
  $('account-history-rows').replaceChildren();
  for (const evento of historial) {
    const entrada = elemento('article', undefined, 'history-entry');
    entrada.append(elemento('strong', estado(evento.accion)), elemento('p', evento.motivo || 'Acceso institucional.', 'mb-1'),
      elemento('small', `${evento.actor || 'Sistema'} · ${fecha(evento.ocurrido_en)}`));
    $('account-history-rows').append(entrada);
  }
  if (!historial.length) $('account-history-rows').textContent = 'No hay movimientos registrados para esta cuenta.';
  $('account-history').hidden = false;
  $('account-history').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function mostrarCuentas() {
  $('account-rows').replaceChildren();
  for (const cuenta of cuentaCatalogo.usuarios) {
    const fila = elemento('tr');
    const valores = [cuenta.nombre, cuenta.nombre_usuario, cargos[cuenta.rol], cuenta.activo ? 'Activo' : 'Inactivo'];
    valores.forEach((valor, indice) => {
      const celda = elemento('td');
      celda.dataset.label = ['Nombre', 'Usuario', 'Rol', 'Estado'][indice];
      if (indice === 3) {
        celda.append(elemento('span', valor, `status-label account-status ${cuenta.activo ? 'account-active' : 'account-inactive'}`));
      } else celda.textContent = valor;
      fila.append(celda);
    });
    const celdaAcciones = elemento('td'); celdaAcciones.dataset.label = 'Acciones';
    const botones = elemento('div', undefined, 'account-actions');
    if (String(cuenta.id) === String(usuario.id)) botones.append(elemento('span', 'Tu cuenta: los cambios propios están bloqueados.', 'small text-secondary'));
    else if (puede('cuentas.solicitar')) {
      for (const [etiqueta, tipo] of [['Editar', 'editar_cuenta'], [cuenta.activo ? 'Desactivar' : 'Activar', cuenta.activo ? 'desactivar_cuenta' : 'activar_cuenta'], ['Restablecer clave', 'restablecer_clave'], ['Cambiar rol', 'cambiar_rol']]) {
        botones.append(accion(etiqueta, () => prepararCuenta(tipo, cuenta)));
      }
    }
    botones.append(accion('Historial', () => verHistorialCuenta(cuenta)));
    celdaAcciones.append(botones); fila.append(celdaAcciones);
    $('account-rows').append(fila);
  }
}

function tarjetaAutorizacion(autorizacion, resumen) {
  const tarjeta = elemento('article', undefined, 'authorization-card');
  tarjeta.dataset.solicitud = autorizacion.id;
  tarjeta.append(elemento('p', autorizacion.codigo, 'small text-secondary mb-1'));
  const nombreAccion = [...$('account-action').options].find((opcion) => opcion.value === autorizacion.tipo)?.textContent || estado(autorizacion.tipo);
  tarjeta.append(elemento('h4', nombreAccion, 'authorization-title'));
  tarjeta.append(elemento('p', autorizacion.motivo, 'authorization-reason'));
  const datosAfectados = elemento('div', undefined, 'authorization-target');
  datosAfectados.append(elemento('span', 'Cuenta o permiso afectado', 'small text-secondary d-block mb-1'), elemento('p', resumen, 'mb-0'));
  tarjeta.append(datosAfectados);
  const metadatos = elemento('dl', undefined, 'authorization-meta');
  const estados = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', desacuerdo: 'Revisión por desacuerdo', vencida: 'Vencida', ejecutada: 'Ejecutada' };
  const estadoAutorizacion = estados[autorizacion.estado] || estado(autorizacion.estado);
  const datos = [['Solicitante', autorizacion.solicitante || autorizacion.autorizante], ['Registrada el', fecha(autorizacion.solicitada_en || autorizacion.autorizada_en)],
    ['Estado', estadoAutorizacion], [autorizacion.ejecutada_en ? 'Ejecutada el' : 'Vence el', fecha(autorizacion.ejecutada_en || autorizacion.vence_en)]];
  if (autorizacion.ejecutor) datos.push(['Ejecutor', autorizacion.ejecutor]);
  for (const [etiqueta, valor] of datos) {
    const grupo = elemento('div');
    grupo.append(elemento('dt', etiqueta), elemento('dd', valor));
    metadatos.append(grupo);
  }
  tarjeta.append(metadatos);
  const decisiones = elemento('div', undefined, 'authorization-decisions');
  for (const cargo of ['director', 'subdirector']) {
    if (autorizacion[`decision_${cargo}`]) decisiones.append(elemento('p', `${cargos[cargo]} · ${autorizacion[`decisor_${cargo}`]} · ${autorizacion[`decision_${cargo}`] === 'aprobar' ? 'Aprobó' : 'Rechazó'} · ${fecha(autorizacion[`decidida_${cargo}_en`])}: ${autorizacion[`fundamento_${cargo}`]}`));
  }
  if (autorizacion.estado === 'desacuerdo') decisiones.append(elemento('p', 'Ejecución bloqueada. Se requiere una resolución institucional documentada; este sistema no permite resolverla unilateralmente.'));
  if (autorizacion.estado === 'pendiente') decisiones.append(elemento('p', autorizacion.revision_doble ? 'Requiere decisiones independientes del Director y Subdirector.' : autorizacion.rol_solicitante === 'director' ? 'Requiere decisión del Subdirector.' : autorizacion.rol_solicitante === 'subdirector' ? 'Requiere decisión del Director.' : 'La primera decisión válida del Director o Subdirector resuelve la solicitud.'));
  if (decisiones.children.length) tarjeta.append(decisiones);
  return tarjeta;
}

async function cuentas() {
  let pendientes;
  [cuentaCatalogo, { autorizaciones, pendientes }] = await Promise.all([json('cuentas/catalogos'), json('cuentas/autorizaciones')]);
  mostrar('accounts-view'); mostrarCuentas();
  mostrarPendientes(pendientes);
  $('create-account').hidden = !puede('cuentas.solicitar'); $('request-account-change').hidden = !puede('cuentas.solicitar');
  $('authorization-form').hidden = true; $('decision-form').hidden = true; $('account-history').hidden = true;
  $('initial-password').value = ''; $('decision-password').value = '';
  camposAutorizacion(); $('execution-form').hidden = true;
  mostrarAutorizaciones();
}

function mostrarPendientes(cantidad) {
  $('pending-accounts').textContent = cantidad;
  $('nav-pending').textContent = `Pendientes: ${cantidad}`;
}

function mostrarAutorizaciones() {
  $('authorization-list').replaceChildren();
  const pendientes = elemento('section'); pendientes.id = 'pending-authorization-list';
  pendientes.append(elemento('h4', 'Solicitudes pendientes', 'h5'));
  const registradas = elemento('section', undefined, 'mt-4');
  registradas.append(elemento('h4', 'Otras solicitudes y autorizaciones registradas', 'h5'));
  $('authorization-list').append(pendientes, registradas);
  if (!autorizaciones.some(a => a.pendiente_para_usuario)) pendientes.append(elemento('p', 'No tienes solicitudes pendientes.', 'text-secondary'));
  for (const a of autorizaciones) {
    const rol = cuentaCatalogo.roles.find((r) => String(r.id) === String(a.id_rol_objetivo));
    const permiso = cuentaCatalogo.permisos.find((p) => String(p.id) === String(a.id_permiso));
    const objetivo = cuentaCatalogo.usuarios.find((u) => String(u.id) === String(a.id_usuario_objetivo) || String(u.id_persona) === String(a.id_persona));
    const persona = cuentaCatalogo.personas.find((p) => String(p.id) === String(a.id_persona));
    const resumen = [objetivo?.nombre || persona?.nombre, a.nombre_usuario, rol?.nombre,
      permiso ? nombresPermisos[permiso.codigo] || permiso.codigo : null, a.activo === null ? null : a.activo ? 'Cuenta activa' : 'Cuenta inactiva'].filter(Boolean).join(' · ');
    const item = tarjetaAutorizacion(a, resumen);
    if (a.puede_decidir) {
      for (const [etiqueta, decision] of [['Aprobar', 'aprobar'], ['Rechazar', 'rechazar']]) item.append(accion(etiqueta, () => {
        limpiarAviso();
        decisionActual = { id: a.id, decision };
        $('decision-form').reset(); $('decision-form').hidden = false;
        $('decision-summary').textContent = `${etiqueta}: ${estado(a.tipo)} · ${resumen} · ${a.motivo}`;
        $('decision-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }));
    }
    if (a.puede_ejecutar) item.append(accion('Seleccionar para ejecutar', () => { ejecucion = a; $('execution-form').hidden = false; $('execution-summary').textContent = `${estado(a.tipo)} · ${resumen} · ${a.motivo}`; const necesita = ['crear_cuenta', 'restablecer_clave'].includes(a.tipo); $('execution-password-group').hidden = !necesita; $('new-password').required = necesita; $('new-password').value = ''; $('execution-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    (a.pendiente_para_usuario ? pendientes : registradas).append(item);
  }
}

async function actualizarSolicitudes() {
  if (!usuario || redirigiendo || !puede('cuentas.consultar') || actualizandoSolicitudes || document.hidden) return;
  actualizandoSolicitudes = true;
  try {
    const respuesta = await json('cuentas/autorizaciones');
    if (redirigiendo) return;
    autorizaciones = respuesta.autorizaciones;
    mostrarPendientes(respuesta.pendientes);
    // Actualizar la lista sin borrar los formularios que la autoridad está completando.
    if (!$('accounts-view').hidden && cuentaCatalogo) mostrarAutorizaciones();
  } catch (error) {
    $('nav-pending').textContent = 'Pendientes: sin actualizar';
    aviso(error.message, true);
  } finally { actualizandoSolicitudes = false; }
}

$('place').addEventListener('change', actualizarLugar);
$('place-other').addEventListener('input', actualizarLugar);
$('category').addEventListener('change', () => { tipos(); camposCategoria(); }); $('incident-type').addEventListener('change', minimo); $('reporter').addEventListener('change', () => condicion());
$('add-person').addEventListener('click', () => involucrado()); $('account-action').addEventListener('change', camposAutorizacion);
$('incident-form').addEventListener('submit', async (e) => { e.preventDefault(); $('save-draft').disabled = true; try { const resultado = await json(borradorId ? `incidencias/${borradorId}/borrador` : 'incidencias', borradorId ? 'PUT' : 'POST', contenidoFormulario()); await abrir(borradorId || resultado.id); aviso('Borrador guardado. Revisa los datos antes de confirmar.'); } catch (error) { aviso(error.message, true); } finally { $('save-draft').disabled = false; } });
$('authorization-fields').addEventListener('change', actualizarModoCuenta);
$('authorization-form').addEventListener('input', limpiarAviso);
$('authorization-form').addEventListener('change', limpiarAviso);
$('create-account').addEventListener('click', () => prepararCuenta('crear_cuenta'));
$('request-account-change').addEventListener('click', () => prepararCuenta('restablecer_clave'));
$('cancel-account-change').addEventListener('click', () => { $('authorization-form').hidden = true; $('initial-password').value = ''; });
$('refresh-accounts').addEventListener('click', async () => { try { await cuentas(); } catch (error) { aviso(error.message, true); } });
$('authorization-form').addEventListener('submit', async event => {
  event.preventDefault();
  const boton = $('submit-account-change');
  if (boton.disabled || !confirm('¿Confirmas esta operación y los valores indicados?')) return;
  limpiarAviso();
  boton.disabled = true;
  $('account-error').hidden = true;
  const datos = { tipo: $('account-action').value, motivo: $('authorization-reason').value };
  for (const input of $('authorization-fields').querySelectorAll('[name]')) datos[input.name] = input.value;
  const directa = operacionDirecta();
  if (directa && datos.tipo === 'crear_cuenta') datos.contrasena = $('initial-password').value;
  let confirmacion;
  try {
    const resultado = await json(directa ? 'cuentas/directas' : 'cuentas/autorizaciones', 'POST', datos);
    confirmacion = directa ? 'Cambio guardado y registrado en el historial.'
      : `${resultado.existente ? 'La solicitud ya estaba registrada' : 'Solicitud registrada'}: ${resultado.codigo}. Requiere una decisión independiente antes de ejecutarse.`;
    await cuentas();
    aviso(confirmacion);
  } catch (error) {
    if (confirmacion) aviso(`${confirmacion} No se pudo actualizar el panel: ${error.message}`, true);
    else { $('account-error').textContent = `${directa ? 'Cambio no guardado' : 'Solicitud no registrada'}: ${error.message}`; $('account-error').hidden = false; }
  }
  finally { $('initial-password').value = ''; boton.disabled = false; }
});
$('decision-form').addEventListener('submit', async event => {
  event.preventDefault();
  const boton = $('submit-decision');
  if (boton.disabled || !confirm('¿Confirmas esta decisión institucional?')) return;
  limpiarAviso();
  boton.disabled = true;
  try {
    await json(`cuentas/autorizaciones/${decisionActual.id}/decidir`, 'POST', {
      decision: decisionActual.decision, fundamento: $('decision-reason').value,
      contrasena: $('decision-password').value, sin_conflicto: $('decision-independent').checked
    });
    await cuentas(); aviso('Decisión registrada. Revisa el estado resultante de la solicitud.');
  } catch (error) { aviso(error.message, true); }
  finally { $('decision-password').value = ''; boton.disabled = false; }
});
$('execution-form').addEventListener('submit', async event => {
  event.preventDefault();
  const boton = event.target.querySelector('button');
  if (boton.disabled || !confirm('¿Confirmas la ejecución de los valores aprobados?')) return;
  limpiarAviso();
  boton.disabled = true;
  try {
    await json(`cuentas/autorizaciones/${ejecucion.id}/ejecutar`, 'POST', $('new-password').required ? { contrasena: $('new-password').value } : {});
    await cuentas(); aviso('Cambio autorizado ejecutado y auditado.');
  } catch (error) { aviso(error.message, true); }
  finally { $('new-password').value = ''; boton.disabled = false; }
});
$('search-form').addEventListener('submit', async (e) => { e.preventDefault(); busquedaActual = $('search').value.trim(); try { await listar(1); } catch (error) { aviso(error.message, true); } });
$('next-page').addEventListener('click', async () => { try { await listar(paginaActual + 1); } catch (error) { aviso(error.message, true); } });
$('previous-page').addEventListener('click', async () => { try { await listar(paginaActual - 1); } catch (error) { aviso(error.message, true); } });
for (const [id, tarea] of [['nav-list', listar], ['nav-new', () => formulario()], ['cancel-form', listar], ['nav-accounts', cuentas], ['logout', async () => { await api('auth/logout', 'POST', {}); volverAlAcceso('cerrada'); }]]) $(id).addEventListener('click', async () => {
  if ($(id).disabled || redirigiendo) return;
  $(id).disabled = true;
  try { await tarea(); } catch (error) { aviso(error.message, true); } finally { $(id).disabled = false; }
});

async function iniciar() {
  redirigiendo = false;
  $('workspace').hidden = true;
  $('session-header').hidden = true;
  $('panel-status').hidden = false;
  mostrar(null);
  for (const id of ['nav-list', 'nav-new', 'nav-accounts']) $(id).hidden = true;
  try {
    const sesion = await json('auth/sesion'); usuario = sesion.usuario;
    document.body.classList.toggle('admin-panel', usuario.rol === 'administrador');
    $('user-label').textContent = `${usuario.nombre} · ${cargos[usuario.rol]}`;
    $('session-header').hidden = false;
    const operativo = usuario.rol !== 'administrador';
    $('nav-list').hidden = !operativo || !puede('incidencias.consultar'); $('nav-new').hidden = !operativo || !puede('incidencias.registrar'); $('nav-accounts').hidden = !puede('cuentas.consultar');
    if (!$('nav-list').hidden) await listar();
    else if (!$('nav-accounts').hidden) await cuentas();
    else if (!$('nav-new').hidden) await formulario();
    else aviso('Tu cuenta no tiene acciones asignadas. Contacta a la autoridad autorizada.');
    if ($('accounts-view').hidden) await actualizarSolicitudes();
  } catch (error) { aviso(error.message, true); }
  finally {
    if (!redirigiendo) { $('panel-status').hidden = true; $('workspace').hidden = false; }
  }
}
// Al volver desde el historial se valida la sesión antes de mostrar datos guardados.
window.addEventListener('pagehide', () => { $('workspace').hidden = true; $('session-header').hidden = true; });
window.addEventListener('pageshow', (event) => { if (event.persisted) iniciar(); });
window.addEventListener('focus', actualizarSolicitudes);
document.addEventListener('visibilitychange', () => { if (!document.hidden) actualizarSolicitudes(); });
iniciar();
