import { crearHash, limitesPermisos } from '../src/seguridad.js';
import { insertar, auditar } from '../src/consultas-incidencias.js';

// Relatos completamente sintéticos. Horas persistidas en UTC (Lima = UTC-5).
// Incluye testigos adultos; los identificadores se asignan al cargar la colección.
const casos = [
  {
    numero: 1, categoria: 'convivencia', tipo: 'Agresión física observada en recreo',
    titulo: 'Discusión durante un partido en el recreo', fecha: '2026-10-05 15:20:00', lugar: 'Patio de secundaria',
    registrador: 'auxiliar', reportante: 'docente', alumnos: [[5, 'involucrado'], [6, 'involucrado'], [7, 'testigo']],
    prioridad: 'alta', estado: 'en_seguimiento', restringida: true,
    descripcion: 'Durante el recreo, dos estudiantes discutieron sobre una jugada de fútbol. El docente de turno observó un empujón y un golpe con la mano antes de separarlos con apoyo del auxiliar. Un compañero manifestó haber visto el inicio de la discusión. Se escuchará a cada estudiante por separado para precisar la secuencia; el registro inicial no establece quién inició la agresión ni atribuye responsabilidad definitiva.',
    campos: { ambito_convivencia: 'presencial', requiere_mediacion: 0 },
    actuacion: 'Se interrumpió el juego, se separó a los estudiantes y se comprobó si requerían atención. Tutoría programó entrevistas individuales para recoger sus versiones sin confrontación entre las partes.'
  },
  {
    numero: 2, categoria: 'convivencia', tipo: 'Expresiones ofensivas reiteradas',
    titulo: 'Comentarios ofensivos durante el trabajo en aula', fecha: '2026-10-06 14:15:00', lugar: 'Aula de 5.º de primaria A',
    alumnos: [[1, 'afectado'], [2, 'involucrado']], prioridad: 'alta', estado: 'en_seguimiento', restringida: true,
    descripcion: 'Durante dos actividades grupales de la semana, el docente escuchó expresiones despectivas dirigidas a un estudiante. El estudiante indicó que comentarios similares ocurrieron en días anteriores, extremo que aún debe contrastarse. Se registran las observaciones del docente separadamente de lo referido por el estudiante. No se reproducen las expresiones ofensivas en el título ni se determina todavía la existencia de un patrón de acoso.',
    campos: { ambito_convivencia: 'presencial', requiere_mediacion: 0 },
    actuacion: 'El docente detuvo los comentarios, recordó las pautas de trato respetuoso y solicitó acompañamiento de Tutoría. Se acordó observar la participación del grupo durante la semana y escuchar a los estudiantes de manera individual.'
  },
  {
    numero: 3, categoria: 'convivencia', tipo: 'Posible acoso comunicado por apoderado',
    titulo: 'Reporte de hostigamiento pendiente de contraste', fecha: '2026-10-07 13:10:00', lugar: 'Atención a familias',
    reportante: 'apoderado1', alumnos: [[1, 'afectado']], prioridad: 'alta', estado: 'confirmada', restringida: true,
    descripcion: 'La apoderada comunicó que su hijo ha expresado temor de participar en los recreos y refiere que algunos compañeros lo excluyen de los juegos y hacen comentarios sobre él. La docente recibió el relato y aclaró que los hechos específicos todavía no han sido verificados. La fecha consignada corresponde a la comunicación del reporte; las fechas de los episodios referidos no están precisadas. Se conserva únicamente la información necesaria para iniciar una evaluación reservada.',
    campos: { ambito_convivencia: 'presencial', requiere_mediacion: 0 },
    actuacion: 'Se remitió el reporte a una autoridad habilitada y se coordinó una entrevista reservada. Se solicitó evitar entrevistas grupales o difusión del relato mientras se recoge información.'
  },
  {
    numero: 4, categoria: 'disciplina', tipo: 'Presentación personal por evaluar',
    titulo: 'Prendas escolares pendientes de regularización', fecha: '2026-10-08 12:50:00', lugar: 'Ingreso de secundaria',
    registrador: 'auxiliar', alumnos: [[5, 'involucrado']], prioridad: 'normal', estado: 'en_seguimiento',
    descripcion: 'En tres controles de ingreso de la semana se observó que el estudiante asistió con una prenda distinta de la prevista para la jornada. El estudiante explicó que la prenda habitual estaba deteriorada y que su familia estaba gestionando su reemplazo. La explicación se registra como información por contrastar con el apoderado antes de adoptar medidas. El estudiante ingresó a clases; no se presume una negativa deliberada a cumplir las indicaciones.',
    campos: { gravedad_disciplinaria: 'por_evaluar', norma_referida: null },
    actuacion: 'Se solicitó una conversación con la familia para conocer la situación y evaluar apoyos o un plazo razonable. La referencia exacta del reglamento queda pendiente de revisión institucional; no se registra una sanción.'
  },
  {
    numero: 5, categoria: 'disciplina', tipo: 'Tardanzas reiteradas',
    titulo: 'Entrevista familiar por dificultades de puntualidad', fecha: '2026-10-09 13:05:00', lugar: 'Portería',
    registrador: 'auxiliar', alumnos: [[3, 'involucrado']], prioridad: 'normal', estado: 'cerrada', minutosActuacion: 7 * 24 * 60,
    descripcion: 'El auxiliar registró llegadas posteriores al inicio de clases en tres días de la semana. El estudiante refirió dificultades con el traslado familiar. La apoderada confirmó durante la entrevista que el horario de transporte había cambiado temporalmente. Se documentan los horarios observados y la explicación recibida sin convertir automáticamente la dificultad de traslado en una falta grave.',
    campos: { gravedad_disciplinaria: 'por_evaluar' },
    actuacion: 'Se acordó con la apoderada una alternativa de traslado y una revisión de puntualidad. La observación posterior mostró cumplimiento del horario; Tutoría dejó constancia de conclusión del seguimiento, sin imponer sanción.'
  },
  {
    numero: 6, categoria: 'disciplina', tipo: 'Salida del aula sin autorización',
    titulo: 'Salida del aula durante una actividad escrita', fecha: '2026-10-12 15:35:00', lugar: 'Aula de 2.º de secundaria A',
    alumnos: [[6, 'involucrado']], prioridad: 'normal', estado: 'confirmada',
    descripcion: 'Mientras el grupo realizaba una actividad escrita, el estudiante salió del aula sin comunicarlo al docente. El auxiliar lo encontró en el pasillo y lo acompañó de regreso. El estudiante señaló que buscaba agua y que no había logrado llamar la atención del docente. Se registran ambas observaciones y se escuchará la explicación antes de determinar una medida educativa.',
    campos: { gravedad_disciplinaria: 'por_evaluar' },
    actuacion: 'Se verificó que el estudiante se encontrara bien y se recordó el procedimiento para solicitar una salida. El docente programó una conversación breve para identificar si existe alguna necesidad adicional.'
  },
  {
    numero: 7, categoria: 'salud', tipo: 'Pérdida transitoria de respuesta observada',
    titulo: 'Desmayo durante la formación', fecha: '2026-10-13 13:00:00', lugar: 'Patio de formación',
    alumnos: [[4, 'afectado']], prioridad: 'urgente', estado: 'en_seguimiento', restringida: true,
    descripcion: 'Durante la formación, un estudiante manifestó mareo y perdió momentáneamente la respuesta a las indicaciones del docente. Se despejó el área y se solicitó atención inmediata al personal encargado. El registro describe únicamente lo observado; no establece la causa del episodio ni un diagnóstico médico. Se mantuvo acompañamiento del estudiante hasta la llegada de su apoderado y la coordinación de atención correspondiente.',
    campos: { sintomas_observados: 'Mareo referido y pérdida transitoria de respuesta observada.', requiere_atencion_inmediata: 1 },
    actuacion: 'Se interrumpió la participación del estudiante en la formación, se activó la atención inicial y se contactó al apoderado. El seguimiento se limita a confirmar la recepción de atención y las indicaciones escolares que la familia comunique.'
  },
  {
    numero: 8, categoria: 'salud', tipo: 'Malestar repentino durante clases',
    titulo: 'Malestar comunicado al docente', fecha: '2026-10-14 16:10:00', lugar: 'Aula de 5.º de primaria A',
    alumnos: [[2, 'afectado']], prioridad: 'alta', estado: 'cerrada', restringida: true, minutosActuacion: 24 * 60,
    descripcion: 'Durante la clase, el estudiante comunicó que se sentía indispuesto y pidió detener la actividad. El docente observó que permanecía sentado y respondía a las preguntas. Se solicitó apoyo para acompañarlo al espacio de atención, evitando dejarlo solo. No se atribuye el malestar a alimentos, medicamentos o una enfermedad sin información profesional que lo sustente.',
    campos: { sintomas_observados: 'Malestar referido por el estudiante; respondía a las indicaciones.', requiere_atencion_inmediata: 1 },
    actuacion: 'Se brindó acompañamiento y se comunicó la situación a la familia. La apoderada acudió al colegio; al día siguiente informó que podía retomar las actividades. Se cerró el seguimiento escolar sin registrar información clínica adicional.'
  },
  {
    numero: 9, categoria: 'salud', tipo: 'Angustia emocional observada',
    titulo: 'Acompañamiento reservado durante la jornada', fecha: '2026-10-15 15:00:00', lugar: 'Espacio de orientación',
    registrador: 'subdirector', reportante: 'docente', alumnos: [[8, 'afectado']], prioridad: 'alta', estado: 'en_seguimiento', restringida: true,
    descripcion: 'El docente observó que el estudiante lloraba y tenía dificultad para continuar una actividad. Le ofreció un espacio tranquilo y acompañamiento, y comunicó la necesidad de apoyo a la autoridad correspondiente. El estudiante aceptó conversar en privado. Se omiten detalles personales que no son necesarios para organizar el apoyo escolar y no se formula un diagnóstico sobre su estado emocional.',
    campos: { sintomas_observados: 'Llanto y dificultad para continuar la actividad observados por el docente.', requiere_atencion_inmediata: 1 },
    actuacion: 'Se coordinó acompañamiento reservado y una comunicación cuidadosa con el apoderado. El responsable revisará las medidas de apoyo sin difundir el contenido de la conversación al grupo.'
  },
  {
    numero: 10, categoria: 'seguridad', tipo: 'Caída durante actividad física',
    titulo: 'Caída durante un ejercicio de desplazamiento', fecha: '2026-10-16 14:30:00', lugar: 'Losa deportiva',
    alumnos: [[7, 'afectado'], [8, 'testigo']], prioridad: 'alta', estado: 'en_seguimiento',
    descripcion: 'Durante un ejercicio de desplazamiento, el estudiante perdió el equilibrio y cayó sobre la superficie de la losa. El docente detuvo la actividad y un compañero indicó haber observado la caída sin contacto previo con otros estudiantes. Se registró la necesidad de atención inicial y de revisar el área. El hecho se trata como un accidente; no se le asigna gravedad disciplinaria.',
    campos: { riesgo_identificado: 'Caída durante desplazamiento en la losa; revisar la superficie antes de reanudar.', riesgo_persistente: 0 },
    actuacion: 'Se suspendió el ejercicio, se brindó atención inicial y se avisó al apoderado. El docente revisó el espacio y modificó la actividad; queda pendiente confirmar la evolución comunicada por la familia.'
  },
  {
    numero: 11, categoria: 'seguridad', tipo: 'Instalación eléctrica expuesta',
    titulo: 'Cable expuesto detectado antes del ingreso al aula', fecha: '2026-10-19 12:35:00', lugar: 'Aula de 2.º de secundaria A',
    registrador: 'auxiliar', reportante: 'docente', alumnos: [], prioridad: 'urgente', estado: 'en_seguimiento',
    descripcion: 'Antes del ingreso de estudiantes, el docente observó un tramo de cable fuera de su cubierta cerca de un tomacorriente. Comunicó el hallazgo al auxiliar y se mantuvo cerrada esa zona. No se identificaron estudiantes afectados ni se registró contacto con el cable. La presencia de tensión no fue comprobada por personal no especializado; se solicitó evaluación técnica.',
    campos: { riesgo_identificado: 'Cable fuera de su cubierta junto a un tomacorriente.', riesgo_persistente: 1 },
    actuacion: 'Se restringió el acceso, se trasladó al grupo a otro ambiente y se informó a Dirección para coordinar revisión por personal competente. El aula permanecerá fuera de uso hasta contar con la verificación correspondiente.'
  },
  {
    numero: 12, categoria: 'seguridad', tipo: 'Superficie resbaladiza',
    titulo: 'Piso mojado en pasillo de primaria', fecha: '2026-10-20 15:25:00', lugar: 'Pasillo de primaria',
    registrador: 'auxiliar', alumnos: [], prioridad: 'alta', estado: 'cerrada',
    descripcion: 'Al finalizar el recreo, el auxiliar observó agua acumulada en un sector del pasillo próximo al lavadero. Se detuvo el tránsito por ese sector y se habilitó un paso alternativo. No se observaron caídas ni se recibieron reportes de estudiantes afectados. Se dejó constancia del riesgo y de las medidas preventivas sin atribuir el derrame a una persona sin evidencia.',
    campos: { riesgo_identificado: 'Superficie húmeda en una vía de circulación.', riesgo_persistente: 0 },
    actuacion: 'Se señalizó y secó el área, y se verificó el paso antes de reabrirlo. Dirección recibió la observación para revisar el lavadero. Se concluyó la medida inmediata al eliminar la acumulación de agua.'
  },
  {
    numero: 13, categoria: 'bienes', tipo: 'Pertenencia extraviada',
    titulo: 'Mochila extraviada y recuperada', fecha: '2026-10-21 15:15:00', lugar: 'Patio de primaria',
    alumnos: [[3, 'afectado']], prioridad: 'normal', estado: 'cerrada',
    descripcion: 'Después del recreo, el estudiante comunicó que no encontraba la mochila que había dejado junto a una banca. El docente registró la descripción general del objeto y organizó una búsqueda por los espacios utilizados durante el recreo. La mochila fue localizada cerca del aula contigua y el estudiante la reconoció. No se contó con evidencia de sustracción ni se señaló a otros estudiantes como responsables.',
    campos: { descripcion_dano: 'Extravío temporal de mochila; recuperada sin daño advertido.' },
    actuacion: 'Se entregó la mochila al estudiante, se verificó con él la recuperación de sus pertenencias y se informó a la familia. Se dejó constancia de conclusión y se recordó el espacio destinado a guardar los útiles.'
  },
  {
    numero: 14, categoria: 'bienes', tipo: 'Daño accidental de infraestructura',
    titulo: 'Fisura de ventana durante una actividad', fecha: '2026-10-22 16:00:00', lugar: 'Aula de 2.º de secundaria A',
    alumnos: [[5, 'involucrado'], [6, 'testigo']], prioridad: 'alta', estado: 'en_seguimiento',
    descripcion: 'Durante el traslado de materiales, una pieza de madera alcanzó una ventana y se observó una fisura en el vidrio. El docente detuvo la actividad y mantuvo a los estudiantes alejados del área. Los relatos iniciales describen un movimiento accidental que debe contrastarse. No hubo reporte de estudiantes afectados; se documenta el daño sin establecer una obligación de pago ni responsabilidad disciplinaria.',
    campos: { descripcion_dano: 'Fisura visible en un paño de vidrio; valoración económica pendiente.' },
    actuacion: 'Se aisló el sector y se comunicó a Dirección la necesidad de revisión y reparación. Se escuchará por separado a quienes observaron el hecho; no se ha fijado un importe de reposición.'
  },
  {
    numero: 15, categoria: 'bienes', tipo: 'Presunta sustracción por verificar',
    titulo: 'Objeto personal no localizado al finalizar la clase', fecha: '2026-10-23 16:40:00', lugar: 'Aula de 3.º de secundaria B',
    alumnos: [[7, 'afectado']], prioridad: 'normal', estado: 'confirmada', restringida: true,
    descripcion: 'El estudiante indicó que un objeto personal que había guardado en su mochila ya no estaba al terminar la clase. El docente registró el momento en que el estudiante advirtió la ausencia y solicitó revisar primero los espacios utilizados. La afirmación de una posible sustracción corresponde al reporte recibido y no a una conclusión institucional. No se identifican presuntos responsables ni se autoriza una revisión indiscriminada de pertenencias.',
    campos: { descripcion_dano: 'Objeto personal no localizado; pérdida o sustracción aún sin determinar.' },
    actuacion: 'Se comunicó el reporte a la autoridad correspondiente para verificar la información de forma reservada. Se orientó al estudiante sobre cómo aportar datos adicionales sin formular acusaciones públicas.'
  },
  {
    numero: 16, categoria: 'proteccion_estudiantil', tipo: 'Posible maltrato comunicado',
    titulo: 'Reporte reservado que requiere evaluación protectora', fecha: '2026-10-26 14:00:00', lugar: 'Espacio de atención reservada',
    registrador: 'director', reportante: 'docente', alumnos: [[4, 'afectado']], prioridad: 'urgente', estado: 'en_seguimiento', restringida: true,
    descripcion: 'Un docente comunicó a Dirección información que podría indicar una situación de maltrato que afecta a un estudiante. Se registró la recepción del reporte y la necesidad de evaluación por la autoridad competente, sin incorporar un relato explícito ni interrogar reiteradamente al estudiante. La información está pendiente de verificación y no se atribuye responsabilidad a una persona determinada en este registro de demostración.',
    campos: { riesgo_inmediato: 1, requiere_derivacion: 1 },
    actuacion: 'Dirección coordinó la atención y derivación que corresponda por el protocolo aplicable. La comunicación familiar se mantiene sujeta a evaluación de seguridad por la autoridad competente; no se ejecuta automáticamente si pudiera aumentar el riesgo.'
  },
  {
    numero: 17, categoria: 'proteccion_estudiantil', tipo: 'Posible desprotección por evaluar',
    titulo: 'Necesidad de apoyo comunicada por el docente', fecha: '2026-10-27 14:20:00', lugar: 'Dirección',
    registrador: 'subdirector', reportante: 'docente', alumnos: [[2, 'afectado']], prioridad: 'alta', estado: 'confirmada', restringida: true,
    descripcion: 'El docente comunicó dificultades reiteradas para ubicar a una persona responsable al finalizar actividades escolares. El estudiante refirió cambios recientes en la organización de sus cuidados, sin que el docente pudiera verificar su alcance. Se registra una necesidad de evaluación de apoyo y protección, sin concluir abandono ni incorporar información íntima no necesaria. La autoridad debe contrastar la situación antes de determinar las medidas.',
    campos: { riesgo_inmediato: 0, requiere_derivacion: 1 },
    actuacion: 'Se asignó evaluación reservada al Subdirector. La forma y oportunidad de contactar a la familia se decidirán considerando la seguridad del estudiante y el protocolo institucional.'
  },
  {
    numero: 18, categoria: 'seguridad', tipo: 'Obstáculo en ruta de circulación',
    titulo: 'Auxiliar registra una observación reportada por docente', fecha: '2026-10-28 12:40:00', lugar: 'Acceso al patio',
    registrador: 'auxiliar', reportante: 'docente', alumnos: [], prioridad: 'normal', estado: 'cerrada',
    descripcion: 'La docente de turno observó cajas que reducían el ancho del acceso al patio antes de la llegada del alumnado. Comunicó la situación al auxiliar, quien verificó el lugar y registró la incidencia con su propia cuenta. La docente figura como reportante y el auxiliar como registrador; no se les atribuye la misma identidad. No hubo estudiantes afectados durante la observación.',
    campos: { riesgo_identificado: 'Reducción del paso por materiales almacenados temporalmente.', riesgo_persistente: 0 },
    actuacion: 'El auxiliar coordinó el retiro de las cajas y verificó el paso libre antes del ingreso. Se informó a Dirección para mantener despejadas las rutas de circulación.'
  },
  {
    numero: 19, categoria: 'seguridad', tipo: 'Reporte con testigo adulto protegido',
    titulo: 'Observación reservada en el acceso al colegio', fecha: '2026-10-28 17:10:00', lugar: 'Acceso de secundaria',
    registrador: 'subdirector', reportante: 'docente', alumnos: [[8, 'afectado']], testigo_externo: true,
    prioridad: 'alta', estado: 'en_seguimiento', restringida: true,
    descripcion: 'La docente comunicó que un estudiante solicitó apoyo al advertir una discusión cerca del acceso al colegio. Un trabajador externo que se encontraba en el lugar aportó información sobre el momento en que se produjo el intercambio y solicitó que su identidad se tratara de manera reservada. La autoridad recogió el reporte sin atribuir responsabilidad antes de contrastar los relatos. La persona adulta queda relacionada como testigo y no se le asigna una matrícula estudiantil.',
    campos: { riesgo_identificado: 'Discusión próxima al acceso; secuencia pendiente de contraste.', riesgo_persistente: 0 },
    actuacion: 'Se acompañó al estudiante y se coordinó una evaluación reservada del reporte. Se protegió el expediente completo y se dejó pendiente la verificación por la autoridad habilitada.'
  },
  {
    numero: 20, categoria: 'seguridad', tipo: 'Corrección documental de ubicación',
    titulo: 'Rectificación aprobada de una ubicación registrada', fecha: '2026-10-28 15:00:00', lugar: 'Pasillo de primaria',
    alumnos: [], prioridad: 'normal', estado: 'cerrada', especial: 'aprobada',
    descripcion: 'El docente registró una señal desprendida en el pasillo de primaria y solicitó revisar su fijación. Al contrastar su anotación con la inspección del auxiliar, advirtió que había consignado el pasillo equivocado. Solicitó una rectificación documental para indicar el acceso de secundaria. Esta versión original se conserva íntegra; la versión corregida y la decisión independiente se almacenan por separado.',
    campos: { riesgo_identificado: 'Señal con fijación suelta en una zona de paso.', riesgo_persistente: 0 },
    actuacion: 'Se aseguró la señal y se verificó su fijación. El Subdirector revisó la solicitud del docente y aprobó la corrección de ubicación, dejando constancia del fundamento y preservando el registro anterior.'
  },
  {
    numero: 21, categoria: 'bienes', tipo: 'Rectificación de hechos por evaluar',
    titulo: 'Propuesta de modificación rechazada por falta de sustento', fecha: '2026-10-29 15:10:00', lugar: 'Aula de 3.º de secundaria B',
    alumnos: [[8, 'afectado']], prioridad: 'normal', estado: 'en_seguimiento', especial: 'rechazada',
    descripcion: 'El estudiante reportó que no encontraba un cuaderno al finalizar la jornada. El docente registró la búsqueda inicial sin resultado y posteriormente solicitó cambiar el registro para indicar que el objeto había sido recuperado. La información aportada con la solicitud no permitió confirmar la entrega al estudiante. La autoridad rechazó la propuesta y mantuvo vigente esta versión, sin eliminar el texto propuesto ni cerrar la búsqueda.',
    campos: { descripcion_dano: 'Cuaderno no localizado; recuperación aún sin verificar.' },
    actuacion: 'El Subdirector solicitó evidencia de la entrega antes de cambiar el hecho registrado. Se mantiene el seguimiento y se orientó al docente para presentar una nueva solicitud si obtiene información verificable.'
  },
  {
    numero: 22, categoria: 'seguridad', tipo: 'Instalación eléctrica expuesta',
    titulo: 'Registro duplicado del cable expuesto', fecha: '2026-10-19 12:35:00', lugar: 'Aula de 2.º de secundaria A',
    registrador: 'auxiliar', reportante: 'docente', alumnos: [], prioridad: 'urgente', estado: 'anulada', especial: 'duplicado',
    descripcion: 'El auxiliar recibió nuevamente la comunicación sobre el cable expuesto antes de advertir que el mismo hallazgo ya figuraba registrado. La fecha, el aula y la descripción del riesgo coincidían con el expediente original. Se solicitó la anulación lógica por duplicación y una autoridad independiente comprobó la coincidencia. Este registro conserva su contenido y referencia al expediente que continúa el seguimiento; no se fusiona ni elimina información.',
    campos: { riesgo_identificado: 'Cable expuesto; mismo hallazgo del expediente original de la instalación eléctrica.', riesgo_persistente: 1 },
    actuacion: 'Se dejó constancia de que las medidas y la verificación técnica continúan en el expediente original. La solicitud de anulación por duplicado quedó aprobada y este expediente se conserva con estado anulada.'
  },
  {
    numero: 23, categoria: 'convivencia', tipo: 'Revisión con reunión documentada',
    titulo: 'Revisión de una solicitud con participantes y acta', fecha: '2026-10-29 14:00:00', lugar: 'Aula de 5.º de primaria A',
    alumnos: [[1, 'afectado'], [2, 'testigo']], prioridad: 'normal', estado: 'en_seguimiento', especial: 'reunion',
    descripcion: 'Durante una actividad grupal se produjo una discrepancia sobre los turnos de participación. El docente registró que un estudiante se retiró de la mesa y luego solicitó precisar la actividad que realizaba el grupo. La revisión reunió al Subdirector, al docente, al estudiante y a su apoderada para contrastar la secuencia. El acta conserva los aportes y la conclusión; la solicitud permanece pendiente de decisión y la reunión por sí sola no cambia los hechos.',
    campos: { ambito_convivencia: 'presencial', requiere_mediacion: 1 },
    actuacion: 'Se realizó una reunión de revisión y se dejó acta con los participantes identificados. Se acordó mantener acompañamiento al grupo mientras una autoridad independiente evalúa la solicitud.'
  },
  {
    numero: 24, categoria: 'convivencia', tipo: 'Evaluación con autoridad inhibida',
    titulo: 'Autoridad declara un conflicto de interés', fecha: '2026-10-30 14:00:00', lugar: 'Patio de secundaria',
    alumnos: [[6, 'afectado']], prioridad: 'alta', estado: 'en_seguimiento', restringida: true, especial: 'conflicto',
    descripcion: 'El docente recibió un reporte sobre comentarios dirigidos a un estudiante y solicitó precisar la fecha de un episodio. Antes de evaluar la solicitud, el Director declaró una relación personal con una de las familias que podría afectar su independencia. Se registró su inhibición sin resolver la solicitud ni asumir que ello confirma los hechos reportados. La evaluación queda a cargo de una autoridad competente que no esté impedida.',
    campos: { ambito_convivencia: 'presencial', requiere_mediacion: 0 },
    actuacion: 'Se dejó constancia del conflicto y se suspendió la intervención del Director en la evaluación del caso. La solicitud continúa pendiente; el Administrador no recibe facultades de sustitución.'
  }
];

export const personalEscolar = [
  ['director', 'Ricardo Alberto', 'Salazar Mendoza', 'rsalazar'],
  ['subdirector', 'María Elena', 'Huamán Rojas', 'mhuaman'],
  ['coordinador_tutoria', 'José Luis', 'Paredes Díaz', 'jparedes'],
  ['docente', 'Lucía Patricia', 'Ramos Vega', 'lramos'],
  ['auxiliar', 'Carlos Enrique', 'Torres Castillo', 'ctorres'],
  ['administrador', 'Hugo', 'Vargas', 'hugodp19']
];
const estudiantesNombres = [
  ['Diego Alonso', 'Quispe Flores'], ['Mateo André', 'Quispe Flores'],
  ['Adrián Sebastián', 'Cárdenas Rojas'], ['Nicolás Gabriel', 'Cárdenas Rojas'],
  ['Joaquín Eduardo', 'Mendoza Paredes'], ['Samuel Ignacio', 'Mendoza Paredes'],
  ['Leonardo Rafael', 'Chávez Huamán'], ['Thiago Daniel', 'Chávez Huamán']
];

// Prepara identidades y permisos de prueba en SQL con las contraseñas ya suministradas por la suite.
async function identidades(db, claves) {
  const usuarios = {}, personas = {}, estudiantes = {};
  for (const [indice, [rol, nombres, apellidos, nombreUsuario]] of personalEscolar.entries()) {
    const [[r]] = await db.execute('SELECT id FROM roles WHERE codigo = ?', [rol]);
    const idRol = r?.id || await insertar(db, 'roles', { codigo: rol, nombre: nombresRoles[indice] });
    const idPersona = await insertar(db, 'personas', { codigo_interno: `PER-2026-${String(indice + 1).padStart(3, '0')}`, nombres, apellidos, es_personal: 1, activo: 1 });
    const id = await insertar(db, 'usuarios', { id_persona: idPersona, id_rol: idRol, nombre_usuario: nombreUsuario,
      contrasena_hash: await crearHash(claves[`${rol.toUpperCase()}_PASSWORD`]), activo: 1, creado_en: new Date() });
    usuarios[rol] = { id, id_rol: idRol, id_persona: idPersona, nombre: `${nombres} ${apellidos}` };
    personas[rol] = { id: idPersona, nombre: `${nombres} ${apellidos}`, condicion: 'personal' };
  }
  for (const [codigo, permitidos] of Object.entries(limitesPermisos)) {
    await db.execute('INSERT INTO permisos (codigo, descripcion) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM permisos WHERE codigo = ?)', [codigo, `Acción institucional: ${codigo}`, codigo]);
    const [[p]] = await db.execute('SELECT id FROM permisos WHERE codigo = ?', [codigo]);
    for (const rol of permitidos) await db.execute('INSERT INTO roles_permisos (id_rol, id_permiso) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM roles_permisos WHERE id_rol = ? AND id_permiso = ?)', [usuarios[rol].id_rol, p.id, usuarios[rol].id_rol, p.id]);
  }
  const madres = [['Verónica Isabel', 'Flores Medina'], ['Rosa Angélica', 'Rojas Sánchez'], ['Carmen Cecilia', 'Paredes Velásquez'], ['Patricia Susana', 'Huamán Vargas']];
  for (const [indice, [nombres, apellidos]] of madres.entries()) {
    const id = await insertar(db, 'personas', { codigo_interno: `APO-2026-00${indice + 1}`, nombres, apellidos, es_personal: 0, activo: 1 });
    personas[`apoderado${indice + 1}`] = { id, nombre: `${nombres} ${apellidos}`, condicion: 'apoderado' };
  }
  const aulas = [];
  for (const [nivel, grado, seccion] of [['primaria', 5, 'A'], ['primaria', 6, 'B'], ['secundaria', 2, 'A'], ['secundaria', 3, 'B']]) {
    const [[a]] = await db.execute('SELECT id FROM aulas WHERE anio_lectivo = 2026 AND nivel = ? AND grado = ? AND seccion = ?', [nivel, grado, seccion]);
    aulas.push(a?.id || await insertar(db, 'aulas', { anio_lectivo: 2026, nivel, grado, seccion, activo: 1 }));
  }
  for (const [indice, [nombres, apellidos]] of estudiantesNombres.entries()) {
    const id = await insertar(db, 'personas', { codigo_interno: `EST-2026-00${indice + 1}`, nombres, apellidos, es_personal: 0, activo: 1 });
    await insertar(db, 'estudiantes', { id_persona: id, codigo_estudiante: `2026-00${indice + 1}`, activo: 1 });
    const grupo = Math.floor(indice / 2);
    const matricula = await insertar(db, 'matriculas', { id_estudiante: id, id_aula: aulas[grupo], fecha_inicio: '2026-03-02' });
    const apoderado = personas[`apoderado${grupo + 1}`];
    await insertar(db, 'estudiantes_apoderados', { id_estudiante: id, id_apoderado: apoderado.id, vinculo: 'madre', es_principal: 1, vigente_desde: '2026-03-02' });
    estudiantes[indice + 1] = { id, matricula, nombre: `${nombres} ${apellidos}`, apoderado };
  }
  const testigo = await insertar(db, 'personas', { codigo_interno: 'EXT-2026-001', nombres: 'Miguel Ángel', apellidos: 'Soto Benavides', es_personal: 0, activo: 1 });
  for (const [indice, [nombres, apellidos]] of [['Rosa Milagros', 'Vega Carrillo'], ['Luis Fernando', 'Navarro Espinoza']].entries()) {
    await insertar(db, 'personas', { codigo_interno: `PER-2026-10${indice + 1}`, nombres, apellidos, es_personal: 1, activo: 1 });
  }
  return { usuarios, personas, estudiantes, testigo };
}

const nombresRoles = ['Director', 'Subdirector', 'Coordinador de Tutoría', 'Docente', 'Auxiliar', 'Administrador'];
const fecha = (valor, minutos = 0) => new Date(new Date(`${valor.replace(' ', 'T')}Z`).getTime() + minutos * 60000).toISOString().slice(0, 19).replace('T', ' ');

// Ordena los instantes sintéticos para que solicitudes, decisiones y seguimiento resulten coherentes.
function minutosSeguimiento(caso) {
  if (caso.minutosActuacion) return caso.minutosActuacion;
  if (['aprobada', 'rechazada', 'duplicado'].includes(caso.especial)) return 181;
  if (caso.especial === 'reunion') return 160;
  if (caso.especial === 'conflicto') return 65;
  return 20;
}

async function historial(db, actor, accion, instante, destino = {}) {
  const { id_incidencia, ...referencias } = destino;
  await auditar(db, actor, id_incidencia, accion, { ...referencias, ocurrido_en: instante });
}

// Construye las relaciones y evidencias de un expediente sintético, incluida su versión vigente.
async function crearCaso(db, caso, identidades) {
  const { usuarios, personas, estudiantes } = identidades;
  const registrador = usuarios[caso.registrador || 'docente'];
  const reportante = personas[caso.reportante || caso.registrador || 'docente'];
  const [[tipoExistente]] = await db.execute('SELECT id FROM tipos_incidencia WHERE categoria = ? AND nombre = ?', [caso.categoria, caso.tipo]);
  const tipo = tipoExistente?.id || await insertar(db, 'tipos_incidencia', {
    categoria: caso.categoria, nombre: caso.tipo, minimo_estudiantes: caso.alumnos.length ? 1 : 0, activo: 1
  });
  const registrada = fecha(caso.fecha, caso.numero === 22 ? 30 : 10);
  const confirmada = fecha(registrada, 5);
  const id = await insertar(db, 'incidencias', { id_registrador: registrador.id, id_rol_registrador: registrador.id_rol,
    nombre_registrador: registrador.nombre, registrada_en: registrada, estado: 'borrador', prioridad: caso.prioridad,
    confidencialidad: caso.restringida ? 'restringida' : 'interna' });
  const versionDatos = { id_incidencia: id, numero_version: 1, estado_version: 'confirmada', id_autor: registrador.id,
    creada_en: confirmada, id_tipo: tipo, titulo: caso.titulo,
    descripcion: caso.descripcion, ocurrida_en: caso.fecha, lugar: caso.lugar, id_reportante: reportante.id,
    condicion_reportante: reportante.condicion, nombre_reportante: reportante.nombre, ...caso.campos };
  const version = await insertar(db, 'versiones_incidencia', versionDatos);
  for (const [numero, participacion] of caso.alumnos) {
    const alumno = estudiantes[numero];
    await insertar(db, 'involucrados', { id_version: version, id_persona: alumno.id, id_matricula: alumno.matricula, participacion });
  }
  for (const adulto of caso.adultos || []) await insertar(db, 'involucrados', { id_version: version, id_persona: adulto.id, participacion: 'testigo' });
  await db.execute('UPDATE incidencias SET id_version_vigente = ?, confirmada_en = ?, estado = ? WHERE id = ?', [version, confirmada, 'confirmada', id]);
  await historial(db, registrador, caso.numero > 24 ? 'carga_escolar_adicional' : 'carga_escolar', confirmada,
    { id_incidencia: id, id_version: version, campo: 'escenario', valor_nuevo: String(caso.numero) });
  const responsable = usuarios[caso.restringida ? 'subdirector' : 'coordinador_tutoria'];
  const seguimiento = minutosSeguimiento(caso);
  const actuacion = await insertar(db, 'actuaciones', { id_incidencia: id, id_autor: responsable.id, id_rol_autor: responsable.id_rol,
    tipo: 'actuacion', detalle: caso.actuacion, realizada_en: fecha(confirmada, seguimiento), registrada_en: fecha(confirmada, seguimiento + 1),
    id_responsable: responsable.id, fecha_limite: fecha(confirmada, 7 * 24 * 60).slice(0, 10) });
  await historial(db, responsable, 'demo_actuacion', fecha(confirmada, seguimiento + 1), { id_incidencia: id, id_actuacion: actuacion });
  // Protección: no asumir que contactar a la familia siempre es seguro.
  if (caso.alumnos.length && caso.categoria !== 'proteccion_estudiantil') {
    const alumno = estudiantes[caso.alumnos[0][0]];
    const comunicacion = await insertar(db, 'actuaciones', { id_incidencia: id, id_autor: responsable.id, id_rol_autor: responsable.id_rol,
      tipo: 'actuacion', detalle: `Se comunicó a ${alumno.apoderado.nombre}, apoderada de ${alumno.nombre}, la atención escolar y los próximos pasos descritos en este expediente. Se solicitó aportar información pertinente por un canal reservado, sin divulgar datos de otros estudiantes.`,
      realizada_en: fecha(confirmada, 30), registrada_en: fecha(confirmada, 31), id_responsable: responsable.id });
    await historial(db, responsable, 'demo_comunicacion', fecha(confirmada, 31), { id_incidencia: id, id_actuacion: comunicacion });
  }
  return { id, version, versionDatos, registrador, confirmada, responsable };
}

// Prepara estados históricos de prueba para verificar versiones, revisiones y conflictos sin simular SQL.
async function crearEscenarioEspecial(db, caso, registro, registros, identidades) {
  const { usuarios, personas, estudiantes } = identidades;
  const { id, version, versionDatos, registrador, confirmada } = registro;
  const decisor = usuarios.subdirector;
  let propuesta = null;
  if (caso.especial !== 'duplicado') {
    let descripcion = `${caso.descripcion}\nPropuesta pendiente: precisar la actividad o la fecha referida sin borrar la versión original.`;
    if (caso.especial === 'aprobada') descripcion = 'El docente observó una señal con fijación suelta en el acceso de secundaria. El auxiliar verificó la ubicación y aseguró la señal. La versión anterior consignaba el pasillo de primaria por un error de anotación. Esta versión incorpora únicamente la ubicación contrastada mediante revisión independiente; la observación original y la solicitud se conservan.';
    if (caso.especial === 'rechazada') descripcion = 'Propuesta del solicitante: registrar que el cuaderno fue recuperado. La información recibida todavía no permite confirmar la entrega al estudiante. Esta propuesta se conserva como rechazada y no sustituye la versión vigente.';
    propuesta = await insertar(db, 'versiones_incidencia', { ...versionDatos, numero_version: 2, estado_version: caso.especial === 'aprobada' ? 'confirmada' : 'propuesta', creada_en: fecha(confirmada, 40), descripcion,
      lugar: caso.especial === 'aprobada' ? 'Acceso de secundaria' : caso.lugar });
    for (const [numero, participacion] of caso.alumnos) {
      const alumno = estudiantes[numero];
      await insertar(db, 'involucrados', { id_version: propuesta, id_persona: alumno.id, id_matricula: alumno.matricula, participacion });
    }
  }
  const resuelta = ['aprobada', 'rechazada', 'duplicado'].includes(caso.especial);
  const evaluada = caso.especial !== 'conflicto';
  const solicitud = await insertar(db, 'solicitudes_cambio', { id_incidencia: id, id_solicitante: registrador.id,
    id_rol_solicitante: registrador.id_rol, tipo: caso.especial === 'duplicado' ? 'anulacion' : 'rectificacion',
    justificacion: caso.especial === 'duplicado' ? 'Se comprobó que ambos registros describen el mismo cable expuesto, en el mismo lugar e instante.' : 'Se solicita contrastar la precisión documental descrita en la propuesta, conservando el contenido anterior.',
    creada_en: fecha(confirmada, 45), estado: resuelta ? (caso.especial === 'rechazada' ? 'rechazada' : 'aprobada') : 'pendiente',
    id_version_base: version, id_version_propuesta: propuesta,
    motivo_anulacion: caso.especial === 'duplicado' ? 'duplicado' : null,
    id_incidencia_duplicada: caso.especial === 'duplicado' ? registros[11].id : null,
    id_evaluador: evaluada ? decisor.id : null, evaluada_en: evaluada ? fecha(confirmada, 60) : null,
    requiere_revision: evaluada ? Number(caso.especial === 'reunion') : null,
    fundamento_revision: evaluada ? 'Se requiere contrastar las anotaciones y los aportes relacionados con la precisión solicitada.' : null,
    id_decisor: resuelta ? decisor.id : null, id_rol_decisor: resuelta ? decisor.id_rol : null,
    fundamento_decision: resuelta ? (caso.especial === 'rechazada' ? 'No hay evidencia suficiente de entrega; permanece vigente el relato anterior.' : 'Las anotaciones contrastadas permiten corroborar la corrección solicitada sin sustituir la evidencia original.') : null,
    decidida_en: resuelta ? fecha(confirmada, 180) : null });
  await historial(db, registrador, 'demo_solicitud_presentada', fecha(confirmada, 45), { id_incidencia: id, id_solicitud: solicitud });
  if (evaluada) await historial(db, decisor, 'demo_solicitud_evaluada', fecha(confirmada, 60), { id_incidencia: id, id_solicitud: solicitud });
  if (resuelta) await historial(db, decisor, 'demo_solicitud_resuelta', fecha(confirmada, 180), { id_incidencia: id, id_solicitud: solicitud, valor_nuevo: caso.especial === 'rechazada' ? 'rechazada' : 'aprobada' });
  if (caso.especial === 'aprobada') {
    await db.execute('UPDATE incidencias SET id_version_vigente = ? WHERE id = ?', [propuesta, id]);
    await historial(db, decisor, 'demo_version_vigente', fecha(confirmada, 180), { id_incidencia: id, id_version: propuesta,
      campo: 'id_version_vigente', valor_anterior: String(version), valor_nuevo: String(propuesta) });
  }
  if (caso.especial === 'reunion') {
    const revision = await insertar(db, 'revisiones', { id_incidencia: id, id_solicitud: solicitud, id_responsable: decisor.id,
      motivo: 'Contrastar la precisión solicitada escuchando a las personas relacionadas.', abierta_en: fecha(confirmada, 70), cerrada_en: fecha(confirmada, 150),
      estado: 'concluida', requiere_reunion: 1, hubo_reunion: 1, reunion_en: fecha(confirmada, 100), requiere_acta: 1,
      fundamento_acta: 'Conservar los aportes y la conclusión de la reunión para la evaluación de la solicitud.',
      acta: 'Se explicó el objeto de la solicitud y se escucharon los aportes de las personas relacionadas como participantes. Se contrastó la actividad realizada por el grupo y se acordó mantener acompañamiento. La conclusión se remite a una autoridad independiente; esta acta no aprueba la solicitud ni modifica los hechos. Los participantes se identifican en su relación, sin listas de nombres dentro del acta.',
      id_emisor_acta: decisor.id, acta_emitida_en: fecha(confirmada, 140), conclusion: 'Se recogieron elementos para evaluar la precisión documental. La decisión de la solicitud permanece pendiente.' });
    const participantes = [[decisor.id_persona, decisor.nombre, 'responsable'], [registrador.id_persona, registrador.nombre, 'solicitante oído'],
      [estudiantes[1].id, estudiantes[1].nombre, 'estudiante oído'], [personas.apoderado1.id, personas.apoderado1.nombre, 'apoderada']];
    for (const [idPersona, nombre, funcion] of participantes) await insertar(db, 'participantes_revision', {
      id_revision: revision, id_persona: idPersona, funcion, asistencia: 'asistio', nombre_participante: nombre, intervencion: 'Aportó información sobre la secuencia de la actividad.'
    });
    await historial(db, decisor, 'demo_revision_concluida', fecha(confirmada, 150), { id_incidencia: id, id_revision: revision });
  }
  if (caso.especial === 'conflicto') {
    const director = usuarios.director;
    const conflicto = await insertar(db, 'conflictos_interes', { id_incidencia: id, id_usuario_afectado: director.id,
      id_declarante: director.id, motivo: 'Relación personal declarada con una familia que puede afectar la independencia en la evaluación.', declarado_en: fecha(confirmada, 55), estado: 'inhibido' });
    await historial(db, director, 'demo_inhibicion', fecha(confirmada, 55), { id_incidencia: id, id_conflicto: conflicto });
  }
}

// Fixtures exclusivos de pruebas; exigir una base temporal propia antes de insertar.
export async function cargarColeccion(conexion, claves) {
  const [[{ base }]] = await conexion.query('SELECT DB_NAME() AS base');
  if (!/^sice_test_[a-f0-9]{16}$/.test(base)) throw new Error('Los fixtures solo permiten bases temporales de prueba.');
  const [[existente]] = await conexion.execute("SELECT COUNT(*) AS cantidad FROM historial WHERE accion = 'carga_escolar'");
  if (Number(existente.cantidad) === casos.length) return { cargadas: 0, existentes: casos.length };
  if (Number(existente.cantidad)) throw new Error('La colección está incompleta; no se sobrescribe.');
  const datos = await identidades(conexion, claves);
  const registros = {};
  for (const definicion of casos) {
    const caso = { ...definicion, adultos: definicion.testigo_externo ? [{ id: datos.testigo }] : [] };
    const registro = await crearCaso(conexion, caso, datos);
    registros[caso.numero] = registro;
    if (caso.especial) await crearEscenarioEspecial(conexion, caso, registro, registros, datos);
    if (caso.estado !== 'confirmada') {
      await conexion.execute('UPDATE incidencias SET estado = ? WHERE id = ?', [caso.estado, registro.id]);
      const autor = caso.estado === 'anulada' ? datos.usuarios.subdirector : registro.responsable;
      await auditar(conexion, autor, registro.id, 'estado_actualizado', {
        campo: 'estado', valor_anterior: 'confirmada', valor_nuevo: caso.estado
      });
    }
  }
  return { cargadas: casos.length, existentes: 0 };
}
