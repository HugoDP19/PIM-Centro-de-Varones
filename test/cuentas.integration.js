import assert from 'node:assert/strict';
import { generarContrasena, verificarHash } from '../src/seguridad.js';

export async function verificarGestionCuentas({ t, pool, peticion, datos, usuarios, claves, cookies }) {
  const catalogo = await datos('cuentas/catalogos', 'administrador');
  const claveNueva = generarContrasena();
  let idCuenta;
  const solicitar = (rol, cuerpo) => datos('cuentas/autorizaciones', rol, 'POST', { motivo: 'Revisión de acceso del personal en la copia temporal.', ...cuerpo }, 201);
  const decidir = (id, rol, decision = 'aprobar', extra = {}, esperado = 200) => datos(`cuentas/autorizaciones/${id}/decidir`, rol, 'POST', {
    decision, fundamento: 'Decisión independiente sobre los valores solicitados.', sin_conflicto: true,
    contrasena: claves[`${rol.toUpperCase()}_PASSWORD`], ...extra
  }, esperado);
  const ejecutar = (id, rol = 'administrador', cuerpo = {}, esperado = 200) => datos(`cuentas/autorizaciones/${id}/ejecutar`, rol, 'POST', cuerpo, esperado);
  const obtener = async id => (await datos('cuentas/autorizaciones', 'administrador')).autorizaciones.find(s => String(s.id) === String(id));

  await t.test('cuentas: creación directa inactiva, datos básicos y tres sesiones independientes', async () => {
    const persona = catalogo.personas.find(p => p.nombre === 'Luis Fernando Navarro Espinoza');
    assert.ok(persona);
    const cuerpo = { tipo: 'crear_cuenta', id_persona: persona.id, id_rol_objetivo: usuarios.docente.id_rol,
      nombre_usuario: 'lnavarro', motivo: 'Registrar una cuenta para personal existente.', contrasena: claveNueva };
    assert.equal((await peticion('cuentas/directas', 'director', 'POST', cuerpo)).status, 403);
    assert.equal((await peticion('cuentas/directas', 'administrador', 'POST', { ...cuerpo, activo: true })).status, 400);
    assert.equal((await peticion('cuentas/directas', 'administrador', 'POST', { ...cuerpo, id_rol_objetivo: usuarios.director.id_rol })).status, 403);
    const creada = await datos('cuentas/directas', 'administrador', 'POST', cuerpo, 201);
    idCuenta = creada.id;
    const [[cuenta]] = await pool.execute('SELECT activo, contrasena_hash FROM usuarios WHERE id = ?', [idCuenta]);
    assert.equal(cuenta.activo, 0);
    assert.ok(await verificarHash(claveNueva, cuenta.contrasena_hash));
    assert.equal((await peticion('auth/login', null, 'POST', { usuario: 'lnavarro', contrasena: claveNueva })).status, 401);
    const sesiones = await Promise.all(['administrador', 'director', 'subdirector'].map(rol => datos('auth/sesion', rol)));
    assert.equal(new Set(sesiones.map(s => String(s.usuario.id))).size, 3);
    assert.equal((await peticion('incidencias', 'administrador')).status, 403);
  });

  await t.test('cuentas: Administrador solicita, autoridad reautentica y ejecución única', async () => {
    const solicitud = await solicitar('administrador', { tipo: 'activar_cuenta', id_usuario_objetivo: idCuenta });
    await ejecutar(solicitud.id, 'administrador', {}, 409);
    await decidir(solicitud.id, 'director', 'aprobar', { contrasena: generarContrasena() }, 403);
    await decidir(solicitud.id, 'director', 'aprobar', { sin_conflicto: false }, 400);
    await decidir(solicitud.id, 'docente', 'aprobar', {}, 403);
    await decidir(solicitud.id, 'administrador', 'aprobar', {}, 403);
    await decidir(solicitud.id, 'director');
    await decidir(solicitud.id, 'subdirector', 'rechazar', {}, 409);
    await ejecutar(solicitud.id, 'director', {}, 403);
    await ejecutar(solicitud.id, 'administrador', { activo: false }, 400);
    const concurrentes = await Promise.all([1, 2].map(() => peticion(`cuentas/autorizaciones/${solicitud.id}/ejecutar`, 'administrador', 'POST', {})));
    assert.deepEqual(concurrentes.map(r => r.status).sort(), [200, 409]);
    assert.equal((await obtener(solicitud.id)).estado, 'ejecutada');
    const denegada = await solicitar('administrador', { tipo: 'desactivar_cuenta', id_usuario_objetivo: idCuenta });
    await decidir(denegada.id, 'subdirector', 'rechazar');
    assert.equal((await obtener(denegada.id)).estado, 'rechazada');
    await ejecutar(denegada.id, 'administrador', {}, 409);
  });

  await t.test('cuentas: aprobación recíproca, autoaprobación y primera decisión atómica', async () => {
    const solicitud = await solicitar('director', { tipo: 'editar_cuenta', id_usuario_objetivo: idCuenta, nombre_usuario: 'lnavarro2' });
    await decidir(solicitud.id, 'director', 'aprobar', {}, 403);
    await decidir(solicitud.id, 'subdirector');
    await ejecutar(solicitud.id, 'director');
    const denegada = await solicitar('subdirector', { tipo: 'editar_cuenta', id_usuario_objetivo: idCuenta, nombre_usuario: 'lnavarro3' });
    await decidir(denegada.id, 'director', 'rechazar');
    await ejecutar(denegada.id, 'subdirector', {}, 409);
    await datos('cuentas/directas', 'administrador', 'POST', { tipo: 'editar_cuenta', id_usuario_objetivo: idCuenta,
      nombre_usuario: 'lnavarro', motivo: 'Corregir el identificador administrativo de la cuenta.' }, 201);
    const carrera = await solicitar('administrador', { tipo: 'restablecer_clave', id_usuario_objetivo: idCuenta });
    const respuestas = await Promise.all(['director', 'subdirector'].map(rol => peticion(`cuentas/autorizaciones/${carrera.id}/decidir`, rol, 'POST', {
      decision: rol === 'director' ? 'aprobar' : 'rechazar', fundamento: 'Resolución concurrente de prueba.', sin_conflicto: true, contrasena: claves[`${rol.toUpperCase()}_PASSWORD`]
    })));
    assert.deepEqual(respuestas.map(r => r.status).sort(), [200, 409]);
  });

  await t.test('cuentas: ambas decisiones y desacuerdos conservados sin ejecución automática', async () => {
    for (const [director, subdirector, esperado] of [
      ['aprobar', 'aprobar', 'aprobada'], ['rechazar', 'rechazar', 'rechazada'],
      ['rechazar', 'aprobar', 'rechazada'], ['aprobar', 'rechazar', 'desacuerdo']
    ]) {
      const solicitud = await solicitar('administrador', { tipo: 'cambiar_rol', id_usuario_objetivo: idCuenta, id_rol_objetivo: usuarios.auxiliar.id_rol });
      await decidir(solicitud.id, 'subdirector', subdirector);
      assert.equal((await obtener(solicitud.id)).estado, 'pendiente');
      await ejecutar(solicitud.id, 'administrador', {}, 409);
      await decidir(solicitud.id, 'director', director);
      const registro = await obtener(solicitud.id);
      assert.equal(registro.estado, esperado);
      assert.equal(registro.decision_director, director);
      assert.equal(registro.decision_subdirector, subdirector);
      await decidir(solicitud.id, 'director', 'aprobar', {}, 409);
      if (esperado !== 'aprobada') await ejecutar(solicitud.id, 'administrador', {}, 409);
      else {
        await ejecutar(solicitud.id);
        const [[cuenta]] = await pool.execute('SELECT id_rol FROM usuarios WHERE id = ?', [idCuenta]);
        assert.equal(String(cuenta.id_rol), String(usuarios.auxiliar.id_rol));
        const restaurar = await solicitar('director', { tipo: 'cambiar_rol', id_usuario_objetivo: idCuenta, id_rol_objetivo: usuarios.docente.id_rol });
        await decidir(restaurar.id, 'subdirector'); await ejecutar(restaurar.id, 'director');
      }
    }
  });

  await t.test('cuentas: creación recíproca y autoridad inhabilitada bloquean la ejecución', async () => {
    const [persona] = await pool.execute("INSERT INTO personas (codigo_interno, nombres, apellidos, es_personal, activo) VALUES ('PER-PRUEBA-RECIPROCA', 'Personal', 'Verificación', 1, 1)");
    const solicitud = await solicitar('director', { tipo: 'crear_cuenta', id_persona: persona.insertId,
      id_rol_objetivo: usuarios.docente.id_rol, nombre_usuario: 'reciproca.prueba' });
    await decidir(solicitud.id, 'subdirector');
    await pool.execute('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.subdirector.id]);
    try { await ejecutar(solicitud.id, 'director', { contrasena: generarContrasena() }, 403); }
    finally { await pool.execute('UPDATE usuarios SET activo = 1 WHERE id = ?', [usuarios.subdirector.id]); }
    await ejecutar(solicitud.id, 'director', { contrasena: generarContrasena() });
    const [[creada]] = await pool.execute("SELECT activo FROM usuarios WHERE nombre_usuario = 'reciproca.prueba'");
    assert.equal(creada.activo, 0);
    const pendiente = await solicitar('director', { tipo: 'restablecer_clave', id_usuario_objetivo: idCuenta });
    await pool.execute('UPDATE usuarios SET activo = 0 WHERE id = ?', [usuarios.subdirector.id]);
    try { await decidir(pendiente.id, 'subdirector', 'aprobar', {}, 401); }
    finally {
      await pool.execute('UPDATE usuarios SET activo = 1 WHERE id = ?', [usuarios.subdirector.id]);
      const login = await peticion('auth/login', null, 'POST', { usuario: usuarios.subdirector.nombre_usuario, contrasena: claves.SUBDIRECTOR_PASSWORD });
      assert.equal(login.status, 200); cookies.subdirector = login.headers.get('set-cookie').split(';')[0];
    }
  });

  await t.test('cuentas: continuidad, valores obsoletos, vencimiento y límites institucionales', async () => {
    for (const [actor, objetivo] of [['director', 'director'], ['director', 'administrador'], ['administrador', 'subdirector']]) {
      const respuesta = await peticion('cuentas/autorizaciones', actor, 'POST', { tipo: 'desactivar_cuenta', id_usuario_objetivo: usuarios[objetivo].id, motivo: 'Comprobar continuidad institucional.' });
      assert.ok([403, 409].includes(respuesta.status));
    }
    const permiso = catalogo.permisos.find(p => p.codigo === 'incidencias.consultar');
    assert.equal((await peticion('cuentas/autorizaciones', 'director', 'POST', { tipo: 'asignar_permiso', id_rol_objetivo: usuarios.administrador.id_rol,
      id_permiso: permiso.id, motivo: 'Intento de exceder el rol.' })).status, 403);
    const vencida = await solicitar('administrador', { tipo: 'restablecer_clave', id_usuario_objetivo: idCuenta });
    await pool.execute('UPDATE autorizaciones_cuentas SET vence_en = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 SECOND) WHERE id = ?', [vencida.id]);
    await decidir(vencida.id, 'director', 'aprobar', {}, 409);
    assert.equal((await obtener(vencida.id)).estado, 'vencida');
    const obsoleta = await solicitar('administrador', { tipo: 'restablecer_clave', id_usuario_objetivo: idCuenta });
    await datos('cuentas/directas', 'administrador', 'POST', { tipo: 'editar_cuenta', id_usuario_objetivo: idCuenta, nombre_usuario: 'lnavarro4', motivo: 'Cambio posterior a la solicitud.' }, 201);
    await decidir(obsoleta.id, 'director', 'aprobar', {}, 409);
    await datos('cuentas/directas', 'administrador', 'POST', { tipo: 'editar_cuenta', id_usuario_objetivo: idCuenta, nombre_usuario: 'lnavarro', motivo: 'Restituir el identificador de la prueba.' }, 201);
  });

  await t.test('cuentas: cambios de contraseña, desactivación y permisos invalidan sesiones; auditoría', async () => {
    const solicitud = await solicitar('administrador', { tipo: 'restablecer_clave', id_usuario_objetivo: idCuenta });
    await decidir(solicitud.id, 'director');
    await ejecutar(solicitud.id, 'administrador', { contrasena: 'corta' }, 400);
    await ejecutar(solicitud.id, 'administrador', { contrasena: claveNueva });
    const acceso = await peticion('auth/login', null, 'POST', { usuario: 'lnavarro', contrasena: claveNueva });
    assert.equal(acceso.status, 200);
    const cookie = acceso.headers.get('set-cookie').split(';')[0];
    const baja = await solicitar('administrador', { tipo: 'desactivar_cuenta', id_usuario_objetivo: idCuenta });
    await decidir(baja.id, 'subdirector');
    await ejecutar(baja.id);
    assert.equal((await peticion('auth/sesion', null, 'GET', undefined, { Cookie: cookie })).status, 401);
    const permiso = catalogo.permisos.find(p => p.codigo === 'incidencias.exportar');
    for (const tipo of ['retirar_permiso', 'asignar_permiso']) {
      const cambio = await solicitar('administrador', { tipo, id_rol_objetivo: usuarios.docente.id_rol, id_permiso: permiso.id });
      await decidir(cambio.id, 'director'); await decidir(cambio.id, 'subdirector');
      await ejecutar(cambio.id);
    }
    assert.equal((await peticion('auth/sesion', 'docente')).status, 401);
    const ingreso = await peticion('auth/login', null, 'POST', { usuario: usuarios.docente.nombre_usuario, contrasena: claves.DOCENTE_PASSWORD });
    assert.equal(ingreso.status, 200); cookies.docente = ingreso.headers.get('set-cookie').split(';')[0];
    const historial = await datos(`cuentas/${idCuenta}/historial`, 'director');
    for (const accion of ['gestion_cuenta_directa', 'gestion_cuenta_solicitada', 'gestion_cuenta_aprobada', 'gestion_cuenta_rechazada', 'gestion_cuenta_ejecutada']) assert.ok(historial.historial.some(h => h.accion === accion));
    assert.ok(!JSON.stringify(historial).includes(claveNueva));
    assert.equal((await peticion(`cuentas/${idCuenta}/historial`, 'docente')).status, 403);
  });
}
