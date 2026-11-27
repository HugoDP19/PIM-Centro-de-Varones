import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { autorizar, reautenticar } from './autenticacion.js';
import { actorVigente } from './cuentas.js';
import { transaccion } from './database.js';
import { rechazar, validarTexto, validarIdentificador, validarNombre } from './seguridad.js';
import * as consultas from './consultas-incidencias.js';

const camposPersona = [
  'nombres',
  'apellidos',
  'tipo_documento',
  'numero_documento',
  'pais_documento',
  'telefono',
  'correo'
];
const camposIdentidad = [
  'nombres',
  'apellidos',
  'tipo_documento',
  'numero_documento',
  'pais_documento'
];
const camposMatricula = ['id_aula', 'fecha_inicio'];
const paisesDocumento = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR ' +
  'BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ ' +
  'EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW ' +
  'GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY ' +
  'KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV ' +
  'MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY ' +
  'QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG ' +
  'TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

function validarCampos(cuerpo, permitidos) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    rechazar(400, 'Envía los datos del formulario.');
  }
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => campo !== 'contrasena' && !permitidos.includes(campo)
  );
  if (desconocidos.length) {
    rechazar(400, 'El formulario contiene campos no permitidos.');
  }
}

function fechaCivil(valor) {
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10);
  }
  return String(valor).slice(0, 10);
}

function validarFecha(valor, etiqueta) {
  if (typeof valor !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(valor)) {
    rechazar(400, `${etiqueta}: indica una fecha válida.`);
  }
  if (!Number.isFinite(Date.parse(valor)) || fechaCivil(new Date(valor)) !== valor) {
    rechazar(400, `${etiqueta}: la fecha no existe.`);
  }
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (valor > hoy || valor < '1900-01-01') {
    rechazar(400, `${etiqueta}: usa una fecha desde 1900 y no posterior a hoy.`);
  }
  return valor;
}

function textoOpcional(valor, etiqueta, longitud) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  return validarTexto(valor, etiqueta, longitud);
}

function validarDocumento(cuerpo) {
  const tipo = textoOpcional(cuerpo.tipo_documento, 'tipo de documento', 20);
  const numero = textoOpcional(cuerpo.numero_documento, 'número de documento', 40)?.toUpperCase();
  const pais = textoOpcional(cuerpo.pais_documento, 'país emisor', 2)?.toUpperCase();
  if (!tipo && !numero && !pais) {
    return { tipo_documento: null, numero_documento: null, pais_documento: null };
  }
  if (!['DNI', 'CE', 'PASAPORTE'].includes(tipo)) {
    rechazar(400, 'Selecciona DNI, carnet de extranjería o pasaporte.');
  }
  if (!paisesDocumento.includes(pais) || !numero) {
    rechazar(400, 'Completa país emisor, tipo y número de documento, o deja los tres vacíos.');
  }
  if (tipo === 'DNI' && (pais !== 'PE' || !/^\d{8}$/.test(numero))) {
    rechazar(400, 'El DNI peruano debe contener ocho dígitos y país emisor PE.');
  }
  if (tipo === 'CE' && (pais !== 'PE' || !/^[A-Z0-9]{9,12}$/.test(numero))) {
    rechazar(400, 'El carnet de extranjería admite de 9 a 12 letras o números y país emisor PE.');
  }
  if (tipo === 'PASAPORTE' && !/^[A-Z0-9]{3,40}$/.test(numero)) {
    rechazar(400, 'El pasaporte admite de 3 a 40 letras o números, sin espacios ni signos.');
  }
  return { tipo_documento: tipo, numero_documento: numero, pais_documento: pais };
}

function validarPersona(cuerpo) {
  const telefono = textoOpcional(cuerpo.telefono, 'teléfono', 30);
  const correo = textoOpcional(cuerpo.correo, 'correo', 254);
  if (telefono && (!/^\+?[0-9 ()-]{6,30}$/.test(telefono) || !/\d/.test(telefono))) {
    rechazar(400, 'Revisa el teléfono: usa números y, si corresponde, prefijo internacional.');
  }
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    rechazar(400, 'Introduce un correo válido.');
  }
  return {
    nombres: validarNombre(cuerpo.nombres, 'nombres', 100),
    apellidos: validarNombre(cuerpo.apellidos, 'apellidos', 150),
    ...validarDocumento(cuerpo),
    telefono,
    correo
  };
}

function validarNacimiento(cuerpo) {
  if ([undefined, null, ''].includes(cuerpo.fecha_nacimiento)) {
    return null;
  }
  return validarFecha(cuerpo.fecha_nacimiento, 'Nacimiento');
}

function validarBusqueda(parametros) {
  if (Object.keys(parametros).some((campo) => !['buscar', 'grado', 'pagina'].includes(campo))) {
    rechazar(400, 'Filtros de búsqueda no permitidos.');
  }
  const buscar = parametros.buscar ?? '';
  const pagina = parametros.pagina ?? '1';
  const grado = parametros.grado ?? '';
  if (typeof buscar !== 'string' || buscar.length > 100) {
    rechazar(400, 'La búsqueda admite hasta 100 caracteres.');
  }
  if (typeof pagina !== 'string' || !/^[1-9]\d{0,6}$/.test(pagina)) {
    rechazar(400, 'Página no válida.');
  }
  if (typeof grado !== 'string' || (grado && !/^\d{1,3}$/.test(grado))) {
    rechazar(400, 'Grado no válido.');
  }
  return { buscar: buscar.trim(), grado, pagina: Number(pagina) };
}

async function exigirPersona(db, actor, id, estudiante = false) {
  const persona = await consultas.personaEscolar(db, actor, id);
  if (!persona || (estudiante && (!persona.codigo_estudiante || !persona.estudiante_activo))) {
    rechazar(404, 'No se encontró la persona dentro de tu acceso.');
  }
  return persona;
}

async function validarMatricula(db, cuerpo) {
  const idAula = validarIdentificador(cuerpo.id_aula);
  const fecha = validarFecha(cuerpo.fecha_inicio, 'Inicio de matrícula');
  const aula = (await consultas.aulasActivas(db)).find((fila) => String(fila.id) === idAula);
  if (!aula || Number(fecha.slice(0, 4)) !== Number(aula.anio_lectivo)) {
    rechazar(400, 'Selecciona un aula activa del año de matrícula.');
  }
  return { id_aula: idAula, fecha_inicio: fecha };
}

async function editarPersona(db, actor, anterior, persona) {
  const cambiaIdentidad = camposIdentidad.some((campo) => anterior[campo] !== persona[campo]);
  // Las identidades usadas en expedientes o cuentas no se reescriben desde este formulario.
  if (anterior.identidad_historica && cambiaIdentidad) {
    rechazar(409, 'La identidad tiene historial. Puedes editar el contacto, pero no su identidad.');
  }
  await consultas.actualizarPersonaEscolar(db, anterior.id, persona);
  const previos = Object.fromEntries(camposPersona.map((campo) => [campo, anterior[campo]]));
  await consultas.auditar(db, actor, null, 'persona_escolar_editada', {
    id_persona: anterior.id,
    valor_anterior: JSON.stringify(previos),
    valor_nuevo: JSON.stringify(persona)
  });
}

async function fichaEstudiante(db, actor, id) {
  const estudiante = await exigirPersona(db, actor, id, true);
  const matriculas = await consultas.matriculasEstudiante(db, id);
  const apoderados = await consultas.apoderadosEstudiante(db, actor, id);
  return { estudiante, matriculas, apoderados };
}

async function renovarMatricula(db, actor, id, cuerpo) {
  await exigirPersona(db, actor, id, true);
  const nueva = await validarMatricula(db, cuerpo);
  const anteriores = await consultas.matriculasEstudiante(db, id);
  if (anteriores.some((fila) => fechaCivil(fila.fecha_inicio) >= nueva.fecha_inicio)) {
    rechazar(409, 'La nueva matrícula debe empezar después de las matrículas anteriores.');
  }
  const vigentes = anteriores.filter((fila) => !fila.fecha_fin);
  if (vigentes.length > 1) {
    rechazar(409, 'Hay más de una matrícula vigente. Requiere revisión institucional.');
  }
  if (vigentes.some((fila) => String(fila.id_aula) === nueva.id_aula)) {
    rechazar(409, 'El estudiante ya tiene matrícula vigente en esa aula.');
  }
  const diaAnterior = new Date(nueva.fecha_inicio);
  diaAnterior.setUTCDate(diaAnterior.getUTCDate() - 1);
  const cierre = fechaCivil(diaAnterior);
  if (
    anteriores.some((fila) => fila.fecha_fin && fechaCivil(fila.fecha_fin) >= nueva.fecha_inicio)
  ) {
    rechazar(409, 'La fecha se superpone con una matrícula anterior.');
  }
  for (const anterior of vigentes) {
    if (await consultas.matriculaConHechosPosteriores(db, anterior.id, cierre)) {
      rechazar(409, 'El inicio dejaría hechos registrados fuera de su matrícula histórica.');
    }
    await consultas.cerrarMatricula(db, anterior.id, cierre);
    await consultas.auditar(db, actor, null, 'matricula_finalizada', {
      id_estudiante: id,
      id_matricula: anterior.id,
      campo: 'fecha_fin',
      valor_nuevo: cierre
    });
  }
  const matricula = await consultas.insertar(db, 'matriculas', { id_estudiante: id, ...nueva });
  await consultas.auditar(db, actor, null, 'matricula_creada', {
    id_estudiante: id,
    id_matricula: matricula,
    id_aula: nueva.id_aula
  });
  return { id: matricula };
}

async function asignarPrincipal(db, actor, id, idApoderado, vinculo, desde) {
  await exigirPersona(db, actor, id, true);
  const apoderado = await exigirPersona(db, actor, idApoderado);
  if (apoderado.codigo_estudiante || id === idApoderado) {
    rechazar(400, 'El apoderado debe ser una persona adulta distinta del estudiante.');
  }
  const historial = await consultas.principalEstudiante(db, id);
  const anteriores = historial.filter((fila) => !fila.vigente_hasta);
  if (anteriores.length > 1) {
    rechazar(409, 'Hay más de un principal vigente. Requiere revisión institucional.');
  }
  const anterior = anteriores[0];
  if (anterior && String(anterior.id_apoderado) === idApoderado && anterior.vinculo === vinculo) {
    if (desde !== fechaCivil(anterior.vigente_desde)) {
      rechazar(409, 'Ese apoderado ya es principal. Se conserva la fecha del vínculo vigente.');
    }
    return { id: anterior.id };
  }
  if (historial.some((fila) => fila.vigente_hasta && fechaCivil(fila.vigente_hasta) >= desde)) {
    rechazar(409, 'La fecha se superpone con un vínculo principal anterior.');
  }
  if (anterior && desde <= fechaCivil(anterior.vigente_desde)) {
    rechazar(409, 'El nuevo vínculo debe empezar después del principal anterior.');
  }
  if (anterior) {
    await exigirPersona(db, actor, anterior.id_apoderado);
    const cierre = new Date(desde);
    cierre.setUTCDate(cierre.getUTCDate() - 1);
    await consultas.cerrarVinculo(db, anterior.id, fechaCivil(cierre));
    await consultas.auditar(db, actor, null, 'apoderado_principal_finalizado', {
      id_estudiante: id,
      id_vinculo_apoderado: anterior.id,
      campo: 'vigente_hasta',
      valor_nuevo: fechaCivil(cierre)
    });
  }
  const vinculoId = await consultas.insertar(db, 'estudiantes_apoderados', {
    id_estudiante: id,
    id_apoderado: idApoderado,
    vinculo,
    es_principal: 1,
    vigente_desde: desde
  });
  await consultas.auditar(db, actor, null, 'apoderado_principal_asignado', {
    id_estudiante: id,
    id_persona: idApoderado,
    id_vinculo_apoderado: vinculoId
  });
  return { id: vinculoId };
}

export function rutasEstudiantes(pool) {
  const router = Router();
  router.use(autorizar('estudiantes.crear'));

  // Se comprueba cuenta, sesión y permiso bajo el bloqueo de gestión en cada operación.
  const operar = (req, trabajo) =>
    transaccion(pool, async (db) => {
      const actor = await actorVigente(db, req.usuario, 'estudiantes.crear', req.tokenSesion);
      return trabajo(db, actor);
    });

  router.get('/aulas', async (req, res) => {
    res.json(await operar(req, (db) => consultas.aulasActivas(db)));
  });
  router.get('/paises-documento', async (req, res) => {
    const nombres = new Intl.DisplayNames(['es'], { type: 'region' });
    const paises = paisesDocumento.map((codigo) => ({ codigo, nombre: nombres.of(codigo) }));
    paises.sort((primero, segundo) => primero.nombre.localeCompare(segundo.nombre, 'es'));
    res.json(await operar(req, () => paises));
  });
  router.get('/', async (req, res) => {
    const filtros = validarBusqueda(req.query);
    res.json(await operar(req, (db, actor) => consultas.buscarEstudiantes(db, actor, filtros)));
  });
  router.get('/apoderados', async (req, res) => {
    const { buscar, pagina } = validarBusqueda(req.query);
    res.json(
      await operar(req, (db, actor) => consultas.buscarApoderados(db, actor, buscar, pagina))
    );
  });
  router.get('/apoderados/:id', async (req, res) => {
    const id = validarIdentificador(req.params.id);
    res.json(
      await operar(req, async (db, actor) => {
        const persona = await exigirPersona(db, actor, id);
        if (persona.codigo_estudiante) {
          rechazar(400, 'Selecciona una persona adulta como apoderado.');
        }
        if (!persona.es_apoderado) {
          rechazar(409, 'Asocia primero esta persona existente como apoderado de un estudiante.');
        }
        return persona;
      })
    );
  });
  router.post('/apoderados', async (req, res) => {
    validarCampos(req.body, camposPersona);
    const persona = validarPersona(req.body);
    await reautenticar(pool, req);
    const resultado = await operar(req, async (db, actor) => {
      const id = await consultas.insertar(db, 'personas', {
        ...persona,
        codigo_interno: `AP-${randomBytes(12).toString('hex')}`,
        es_personal: 0,
        activo: 1
      });
      await consultas.auditar(db, actor, null, 'apoderado_creado', { id_persona: id });
      return { id };
    });
    res.status(201).json(resultado);
  });
  router.put('/apoderados/:id', async (req, res) => {
    validarCampos(req.body, camposPersona);
    const persona = validarPersona(req.body);
    const id = validarIdentificador(req.params.id);
    await reautenticar(pool, req);
    await operar(req, async (db, actor) => {
      const anterior = await exigirPersona(db, actor, id);
      if (anterior.codigo_estudiante) {
        rechazar(400, 'Edita al estudiante desde su ficha.');
      }
      if (!anterior.es_apoderado) {
        rechazar(409, 'Asocia primero esta persona existente como apoderado de un estudiante.');
      }
      await editarPersona(db, actor, anterior, persona);
    });
    res.json({ id });
  });
  router.get('/:id', async (req, res) => {
    const id = validarIdentificador(req.params.id);
    res.json(await operar(req, (db, actor) => fichaEstudiante(db, actor, id)));
  });
  router.post('/', async (req, res) => {
    validarCampos(req.body, [
      ...camposPersona,
      ...camposMatricula,
      'codigo_estudiante',
      'fecha_nacimiento'
    ]);
    const persona = validarPersona(req.body);
    const nacimiento = validarNacimiento(req.body);
    const codigo = validarTexto(req.body.codigo_estudiante, 'código de estudiante', 20);
    if (!/^[A-Za-z0-9-]+$/.test(codigo)) {
      rechazar(400, 'El código admite letras, números y guiones.');
    }
    await reautenticar(pool, req);
    const resultado = await operar(req, async (db, actor) => {
      const datosMatricula = await validarMatricula(db, req.body);
      if (nacimiento && nacimiento > datosMatricula.fecha_inicio) {
        rechazar(400, 'El nacimiento no puede ser posterior al inicio de matrícula.');
      }
      const id = await consultas.insertar(db, 'personas', {
        ...persona,
        codigo_interno: `EST-${codigo}`,
        es_personal: 0,
        activo: 1
      });
      await consultas.insertar(db, 'estudiantes', {
        id_persona: id,
        codigo_estudiante: codigo,
        fecha_nacimiento: nacimiento,
        activo: 1
      });
      const matricula = await consultas.insertar(db, 'matriculas', {
        id_estudiante: id,
        ...datosMatricula
      });
      await consultas.auditar(db, actor, null, 'estudiante_creado', {
        id_persona: id,
        id_estudiante: id,
        id_matricula: matricula,
        id_aula: datosMatricula.id_aula
      });
      return { id, matricula, codigo_estudiante: codigo };
    });
    res.status(201).json(resultado);
  });
  router.put('/:id', async (req, res) => {
    validarCampos(req.body, [...camposPersona, 'fecha_nacimiento']);
    const persona = validarPersona(req.body);
    const nacimiento = validarNacimiento(req.body);
    const id = validarIdentificador(req.params.id);
    await reautenticar(pool, req);
    await operar(req, async (db, actor) => {
      const anterior = await exigirPersona(db, actor, id, true);
      const nacimientoAnterior = anterior.fecha_nacimiento
        ? fechaCivil(anterior.fecha_nacimiento)
        : null;
      if (anterior.identidad_historica && nacimiento !== nacimientoAnterior) {
        rechazar(
          409,
          'El nacimiento pertenece a una identidad con historial y no puede cambiarse.'
        );
      }
      const matriculas = await consultas.matriculasEstudiante(db, id);
      if (nacimiento && matriculas.some((fila) => nacimiento > fechaCivil(fila.fecha_inicio))) {
        rechazar(400, 'El nacimiento no puede ser posterior a una matrícula existente.');
      }
      await editarPersona(db, actor, anterior, persona);
      await consultas.guardarNacimiento(db, id, nacimiento);
      await consultas.auditar(db, actor, null, 'estudiante_editado', {
        id_estudiante: id,
        campo: 'fecha_nacimiento',
        valor_anterior: anterior.fecha_nacimiento ? fechaCivil(anterior.fecha_nacimiento) : null,
        valor_nuevo: nacimiento
      });
    });
    res.json({ id });
  });
  router.post('/:id/matriculas', async (req, res) => {
    validarCampos(req.body, camposMatricula);
    const id = validarIdentificador(req.params.id);
    await reautenticar(pool, req);
    res
      .status(201)
      .json(await operar(req, (db, actor) => renovarMatricula(db, actor, id, req.body)));
  });
  router.post('/:id/apoderado-principal', async (req, res) => {
    validarCampos(req.body, ['id_apoderado', 'vinculo', 'vigente_desde']);
    const id = validarIdentificador(req.params.id);
    const idApoderado = validarIdentificador(req.body.id_apoderado);
    const vinculo = validarNombre(req.body.vinculo, 'vínculo', 30);
    const desde = validarFecha(req.body.vigente_desde, 'Inicio del vínculo');
    await reautenticar(pool, req);
    const resultado = await operar(req, (db, actor) =>
      asignarPrincipal(db, actor, id, idApoderado, vinculo, desde)
    );
    res.status(201).json(resultado);
  });
  return router;
}
