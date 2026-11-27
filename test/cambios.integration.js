import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { personalEscolar } from './datos.js';
import { resumir } from '../src/seguridad.js';
import { administrar } from '../database/administrar.js';

// Comprueba por HTTP y SELECT versiones, decisiones y estudiantes usando la base temporal de la suite.
export async function verificarCambios({ t, pool, datos, peticion, claves, cuerpo }) {
  const credencial = rol => ({ contrasena: claves[`${rol.toUpperCase()}_PASSWORD`] });
  const decision = rol => ({ ...credencial(rol), fundamento: 'Revisión independiente documentada en la prueba.', sin_conflicto: true });
  const crear = async rol => {
    const creado = await datos('incidencias', rol, 'POST', cuerpo('seguridad'), 201);
    await datos(`incidencias/${creado.id}/confirmar`, rol, 'POST', {});
    return creado.id;
  };
  let id, solicitud;
  await t.test('rectificación: propuesta inmutable, reautenticación y decisión independiente', async () => {
    id = await crear('docente');
    const anterior = await datos(`incidencias/${id}`, 'docente');
    const propuesta = { ...cuerpo('seguridad'), titulo: 'Título corregido sin cambiar los hechos' };
    assert.equal((await peticion(`incidencias/${id}/solicitudes`, 'docente', 'POST', {
      tipo: 'rectificacion', justificacion: 'Error material en el título.', propuesta, contrasena: 'incorrecta'
    })).status, 403);
    solicitud = await datos(`incidencias/${id}/solicitudes`, 'docente', 'POST', {
      tipo: 'rectificacion', justificacion: 'Error material en el título.', propuesta, ...credencial('docente')
    }, 201);
    assert.equal((await datos(`incidencias/${id}`, 'docente')).version.id, anterior.version.id);
    assert.equal((await peticion(`incidencias/${id}/solicitudes`, 'docente', 'POST', {
      tipo: 'rectificacion', justificacion: 'Reintento mientras está pendiente.', propuesta, ...credencial('docente')
    })).status, 409);
    assert.equal((await peticion(`incidencias/${id}/estado`, 'director', 'POST', {
      accion: 'cerrar', motivo: 'Cierre que debe bloquearse.', seguimiento_revisado: true, ...credencial('director')
    })).status, 409);
    await datos(`incidencias/${id}/solicitudes/${solicitud.id}/evaluar`, 'director', 'POST', { requiere_revision: false, ...decision('director') });
    await datos(`incidencias/${id}/solicitudes/${solicitud.id}/decidir`, 'subdirector', 'POST', { decision: 'aprobar', ...decision('subdirector') });
    const despues = await datos(`incidencias/${id}`, 'docente');
    assert.equal(despues.version.titulo, propuesta.titulo);
    const [[original]] = await pool.execute('SELECT * FROM versiones_incidencia WHERE id = ?', [anterior.version.id]);
    assert.equal(original.titulo, anterior.version.titulo);
    assert.equal(original.descripcion, anterior.version.descripcion);
    assert.equal(despues.versiones.length, 2);
    assert.equal((await peticion(`incidencias/${id}/solicitudes/${solicitud.id}/decidir`, 'director', 'POST', { decision: 'aprobar', ...decision('director') })).status, 409);
  });
  await t.test('cierre y reapertura: conclusión, permisos, contraseña y conservación del historial', async () => {
    assert.equal((await peticion(`incidencias/${id}/estado`, 'docente', 'POST', { accion: 'cerrar', motivo: 'No autorizado.', ...credencial('docente') })).status, 403);
    assert.equal((await peticion(`incidencias/${id}/estado`, 'administrador', 'POST', {})).status, 403);
    assert.equal((await peticion(`incidencias/${id}/estado`, 'coordinador_tutoria', 'POST', { accion: 'cerrar', motivo: 'Sin confirmar revisión.', ...credencial('coordinador_tutoria') })).status, 400);
    await datos(`incidencias/${id}/estado`, 'coordinador_tutoria', 'POST', {
      accion: 'cerrar', motivo: 'Conclusión verificada sin actuaciones pendientes.', seguimiento_revisado: true, ...credencial('coordinador_tutoria')
    });
    assert.equal((await datos(`incidencias/${id}`, 'director')).incidencia.estado, 'cerrada');
    assert.equal((await peticion(`incidencias/${id}/actuaciones`, 'docente', 'POST', { tipo: 'observacion', detalle: 'Bloqueada.', contenido_sensible: false })).status, 409);
    await datos(`incidencias/${id}/estado`, 'director', 'POST', { accion: 'reabrir', motivo: 'Se recibió información para nuevo seguimiento.', ...credencial('director') });
    const historial = (await datos(`incidencias/${id}`, 'director')).historial;
    assert.ok(historial.some(h => h.accion === 'incidencia_cerrada'));
    assert.ok(historial.some(h => h.accion === 'incidencia_reabierta'));
  });
  await t.test('revisión formal: no puede omitirse al cambiar hechos y permite retirar conservando propuesta', async () => {
    const propuesta = { ...cuerpo('seguridad'), descripcion: 'Cambio de hechos que requiere evaluación formal, sin aprobar por una revisión documental.' };
    const solicitud = await datos(`incidencias/${id}/solicitudes`, 'docente', 'POST', {
      tipo: 'rectificacion', justificacion: 'Cambio sustantivo de hechos.', propuesta, ...credencial('docente')
    }, 201);
    assert.equal((await peticion(`incidencias/${id}/solicitudes/${solicitud.id}/evaluar`, 'director', 'POST', { requiere_revision: false, ...decision('director') })).status, 409);
    await datos(`incidencias/${id}/solicitudes/${solicitud.id}/evaluar`, 'director', 'POST', { requiere_revision: true, ...decision('director') });
    assert.equal((await peticion(`incidencias/${id}/solicitudes/${solicitud.id}/decidir`, 'subdirector', 'POST', { decision: 'aprobar', ...decision('subdirector') })).status, 409);
    await datos(`incidencias/${id}/solicitudes/${solicitud.id}/retirar`, 'docente', 'POST', { motivo: 'Pendiente de procedimiento institucional.', ...credencial('docente') });
    const [[fila]] = await pool.execute('SELECT estado,id_version_propuesta FROM solicitudes_cambio WHERE id = ?', [solicitud.id]);
    assert.equal(fila.estado, 'retirada'); assert.ok(fila.id_version_propuesta);
  });
  await t.test('anulación lógica: duplicado conservado, independencia y prohibición de reapertura', async () => {
    const duplicado = await crear('director');
    const solicitud = await datos(`incidencias/${duplicado}/solicitudes`, 'director', 'POST', {
      tipo: 'anulacion', motivo_anulacion: 'duplicado', id_incidencia_duplicada: id,
      justificacion: 'Duplicación verificada en la prueba.', ...credencial('director')
    }, 201);
    assert.equal((await peticion(`incidencias/${duplicado}/solicitudes/${solicitud.id}/evaluar`, 'director', 'POST', { requiere_revision: false, ...decision('director') })).status, 403);
    await datos(`incidencias/${duplicado}/solicitudes/${solicitud.id}/evaluar`, 'subdirector', 'POST', { requiere_revision: false, ...decision('subdirector') });
    await datos(`incidencias/${duplicado}/solicitudes/${solicitud.id}/decidir`, 'subdirector', 'POST', { decision: 'aprobar', ...decision('subdirector') });
    const registro = await datos(`incidencias/${duplicado}`, 'director');
    assert.equal(registro.incidencia.estado, 'anulada'); assert.ok(registro.versiones.length);
    assert.equal((await peticion(`incidencias/${duplicado}/estado`, 'director', 'POST', { accion: 'reabrir', motivo: 'No restaurar anuladas.', ...credencial('director') })).status, 409);
    assert.equal((await datos(`incidencias/${id}`, 'director')).incidencia.estado, 'en_seguimiento');
  });
  await t.test('propuesta sensible protege también originales y no devuelve contenido al solicitante sin reserva', async () => {
    const id = await crear('docente');
    const resultado = await datos(`incidencias/${id}/solicitudes`, 'docente', 'POST', {
      tipo: 'rectificacion', justificacion: 'La propuesta contiene información reservada.',
      propuesta: { ...cuerpo('seguridad'), titulo: 'Propuesta reservada para autoridad', contenido_sensible: true }, ...credencial('docente')
    }, 201);
    assert.equal(resultado.acceso, false);
    assert.equal((await peticion(`incidencias/${id}`, 'docente')).status, 404);
    assert.equal((await datos(`incidencias/${id}`, 'director')).incidencia.confidencialidad, 'restringida');
    const [[fila]] = await pool.execute('SELECT confidencialidad FROM incidencias WHERE id = ?', [id]);
    assert.equal(fila.confidencialidad, 'restringida');
  });
  await t.test('estudiantes: roles autorizados, matrícula inmediata, auditoría y duplicados sin filas parciales', async () => {
    const [aulas] = await pool.execute('SELECT TOP (1) id,anio_lectivo FROM aulas');
    for (const rol of ['director', 'subdirector', 'coordinador_tutoria']) {
      const codigo = `PR-${rol.slice(0, 10)}`;
      const cuerpo = { nombres: 'Estudiante de prueba', apellidos: 'Navarro Flores', codigo_estudiante: codigo,
        id_aula: aulas[0].id, fecha_inicio: `${aulas[0].anio_lectivo}-03-02`, ...credencial(rol) };
      const creado = await datos('estudiantes', rol, 'POST', cuerpo, 201);
      const [[fila]] = await pool.execute('SELECT id FROM matriculas WHERE id_estudiante = ?', [creado.id]);
      assert.equal(fila.id, creado.matricula);
      assert.equal((await peticion('estudiantes', rol, 'POST', cuerpo)).status, 409);
      const [[auditoria]] = await pool.execute("SELECT COUNT(*) AS cantidad FROM historial WHERE id_estudiante = ? AND accion = 'estudiante_creado'", [creado.id]);
      assert.equal(Number(auditoria.cantidad), 1);
    }
    for (const rol of ['docente', 'auxiliar', 'administrador']) assert.equal((await peticion('estudiantes', rol, 'POST', {})).status, 403);
  });
}


// Las nuevas gestiones comparten la base aislada y la comparación completa de SICE de la suite.
export async function verificarEstudiantes({ t, pool, datos, peticion, claves, cuerpo }) {
  const prueba = (nombre, comprobar) => t.test('Gestión escolar: ' + nombre, comprobar);
  const clave = { contrasena: claves.DIRECTOR_PASSWORD };
  const aulas = await datos('estudiantes/aulas', 'director');
  const persona = { nombres: 'Álvaro José', apellidos: 'Extranjero Escolar' };
  const inicial = {
    ...persona,
    codigo_estudiante: 'GEST-01',
    id_aula: aulas[0].id,
    fecha_inicio: '2026-03-02',
    ...clave
  };
  const documento = {
    tipo_documento: 'PASAPORTE',
    numero_documento: 'ab123456',
    pais_documento: 've'
  };
  let estudiante, apoderado, segundoApoderado, incidencia, versionAnterior;

  await prueba('DNI, carnet, pasaporte y registro provisional sin DNI', async () => {
    for (const [indice, identidad] of [
      { tipo_documento: 'DNI', numero_documento: '01234567', pais_documento: 'PE' },
      { tipo_documento: 'CE', numero_documento: '001234567', pais_documento: 'PE' },
      documento,
      {}
    ].entries()) {
      const nuevo = await datos(
        'estudiantes',
        'director',
        'POST',
        {
          ...inicial,
          ...identidad,
          codigo_estudiante: `GEST-${indice + 1}`
        },
        201
      );
      const ficha = await datos(`estudiantes/${nuevo.id}`, 'director');
      assert.equal(ficha.matriculas.length, 1);
      if (indice === 2) {
        estudiante = nuevo;
        assert.equal(ficha.estudiante.numero_documento, 'AB123456');
        assert.equal(ficha.estudiante.pais_documento, 'VE');
      }
      if (indice === 3) {
        assert.equal(ficha.estudiante.numero_documento, null);
        assert.equal(ficha.estudiante.tipo_documento, null);
        assert.equal(ficha.estudiante.pais_documento, null);
      }
    }
  });
  await prueba(
    'documentos inválidos, fechas, campos ajenos y duplicados no dejan filas parciales',
    async () => {
      const [[antes]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM personas');
      const invalidos = [
        { tipo_documento: 'DNI', numero_documento: '1234', pais_documento: 'PE' },
        { tipo_documento: 'DNI', numero_documento: '12345678', pais_documento: 'VE' },
        { tipo_documento: 'CE', numero_documento: '123', pais_documento: 'PE' },
        { tipo_documento: 'PASAPORTE', numero_documento: 'A<1234', pais_documento: 'VE' },
        { tipo_documento: 'PASAPORTE' },
        { numero_documento: 'A1234' },
        { ...documento, pais_documento: 'VEN' },
        { ...documento, pais_documento: 'ZZ' },
        { tipo_documento: 'OTRO' },
        { activo: 0 },
        { fecha_nacimiento: '2026-02-30' },
        { fecha_nacimiento: '2026-05-01' },
        { id_aula: '9223372036854775807' },
        { correo: 'sin-arroba' },
        { telefono: '<script>' }
      ];
      for (const invalido of invalidos) {
        const respuesta = await peticion('estudiantes', 'director', 'POST', {
          ...inicial,
          codigo_estudiante: 'GEST-INVALIDO',
          ...invalido
        });
        assert.equal(respuesta.status, 400);
      }
      assert.equal(
        (
          await peticion('estudiantes', 'director', 'POST', {
            ...inicial,
            ...documento,
            codigo_estudiante: 'GEST-DUPLICADO'
          })
        ).status,
        409
      );
      const [[despues]] = await pool.execute('SELECT COUNT(*) AS cantidad FROM personas');
      assert.equal(despues.cantidad, antes.cantidad);
    }
  );
  await prueba(
    'los seis roles, autenticación y origen en consultas y escrituras nuevas',
    async () => {
      const rutas = [
        'estudiantes',
        `estudiantes/${estudiante.id}`,
        'estudiantes/apoderados',
        'estudiantes/apoderados/1'
      ];
      for (const rol of ['docente', 'auxiliar', 'administrador']) {
        for (const ruta of rutas) {
          assert.equal((await peticion(ruta, rol)).status, 403);
        }
        for (const [ruta, metodo] of [
          [`estudiantes/${estudiante.id}`, 'PUT'],
          ['estudiantes/apoderados', 'POST'],
          ['estudiantes/apoderados/1', 'PUT'],
          [`estudiantes/${estudiante.id}/matriculas`, 'POST'],
          [`estudiantes/${estudiante.id}/apoderado-principal`, 'POST']
        ]) {
          assert.equal((await peticion(ruta, rol, metodo, {})).status, 403);
        }
      }
      for (const rol of ['director', 'subdirector', 'coordinador_tutoria']) {
        assert.equal((await peticion(`estudiantes/${estudiante.id}`, rol)).status, 200);
      }
      assert.equal((await peticion('estudiantes', null)).status, 401);
      assert.equal(
        (
          await peticion(
            `estudiantes/${estudiante.id}`,
            'director',
            'PUT',
            {},
            { Origin: 'https://otro.example' }
          )
        ).status,
        403
      );
      assert.equal(
        (
          await peticion(`estudiantes/${estudiante.id}`, 'director', 'PUT', {
            ...persona,
            ...documento,
            contrasena: 'incorrecta'
          })
        ).status,
        403
      );
    }
  );
  await prueba(
    'edición con auditoría, búsqueda por nombre/documento/grado y comodines literales',
    async () => {
      await datos(`estudiantes/${estudiante.id}`, 'director', 'PUT', {
        ...persona,
        ...documento,
        nombres: 'Álvaro Andrés',
        fecha_nacimiento: '2014-06-03',
        telefono: '+51 999 111 222',
        ...clave
      });
      const ficha = await datos(`estudiantes/${estudiante.id}`, 'director');
      assert.equal(ficha.estudiante.nombres, 'Álvaro Andrés');
      for (const buscar of ['Álvaro Andrés', 'AB123456', 'GEST-3']) {
        const resultado = await datos(
          'estudiantes?buscar=' + encodeURIComponent(buscar),
          'director'
        );
        assert.ok(resultado.estudiantes.some((fila) => fila.id === estudiante.id));
      }
      const resultado = await datos(
        `estudiantes?buscar=AB123456&grado=${aulas[0].grado}`,
        'director'
      );
      assert.equal(resultado.paginacion.total, 1);
      assert.equal((await datos('estudiantes?buscar=%25%5B%5D_', 'director')).paginacion.total, 0);
      for (const filtro of ['pagina=0', 'pagina=1x', 'grado=abc', 'buscar[x]=1']) {
        assert.equal((await peticion(`estudiantes?${filtro}`, 'director')).status, 400);
      }
      const [auditoria] = await pool.execute(
        "SELECT valor_nuevo FROM historial WHERE id_persona = ? AND accion = 'persona_escolar_editada'",
        [estudiante.id]
      );
      assert.equal(auditoria.length, 1);
      assert.equal(JSON.parse(auditoria[0].valor_nuevo).nombres, 'Álvaro Andrés');
      assert.ok(!auditoria[0].valor_nuevo.includes(clave.contrasena));
    }
  );
  await prueba(
    'apoderados: registrar, consultar, editar y reutilizar sin duplicar identidad',
    async () => {
      apoderado = await datos(
        'estudiantes/apoderados',
        'director',
        'POST',
        {
          nombres: 'María Elena',
          apellidos: 'Apoderada Escolar',
          tipo_documento: 'DNI',
          numero_documento: '11234567',
          pais_documento: 'PE',
          ...clave
        },
        201
      );
      const ficha = await datos(`estudiantes/apoderados/${apoderado.id}`, 'director');
      const editado = {
        nombres: ficha.nombres,
        apellidos: ficha.apellidos,
        tipo_documento: ficha.tipo_documento,
        numero_documento: ficha.numero_documento,
        pais_documento: ficha.pais_documento,
        correo: 'apoderada@example.test',
        ...clave
      };
      await datos(`estudiantes/apoderados/${apoderado.id}`, 'director', 'PUT', editado);
      assert.equal(
        (await datos(`estudiantes/apoderados/${apoderado.id}`, 'director')).correo,
        'apoderada@example.test'
      );
      assert.equal(
        (await peticion('estudiantes/apoderados', 'director', 'POST', editado)).status,
        409
      );
      const resultado = await datos('estudiantes/apoderados?buscar=11234567', 'director');
      assert.equal(resultado.apoderados[0].id, apoderado.id);
      assert.equal(resultado.paginacion.total, 1);
      assert.equal(
        (await datos('estudiantes/apoderados?buscar=%25%5B%5D_', 'director')).paginacion.total,
        0
      );
    }
  );
  await prueba(
    'principal único, fechas, sustitución y conservación del vínculo anterior',
    async () => {
      const ruta = `estudiantes/${estudiante.id}/apoderado-principal`;
      const asociacion = {
        id_apoderado: apoderado.id,
        vinculo: 'Madre',
        vigente_desde: '2026-03-02',
        ...clave
      };
      const primero = await datos(ruta, 'director', 'POST', asociacion, 201);
      assert.equal((await datos(ruta, 'director', 'POST', asociacion, 201)).id, primero.id);
      assert.equal(
        (
          await peticion(ruta, 'director', 'POST', {
            ...asociacion,
            id_apoderado: estudiante.id
          })
        ).status,
        400
      );
      segundoApoderado = await datos(
        'estudiantes/apoderados',
        'director',
        'POST',
        {
          nombres: 'Juan Carlos',
          apellidos: 'Tutor Escolar',
          ...clave
        },
        201
      );
      assert.equal(
        (
          await peticion(ruta, 'director', 'POST', {
            ...asociacion,
            id_apoderado: segundoApoderado.id
          })
        ).status,
        409
      );
      await datos(
        ruta,
        'director',
        'POST',
        {
          ...asociacion,
          id_apoderado: segundoApoderado.id,
          vinculo: 'Tutor',
          vigente_desde: '2026-04-01'
        },
        201
      );
      const ficha = await datos(`estudiantes/${estudiante.id}`, 'director');
      assert.equal(ficha.apoderados.length, 2);
      assert.equal(ficha.apoderados.filter((fila) => !fila.vigente_hasta).length, 1);
      const anterior = ficha.apoderados.find((fila) => fila.id_vinculo === primero.id);
      assert.equal(anterior.vigente_hasta.slice(0, 10), '2026-03-31');
      assert.equal(anterior.es_principal, 1);
    }
  );
  await prueba(
    'el mismo apoderado puede representar a otro estudiante sin otra persona',
    async () => {
      const otro = (await datos('estudiantes?buscar=GEST-4', 'director')).estudiantes[0];
      await datos(
        `estudiantes/${otro.id}/apoderado-principal`,
        'director',
        'POST',
        {
          id_apoderado: segundoApoderado.id,
          vinculo: 'Tutor',
          vigente_desde: '2026-04-01',
          ...clave
        },
        201
      );
      const [[total]] = await pool.execute(
        'SELECT COUNT(*) AS cantidad FROM estudiantes_apoderados WHERE id_apoderado = ?',
        [segundoApoderado.id]
      );
      assert.equal(total.cantidad, 2);
    }
  );
  await prueba(
    'historial de expediente impide reescribir identidad, permite contacto',
    async () => {
      const caso = cuerpo('seguridad');
      incidencia = await datos(
        'incidencias',
        'director',
        'POST',
        {
          ...caso,
          involucrados: [
            {
              id_persona: estudiante.id,
              id_matricula: estudiante.matricula,
              participacion: 'afectado'
            }
          ]
        },
        201
      );
      await datos(`incidencias/${incidencia.id}/confirmar`, 'director', 'POST', {});
      versionAnterior = await datos(`incidencias/${incidencia.id}`, 'director');
      assert.equal(
        (
          await peticion(`estudiantes/${estudiante.id}`, 'director', 'PUT', {
            ...persona,
            ...documento,
            nombres: 'Identidad cambiada',
            ...clave
          })
        ).status,
        409
      );
      await datos(`estudiantes/${estudiante.id}`, 'director', 'PUT', {
        ...persona,
        ...documento,
        nombres: 'Álvaro Andrés',
        fecha_nacimiento: '2014-06-03',
        telefono: '999222333',
        ...clave
      });
      const despues = await datos(`incidencias/${incidencia.id}`, 'director');
      assert.deepEqual(despues.version, versionAnterior.version);
      assert.deepEqual(despues.involucrados, versionAnterior.involucrados);
    }
  );
  await prueba('nueva matrícula mantiene IDs, aula histórica y expediente existente', async () => {
    const otra = aulas.find((aula) => aula.id !== aulas[0].id);
    assert.equal(
      (
        await peticion(`estudiantes/${estudiante.id}/matriculas`, 'director', 'POST', {
          id_aula: otra.id,
          fecha_inicio: '2026-04-01',
          ...clave
        })
      ).status,
      409
    );
    await datos(
      `estudiantes/${estudiante.id}/matriculas`,
      'director',
      'POST',
      {
        id_aula: otra.id,
        fecha_inicio: '2026-11-26',
        ...clave
      },
      201
    );
    const ficha = await datos(`estudiantes/${estudiante.id}`, 'director');
    assert.equal(ficha.matriculas.length, 2);
    const anterior = ficha.matriculas.find((fila) => fila.id === estudiante.matricula);
    assert.equal(anterior.id_aula, aulas[0].id);
    assert.equal(anterior.fecha_inicio.slice(0, 10), '2026-03-02');
    assert.equal(anterior.fecha_fin.slice(0, 10), '2026-11-25');
    const despues = await datos(`incidencias/${incidencia.id}`, 'director');
    assert.deepEqual(despues.version, versionAnterior.version);
    assert.deepEqual(despues.involucrados, versionAnterior.involucrados);
    assert.equal(
      (
        await peticion(`estudiantes/${estudiante.id}/matriculas`, 'director', 'POST', {
          id_aula: aulas[0].id,
          fecha_inicio: '2026-11-26',
          ...clave
        })
      ).status,
      409
    );
  });
  await prueba(
    'reserva en listas, fichas y apoderados compartidos sin filtraciones al coordinador',
    async () => {
      const sensible = await datos(
        'incidencias',
        'director',
        'POST',
        {
          ...cuerpo('salud'),
          involucrados: [
            {
              id_persona: estudiante.id,
              id_matricula: estudiante.matricula,
              participacion: 'afectado'
            }
          ]
        },
        201
      );
      await datos(`incidencias/${sensible.id}/confirmar`, 'director', 'POST', {});
      for (const ruta of [
        `estudiantes/${estudiante.id}`,
        `estudiantes/apoderados/${segundoApoderado.id}`
      ]) {
        assert.equal((await peticion(ruta, 'coordinador_tutoria')).status, 404);
        assert.equal((await peticion(ruta, 'director')).status, 200);
      }
      assert.equal(
        (await datos('estudiantes?buscar=AB123456', 'coordinador_tutoria')).paginacion.total,
        0
      );
      assert.equal(
        (await datos('estudiantes/apoderados?buscar=Tutor%20Escolar', 'coordinador_tutoria'))
          .paginacion.total,
        0
      );
      const otro = (await datos('estudiantes?buscar=GEST-4', 'coordinador_tutoria')).estudiantes[0];
      assert.equal(
        (await datos(`estudiantes/${otro.id}`, 'coordinador_tutoria')).apoderados.length,
        0
      );
    }
  );
  await prueba('registros simultáneos impiden duplicados entre roles autorizados', async () => {
    const solicitudes = ['director', 'subdirector', 'coordinador_tutoria'].map((rol, indice) =>
      peticion('estudiantes', rol, 'POST', {
        ...inicial,
        codigo_estudiante: `GEST-SIM-${indice}`,
        tipo_documento: 'PASAPORTE',
        numero_documento: 'SIM123456',
        pais_documento: 'CO',
        contrasena: claves[`${rol.toUpperCase()}_PASSWORD`]
      })
    );
    const respuestas = await Promise.all(solicitudes);
    assert.deepEqual(respuestas.map((respuesta) => respuesta.status).sort(), [201, 409, 409]);
    const [[fila]] = await pool.execute(
      "SELECT COUNT(*) AS cantidad FROM personas WHERE numero_documento = 'SIM123456'"
    );
    assert.equal(fila.cantidad, 1);
  });
  await prueba('personal existente se asocia sin duplicarlo ni editarlo antes del vínculo', async () => {
    const [[personal]] = await pool.execute(
      "SELECT id, nombres, apellidos FROM personas WHERE codigo_interno = 'PER-2026-101'"
    );
    const ruta = `estudiantes/apoderados/${personal.id}`;
    const cambios = { nombres: personal.nombres, apellidos: personal.apellidos,
      telefono: '999222111', ...clave };
    assert.equal((await peticion(ruta, 'director')).status, 409);
    assert.equal((await peticion(ruta, 'director', 'PUT', cambios)).status, 409);
    const nuevo = await datos('estudiantes', 'director', 'POST', {
      ...inicial, codigo_estudiante: 'GEST-PERSONAL'
    }, 201);
    await datos(`estudiantes/${nuevo.id}/apoderado-principal`, 'director', 'POST', {
      id_apoderado: personal.id, vinculo: 'Tutor', vigente_desde: '2026-03-02', ...clave
    }, 201);
    await datos(ruta, 'director', 'PUT', cambios);
    assert.equal((await datos(ruta, 'director')).telefono, '999222111');
  });
  await prueba('dos sustituciones simultáneas conservan un único principal vigente', async () => {
    const tercero = await datos(
      'estudiantes/apoderados',
      'director',
      'POST',
      {
        nombres: 'Rosa Isabel',
        apellidos: 'Otra Tutora',
        ...clave
      },
      201
    );
    const respuestas = await Promise.all(
      [apoderado.id, tercero.id].map((idApoderado) =>
        peticion(`estudiantes/${estudiante.id}/apoderado-principal`, 'director', 'POST', {
          id_apoderado: idApoderado,
          vinculo: 'Tutor',
          vigente_desde: '2026-05-01',
          ...clave
        })
      )
    );
    assert.deepEqual(respuestas.map((respuesta) => respuesta.status).sort(), [201, 409]);
    const [[fila]] = await pool.execute(
      `SELECT COUNT(*) AS cantidad FROM estudiantes_apoderados
       WHERE id_estudiante = ? AND es_principal = 1 AND vigente_hasta IS NULL`,
      [estudiante.id]
    );
    assert.equal(fila.cantidad, 1);
  });
}

// Reproduce los escenarios de auditoría con datos y cuentas de la base temporal.
export async function verificarRegresiones({ t, pool, datos, peticion, claves, cuerpo, usuarios, alumnos, copia, cookies, renovarSesiones }) {
  await renovarSesiones();
  const caso = (nombre, prueba) => t.test('Regresión: ' + nombre, prueba);
  const escenarios = { t, personaDirector: usuarios.director.id_persona };
  const categorias = ['convivencia','disciplina','salud','seguridad','bienes','proteccion_estudiantil'];
  const crear = async (rol = 'director', categoria = 'seguridad', campos = {}) => datos('incidencias', rol, 'POST', { ...cuerpo(categoria), ...campos }, 201);
  const confirmar = async (rol, id) => datos('incidencias/' + id + '/confirmar', rol, 'POST', {});
  await caso('API sin autenticacion: lectura, catalogos y escrituras', async () => {
    for (const ruta of ['incidencias', 'incidencias/catalogos', 'incidencias/personas', 'incidencias/1', 'incidencias/1/pdf', 'cuentas/catalogos', 'cuentas/autorizaciones', 'estudiantes/aulas']) {
      assert.equal((await peticion(ruta, null)).status, 401, ruta);
    }
    for (const ruta of ['incidencias', 'estudiantes', 'cuentas/directas', 'cuentas/autorizaciones']) assert.equal((await peticion(ruta, null, 'POST', {})).status, 401, ruta);
  });
  await caso('Identificadores manipulados y SQL inyectado se rechazan', async () => {
    for (const id of ['0', '-1', '1 OR 1=1', '9223372036854775808', '1;DROP TABLE usuarios', '<script>']) assert.equal((await peticion('incidencias/' + encodeURIComponent(id), 'director')).status, 400, id);
    const r = await datos('incidencias?buscar=' + encodeURIComponent("' OR 1=1--"), 'director');
    assert.equal(r.paginacion.total, 0);
  });
  await caso('Fechas, campos vacios, booleanos y autoria manipulada', async () => {
    for (const extra of [{titulo:''}, {descripcion:' '}, {ocurrida_en:'2026-02-30T12:00:00-05:00'}, {ocurrida_en:'2026-10-30T25:00:00-05:00'}, {ocurrida_en:'2099-10-30T12:00:00-05:00'}, {riesgo_persistente:'false'}, {id_registrador:usuarios.subdirector.id}, {confidencialidad:'publica'}]) {
      assert.equal((await peticion('incidencias','director','POST',{...cuerpo('seguridad'),...extra})).status,400, Object.keys(extra)[0]);
    }
  });
  await caso('Busqueda literal de corchetes', async () => {
    const resultado = await datos('incidencias?buscar=' + encodeURIComponent('[aeiou]'), 'director');
    assert.equal(resultado.paginacion.total, 0, 'La busqueda literal [aeiou] devolvio ' + resultado.paginacion.total + ' expedientes');
    const literal = await crear('director', 'seguridad', { titulo: 'Referencia literal [a-z] 50%_fin!' });
    for (const termino of ['[a-z]', '50%', '%_', '_fin', 'fin!', ']']) {
      const lista = await datos('incidencias?buscar=' + encodeURIComponent(termino), 'director');
      assert.deepEqual(lista.incidencias.map(i => String(i.id)), [String(literal.id)], termino);
    }
  });
  await caso('Filtros combinados, vacios y pagina fuera de rango', async () => {
    const r = await datos('incidencias?buscar=NO_EXISTE_AUDITORIA&categoria=seguridad&estado=confirmada&pagina=999', 'director');
    assert.deepEqual([r.incidencias.length,r.paginacion.total,r.paginacion.pagina,r.paginacion.paginas], [0,0,1,1]);
    for (const consulta of ['pagina=0','pagina=-1','pagina=abc','categoria=otro','estado=otro','buscar=30/02/2026']) assert.equal((await peticion('incidencias?'+consulta,'director')).status,400);
  });
  await caso('Creacion repetida simultanea no duplica el borrador', async () => {
    const titulo = 'AUDITORIA_REENVIO_BORRADOR';
    const clave = randomUUID();
    const respuestas = await Promise.all([1,2].map(()=>peticion('incidencias','director','POST',{...cuerpo('seguridad'),titulo},{'X-SICE-Operation':clave})));
    const [[cantidad]] = await pool.execute('SELECT COUNT(*) AS total FROM versiones_incidencia WHERE titulo = ?', [titulo]);
    assert.equal(cantidad.total, 1);
    assert.deepEqual(respuestas.map(r=>r.status).sort(), [200,201]);
    const resultados = await Promise.all(respuestas.map(r=>r.json()));
    assert.equal(String(resultados[0].id), String(resultados[1].id));
    const reordenado = Object.fromEntries(Object.entries({ ...cuerpo('seguridad'), titulo }).reverse());
    const repetida = await peticion('incidencias', 'director', 'POST', reordenado, { 'X-SICE-Operation': clave });
    assert.equal(repetida.status, 200);
    assert.equal((await repetida.json()).id, resultados[0].id);
    for (const referencia of ['', 'no-valida']) {
      assert.equal((await peticion('incidencias', 'director', 'POST', reordenado, { 'X-SICE-Operation': referencia })).status, 400);
    }
    assert.equal((await peticion('incidencias','director','POST',{...cuerpo('seguridad'),titulo:titulo+' distinto'},{'X-SICE-Operation':clave})).status,409);
    const distinta = await crear('director','seguridad',{titulo});
    assert.notEqual(String(distinta.id),String(resultados[0].id));
  });
  await caso('Confirmacion simultanea aplica una sola vez', async () => {
    const n = await crear();
    const respuestas = await Promise.all([1,2].map(()=>peticion('incidencias/'+n.id+'/confirmar','director','POST',{})));
    assert.deepEqual(respuestas.map(r=>r.status).sort(),[200,409]);
  });
  const aula = (await datos('estudiantes/aulas','director'))[0];
  const alumno = { nombres:'Mateo Andres',apellidos:'Auditoria Escolar',codigo_estudiante:'AUD-REG',id_aula:aula.id,fecha_inicio:aula.anio_lectivo+'-03-10',contrasena:claves.DIRECTOR_PASSWORD };
  await caso('Nombre de estudiante formado solo por numeros o signos', async () => {
    for (const nombre of ['12345', '!!!', 'Mateo123', '-Mateo', 'Mateo--José']) {
      for (const campo of ['nombres', 'apellidos']) {
        const r = await peticion('estudiantes', 'director', 'POST', { ...alumno, [campo]: nombre, codigo_estudiante: 'AUD-NOMBRE' });
        assert.equal(r.status, 400, campo + ': ' + nombre);
      }
    }
    await datos('estudiantes', 'director', 'POST', { ...alumno, nombres: 'Álvaro-José', apellidos: 'D’Ávila O\'Connor', codigo_estudiante: 'AUD-UNICODE' }, 201);
  });
  await caso('Estudiante: campos vacios, fecha invalida, aula ajena y codigo duplicado', async () => {
    for (const extra of [{nombres:''},{apellidos:' '},{fecha_inicio:'2026-02-30'},{id_aula:'9223372036854775807'},{codigo_estudiante:'A B'}]) assert.equal((await peticion('estudiantes','director','POST',{...alumno,...extra})).status,400);
    await datos('estudiantes','director','POST',alumno,201);
    assert.equal((await peticion('estudiantes','director','POST',alumno)).status,409);
  });
  await caso('Seis categorias: PDF autorizado y borrador bloqueado para cada rol operativo', async () => {
    escenarios.pdfs=[];
    for (const [rol,categoria] of [...personalEscolar.filter(([r])=>r!=='administrador').map(([r])=>[r,'seguridad']), ...categorias.filter(c=>c!=='seguridad').map(c=>['director',c])]) {
        // El reportante propio siempre esta disponible para la captura sensible.
        const n = await crear(rol,categoria,{id_reportante:usuarios[rol].id_persona,condicion_reportante:'personal',involucrados:cuerpo(categoria).involucrados});
        assert.equal((await peticion('incidencias/'+n.id+'/pdf',rol)).status,409);
        const confirmacion = await confirmar(rol,n.id);
        const r = await peticion('incidencias/'+n.id+'/pdf',rol);
        assert.equal(r.status,confirmacion.acceso?200:404,rol+'/'+categoria);
        if(confirmacion.acceso) {
          const pdf=await getDocument({data:new Uint8Array(await r.arrayBuffer()),useSystemFonts:true}).promise;
          const texto=(await (await pdf.getPage(1)).getTextContent()).items.map(x=>x.str).join(' ');
          assert.ok(texto.includes('20874')); await pdf.cleanup?.();
          escenarios.pdfs.push({rol,categoria,id:n.id,titulo:cuerpo(categoria).titulo});
        }
        assert.equal((await peticion('incidencias/'+n.id+'/pdf','administrador')).status,403);
    }
  });
  const control = await crear('director','seguridad',{titulo:'AUDITORIA_PLAZO'});
  await confirmar('director',control.id);
  await datos('incidencias/'+control.id+'/actuaciones','director','POST',{tipo:'actuacion',detalle:'Revisar el piso y verificar que el paso sea seguro.',fecha_limite:'2026-12-18',contenido_sensible:false,id_responsable:usuarios.director.id},201);
  escenarios.plazo=control.id;
  const xss = await crear('director','seguridad',{titulo:'AUDITORIA_XSS <img src=x onerror="window.__auditXss=1">',descripcion:'<script>window.__auditXss=1</script>'});
  escenarios.xss=xss.id;
  await caso('Reautenticacion: el limite de intentos responde 429', async () => {
    let respuesta;
    try {
      for(let i=0;i<11;i++) respuesta=await peticion('estudiantes','director','POST',{...alumno,codigo_estudiante:'AUD-LIMITE',contrasena:'incorrecta'});
      assert.equal(respuesta.status,429);
      assert.equal(respuesta.headers.get('Retry-After'),'900');
      assert.match((await respuesta.json()).error,/15 minutos/);
    } finally {
      await pool.execute('DELETE FROM intentos_acceso WHERE clave = ?',[resumir('cuenta:reauth:'+usuarios.director.id)]);
    }
  });
  await caso('Responsables ofrecidos coinciden con los permisos de reserva', async () => {
    const n = await crear('subdirector','seguridad',{confidencialidad:'restringida'});
    await confirmar('subdirector',n.id);
    const [[permiso]] = await pool.execute("SELECT id FROM permisos WHERE codigo='incidencias.restringidas'");
    await pool.execute('DELETE FROM roles_permisos WHERE id_rol=? AND id_permiso=?',[usuarios.director.id_rol,permiso.id]);
    try {
      const d=await datos('incidencias/'+n.id,'subdirector');
      const r=await peticion('incidencias/'+n.id+'/actuaciones','subdirector','POST',{tipo:'actuacion',detalle:'Verificar acompanamiento.',contenido_sensible:false,id_responsable:usuarios.director.id});
      assert.equal(d.responsables.some(x=>String(x.id)===String(usuarios.director.id)),false);
      assert.equal(r.status,400);
    } finally {
      await pool.execute('INSERT INTO roles_permisos(id_rol,id_permiso) VALUES (?,?)',[usuarios.director.id_rol,permiso.id]);
    }
  });

  await caso('SQL Server: perdida temporal de conexion y recuperacion sin filtrar errores',async()=>{
    const programa = [
      "import net from 'node:net';",
      "import {once} from 'node:events';",
      "import {createDatabasePool} from "+JSON.stringify(new URL('../src/database.js',import.meta.url).href)+";",
      "import {createApp} from "+JSON.stringify(new URL('../src/app.js',import.meta.url).href)+";",
      "let disponible=true;const sockets=new Set();",
      "const puente=net.createServer(cliente=>{if(!disponible){cliente.destroy();return;} const destino=net.connect({host:process.env.DB_HOST,port:Number(process.env.DB_PORT)});for(const s of [cliente,destino]){sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('error',()=>{cliente.destroy();destino.destroy();});}cliente.pipe(destino);destino.pipe(cliente);});",
      "puente.listen(0,'127.0.0.1');await once(puente,'listening');",
      "const pool=createDatabasePool({...process.env,DB_HOST:'127.0.0.1',DB_PORT:String(puente.address().port)});",
      "const server=createApp({pool}).listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;",
      "try{await pool.execute('SELECT 1');disponible=false;for(const s of sockets)s.destroy();let r=await fetch(base+'/api/incidencias',{headers:{Cookie:process.env.AUDIT_COOKIE}});const cuerpo=await r.json();if(r.status!==500||/SELECT|password|tedious|ECONN|socket|stack/i.test(cuerpo.error))throw Error('Respuesta durante fallo incorrecta');disponible=true;r=await fetch(base+'/api/incidencias',{headers:{Cookie:process.env.AUDIT_COOKIE}});if(r.status!==200)throw Error('No recupera conexion: '+r.status);console.log('RECUPERACION_OK');}",
      "finally{await new Promise(r=>server.close(r));await pool.end();for(const s of sockets)s.destroy();await new Promise(r=>puente.close(r));}"
    ].join('\n');
    const hijo=spawn(process.execPath,['--input-type=module','-e',programa],{env:{...process.env,...copia.entorno,AUDIT_COOKIE:cookies.director},windowsHide:true,stdio:['ignore','pipe','pipe']});
    let salida='';hijo.stdout.on('data',d=>salida+=d.toString());hijo.stderr.on('data',()=>{});
    const limite=setTimeout(()=>hijo.kill(),45000);
    const [codigo]=await once(hijo,'exit');clearTimeout(limite);
    assert.ok(codigo===0&&salida.includes('RECUPERACION_OK'),'Fallo del recorrido de desconexion/recuperacion, salida='+codigo);
  });
  await caso('Catalogo institucional permite seleccionar personas despues de 250',async()=>{
    await pool.execute("INSERT INTO personas(codigo_interno,nombres,apellidos,es_personal,activo) SELECT CONCAT('AUD-CAT-',ROW_NUMBER() OVER(ORDER BY object_id)),N'Mateo',N'Auditoria Catalogo',0,1 FROM (SELECT TOP (260) object_id FROM sys.all_objects ORDER BY object_id) origen");
    await pool.execute("INSERT INTO estudiantes(id_persona,codigo_estudiante,activo) SELECT id,codigo_interno,1 FROM personas WHERE codigo_interno LIKE 'AUD-CAT-%'");
    await pool.execute("INSERT INTO personas(codigo_interno,nombres,apellidos,es_personal,activo) SELECT CONCAT('AUD-PER-',ROW_NUMBER() OVER(ORDER BY object_id)),N'Personal',N'Prueba Catalogo',1,1 FROM (SELECT TOP (260) object_id FROM sys.all_objects ORDER BY object_id) origen");
    const r=await datos('incidencias/catalogos','director');
    const [[ultimo]]=await pool.execute("SELECT id FROM personas WHERE codigo_interno='AUD-CAT-260'");
    const visible=r.personas.some(p=>String(p.id)===String(ultimo.id));
    const respuesta=await peticion('incidencias','director','POST',{...cuerpo('seguridad'),id_reportante:usuarios.director.id_persona,condicion_reportante:'personal',involucrados:[{id_persona:ultimo.id,participacion:'testigo'}]});
    assert.equal(visible,false);
    assert.equal(r.personas.length,50); assert.ok(r.paginacion.total>520);
    assert.equal(respuesta.status,201);
    const ids = new Set();
    for(let pagina=1;pagina<=r.paginacion.paginas;pagina++){
      const datosPagina=await datos('incidencias/personas?pagina='+pagina,'director');
      for(const p of datosPagina.personas){assert.ok(!ids.has(String(p.id)));ids.add(String(p.id));}
    }
    assert.equal(ids.size,r.paginacion.total);
    const seleccion=await datos('incidencias/personas?buscar=AUD-CAT-260','director');
    assert.deepEqual(seleccion.personas.map(p=>String(p.id)),[String(ultimo.id)]);
    const personal = await datos('incidencias/personas?buscar=AUD-PER-260', 'director');
    assert.equal(personal.personas.length, 1);
    await crear('director', 'seguridad', { id_reportante: personal.personas[0].id, condicion_reportante: 'personal' });
    for (const termino of ['[aeiou]', '%', '_', '!']) {
      assert.equal((await datos('incidencias/personas?buscar=' + encodeURIComponent(termino), 'director')).paginacion.total, 0);
    }
    const reserva=await datos('incidencias/personas?id='+alumnos[1].id,'coordinador_tutoria');
    assert.equal(reserva.personas.length,0);
    assert.equal((await peticion('incidencias','coordinador_tutoria','POST',{...cuerpo('seguridad'),id_reportante:usuarios.coordinador_tutoria.id_persona,involucrados:[{id_persona:alumnos[1].id,participacion:'testigo'}]})).status,403);
    escenarios.personaPagina=ultimo.id;
  });

  await caso('revocación concurrente: orden de confirmación y desactivación', async () => {
    const nuevo = await crear('auxiliar', 'seguridad', { id_reportante: usuarios.auxiliar.id_persona });
    const solicitud = await datos('cuentas/autorizaciones', 'administrador', 'POST', {
      tipo: 'desactivar_cuenta', id_usuario_objetivo: usuarios.auxiliar.id, motivo: 'Verificar revocación concurrente.'
    }, 201);
    await datos('cuentas/autorizaciones/' + solicitud.id + '/decidir', 'director', 'POST', {
      decision: 'aprobar', fundamento: 'Decisión independiente.', sin_conflicto: true, contrasena: claves.DIRECTOR_PASSWORD
    });
    const bloqueo = await pool.getConnection();
    let confirmacion, desactivacion;
    async function esperarBloqueo(texto) {
      for (let intento = 0; intento < 30; intento++) {
        const cantidad = Number(await administrar("SELECT COUNT(*) FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t WHERE r.database_id=DB_ID(N'" + copia.nombre + "') AND r.wait_type LIKE 'LCK%' AND t.text LIKE '%" + texto + "%';"));
        if (cantidad) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.fail('No se observó el bloqueo esperado: ' + texto);
    }
    try {
      await bloqueo.beginTransaction();
      await bloqueo.execute('SELECT id FROM incidencias WITH (UPDLOCK,HOLDLOCK) WHERE id=?', [nuevo.id]);
      confirmacion = peticion('incidencias/' + nuevo.id + '/confirmar', 'auxiliar', 'POST', {});
      await esperarBloqueo('FROM incidencias');
      desactivacion = peticion('cuentas/autorizaciones/' + solicitud.id + '/ejecutar', 'administrador', 'POST', {});
      await esperarBloqueo('FROM roles');
      assert.equal((await pool.execute('SELECT activo FROM usuarios WHERE id=?', [usuarios.auxiliar.id]))[0][0].activo, 1);
      await bloqueo.commit();
      assert.equal((await confirmacion).status, 200);
      assert.equal((await desactivacion).status, 200);
      const [[orden]] = await pool.execute('SELECT i.confirmada_en, a.ejecutada_en, u.activo FROM incidencias i CROSS JOIN autorizaciones_cuentas a CROSS JOIN usuarios u WHERE i.id=? AND a.id=? AND u.id=?', [nuevo.id, solicitud.id, usuarios.auxiliar.id]);
      assert.equal(orden.activo, 0);
      assert.ok(orden.confirmada_en <= orden.ejecutada_en, 'La revocación no puede hacerse efectiva antes de la escritura en curso.');
      assert.equal((await peticion('incidencias/' + nuevo.id + '/actuaciones', 'auxiliar', 'POST', {})).status, 401);
    } finally {
      await bloqueo.rollback(); bloqueo.release();
      await Promise.allSettled([confirmacion, desactivacion].filter(Boolean));
      await pool.execute('UPDATE usuarios SET activo=1 WHERE id=?', [usuarios.auxiliar.id]);
      await renovarSesiones();
    }
    const pendiente = await crear('auxiliar', 'seguridad', { id_reportante: usuarios.auxiliar.id_persona });
    const gestion = await pool.getConnection();
    let intento;
    try {
      await gestion.beginTransaction();
      await gestion.execute('SELECT id FROM roles WITH (UPDLOCK,HOLDLOCK) ORDER BY id');
      intento = peticion('incidencias/' + pendiente.id + '/confirmar', 'auxiliar', 'POST', {});
      await esperarBloqueo('FROM roles');
      await gestion.execute('UPDATE usuarios SET activo=0 WHERE id=?', [usuarios.auxiliar.id]);
      await gestion.execute('DELETE FROM sesiones WHERE id_usuario=?', [usuarios.auxiliar.id]);
      await gestion.commit();
      assert.equal((await intento).status, 401, 'La petición autenticada antes de la revocación debe revalidarse al obtener el bloqueo.');
      assert.equal((await pool.execute('SELECT estado FROM incidencias WHERE id=?', [pendiente.id]))[0][0].estado, 'borrador');
    } finally {
      await gestion.rollback(); gestion.release();
      if (intento) await intento.catch(() => {});
      await pool.execute('UPDATE usuarios SET activo=1 WHERE id=?', [usuarios.auxiliar.id]);
      await renovarSesiones();
    }
  });

  escenarios.borrador = (await crear()).id;
  const [[permiso]] = await pool.execute("SELECT id FROM permisos WHERE codigo='incidencias.registrar'");
  escenarios.permisoRegistro = async conceder => {
    if (conceder) await pool.execute('INSERT INTO roles_permisos(id_rol,id_permiso) VALUES (?,?)', [usuarios.director.id_rol, permiso.id]);
    else await pool.execute('DELETE FROM roles_permisos WHERE id_rol=? AND id_permiso=?', [usuarios.director.id_rol, permiso.id]);
  };
  return escenarios;
}
