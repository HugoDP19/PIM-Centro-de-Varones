import assert from 'node:assert/strict';

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
    const [aulas] = await pool.execute('SELECT id,anio_lectivo FROM aulas LIMIT 1');
    for (const rol of ['director', 'subdirector', 'coordinador_tutoria']) {
      const codigo = `PR-${rol.slice(0, 10)}`;
      const cuerpo = { nombres: 'Estudiante de prueba', apellidos: rol, codigo_estudiante: codigo,
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
