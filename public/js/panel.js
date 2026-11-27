const porId = (id) => document.getElementById(id);
const categorias = {
  convivencia: 'Convivencia escolar',
  disciplina: 'Disciplina',
  salud: 'Salud y bienestar',
  seguridad: 'Accidentes y seguridad',
  bienes: 'Bienes y pertenencias',
  proteccion_estudiantil: 'Protección estudiantil'
};
const cargos = {
  director: 'Director',
  subdirector: 'Subdirector',
  coordinador_tutoria: 'Coordinador de Tutoría',
  docente: 'Docente',
  auxiliar: 'Auxiliar',
  administrador: 'Administrador'
};
const nombresPermisos = {
  'sesion.consultar': 'Consultar sesión',
  'cuentas.consultar': 'Consultar cuentas',
  'cuentas.autorizar': 'Autorizar cambios de cuentas',
  'cuentas.administrar': 'Ejecutar administración autorizada',
  'cuentas.solicitar': 'Solicitar cambios de cuentas',
  'cuentas.ejecutar': 'Ejecutar cambios aprobados',
  'incidencias.registrar': 'Registrar incidencias',
  'incidencias.consultar': 'Consultar incidencias',
  'incidencias.seguimiento': 'Agregar seguimiento',
  'incidencias.exportar': 'Descargar informes PDF',
  'incidencias.restringidas': 'Acceder a expedientes restringidos'
};
const campos = {
  convivencia: [
    ['ambito_convivencia', 'Ámbito', ['presencial', 'digital', 'mixto']],
    ['requiere_mediacion', '¿Requiere mediación?', 'booleano']
  ],
  disciplina: [
    [
      'gravedad_disciplinaria',
      'Gravedad disciplinaria',
      ['por_evaluar', 'leve', 'grave', 'muy_grave']
    ],
    ['norma_referida', 'Norma referida, si se conoce', 'texto']
  ],
  salud: [
    ['sintomas_observados', 'Síntomas u observaciones, sin diagnóstico', 'area'],
    ['requiere_atencion_inmediata', '¿Requiere atención inmediata?', 'booleano']
  ],
  seguridad: [
    ['riesgo_identificado', 'Riesgo observado', 'area'],
    ['riesgo_persistente', '¿Persiste el riesgo?', 'booleano']
  ],
  bienes: [
    ['descripcion_dano', 'Descripción de la afectación o pérdida', 'area'],
    ['monto_estimado', 'Importe estimado, si se conoce', 'numero'],
    ['moneda', 'Moneda del importe (por ejemplo, PEN)', 'texto']
  ],
  proteccion_estudiantil: [
    ['riesgo_inmediato', '¿Existe riesgo inmediato?', 'booleano'],
    ['requiere_derivacion', '¿Requiere derivación?', 'booleano']
  ]
};

let usuario;
let catalogo;
let detalleActual;
let borradorId = null;
let cuentaCatalogo;
let autorizaciones;
let ejecucion;
let paginaActual = 1;
let filtrosActuales = {};
let revisionLista = 0;
let redirigiendo = false;
let decisionActual;
let rectificacionId = null;
let actualizandoSolicitudes = false;
let registroEnviado = null;
const lugares = [
  'Aula',
  'Patio de formación',
  'Patio de primaria',
  'Patio de secundaria',
  'Pasillo',
  'Pasillo de primaria',
  'Servicios higiénicos',
  'Biblioteca',
  'Sala de cómputo',
  'Losa deportiva',
  'Escaleras',
  'Ingreso',
  'Ingreso de secundaria',
  'Acceso al patio',
  'Acceso de secundaria',
  'Portería',
  'Dirección',
  'Atención a familias',
  'Espacio de orientación',
  'Espacio de atención reservada'
];
const puede = (permiso) => usuario.permisos.includes(permiso);
const fecha = (valor) =>
  valor ? new Date(valor).toLocaleString('es-PE', { timeZone: 'America/Lima' }) : 'No precisada';
const fechaCivil = (valor) => new Date(valor).toLocaleDateString('es-PE', { timeZone: 'UTC' });
const estado = (valor) => String(valor).replaceAll('_', ' ');
const codigo = (id) => `INC-${String(id).padStart(6, '0')}`;

function elemento(etiqueta, contenido, clase) {
  const el = document.createElement(etiqueta);
  if (contenido !== undefined) {
    el.textContent = contenido;
  }
  if (clase) {
    el.className = clase;
  }
  return el;
}

function aviso(mensaje, error = false) {
  if (redirigiendo) {
    return;
  }
  porId('message').textContent = mensaje;
  porId('message').className = `alert alert-${error ? 'danger' : 'success'}`;
  porId('message').hidden = false;
}

function limpiarAviso() {
  for (const id of ['message', 'account-error']) {
    porId(id).hidden = true;
    porId(id).textContent = '';
  }
}

function mostrar(vista) {
  for (const id of ['list-view', 'form-view', 'detail-view', 'accounts-view', 'student-view']) {
    porId(id).hidden = id !== vista;
  }
  limpiarAviso();
}

function volverAlAcceso(motivo) {
  if (redirigiendo) {
    return;
  }
  redirigiendo = true;
  porId('workspace').hidden = true;
  porId('session-header').hidden = true;
  porId('user-label').textContent = '';
  usuario = null;
  location.replace(`/?sesion=${motivo}`);
}

async function api(ruta, method = 'GET', datos, cabeceras = {}) {
  let response;
  try {
    response = await fetch(`/api/${ruta}`, {
      method,
      credentials: 'same-origin',
      headers:
        method === 'GET'
          ? {}
          : { 'Content-Type': 'application/json', 'X-SICE-Request': '1', ...cabeceras },
      body: method === 'GET' ? undefined : JSON.stringify(datos || {}),
      signal: AbortSignal.timeout(20000)
    });
  } catch {
    throw new Error(
      'No se pudo contactar al servidor. Comprueba tu conexión e inténtalo de nuevo.'
    );
  }
  if (response.status === 401) {
    volverAlAcceso(ruta === 'auth/logout' ? 'cerrada' : 'expirada');
    throw new Error('La sesión ha finalizado.');
  }
  if (!response.ok) {
    const resultado = await response.json();
    throw new Error(resultado.error || 'No se pudo completar la solicitud.');
  }
  return response;
}
const json = async (ruta, method, datos, cabeceras) =>
  (await api(ruta, method, datos, cabeceras)).json();
function accion(etiqueta, tarea, clase = 'btn btn-sm btn-outline-primary') {
  const boton = elemento('button', etiqueta, clase);
  boton.type = 'button';
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    try {
      await tarea();
    } catch (error) {
      aviso(error.message, true);
    } finally {
      boton.disabled = false;
    }
  });
  return boton;
}

function opciones(select, filas, valor, etiqueta, seleccionado = '') {
  select.replaceChildren(new Option('Seleccionar', ''));
  for (const fila of filas) {
    select.add(new Option(etiqueta(fila), String(valor(fila))));
  }
  select.value = String(seleccionado ?? '');
}

function incorporarPersonas(resultado) {
  for (const campo of ['personas', 'matriculas']) {
    catalogo[campo] = [
      ...new Map(
        [...catalogo[campo], ...resultado[campo]].map((fila) => [String(fila.id), fila])
      ).values()
    ];
  }
}

function selectorPersonas(select) {
  const grupo = select.closest('label')?.parentElement || select.parentElement;
  grupo.querySelector('[data-person-search]')?.remove();
  const controles = elemento('div', undefined, 'mt-2');
  controles.dataset.personSearch = '';
  const busqueda = elemento('input', undefined, 'form-control form-control-sm');
  busqueda.type = 'search';
  busqueda.maxLength = 100;
  busqueda.placeholder = 'Buscar por nombre o código';
  busqueda.setAttribute('aria-label', 'Buscar personas por nombre o código');
  const pagina = elemento('span', undefined, 'small text-secondary');
  pagina.setAttribute('aria-live', 'polite');
  let actual = 1;
  let termino = '';
  let revision = 0;
  let paginacion = catalogo.paginacion;
  async function cargar(numero, buscar = termino) {
    const turno = ++revision;
    const resultado = await json(
      'incidencias/personas?' + new URLSearchParams({ buscar, pagina: numero })
    );
    if (turno !== revision || !select.isConnected) {
      return;
    }
    const seleccionado = select.value;
    incorporarPersonas(resultado);
    const filas = [...resultado.personas];
    const anterior = catalogo.personas.find((p) => String(p.id) === seleccionado);
    if (anterior && !filas.some((p) => String(p.id) === seleccionado)) {
      filas.unshift(anterior);
    }
    opciones(
      select,
      filas,
      (p) => p.id,
      (p) => `${p.nombres} ${p.apellidos}`,
      seleccionado
    );
    termino = buscar;
    actualizar(resultado.paginacion);
  }
  function botonSelector(texto, tarea) {
    const boton = elemento('button', texto, 'btn btn-sm btn-outline-primary');
    boton.type = 'button';
    boton.addEventListener('click', async () => {
      boton.disabled = true;
      try {
        await tarea();
      } catch (error) {
        aviso(error.message, true);
      } finally {
        boton.disabled = false;
        actualizar(paginacion);
      }
    });
    return boton;
  }
  const buscar = botonSelector('Buscar', () => cargar(1, busqueda.value.trim()));
  const anterior = botonSelector('Anterior', () => cargar(actual - 1));
  const siguiente = botonSelector('Siguiente', () => cargar(actual + 1));
  function actualizar(datos) {
    paginacion = datos;
    actual = datos.pagina;
    pagina.textContent = `Página ${actual} de ${datos.paginas} · ${datos.total} personas`;
    anterior.disabled = actual <= 1;
    siguiente.disabled = actual >= datos.paginas;
  }
  busqueda.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      buscar.click();
    }
  });
  const botones = elemento('div', undefined, 'd-flex gap-2 flex-wrap my-2');
  botones.append(buscar, anterior, siguiente);
  controles.append(busqueda, botones, pagina);
  grupo.append(controles);
  actualizar(catalogo.paginacion);
}

async function listar(pagina = paginaActual) {
  const revision = ++revisionLista;
  mostrar('list-view');
  const parametros = new URLSearchParams({ ...filtrosActuales, pagina });
  const { incidencias, paginacion } = await json(`incidencias?${parametros}`);
  if (revision !== revisionLista || redirigiendo) {
    return;
  }
  paginaActual = paginacion.pagina;
  porId('incident-rows').replaceChildren();
  for (const fila of incidencias) {
    const tr = elemento('tr');
    tr.append(elemento('td', codigo(fila.id)), elemento('td', fecha(fila.registrada_en)));
    const asunto = elemento('td');
    asunto.append(
      elemento('small', categorias[fila.categoria], 'text-secondary d-block'),
      elemento('span', fila.titulo)
    );
    const est = elemento('td');
    est.append(elemento('span', estado(fila.estado), 'status-label'));
    const ver = elemento('td');
    ver.append(accion('Ver', () => abrir(fila.id)));
    tr.append(asunto, est, elemento('td', fila.prioridad), ver);
    [...tr.children].forEach((td, indice) => {
      if (indice < 5) {
        td.dataset.label = ['Código', 'Fecha', 'Categoría y título', 'Estado', 'Prioridad'][indice];
      }
    });
    porId('incident-rows').append(tr);
  }
  porId('list-empty').hidden = incidencias.length !== 0;
  mostrarPaginacion(paginacion);
}

function mostrarPaginacion({ pagina, paginas, total, desde, hasta }) {
  porId('page-summary').textContent =
    `Página ${pagina} de ${paginas} · ${desde}–${hasta} de ${total} incidencias`;
  porId('previous-page').disabled = pagina === 1;
  porId('next-page').disabled = pagina === paginas;
  porId('page-numbers').replaceChildren();
  const numeros = [...new Set([1, pagina - 2, pagina - 1, pagina, pagina + 1, pagina + 2, paginas])]
    .filter((numero) => numero >= 1 && numero <= paginas)
    .sort((a, b) => a - b);
  numeros.forEach((numero, indice) => {
    if (indice && numero > numeros[indice - 1] + 1) {
      porId('page-numbers').append(elemento('span', '…', 'align-self-center'));
    }
    const boton = accion(
      String(numero),
      () => listar(numero),
      `btn btn-sm ${numero === pagina ? 'btn-primary' : 'btn-outline-primary'}`
    );
    boton.setAttribute('aria-label', `Página ${numero}`);
    if (numero === pagina) {
      boton.setAttribute('aria-current', 'page');
    }
    porId('page-numbers').append(boton);
  });
}

function camposCategoria(valores = {}) {
  porId('specific-fields').replaceChildren();
  for (const [nombre, etiqueta, tipo] of campos[porId('category').value] || []) {
    const grupo = elemento('div', undefined, tipo === 'area' ? 'col-12' : 'col-md-6');
    const label = elemento('label', etiqueta, 'form-label');
    label.htmlFor = `field-${nombre}`;
    let etiquetaControl = 'input';
    if (Array.isArray(tipo) || tipo === 'booleano') {
      etiquetaControl = 'select';
    } else if (tipo === 'area') {
      etiquetaControl = 'textarea';
    }
    const input = elemento(etiquetaControl);
    input.id = `field-${nombre}`;
    input.dataset.field = nombre;
    input.dataset.tipo = tipo === 'booleano' ? tipo : '';
    input.className = input.tagName === 'SELECT' ? 'form-select' : 'form-control';
    if (Array.isArray(tipo)) {
      opciones(input, tipo, (v) => v, estado);
    } else if (tipo === 'booleano') {
      opciones(
        input,
        ['true', 'false'],
        (v) => v,
        (v) => (v === 'true' ? 'Sí' : 'No')
      );
    } else if (tipo === 'numero') {
      input.type = 'number';
      input.min = '0';
      input.step = '0.01';
    } else {
      input.maxLength = tipo === 'area' ? 5000 : 100;
    }
    const valor = valores[nombre];
    if (valor === null || valor === undefined) {
      input.value = '';
    } else if (tipo === 'booleano') {
      input.value = String(Boolean(valor));
    } else {
      input.value = valor;
    }
    grupo.append(label, input);
    porId('specific-fields').append(grupo);
  }
  const reserva = ['salud', 'proteccion_estudiantil'].includes(porId('category').value);
  if (reserva) {
    porId('confidentiality').value = 'restringida';
  }
  porId('confidentiality').disabled = reserva;
}

function tipos(id) {
  opciones(
    porId('incident-type'),
    catalogo.tipos.filter((t) => t.categoria === porId('category').value),
    (t) => t.id,
    (t) => t.nombre,
    id
  );
  minimo();
}

function minimo() {
  const tipo = catalogo.tipos.find((t) => String(t.id) === porId('incident-type').value);
  porId('minimum').textContent = tipo
    ? `Al confirmar: mínimo ${tipo.minimo_estudiantes} estudiante(s).`
    : '';
}

function condicion(valor = '') {
  const p = catalogo.personas.find((p) => String(p.id) === porId('reporter').value);
  const lista = p
    ? [
        p.es_personal ? 'personal' : null,
        p.es_estudiante ? 'estudiante' : null,
        p.es_apoderado ? 'apoderado' : null
      ].filter(Boolean)
    : [];
  if (p && !lista.length) {
    lista.push('externo');
  }
  opciones(porId('reporter-condition'), lista, (v) => v, estado, valor);
}

function involucrado(valores = {}) {
  const fila = elemento('div', undefined, 'row g-2 involved-row align-items-end');
  function selector(etiqueta, clase) {
    const grupo = elemento('div', undefined, clase);
    const label = elemento('label', etiqueta, 'form-label');
    const select = elemento('select', undefined, 'form-select');
    label.append(select);
    grupo.append(label);
    fila.append(grupo);
    return select;
  }
  const persona = selector('Persona', 'col-md-4');
  const participacion = selector('Participación', 'col-md-3');
  const matricula = selector('Matrícula, si corresponde', 'col-md-4');
  persona.dataset.persona = '';
  participacion.dataset.participacion = '';
  matricula.dataset.matricula = '';
  opciones(
    persona,
    catalogo.personas,
    (p) => p.id,
    (p) => `${p.nombres} ${p.apellidos}`,
    valores.id_persona
  );
  opciones(
    participacion,
    ['afectado', 'testigo', 'involucrado'],
    (v) => v,
    estado,
    valores.participacion
  );
  function cargarMatricula(id) {
    opciones(
      matricula,
      catalogo.matriculas.filter((m) => String(m.id_persona) === persona.value),
      (m) => m.id,
      (m) => `${m.nivel} · ${m.grado}.º ${m.seccion} · ${m.anio_lectivo}`,
      id
    );
  }
  cargarMatricula(valores.id_matricula);
  persona.addEventListener('change', () => cargarMatricula());
  selectorPersonas(persona);
  persona.required = true;
  participacion.required = true;
  const quitar = elemento('div', undefined, 'col-md-1');
  quitar.append(accion('Quitar', () => fila.remove()));
  fila.append(quitar);
  porId('involved-rows').append(fila);
}

async function formulario(datos) {
  rectificacionId = null;
  porId('correction-fields')?.remove();
  porId('save-draft').textContent = 'Guardar borrador y revisar';
  porId('priority').disabled = false;
  catalogo = await json('incidencias/catalogos');
  if (datos) {
    const ids = new Set(
      [datos.version.id_reportante, ...datos.involucrados.map((p) => p.id_persona)].map(String)
    );
    for (const id of ids) {
      if (!catalogo.personas.some((p) => String(p.id) === id)) {
        incorporarPersonas(await json('incidencias/personas?' + new URLSearchParams({ id })));
      }
    }
  }
  registroEnviado = null;
  porId('incident-form').reset();
  porId('involved-rows').replaceChildren();
  borradorId = datos?.incidencia.id || null;
  porId('form-title').textContent = borradorId
    ? `Editar borrador ${codigo(borradorId)}`
    : 'Registrar incidencia';
  opciones(
    porId('category'),
    Object.keys(categorias),
    (v) => v,
    (v) => categorias[v],
    datos?.version.categoria
  );
  opciones(
    porId('reporter'),
    catalogo.personas,
    (p) => p.id,
    (p) => `${p.nombres} ${p.apellidos}`,
    datos?.version.id_reportante
  );
  selectorPersonas(porId('reporter'));
  condicion(datos?.version.condicion_reportante);
  porId('registrar').value = `${usuario.nombre} · ${cargos[usuario.rol]}`;
  tipos(datos?.version.id_tipo);
  camposCategoria(datos?.version);
  prepararLugar(datos?.version.lugar);
  if (datos) {
    const v = datos.version;
    for (const [campo, valor] of Object.entries({
      'incident-title': v.titulo,
      description: v.descripcion,
      priority: datos.incidencia.prioridad,
      confidentiality: datos.incidencia.confidencialidad
    })) {
      porId(campo).value = valor || '';
    }
    if (v.ocurrida_en) {
      porId('occurred').value = new Date(new Date(v.ocurrida_en).getTime() - 5 * 3600000)
        .toISOString()
        .slice(0, 16);
    }
    porId('sensitive').value = String(datos.incidencia.confidencialidad === 'restringida');
    datos.involucrados.forEach(involucrado);
  }
  mostrar('form-view');
}

function prepararLugar(valor = '') {
  opciones(
    porId('place'),
    lugares,
    (lugar) => lugar,
    (lugar) => lugar
  );
  porId('place').options[0].textContent = 'Sin precisar';
  porId('place').add(new Option('Otro lugar', 'otro'));
  const aulas = catalogo.aulas.map(
    (aula) => `Aula de ${aula.grado}.º de ${aula.nivel} ${aula.seccion}`
  );
  opciones(
    porId('place-classroom'),
    aulas,
    (aula) => aula,
    (aula) => aula
  );
  if (aulas.includes(valor)) {
    porId('place').value = 'Aula';
    porId('place-classroom').value = valor;
  } else {
    if (valor && !lugares.includes(valor)) {
      porId('place').add(new Option(valor, valor));
    }
    porId('place').value = valor || '';
  }
  actualizarLugar();
}

function actualizarLugar() {
  const aula = porId('place').value === 'Aula';
  const otro = porId('place').value === 'otro';
  porId('place-classroom-group').hidden = !aula;
  porId('place-classroom').required = aula;
  porId('place-classroom').disabled = !aula;
  porId('place-other-group').hidden = !otro;
  porId('place-other').required = otro;
  porId('place-other').disabled = !otro;
  porId('place-other').setCustomValidity(
    otro && !porId('place-other').value.trim() ? 'Especifica el otro lugar.' : ''
  );
}

function contenidoFormulario() {
  let lugar = porId('place').value;
  if (lugar === 'Aula') {
    lugar = porId('place-classroom').value;
  } else if (lugar === 'otro') {
    lugar = porId('place-other').value.trim();
  }
  const cuerpo = {
    id_tipo: porId('incident-type').value,
    titulo: porId('incident-title').value.trim(),
    descripcion: porId('description').value.trim(),
    lugar,
    ocurrida_en: porId('occurred').value
      ? new Date(`${porId('occurred').value}-05:00`).toISOString()
      : null,
    id_reportante: porId('reporter').value,
    condicion_reportante: porId('reporter-condition').value,
    prioridad: porId('priority').value,
    confidencialidad: porId('confidentiality').value,
    contenido_sensible: porId('sensitive').value === 'true',
    involucrados: [...porId('involved-rows').children].map((fila) => ({
      id_persona: fila.querySelector('[data-persona]').value,
      id_matricula: fila.querySelector('[data-matricula]').value || null,
      participacion: fila.querySelector('[data-participacion]').value
    }))
  };
  for (const input of porId('specific-fields').querySelectorAll('[data-field]')) {
    let valor = null;
    if (input.value !== '') {
      if (input.dataset.tipo === 'booleano') {
        valor = input.value === 'true';
      } else if (input.type === 'number') {
        valor = Number(input.value);
      } else {
        valor = input.value.trim();
      }
    }
    cuerpo[input.dataset.field] = valor;
  }
  return cuerpo;
}

function bloque(titulo, contenedor) {
  const section = elemento('section', undefined, 'record-block');
  section.append(elemento('h3', titulo));
  contenedor.append(section);
  return section;
}

function metadatos(destino, pares) {
  const dl = elemento('dl', undefined, 'record-meta');
  for (const [titulo, valor] of pares) {
    const div = elemento('div');
    div.append(elemento('dt', titulo), elemento('dd', valor || 'No precisado'));
    dl.append(div);
  }
  destino.append(dl);
}

function mostrarEncabezado(datos, destino) {
  const { incidencia, version } = datos;
  destino.append(
    elemento(
      'p',
      `${codigo(incidencia.id)} · ${estado(incidencia.estado)} · ${incidencia.confidencialidad}`,
      'eyebrow'
    ),
    elemento('h2', version.titulo, 'h3')
  );
  const botones = elemento('div', undefined, 'd-flex flex-wrap gap-2 my-3');
  botones.append(accion('Volver', listar));
  if (incidencia.estado === 'borrador') {
    if (
      puede('incidencias.registrar') &&
      String(incidencia.id_registrador) === String(usuario.id)
    ) {
      botones.append(accion('Editar borrador', () => formulario(datos)));
      botones.append(
        accion(
          'Confirmar incidencia',
          async () => {
            const respuesta = await json(`incidencias/${incidencia.id}/confirmar`, 'POST', {});
            if (respuesta.acceso) {
              await abrir(incidencia.id);
            } else {
              await listar();
              aviso(
                `${codigo(incidencia.id)}` +
                  ` recibido y confirmado. Tu rol no tiene acceso posterior al contenido ` +
                  `restringido.`
              );
            }
          },
          'btn btn-primary'
        )
      );
    }
  } else if (puede('incidencias.exportar')) {
    botones.append(
      accion(
        'Descargar PDF',
        async () => {
          const blob = await (await api(`incidencias/${incidencia.id}/pdf`)).blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${codigo(incidencia.id)}.pdf`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        'btn btn-primary'
      )
    );
  }
  destino.append(botones);
  if (
    ['confirmada', 'en_seguimiento'].includes(incidencia.estado) &&
    puede('incidencias.solicitar')
  ) {
    botones.append(
      accion('Solicitar rectificación', async () => {
        await formulario(datos);
        rectificacionId = incidencia.id;
        porId('form-title').textContent = `Proponer rectificación de ${codigo(incidencia.id)}`;
        porId('save-draft').textContent = 'Enviar propuesta de rectificación';
        porId('priority').disabled = true;
        const campos = elemento('fieldset', undefined, 'mb-4');
        campos.id = 'correction-fields';
        campos.innerHTML =
          '<legend class="section-legend">Justificación de la propuesta</legend>' +
          '<label class="form-label" for="correction-reason">Motivo</label>' +
          '<textarea id="correction-reason" class="form-control mb-3" required ' +
          'maxlength="5000"></textarea>' +
          '<label class="form-label" for="correction-password">Confirma tu contraseña ' +
          'actual</label>' +
          '<input id="correction-password" type="password" ' +
          'autocomplete="current-password" class="form-control" required ' +
          'maxlength="256">' +
          '<p class="form-text">Los hechos originales se conservan. Una autoridad ' +
          'independiente evalúa la propuesta; cambiar hechos o participantes exige ' +
          'revisión formal.</p>';
        porId('incident-form').insertBefore(campos, porId('save-draft').parentElement);
      })
    );
    botones.append(
      accion('Solicitar anulación lógica', () =>
        operacionSensible(
          'Solicitar anulación lógica',
          async (datos, form) => {
            await json(`incidencias/${incidencia.id}/solicitudes`, 'POST', {
              tipo: 'anulacion',
              justificacion: datos.motivo,
              motivo_anulacion: form.elements.motivo_anulacion.value,
              id_incidencia_duplicada: form.elements.duplicada.value || undefined,
              contrasena: datos.contrasena
            });
            await abrir(incidencia.id);
            aviso('Solicitud registrada. El expediente no se elimina.');
          },
          '<label class="form-label">Motivo de anulación<select ' +
            'name="motivo_anulacion" class="form-select">' +
            '<option value="duplicado">Duplicado comprobable</option>' +
            '<option value="otro">Otro: exige revisión formal</option></select></label>' +
            '<label class="form-label">Número del expediente que se conserva, si es ' +
            'duplicado<input name="duplicada" type="number" min="1" class="form-control">' +
            '</label>'
        )
      )
    );
  }
  if (
    puede('incidencias.cerrar') &&
    ['confirmada', 'en_seguimiento', 'cerrada'].includes(incidencia.estado)
  ) {
    const accionEstado = incidencia.estado === 'cerrada' ? 'reabrir' : 'cerrar';
    botones.append(
      accion(accionEstado === 'cerrar' ? 'Cerrar expediente' : 'Reabrir expediente', () =>
        operacionSensible(
          accionEstado === 'cerrar' ? 'Conclusión y cierre del expediente' : 'Motivo de reapertura',
          async (datos) => {
            await json(`incidencias/${incidencia.id}/estado`, 'POST', {
              accion: accionEstado,
              motivo: datos.motivo,
              contrasena: datos.contrasena,
              seguimiento_revisado: datos.seguimiento_revisado
            });
            await abrir(incidencia.id);
          }
        )
      )
    );
  }
  metadatos(destino, [
    ['Categoría', categorias[version.categoria]],
    ['Tipo', version.tipo],
    ['Fecha del hecho', fecha(version.ocurrida_en)],
    ['Lugar', version.lugar],
    ['Prioridad', incidencia.prioridad],
    ['Registrador', `${incidencia.nombre_registrador} · ${incidencia.cargo_registrador}`],
    ['Reportante', `${version.nombre_reportante} · ${version.condicion_reportante}`],
    ['Registro', fecha(incidencia.registrada_en)]
  ]);
}

function mostrarHechos(datos, destino) {
  const { version, involucrados } = datos;
  const personas = bloque('Personas involucradas', destino);
  for (const persona of involucrados) {
    let contexto = ' · Sin matrícula relacionada';
    if (persona.nivel) {
      contexto = ` · ${persona.nivel} · ${persona.grado}.º ${persona.seccion}`;
    }
    personas.append(elemento('p', `${persona.nombre} · ${persona.participacion}${contexto}`));
  }
  if (!involucrados.length) {
    personas.append(elemento('p', 'Sin personas involucradas identificadas.'));
  }
  bloque('Descripción de los hechos', destino).append(
    elemento('p', version.descripcion, 'record-text')
  );
  const especificos = bloque('Datos de la categoría', destino);
  for (const [campo, etiqueta, tipo] of campos[version.categoria]) {
    if (version[campo] !== null) {
      let valor = version[campo];
      if (tipo === 'booleano') {
        valor = valor ? 'Sí' : 'No';
      }
      especificos.append(elemento('p', `${etiqueta}: ${valor}`));
    }
  }
}

function mostrarSeguimiento(datos, destino) {
  const { incidencia, actuaciones, responsables } = datos;
  const seguimiento = bloque('Actuaciones y seguimiento', destino);
  actuaciones.forEach((actuacion) => {
    const entry = elemento('article', undefined, 'history-entry');
    let resumen = `${actuacion.autor} · ${actuacion.cargo_autor}`;
    resumen += ` · Responsable: ${actuacion.responsable || 'No asignado'}`;
    if (actuacion.fecha_limite) {
      resumen += ` · Plazo: ${fechaCivil(actuacion.fecha_limite)}`;
    }
    if (actuacion.id_actuacion_corregida) {
      resumen += ' · Corrige una actuación anterior';
    }
    entry.append(
      elemento('strong', `${estado(actuacion.tipo)} · ${fecha(actuacion.realizada_en)}`),
      elemento('p', actuacion.detalle, 'record-text'),
      elemento('small', resumen, 'text-secondary')
    );
    seguimiento.append(entry);
  });
  if (
    puede('incidencias.seguimiento') &&
    ['confirmada', 'en_seguimiento'].includes(incidencia.estado)
  ) {
    const form = elemento('form', undefined, 'row g-3 mt-2');
    form.innerHTML =
      '\n      <h4 class="h6">Agregar seguimiento</h4><div class="col-md-4">' +
      '<label class="form-label">Tipo<select name="tipo" class="form-select">' +
      '<option value="actuacion">Actuación</option>' +
      '<option value="observacion">Observación</option></select></label>' +
      '</div>\n      <div class="col-md-4">' +
      '<label class="form-label">Responsable<select name="responsable" ' +
      'class="form-select" required></select></label>' +
      '</div>\n      <div class="col-md-4">' +
      '<label class="form-label">Plazo, si corresponde<input name="plazo" ' +
      'class="form-control" type="date"></label></div>\n      <div class="col-12">' +
      '<label class="form-label d-block">Detalle<textarea name="detalle" ' +
      'class="form-control" required maxlength="10000" rows="3"></textarea></label>' +
      '</div>\n      <div class="col-12">' +
      '<label class="form-label">Corrección de una actuación, si ' +
      'corresponde<select name="correccion" class="form-select"></select></label>' +
      '</div>\n      <div class="col-12">' +
      '<button class="btn btn-primary">Agregar actuación</button></div>\n      ';
    opciones(
      form.elements.responsable,
      responsables,
      (r) => r.id,
      (r) => r.nombre,
      usuario.id
    );
    const grupoReserva = elemento('div', undefined, 'col-12');
    const etiquetaReserva = elemento(
      'label',
      '¿El seguimiento contiene información sensible?',
      'form-label d-block'
    );
    const reserva = elemento('select', undefined, 'form-select');
    reserva.name = 'contenido_sensible';
    reserva.required = true;
    opciones(
      reserva,
      ['true', 'false'],
      (version) => version,
      (version) => (version === 'true' ? 'Sí, proteger el expediente completo' : 'No')
    );
    reserva.addEventListener('change', () =>
      opciones(
        form.elements.responsable,
        reserva.value === 'true'
          ? responsables.filter((r) => ['director', 'subdirector'].includes(r.rol))
          : responsables,
        (r) => r.id,
        (r) => r.nombre
      )
    );
    etiquetaReserva.append(reserva);
    grupoReserva.append(etiquetaReserva);
    form.insertBefore(grupoReserva, form.lastElementChild);
    opciones(
      form.elements.correccion,
      actuaciones,
      (actuacion) => actuacion.id,
      (actuacion) => `${fecha(actuacion.registrada_en)} · ${actuacion.detalle.slice(0, 80)}`
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const boton = form.querySelector('button');
      boton.disabled = true;
      try {
        const respuesta = await json(`incidencias/${incidencia.id}/actuaciones`, 'POST', {
          tipo: form.elements.tipo.value,
          detalle: form.elements.detalle.value,
          id_responsable: form.elements.responsable.value,
          fecha_limite: form.elements.plazo.value || null,
          id_actuacion_corregida: form.elements.correccion.value || null,
          contenido_sensible: reserva.value === 'true'
        });
        if (respuesta.acceso) {
          await abrir(incidencia.id);
        } else {
          await listar();
          aviso(
            `Actuación recibida en ${codigo(incidencia.id)}` +
              `. El expediente quedó restringido y tu rol no tiene acceso posterior.`
          );
        }
      } catch (error) {
        aviso(error.message, true);
        boton.disabled = false;
      }
    });
    seguimiento.append(form);
  }
}

function mostrarDocumentos(datos, destino) {
  if (datos.solicitudes.length) {
    const seccion = bloque('Solicitudes conservadas', destino);
    for (const solicitud of datos.solicitudes) {
      seccion.append(
        elemento(
          'p',
          `${estado(solicitud.tipo)} · ${estado(solicitud.estado)} · ${solicitud.justificacion}`
        )
      );
      seccion.append(elemento('p', solicitud.fundamento_decision || 'Decisión pendiente.'));
      if (solicitud.id_version_propuesta) {
        seccion.append(
          elemento(
            'p',
            `Propuesta: ${solicitud.titulo_propuesto} · ` +
              `${solicitud.lugar_propuesto || 'Lugar no precisado'} · ` +
              `${solicitud.descripcion_propuesta}`,
            'record-text'
          )
        );
      }
      if (solicitud.estado === 'pendiente') {
        const ruta = `incidencias/${datos.incidencia.id}/solicitudes/${solicitud.id}`;
        if (
          puede('incidencias.solicitar') &&
          String(solicitud.id_solicitante) === String(usuario.id)
        ) {
          seccion.append(
            accion('Retirar solicitud', () =>
              operacionSensible('Retirar solicitud conservando su evidencia', async (dato) => {
                await json(`${ruta}/retirar`, 'POST', {
                  motivo: dato.motivo,
                  contrasena: dato.contrasena
                });
                await abrir(datos.incidencia.id);
              })
            )
          );
        }
        if (
          puede('incidencias.resolver') &&
          String(solicitud.id_solicitante) !== String(usuario.id)
        ) {
          seccion.append(
            accion('Evaluar revisión necesaria', () =>
              operacionSensible(
                'Evaluación independiente',
                async (dato, form) => {
                  await json(`${ruta}/evaluar`, 'POST', {
                    requiere_revision: form.elements.revision.value === 'true',
                    fundamento: dato.motivo,
                    sin_conflicto: dato.sin_conflicto,
                    contrasena: dato.contrasena
                  });
                  await abrir(datos.incidencia.id);
                },
                '<label class="form-label">Revisión necesaria<select name="revision" ' +
                  'class="form-select"><option value="true">Formal con acta</option>' +
                  '<option value="false">Documental: error material o duplicado ' +
                  'comprobado</option></select></label>'
              )
            )
          );
          if (solicitud.id_evaluador) {
            for (const decision of ['aprobar', 'rechazar']) {
              seccion.append(
                accion(decision === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud', () =>
                  operacionSensible('Decisión independiente: ' + decision, async (dato) => {
                    await json(`${ruta}/decidir`, 'POST', {
                      decision,
                      fundamento: dato.motivo,
                      sin_conflicto: dato.sin_conflicto,
                      contrasena: dato.contrasena
                    });
                    await abrir(datos.incidencia.id);
                  })
                )
              );
            }
          }
        }
      }
    }
    seccion.append(
      elemento(
        'small',
        'Las propuestas y decisiones se conservan. La aprobación de cambios que ' +
          'exigen acta sigue bloqueada mientras no se definan composición y quórum ' +
          'institucional.',
        'text-secondary'
      )
    );
  }
  if (datos.versiones.length > 1) {
    const seccion = bloque('Versiones conservadas', destino);
    for (const version of datos.versiones) {
      const contenido = elemento('details');
      contenido.append(
        elemento('summary', 'Versión ' + version.numero_version + ' → ' + version.estado_version)
      );
      contenido.append(elemento('p', version.descripcion, 'record-text'));
      seccion.append(contenido);
    }
  }
}

function operacionSensible(titulo, tarea, extras = '') {
  porId('sensitive-operation')?.remove();
  const form = elemento('form', undefined, 'record-block');
  form.id = 'sensitive-operation';
  form.append(elemento('h3', titulo));
  const campos = elemento('div');
  campos.innerHTML =
    `${extras}` +
    '<label class="form-label d-block">Motivo o fundamento<textarea ' +
    'name="motivo" class="form-control" maxlength="500" required></textarea>' +
    '</label>' +
    '<label class="form-label d-block">Contraseña actual<input name="contrasena" ' +
    'type="password" autocomplete="current-password" class="form-control" ' +
    'maxlength="256" required></label>' +
    '<label class="form-check-label d-block my-3">' +
    '<input name="independencia" type="checkbox" required> Declaro no tener ' +
    'conflicto y haber revisado el expediente, actuaciones y plazos ' +
    'pendientes.</label>' +
    '<button class="btn btn-primary">Confirmar operación</button>';
  form.append(campos);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('button');
    boton.disabled = true;
    const datos = {
      motivo: form.elements.motivo.value,
      contrasena: form.elements.contrasena.value,
      sin_conflicto: form.elements.independencia.checked,
      seguimiento_revisado: form.elements.independencia.checked
    };
    try {
      await tarea(datos, form);
    } catch (error) {
      aviso(error.message, true);
    } finally {
      form.elements.contrasena.value = '';
      boton.disabled = false;
    }
  });
  porId('detail-content').append(form);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mostrarHistorial(historial, destino) {
  const seccion = bloque('Historial del expediente', destino);
  for (const evento of historial) {
    const descripcion =
      `${fecha(evento.ocurrido_en)} · ${evento.actor} · ` +
      `${estado(evento.accion.replace(/^demo_/, ''))}`;
    const entrada = elemento('p', descripcion, 'small history-entry');
    if (evento.campo && evento.campo !== 'escenario') {
      entrada.append(
        elemento(
          'span',
          ` · ${evento.campo}: ${evento.valor_anterior ?? 'sin valor'} → ` +
            `${evento.valor_nuevo ?? 'sin valor'}`
        )
      );
    }
    seccion.append(entrada);
  }
}

async function abrir(id) {
  detalleActual = await json('incidencias/' + id);
  mostrar('detail-view');
  const destino = porId('detail-content');
  destino.replaceChildren();
  mostrarEncabezado(detalleActual, destino);
  mostrarHechos(detalleActual, destino);
  mostrarSeguimiento(detalleActual, destino);
  mostrarDocumentos(detalleActual, destino);
  mostrarHistorial(detalleActual.historial, destino);
}

function campoCuenta(nombre, etiqueta, filas, valor, mostrar) {
  const grupo = elemento('div', undefined, 'col-md-6');
  const label = elemento('label', etiqueta, 'form-label');
  const input = elemento(
    filas ? 'select' : 'input',
    undefined,
    filas ? 'form-select' : 'form-control'
  );
  input.name = nombre;
  input.required = true;
  if (filas) {
    opciones(input, filas, valor || ((f) => f.id), mostrar || ((f) => f.nombre));
  }
  label.append(input);
  grupo.append(label);
  porId('authorization-fields').append(grupo);
  return input;
}

function camposAutorizacion() {
  limpiarAviso();
  porId('authorization-fields').replaceChildren();
  const tipo = porId('account-action').value;
  if (tipo === 'crear_cuenta') {
    campoCuenta('id_persona', 'Personal sin cuenta', cuentaCatalogo.personas);
  }
  if (
    [
      'editar_cuenta',
      'activar_cuenta',
      'desactivar_cuenta',
      'restablecer_clave',
      'cambiar_rol'
    ].includes(tipo)
  ) {
    campoCuenta(
      'id_usuario_objetivo',
      'Cuenta objetivo',
      cuentaCatalogo.usuarios.filter((u) => String(u.id) !== String(usuario.id))
    );
  }
  if (['crear_cuenta', 'cambiar_rol', 'asignar_permiso', 'retirar_permiso'].includes(tipo)) {
    campoCuenta('id_rol_objetivo', 'Rol', cuentaCatalogo.roles);
  }
  if (['asignar_permiso', 'retirar_permiso'].includes(tipo)) {
    campoCuenta(
      'id_permiso',
      'Permiso',
      cuentaCatalogo.permisos,
      (p) => p.id,
      (p) => nombresPermisos[p.codigo] || p.codigo
    );
  }
  if (['crear_cuenta', 'editar_cuenta'].includes(tipo)) {
    const input = campoCuenta('nombre_usuario', 'Nombre de usuario');
    input.minLength = 3;
    input.maxLength = 60;
    input.pattern = '[a-zA-Z0-9._\\-]{3,60}';
  }
  actualizarModoCuenta();
}

function operacionDirecta() {
  if (!puede('cuentas.administrar')) {
    return false;
  }
  const formulario = porId('authorization-form');
  const tipo = porId('account-action').value;
  const cuenta = cuentaCatalogo.usuarios.find(
    (c) => String(c.id) === formulario.elements.id_usuario_objetivo?.value
  );
  const rol = cuentaCatalogo.roles.find(
    (r) => String(r.id) === formulario.elements.id_rol_objetivo?.value
  );
  const cargo = tipo === 'crear_cuenta' ? rol?.codigo : cuenta?.rol;
  return (
    ['crear_cuenta', 'editar_cuenta'].includes(tipo) &&
    cargo &&
    !['director', 'subdirector', 'administrador'].includes(cargo)
  );
}

function actualizarModoCuenta() {
  const directa = operacionDirecta();
  const crear = porId('account-action').value === 'crear_cuenta';
  porId('initial-password-group').hidden = !(directa && crear);
  porId('initial-password').required = Boolean(directa && crear);
  if (!directa || !crear) {
    porId('initial-password').value = '';
  }
  porId('submit-account-change').textContent = directa ? 'Guardar cambio' : 'Enviar solicitud';
  let mensaje =
    'Se enviarán los valores exactos para aprobación independiente. El cambio aún no se aplicará.';
  if (crear) {
    mensaje =
      'La cuenta se crea inactiva para personal existente. ' +
      'Su activación se solicita y aprueba por separado. ' +
      'Los roles de autoridad requieren autorización.';
  } else if (directa) {
    mensaje =
      'La edición básica solo cambia el nombre de usuario y queda registrada en el historial.';
  }
  porId('account-mode').textContent = mensaje;
}

function prepararCuenta(tipo, cuenta) {
  porId('account-error').hidden = true;
  limpiarAviso();
  porId('authorization-form').reset();
  porId('account-action').value = tipo;
  camposAutorizacion();
  if (cuenta) {
    porId('authorization-form').elements.id_usuario_objetivo.value = String(cuenta.id);
    if (tipo === 'editar_cuenta') {
      porId('authorization-form').elements.nombre_usuario.value = cuenta.nombre_usuario;
    }
  }
  actualizarModoCuenta();
  porId('authorization-form').hidden = false;
  porId('authorization-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function verHistorialCuenta(cuenta) {
  const { historial } = await json(`cuentas/${cuenta.id}/historial`);
  porId('account-history-title').textContent = `Historial de ${cuenta.nombre}`;
  porId('account-history-rows').replaceChildren();
  for (const evento of historial) {
    const entrada = elemento('article', undefined, 'history-entry');
    entrada.append(
      elemento('strong', estado(evento.accion)),
      elemento('p', evento.motivo || 'Acceso institucional.', 'mb-1'),
      elemento('small', `${evento.actor || 'Sistema'} · ${fecha(evento.ocurrido_en)}`)
    );
    porId('account-history-rows').append(entrada);
  }
  if (!historial.length) {
    porId('account-history-rows').textContent = 'No hay movimientos registrados para esta cuenta.';
  }
  porId('account-history').hidden = false;
  porId('account-history').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function mostrarCuentas() {
  porId('account-rows').replaceChildren();
  for (const cuenta of cuentaCatalogo.usuarios) {
    const fila = elemento('tr');
    const valores = [
      cuenta.nombre,
      cuenta.nombre_usuario,
      cargos[cuenta.rol],
      cuenta.activo ? 'Activo' : 'Inactivo'
    ];
    valores.forEach((valor, indice) => {
      const celda = elemento('td');
      celda.dataset.label = ['Nombre', 'Usuario', 'Rol', 'Estado'][indice];
      if (indice === 3) {
        celda.append(
          elemento(
            'span',
            valor,
            `status-label account-status ${cuenta.activo ? 'account-active' : 'account-inactive'}`
          )
        );
      } else {
        celda.textContent = valor;
      }
      fila.append(celda);
    });
    const celdaAcciones = elemento('td');
    celdaAcciones.dataset.label = 'Acciones';
    const botones = elemento('div', undefined, 'account-actions');
    if (String(cuenta.id) === String(usuario.id)) {
      botones.append(
        elemento('span', 'Tu cuenta: los cambios propios están bloqueados.', 'small text-secondary')
      );
    } else if (puede('cuentas.solicitar')) {
      for (const [etiqueta, tipo] of [
        ['Editar', 'editar_cuenta'],
        [
          cuenta.activo ? 'Desactivar' : 'Activar',
          cuenta.activo ? 'desactivar_cuenta' : 'activar_cuenta'
        ],
        ['Restablecer clave', 'restablecer_clave'],
        ['Cambiar rol', 'cambiar_rol']
      ]) {
        botones.append(accion(etiqueta, () => prepararCuenta(tipo, cuenta)));
      }
    }
    botones.append(accion('Historial', () => verHistorialCuenta(cuenta)));
    celdaAcciones.append(botones);
    fila.append(celdaAcciones);
    porId('account-rows').append(fila);
  }
}

function tarjetaAutorizacion(autorizacion, resumen) {
  const tarjeta = elemento('article', undefined, 'authorization-card');
  tarjeta.dataset.solicitud = autorizacion.id;
  tarjeta.append(elemento('p', autorizacion.codigo, 'small text-secondary mb-1'));
  const nombreAccion =
    [...porId('account-action').options].find((opcion) => opcion.value === autorizacion.tipo)
      ?.textContent || estado(autorizacion.tipo);
  tarjeta.append(elemento('h4', nombreAccion, 'authorization-title'));
  tarjeta.append(elemento('p', autorizacion.motivo, 'authorization-reason'));
  const datosAfectados = elemento('div', undefined, 'authorization-target');
  datosAfectados.append(
    elemento('span', 'Cuenta o permiso afectado', 'small text-secondary d-block mb-1'),
    elemento('p', resumen, 'mb-0')
  );
  tarjeta.append(datosAfectados);
  const metadatos = elemento('dl', undefined, 'authorization-meta');
  const estados = {
    pendiente: 'Pendiente',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    desacuerdo: 'Revisión por desacuerdo',
    vencida: 'Vencida',
    ejecutada: 'Ejecutada'
  };
  const estadoAutorizacion = estados[autorizacion.estado] || estado(autorizacion.estado);
  const datos = [
    ['Solicitante', autorizacion.solicitante || autorizacion.autorizante],
    ['Registrada el', fecha(autorizacion.solicitada_en || autorizacion.autorizada_en)],
    ['Estado', estadoAutorizacion],
    [
      autorizacion.ejecutada_en ? 'Ejecutada el' : 'Vence el',
      fecha(autorizacion.ejecutada_en || autorizacion.vence_en)
    ]
  ];
  if (autorizacion.ejecutor) {
    datos.push(['Ejecutor', autorizacion.ejecutor]);
  }
  for (const [etiqueta, valor] of datos) {
    const grupo = elemento('div');
    grupo.append(elemento('dt', etiqueta), elemento('dd', valor));
    metadatos.append(grupo);
  }
  tarjeta.append(metadatos);
  const decisiones = elemento('div', undefined, 'authorization-decisions');
  for (const cargo of ['director', 'subdirector']) {
    if (autorizacion[`decision_${cargo}`]) {
      decisiones.append(
        elemento(
          'p',
          `${cargos[cargo]} · ${autorizacion[`decisor_${cargo}`]} · ` +
            `${autorizacion[`decision_${cargo}`] === 'aprobar' ? 'Aprobó' : 'Rechazó'} · ` +
            `${fecha(autorizacion[`decidida_${cargo}_en`])}: ` +
            `${autorizacion[`fundamento_${cargo}`]}`
        )
      );
    }
  }
  if (autorizacion.estado === 'desacuerdo') {
    decisiones.append(
      elemento(
        'p',
        'Ejecución bloqueada. Se requiere una resolución institucional documentada; ' +
          'este sistema no permite resolverla unilateralmente.'
      )
    );
  }
  if (autorizacion.estado === 'pendiente') {
    let mensaje = 'La primera decisión válida del Director o Subdirector resuelve la solicitud.';
    if (autorizacion.revision_doble) {
      mensaje = 'Requiere decisiones independientes del Director y Subdirector.';
    } else if (autorizacion.rol_solicitante === 'director') {
      mensaje = 'Requiere decisión del Subdirector.';
    } else if (autorizacion.rol_solicitante === 'subdirector') {
      mensaje = 'Requiere decisión del Director.';
    }
    decisiones.append(elemento('p', mensaje));
  }
  if (decisiones.children.length) {
    tarjeta.append(decisiones);
  }
  return tarjeta;
}

async function cuentas() {
  let pendientes;
  [cuentaCatalogo, { autorizaciones, pendientes }] = await Promise.all([
    json('cuentas/catalogos'),
    json('cuentas/autorizaciones')
  ]);
  mostrar('accounts-view');
  mostrarCuentas();
  mostrarPendientes(pendientes);
  porId('create-account').hidden = !puede('cuentas.solicitar');
  porId('request-account-change').hidden = !puede('cuentas.solicitar');
  porId('authorization-form').hidden = true;
  porId('decision-form').hidden = true;
  porId('account-history').hidden = true;
  porId('initial-password').value = '';
  porId('decision-password').value = '';
  camposAutorizacion();
  porId('execution-form').hidden = true;
  mostrarAutorizaciones();
}

function mostrarPendientes(cantidad) {
  porId('pending-accounts').textContent = cantidad;
  porId('nav-pending').textContent = `Pendientes: ${cantidad}`;
}

function mostrarAutorizaciones() {
  porId('authorization-list').replaceChildren();
  const pendientes = elemento('section');
  pendientes.id = 'pending-authorization-list';
  pendientes.append(elemento('h4', 'Solicitudes pendientes', 'h5'));
  const registradas = elemento('section', undefined, 'mt-4');
  registradas.append(elemento('h4', 'Otras solicitudes y autorizaciones registradas', 'h5'));
  porId('authorization-list').append(pendientes, registradas);
  if (!autorizaciones.some((a) => a.pendiente_para_usuario)) {
    pendientes.append(elemento('p', 'No tienes solicitudes pendientes.', 'text-secondary'));
  }
  for (const a of autorizaciones) {
    const rol = cuentaCatalogo.roles.find((r) => String(r.id) === String(a.id_rol_objetivo));
    const permiso = cuentaCatalogo.permisos.find((p) => String(p.id) === String(a.id_permiso));
    const objetivo = cuentaCatalogo.usuarios.find(
      (u) =>
        String(u.id) === String(a.id_usuario_objetivo) ||
        String(u.id_persona) === String(a.id_persona)
    );
    const persona = cuentaCatalogo.personas.find((p) => String(p.id) === String(a.id_persona));
    let estadoCuenta = null;
    if (a.activo !== null) {
      estadoCuenta = a.activo ? 'Cuenta activa' : 'Cuenta inactiva';
    }
    const resumen = [
      objetivo?.nombre || persona?.nombre,
      a.nombre_usuario,
      rol?.nombre,
      permiso ? nombresPermisos[permiso.codigo] || permiso.codigo : null,
      estadoCuenta
    ]
      .filter(Boolean)
      .join(' · ');
    const item = tarjetaAutorizacion(a, resumen);
    if (a.puede_decidir) {
      for (const [etiqueta, decision] of [
        ['Aprobar', 'aprobar'],
        ['Rechazar', 'rechazar']
      ]) {
        item.append(
          accion(
            etiqueta,
            () => {
              limpiarAviso();
              decisionActual = { id: a.id, decision };
              porId('decision-form').reset();
              porId('decision-form').hidden = false;
              porId('submit-decision').textContent = etiqueta;
              porId('submit-decision').className =
                `btn ${decision === 'aprobar' ? 'btn-success' : 'btn-danger'}`;
              porId('decision-summary').textContent =
                `${etiqueta}: ${estado(a.tipo)} · ${resumen} · ${a.motivo}`;
              porId('decision-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
            },
            `btn btn-sm ${decision === 'aprobar' ? 'btn-success' : 'btn-danger'}`
          )
        );
      }
    }
    if (a.puede_ejecutar) {
      item.append(
        accion('Seleccionar para ejecutar', () => {
          ejecucion = a;
          porId('execution-form').hidden = false;
          porId('execution-summary').textContent = `${estado(a.tipo)} · ${resumen} · ${a.motivo}`;
          const necesita = ['crear_cuenta', 'restablecer_clave'].includes(a.tipo);
          porId('execution-password-group').hidden = !necesita;
          porId('new-password').required = necesita;
          porId('new-password').value = '';
          porId('execution-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
      );
    }
    (a.pendiente_para_usuario ? pendientes : registradas).append(item);
  }
}

async function actualizarSolicitudes() {
  if (
    !usuario ||
    redirigiendo ||
    !puede('cuentas.consultar') ||
    actualizandoSolicitudes ||
    document.hidden
  ) {
    return;
  }
  actualizandoSolicitudes = true;
  try {
    const respuesta = await json('cuentas/autorizaciones');
    if (redirigiendo) {
      return;
    }
    autorizaciones = respuesta.autorizaciones;
    mostrarPendientes(respuesta.pendientes);

    if (!porId('accounts-view').hidden && cuentaCatalogo) {
      mostrarAutorizaciones();
    }
  } catch (error) {
    porId('nav-pending').textContent = 'Pendientes: sin actualizar';
    aviso(error.message, true);
  } finally {
    actualizandoSolicitudes = false;
  }
}

porId('place').addEventListener('change', actualizarLugar);
porId('place-other').addEventListener('input', actualizarLugar);
porId('category').addEventListener('change', () => {
  tipos();
  camposCategoria();
});
porId('incident-type').addEventListener('change', minimo);
porId('reporter').addEventListener('change', () => condicion());
porId('add-person').addEventListener('click', () => involucrado());
porId('account-action').addEventListener('change', camposAutorizacion);

porId('incident-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (porId('save-draft').disabled) {
    return;
  }
  porId('save-draft').disabled = true;
  try {
    if (rectificacionId) {
      const resultado = await json(`incidencias/${rectificacionId}/solicitudes`, 'POST', {
        tipo: 'rectificacion',
        justificacion: porId('correction-reason').value,
        contrasena: porId('correction-password').value,
        propuesta: contenidoFormulario()
      });
      if (resultado.acceso) {
        await abrir(rectificacionId);
        aviso(
          'Propuesta presentada; los hechos originales permanecen vigentes hasta una ' +
            'decisión independiente.'
        );
      } else {
        await listar();
        aviso(
          `Propuesta recibida en ${codigo(rectificacionId)}` +
            `. El expediente quedó reservado; tu rol no tiene acceso posterior.`
        );
      }
    } else {
      const cuerpo = contenidoFormulario();
      const contenido = JSON.stringify(cuerpo);
      if (!registroEnviado || registroEnviado.contenido !== contenido) {
        registroEnviado = { contenido, clave: crypto.randomUUID() };
      }
      const resultado = await json(
        borradorId ? `incidencias/${borradorId}/borrador` : 'incidencias',
        borradorId ? 'PUT' : 'POST',
        cuerpo,
        borradorId ? {} : { 'X-SICE-Operation': registroEnviado.clave }
      );
      await abrir(borradorId || resultado.id);
      aviso('Borrador guardado. Revisa los datos antes de confirmar.');
    }
  } catch (error) {
    aviso(error.message, true);
  } finally {
    if (porId('correction-password')) {
      porId('correction-password').value = '';
    }
    porId('save-draft').disabled = false;
  }
});

porId('nav-student').addEventListener('click', async () => {
  try {
    porId('student-form').reset();
    opciones(
      porId('student-classroom'),
      await json('estudiantes/aulas'),
      (a) => a.id,
      (a) => `${a.anio_lectivo} · ${a.nivel} · ${a.grado}.º ${a.seccion}`
    );
    mostrar('student-view');
  } catch (error) {
    aviso(error.message, true);
  }
});

porId('student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const boton = form.querySelector('button');
  if (boton.disabled) {
    return;
  }
  validarNombresEstudiante();
  if (!form.reportValidity()) {
    return;
  }
  boton.disabled = true;
  try {
    const resultado = await json('estudiantes', 'POST', Object.fromEntries(new FormData(form)));
    form.reset();
    aviso(`Estudiante ${resultado.codigo_estudiante} y matrícula registrados.`);
  } catch (error) {
    aviso(error.message, true);
  } finally {
    porId('student-password').value = '';
    boton.disabled = false;
  }
});

function validarNombresEstudiante() {
  return ['student-names', 'student-surnames']
    .map((id) => {
      const input = porId(id);
      const nombre = input.value.trim().normalize('NFC').replace(/\s+/g, ' ');
      const valido = /^\p{L}[\p{L}\p{M}]*(?:[ '’ʼ-]\p{L}[\p{L}\p{M}]*)*$/u.test(nombre);
      input.setCustomValidity(
        valido ? '' : 'Usa letras, espacios, apóstrofes o guiones entre nombres.'
      );
      return valido;
    })
    .every(Boolean);
}
for (const id of ['student-names', 'student-surnames']) {
  porId(id).addEventListener('input', validarNombresEstudiante);
}
porId('authorization-fields').addEventListener('change', actualizarModoCuenta);
porId('authorization-form').addEventListener('input', limpiarAviso);
porId('authorization-form').addEventListener('change', limpiarAviso);
porId('create-account').addEventListener('click', () => prepararCuenta('crear_cuenta'));
porId('request-account-change').addEventListener('click', () =>
  prepararCuenta('restablecer_clave')
);
porId('cancel-account-change').addEventListener('click', () => {
  porId('authorization-form').hidden = true;
  porId('initial-password').value = '';
});
porId('refresh-accounts').addEventListener('click', async () => {
  try {
    await cuentas();
  } catch (error) {
    aviso(error.message, true);
  }
});
porId('authorization-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const boton = porId('submit-account-change');
  if (boton.disabled || !confirm('¿Confirmas esta operación y los valores indicados?')) {
    return;
  }
  limpiarAviso();
  boton.disabled = true;
  porId('account-error').hidden = true;
  const datos = {
    tipo: porId('account-action').value,
    motivo: porId('authorization-reason').value
  };
  for (const input of porId('authorization-fields').querySelectorAll('[name]')) {
    datos[input.name] = input.value;
  }
  const directa = operacionDirecta();
  if (directa && datos.tipo === 'crear_cuenta') {
    datos.contrasena = porId('initial-password').value;
  }
  let confirmacion;
  try {
    const resultado = await json(
      directa ? 'cuentas/directas' : 'cuentas/autorizaciones',
      'POST',
      datos
    );
    confirmacion = directa
      ? 'Cambio guardado y registrado en el historial.'
      : `${resultado.existente ? 'La solicitud ya estaba registrada' : 'Solicitud registrada'}` +
        `: ${resultado.codigo}. Requiere una decisión independiente antes de ejecutarse.`;
    await cuentas();
    aviso(confirmacion);
  } catch (error) {
    if (confirmacion) {
      aviso(`${confirmacion} No se pudo actualizar el panel: ${error.message}`, true);
    } else {
      porId('account-error').textContent =
        `${directa ? 'Cambio no guardado' : 'Solicitud no registrada'}: ${error.message}`;
      porId('account-error').hidden = false;
    }
  } finally {
    porId('initial-password').value = '';
    boton.disabled = false;
  }
});
porId('decision-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const boton = porId('submit-decision');
  if (boton.disabled || !confirm('¿Confirmas esta decisión institucional?')) {
    return;
  }
  limpiarAviso();
  boton.disabled = true;
  try {
    await json(`cuentas/autorizaciones/${decisionActual.id}/decidir`, 'POST', {
      decision: decisionActual.decision,
      fundamento: porId('decision-reason').value,
      contrasena: porId('decision-password').value,
      sin_conflicto: porId('decision-independent').checked
    });
    await cuentas();
    aviso('Decisión registrada. Revisa el estado resultante de la solicitud.');
  } catch (error) {
    aviso(error.message, true);
  } finally {
    porId('decision-password').value = '';
    boton.disabled = false;
  }
});
porId('execution-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const boton = event.target.querySelector('button');
  if (boton.disabled || !confirm('¿Confirmas la ejecución de los valores aprobados?')) {
    return;
  }
  limpiarAviso();
  boton.disabled = true;
  try {
    await json(
      `cuentas/autorizaciones/${ejecucion.id}/ejecutar`,
      'POST',
      porId('new-password').required ? { contrasena: porId('new-password').value } : {}
    );
    await cuentas();
    aviso('Cambio autorizado ejecutado y auditado.');
  } catch (error) {
    aviso(error.message, true);
  } finally {
    porId('new-password').value = '';
    boton.disabled = false;
  }
});
porId('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  filtrosActuales = {
    buscar: porId('search').value.trim(),
    categoria: porId('search-category').value,
    estado: porId('search-state').value
  };
  try {
    await listar(1);
  } catch (error) {
    aviso(error.message, true);
  }
});
for (const id of ['search-category', 'search-state']) {
  porId(id).addEventListener('change', () => porId('search-form').requestSubmit());
}
porId('search').addEventListener('search', () => porId('search-form').requestSubmit());
opciones(
  porId('search-category'),
  Object.keys(categorias),
  (valor) => valor,
  (valor) => categorias[valor]
);
opciones(
  porId('search-state'),
  ['borrador', 'confirmada', 'en_seguimiento', 'cerrada', 'anulada'],
  (valor) => valor,
  estado
);
porId('search-category').options[0].textContent = 'Todas';
porId('search-state').options[0].textContent = 'Todos';
porId('next-page').addEventListener('click', async () => {
  try {
    await listar(paginaActual + 1);
  } catch (error) {
    aviso(error.message, true);
  }
});
porId('previous-page').addEventListener('click', async () => {
  try {
    await listar(paginaActual - 1);
  } catch (error) {
    aviso(error.message, true);
  }
});
for (const [id, tarea] of [
  ['nav-list', listar],
  ['nav-new', () => formulario()],
  ['cancel-form', listar],
  ['nav-accounts', cuentas],
  [
    'logout',
    async () => {
      await api('auth/logout', 'POST', {});
      volverAlAcceso('cerrada');
    }
  ]
]) {
  porId(id).addEventListener('click', async () => {
    if (porId(id).disabled || redirigiendo) {
      return;
    }
    porId(id).disabled = true;
    try {
      await tarea();
    } catch (error) {
      aviso(error.message, true);
    } finally {
      porId(id).disabled = false;
    }
  });
}

async function iniciar() {
  redirigiendo = false;
  porId('workspace').hidden = true;
  porId('session-header').hidden = true;
  porId('panel-status').hidden = false;
  mostrar(null);
  for (const id of ['nav-list', 'nav-new', 'nav-accounts']) {
    porId(id).hidden = true;
  }
  try {
    const sesion = await json('auth/sesion');
    usuario = sesion.usuario;
    document.body.classList.toggle('admin-panel', usuario.rol === 'administrador');
    porId('user-label').textContent = `${usuario.nombre} · ${cargos[usuario.rol]}`;
    porId('session-header').hidden = false;
    const operativo = usuario.rol !== 'administrador';
    porId('nav-student').hidden = !puede('estudiantes.crear');
    porId('nav-list').hidden = !operativo || !puede('incidencias.consultar');
    porId('nav-new').hidden = !operativo || !puede('incidencias.registrar');
    porId('nav-accounts').hidden = !puede('cuentas.consultar');
    if (!porId('nav-list').hidden) {
      await listar();
    } else if (!porId('nav-accounts').hidden) {
      await cuentas();
    } else if (!porId('nav-new').hidden) {
      await formulario();
    } else {
      aviso('Tu cuenta no tiene acciones asignadas. Contacta a la autoridad autorizada.');
    }
    if (porId('accounts-view').hidden) {
      await actualizarSolicitudes();
    }
  } catch (error) {
    aviso(error.message, true);
  } finally {
    if (!redirigiendo) {
      porId('panel-status').hidden = true;
      porId('workspace').hidden = false;
    }
  }
}

window.addEventListener('pagehide', () => {
  porId('workspace').hidden = true;
  porId('session-header').hidden = true;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    iniciar();
  }
});
window.addEventListener('focus', actualizarSolicitudes);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    actualizarSolicitudes();
  }
});
iniciar();
