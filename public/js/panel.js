const $ = (id) => document.getElementById(id);
const categorias = { convivencia: 'Convivencia escolar', disciplina: 'Disciplina', salud: 'Salud y bienestar', seguridad: 'Accidentes y seguridad', bienes: 'Bienes y pertenencias', proteccion_estudiantil: 'Protección estudiantil' };
const cargos = { director: 'Director', subdirector: 'Subdirector', coordinador_tutoria: 'Coordinador de Tutoría', docente: 'Docente', auxiliar: 'Auxiliar', administrador: 'Administrador' };
const nombresPermisos = { 'sesion.consultar': 'Consultar sesión', 'cuentas.consultar': 'Consultar cuentas', 'cuentas.autorizar': 'Autorizar cambios de cuentas', 'cuentas.administrar': 'Ejecutar administración autorizada',
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
let anterior, cursores = [], ultimaPagina = [];
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
function aviso(mensaje, error = false) { $('message').textContent = mensaje; $('message').className = `alert alert-${error ? 'danger' : 'success'}`; $('message').hidden = false; }
function mostrar(vista) { for (const id of ['list-view', 'form-view', 'detail-view', 'accounts-view']) $(id).hidden = id !== vista; $('message').hidden = true; }
async function api(ruta, method = 'GET', datos) {
  const response = await fetch(`/api/${ruta}`, { method, credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-SICE-Request': '1' },
    body: method === 'GET' ? undefined : JSON.stringify(datos || {}), signal: AbortSignal.timeout(20000) });
  if (response.status === 401) { location.assign('/'); throw new Error('La sesión ha finalizado.'); }
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

async function listar() {
  mostrar('list-view');
  const parametros = new URLSearchParams({ buscar: $('search').value.trim() });
  if (anterior) parametros.set('anterior', anterior);
  ultimaPagina = (await json(`incidencias?${parametros}`)).incidencias;
  $('incident-rows').replaceChildren();
  for (const fila of ultimaPagina) {
    const tr = elemento('tr');
    tr.append(elemento('td', codigo(fila.id)), elemento('td', fecha(fila.registrada_en)));
    const asunto = elemento('td'); asunto.append(elemento('small', categorias[fila.categoria], 'text-secondary d-block'), elemento('span', fila.titulo));
    const est = elemento('td'); est.append(elemento('span', estado(fila.estado), 'status-label'));
    const ver = elemento('td'); ver.append(accion('Ver', () => abrir(fila.id)));
    tr.append(asunto, est, elemento('td', fila.prioridad), ver);
    [...tr.children].forEach((td, indice) => { if (indice < 5) td.dataset.label = ['Código', 'Fecha', 'Categoría y título', 'Estado', 'Prioridad'][indice]; });
    $('incident-rows').append(tr);
  }
  $('list-empty').hidden = ultimaPagina.length !== 0; $('previous-page').hidden = cursores.length === 0; $('next-page').hidden = ultimaPagina.length < 50;
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
  if (datos) {
    const v = datos.version;
    for (const [campo, valor] of Object.entries({ 'incident-title': v.titulo, description: v.descripcion, place: v.lugar, priority: datos.incidencia.prioridad, confidentiality: datos.incidencia.confidencialidad })) $(campo).value = valor || '';
    if (v.ocurrida_en) $('occurred').value = new Date(new Date(v.ocurrida_en).getTime() - 5 * 3600000).toISOString().slice(0, 16);
    $('sensitive').value = String(datos.incidencia.confidencialidad === 'restringida');
    datos.involucrados.forEach(involucrado);
  }
  mostrar('form-view');
}
function contenidoFormulario() {
  const cuerpo = { id_tipo: $('incident-type').value, titulo: $('incident-title').value.trim(), descripcion: $('description').value.trim(),
    lugar: $('place').value.trim(), ocurrida_en: $('occurred').value ? new Date(`${$('occurred').value}-05:00`).toISOString() : null,
    id_reportante: $('reporter').value, condicion_reportante: $('reporter-condition').value,
    prioridad: $('priority').value, confidencialidad: $('confidentiality').value, contenido_sensible: $('sensitive').value === 'true',
    involucrados: [...$('involved-rows').children].map((fila) => ({ id_persona: fila.querySelector('[data-persona]').value, id_matricula: fila.querySelector('[data-matricula]').value || null, participacion: fila.querySelector('[data-participacion]').value })) };
  for (const input of $('specific-fields').querySelectorAll('[data-field]')) cuerpo[input.dataset.field] = input.value === '' ? null : input.dataset.tipo === 'booleano' ? input.value === 'true' : input.type === 'number' ? Number(input.value) : input.value.trim();
  return cuerpo;
}

function bloque(titulo, contenedor) { const section = elemento('section', undefined, 'record-block'); section.append(elemento('h3', titulo)); contenedor.append(section); return section; }
function metadatos(destino, pares) { const dl = elemento('dl', undefined, 'record-meta'); for (const [titulo, valor] of pares) { const div = elemento('div'); div.append(elemento('dt', titulo), elemento('dd', valor || 'No precisado')); dl.append(div); } destino.append(dl); }
async function abrir(id) {
  detalleActual = await json(`incidencias/${id}`); mostrar('detail-view');
  const { incidencia: i, version: v, involucrados, actuaciones, historial, versiones, solicitudes, responsables } = detalleActual;
  const destino = $('detail-content'); destino.replaceChildren();
  destino.append(elemento('p', `${codigo(i.id)} · ${estado(i.estado)} · ${i.confidencialidad}`, 'eyebrow'), elemento('h2', v.titulo, 'h3'));
  const botones = elemento('div', undefined, 'd-flex flex-wrap gap-2 my-3');
  botones.append(accion('Volver', listar));
  if (i.estado === 'borrador' && String(i.id_registrador) === String(usuario.id)) {
    botones.append(accion('Editar borrador', () => formulario(detalleActual)));
    botones.append(accion('Confirmar incidencia', async () => {
      const respuesta = await json(`incidencias/${i.id}/confirmar`, 'POST', {});
      if (respuesta.acceso) await abrir(i.id); else { await listar(); aviso(`${codigo(i.id)} recibido y confirmado. Tu rol no tiene acceso posterior al contenido restringido.`); }
    }, 'btn btn-primary'));
  } else if (puede('incidencias.exportar')) botones.append(accion('Descargar PDF', async () => {
    const blob = await (await api(`incidencias/${i.id}/pdf`)).blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${codigo(i.id)}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'btn btn-primary'));
  destino.append(botones);
  metadatos(destino, [['Categoría', categorias[v.categoria]], ['Tipo', v.tipo], ['Fecha del hecho', fecha(v.ocurrida_en)], ['Lugar', v.lugar], ['Prioridad', i.prioridad], ['Registrador', `${i.nombre_registrador} · ${i.cargo_registrador}`], ['Reportante', `${v.nombre_reportante} · ${v.condicion_reportante}`], ['Registro', fecha(i.registrada_en)]]);
  const personas = bloque('Personas involucradas', destino);
  for (const p of involucrados) personas.append(elemento('p', `${p.nombre} · ${p.participacion}${p.nivel ? ` · ${p.nivel} · ${p.grado}.º ${p.seccion}` : ' · Sin matrícula relacionada'}`));
  if (!involucrados.length) personas.append(elemento('p', 'Sin personas involucradas identificadas.'));
  bloque('Descripción de los hechos', destino).append(elemento('p', v.descripcion, 'record-text'));
  const especificos = bloque('Datos de la categoría', destino);
  for (const [campo, etiqueta, tipo] of campos[v.categoria]) if (v[campo] !== null) especificos.append(elemento('p', `${etiqueta}: ${tipo === 'booleano' ? (v[campo] ? 'Sí' : 'No') : v[campo]}`));
  const seguimiento = bloque('Actuaciones y seguimiento', destino);
  actuaciones.forEach((a) => { const entry = elemento('article', undefined, 'history-entry'); entry.append(elemento('strong', `${estado(a.tipo)} · ${fecha(a.realizada_en)}`), elemento('p', a.detalle, 'record-text'), elemento('small', `${a.autor} · ${a.cargo_autor} · Responsable: ${a.responsable || 'No asignado'}${a.id_actuacion_corregida ? ' · Corrige una actuación anterior' : ''}`, 'text-secondary')); seguimiento.append(entry); });
  if (puede('incidencias.seguimiento') && ['confirmada', 'en_seguimiento'].includes(i.estado)) {
    const form = elemento('form', undefined, 'row g-3 mt-2');
    form.innerHTML = '<h4 class="h6">Agregar seguimiento</h4><div class="col-md-4"><label class="form-label">Tipo<select name="tipo" class="form-select"><option value="actuacion">Actuación</option><option value="observacion">Observación</option></select></label></div><div class="col-md-4"><label class="form-label">Responsable<select name="responsable" class="form-select" required></select></label></div><div class="col-md-4"><label class="form-label">Plazo, si corresponde<input name="plazo" class="form-control" type="date"></label></div><div class="col-12"><label class="form-label d-block">Detalle<textarea name="detalle" class="form-control" required maxlength="10000" rows="3"></textarea></label></div><div class="col-12"><label class="form-label">Corrección de una actuación, si corresponde<select name="correccion" class="form-select"></select></label></div><div class="col-12"><button class="btn btn-primary">Agregar actuación</button></div>';
    opciones(form.elements.responsable, responsables, (r) => r.id, (r) => r.nombre, usuario.id);
    const grupoReserva = elemento('div', undefined, 'col-12');
    const etiquetaReserva = elemento('label', '¿El seguimiento contiene información sensible?', 'form-label d-block');
    const reserva = elemento('select', undefined, 'form-select'); reserva.name = 'contenido_sensible'; reserva.required = true;
    opciones(reserva, ['true', 'false'], (v) => v, (v) => v === 'true' ? 'Sí, proteger el expediente completo' : 'No');
    reserva.addEventListener('change', () => opciones(form.elements.responsable, reserva.value === 'true' ? responsables.filter((r) => ['director', 'subdirector'].includes(r.rol)) : responsables, (r) => r.id, (r) => r.nombre));
    etiquetaReserva.append(reserva); grupoReserva.append(etiquetaReserva); form.insertBefore(grupoReserva, form.lastElementChild);
    opciones(form.elements.correccion, actuaciones, (a) => a.id, (a) => `${fecha(a.registrada_en)} · ${a.detalle.slice(0, 80)}`);
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); const boton = form.querySelector('button'); boton.disabled = true;
      try {
        const respuesta = await json(`incidencias/${i.id}/actuaciones`, 'POST', { tipo: form.elements.tipo.value,
          detalle: form.elements.detalle.value, id_responsable: form.elements.responsable.value,
          fecha_limite: form.elements.plazo.value || null, id_actuacion_corregida: form.elements.correccion.value || null,
          contenido_sensible: reserva.value === 'true' });
        if (respuesta.acceso) await abrir(i.id);
        else { await listar(); aviso(`Actuación recibida en ${codigo(i.id)}. El expediente quedó restringido y tu rol no tiene acceso posterior.`); }
      } catch (error) { aviso(error.message, true); boton.disabled = false; }
    });
    seguimiento.append(form);
  }
  if (solicitudes.length) { const section = bloque('Solicitudes conservadas', destino); solicitudes.forEach((s) => { section.append(elemento('p', `${estado(s.tipo)} · ${estado(s.estado)} · ${s.justificacion}`), elemento('p', s.fundamento_decision || 'Decisión pendiente.')); }); section.append(elemento('small', 'Los flujos para presentar y resolver nuevas solicitudes requieren los criterios institucionales pendientes.', 'text-secondary')); }
  if (versiones.length > 1) { const section = bloque('Versiones conservadas', destino); versiones.forEach((v) => { const details = elemento('details'); details.append(elemento('summary', `Versión ${v.numero_version} · ${v.estado_version}`), elemento('p', v.descripcion, 'record-text')); section.append(details); }); }
  const auditoria = bloque('Historial del expediente', destino);
  historial.forEach((h) => { const item = elemento('p', `${fecha(h.ocurrido_en)} · ${h.actor} · ${estado(h.accion.replace(/^demo_/, ''))}`, 'small history-entry'); if (h.campo && h.campo !== 'escenario') item.append(elemento('span', ` · ${h.campo}: ${h.valor_anterior ?? 'sin valor'} → ${h.valor_nuevo ?? 'sin valor'}`)); auditoria.append(item); });
}

function campoCuenta(nombre, etiqueta, filas, valor, mostrar) {
  const grupo = elemento('div', undefined, 'col-md-6'); const label = elemento('label', etiqueta, 'form-label');
  const input = elemento(filas ? 'select' : 'input', undefined, filas ? 'form-select' : 'form-control'); input.name = nombre; input.required = true;
  if (filas) opciones(input, filas, valor || ((f) => f.id), mostrar || ((f) => f.nombre));
  label.append(input); grupo.append(label); $('authorization-fields').append(grupo); return input;
}
function camposAutorizacion() {
  $('authorization-fields').replaceChildren(); const tipo = $('account-action').value;
  if (tipo === 'crear_cuenta') campoCuenta('id_persona', 'Personal sin cuenta', cuentaCatalogo.personas);
  if (['actualizar_cuenta', 'restablecer_clave'].includes(tipo)) campoCuenta('id_usuario_objetivo', 'Cuenta objetivo', cuentaCatalogo.usuarios.filter((u) => String(u.id) !== String(usuario.id)));
  if (tipo !== 'restablecer_clave') campoCuenta('id_rol_objetivo', 'Rol', cuentaCatalogo.roles);
  if (['asignar_permiso', 'retirar_permiso'].includes(tipo)) campoCuenta('id_permiso', 'Permiso', cuentaCatalogo.permisos, (p) => p.id, (p) => nombresPermisos[p.codigo] || p.codigo);
  if (['crear_cuenta', 'actualizar_cuenta'].includes(tipo)) { const input = campoCuenta('nombre_usuario', 'Nombre de usuario'); input.minLength = 3; input.maxLength = 60; campoCuenta('activo', 'Estado', [{ id: 'true', nombre: 'Activo' }, { id: 'false', nombre: 'Inactivo' }]); }
}
async function cuentas() {
  [cuentaCatalogo, { autorizaciones }] = await Promise.all([json('cuentas/catalogos'), json('cuentas/autorizaciones')]);
  mostrar('accounts-view'); $('account-rows').replaceChildren();
  cuentaCatalogo.usuarios.forEach((u) => { const tr = elemento('tr'); [u.nombre, u.nombre_usuario, cargos[u.rol], u.activo ? 'Activo' : 'Inactivo'].forEach((v, indice) => { const td = elemento('td', v); td.dataset.label = ['Nombre', 'Usuario', 'Rol', 'Estado'][indice]; tr.append(td); }); $('account-rows').append(tr); });
  $('authorization-form').hidden = !puede('cuentas.autorizar'); camposAutorizacion(); $('authorization-list').replaceChildren(); $('execution-form').hidden = true;
  for (const a of autorizaciones) {
    const rol = cuentaCatalogo.roles.find((r) => String(r.id) === String(a.id_rol_objetivo));
    const permiso = cuentaCatalogo.permisos.find((p) => String(p.id) === String(a.id_permiso));
    const objetivo = cuentaCatalogo.usuarios.find((u) => String(u.id) === String(a.id_usuario_objetivo) || String(u.id_persona) === String(a.id_persona));
    const persona = cuentaCatalogo.personas.find((p) => String(p.id) === String(a.id_persona));
    const resumen = [objetivo?.nombre || persona?.nombre, a.nombre_usuario, rol?.nombre,
      permiso ? nombresPermisos[permiso.codigo] || permiso.codigo : null, a.activo === null ? null : a.activo ? 'Cuenta activa' : 'Cuenta inactiva'].filter(Boolean).join(' · ');
    const item = elemento('article', undefined, 'history-entry'); item.append(elemento('strong', `${estado(a.tipo)} · ${a.nombre_usuario || cuentaCatalogo.usuarios.find((u) => String(u.id) === String(a.id_usuario_objetivo))?.nombre || 'Permiso por rol'}`), elemento('p', a.motivo), elemento('small', `${a.autorizante} · ${fecha(a.autorizada_en)} · ${a.ejecutada_en ? 'Ejecutada' : 'Vence: ' + fecha(a.vence_en)}`));
    item.append(elemento('p', resumen, 'small mt-2'));
    if (puede('cuentas.administrar') && !a.ejecutada_en && new Date(a.vence_en) > new Date()) item.append(accion('Seleccionar para ejecutar', () => { ejecucion = a; $('execution-form').hidden = false; $('execution-summary').textContent = `${estado(a.tipo)} · ${resumen} · ${a.motivo}`; const necesita = ['crear_cuenta', 'restablecer_clave'].includes(a.tipo); $('execution-password-group').hidden = !necesita; $('new-password').required = necesita; $('new-password').value = ''; }));
    $('authorization-list').append(item);
  }
}

$('category').addEventListener('change', () => { tipos(); camposCategoria(); }); $('incident-type').addEventListener('change', minimo); $('reporter').addEventListener('change', () => condicion());
$('add-person').addEventListener('click', () => involucrado()); $('account-action').addEventListener('change', camposAutorizacion);
$('incident-form').addEventListener('submit', async (e) => { e.preventDefault(); $('save-draft').disabled = true; try { const resultado = await json(borradorId ? `incidencias/${borradorId}/borrador` : 'incidencias', borradorId ? 'PUT' : 'POST', contenidoFormulario()); await abrir(borradorId || resultado.id); aviso('Borrador guardado. Revisa los datos antes de confirmar.'); } catch (error) { aviso(error.message, true); } finally { $('save-draft').disabled = false; } });
$('authorization-form').addEventListener('submit', async (e) => { e.preventDefault(); const datos = { tipo: $('account-action').value, motivo: $('authorization-reason').value }; for (const input of $('authorization-fields').querySelectorAll('[name]')) datos[input.name] = input.name === 'activo' ? input.value === 'true' : input.value; try { await json('cuentas/autorizaciones', 'POST', datos); await cuentas(); aviso('Autorización registrada. Un Administrador independiente debe ejecutarla.'); } catch (error) { aviso(error.message, true); } });
$('execution-form').addEventListener('submit', async (e) => { e.preventDefault(); const boton = e.target.querySelector('button'); boton.disabled = true; try { await json(`cuentas/autorizaciones/${ejecucion.id}/ejecutar`, 'POST', $('new-password').required ? { contrasena: $('new-password').value } : {}); await cuentas(); aviso('Cambio autorizado ejecutado y auditado.'); } catch (error) { aviso(error.message, true); } finally { $('new-password').value = ''; boton.disabled = false; } });
$('search-form').addEventListener('submit', async (e) => { e.preventDefault(); anterior = undefined; cursores = []; try { await listar(); } catch (error) { aviso(error.message, true); } });
$('next-page').addEventListener('click', async () => { cursores.push(anterior); anterior = ultimaPagina.at(-1).id; try { await listar(); } catch (error) { aviso(error.message, true); } });
$('previous-page').addEventListener('click', async () => { anterior = cursores.pop(); try { await listar(); } catch (error) { aviso(error.message, true); } });
for (const [id, tarea] of [['nav-list', listar], ['nav-new', () => formulario()], ['cancel-form', listar], ['nav-accounts', cuentas], ['logout', async () => { await api('auth/logout', 'POST', {}); location.assign('/'); }]]) $(id).addEventListener('click', async () => { try { await tarea(); } catch (error) { aviso(error.message, true); } });

async function iniciar() {
  const sesion = await json('auth/sesion'); usuario = sesion.usuario;
  $('environment').hidden = sesion.entorno !== 'desarrollo'; $('user-label').textContent = `${usuario.nombre} · ${cargos[usuario.rol]}`;
  $('nav-list').hidden = !puede('incidencias.consultar'); $('nav-new').hidden = !puede('incidencias.registrar'); $('nav-accounts').hidden = !puede('cuentas.consultar');
  if (puede('incidencias.consultar')) await listar(); else if (puede('cuentas.consultar')) await cuentas(); else aviso('Tu cuenta no tiene acciones asignadas. Contacta a la autoridad autorizada.');
}
iniciar().catch((error) => aviso(error.message, true));
