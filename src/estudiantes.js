import { Router } from 'express';
import { autorizar, reautenticar } from './autenticacion.js';
import { actorVigente } from './cuentas.js';
import { transaccion } from './database.js';
import { rechazar, validarTexto, validarIdentificador, validarNombre } from './seguridad.js';
import { insertar, auditar, aulasActivas } from './consultas-incidencias.js';

export function rutasEstudiantes(pool) {
  const router = Router();
  // Protege también el catálogo de aulas con el permiso institucional de registro de estudiantes.
  router.use(autorizar('estudiantes.crear'));
  router.get('/aulas', async (_req, res) => res.json(await aulasActivas(pool)));
  router.post('/', async (req, res) => {
    const cuerpo = req.body || {};
    if (Object.keys(cuerpo).some(c => !['nombres', 'apellidos', 'codigo_estudiante', 'id_aula', 'fecha_inicio', 'contrasena'].includes(c))) rechazar(400, 'Campos de estudiante no permitidos.');
    const nombres = validarNombre(cuerpo.nombres, 'nombres', 100);
    const apellidos = validarNombre(cuerpo.apellidos, 'apellidos', 150);
    const codigo = validarTexto(cuerpo.codigo_estudiante, 'código de estudiante', 20);
    if (!/^[A-Za-z0-9-]+$/.test(codigo)) rechazar(400, 'El código admite letras, números y guiones.');
    // Valida la fecha civil antes de vincular la matrícula al año del aula seleccionada.
    const fecha = cuerpo.fecha_inicio;
    if (typeof fecha !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(fecha)
        || !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha
        || fecha > new Date().toISOString().slice(0, 10)) rechazar(400, 'Fecha de matrícula no válida.');
    const idAula = validarIdentificador(cuerpo.id_aula);
    await reautenticar(pool, req);
    // Revalida al actor y guarda persona, perfil, matrícula y auditoría como una sola operación.
    const resultado = await transaccion(pool, async db => {
      const actor = await actorVigente(db, req.usuario, 'estudiantes.crear', req.tokenSesion);
      const aula = (await aulasActivas(db)).find(a => String(a.id) === idAula);
      if (!aula || Number(fecha.slice(0, 4)) !== Number(aula.anio_lectivo)) rechazar(400, 'Selecciona un aula activa del año de matrícula.');
      const id = await insertar(db, 'personas', { codigo_interno: `EST-${codigo}`, nombres, apellidos, es_personal: 0, activo: 1 });
      await insertar(db, 'estudiantes', { id_persona: id, codigo_estudiante: codigo, activo: 1 });
      const matricula = await insertar(db, 'matriculas', { id_estudiante: id, id_aula: idAula, fecha_inicio: fecha });
      await auditar(db, actor, null, 'estudiante_creado', { id_persona: id, id_estudiante: id, id_matricula: matricula, id_aula: idAula });
      return { id, matricula, codigo_estudiante: codigo };
    });
    res.status(201).json(resultado);
  });
  return router;
}
