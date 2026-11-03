# Demostración local

Datos completamente sintéticos para revisión técnica. No describen estudiantes, trabajadores ni hechos reales del colegio. Las identidades usan códigos `DEMO-`; documentos, teléfonos y correos quedan NULL. No se obtienen datos de internet.

## Preparación y acceso

Con `.env` configurado para `NODE_ENV=development`, `DB_HOST=127.0.0.1` y `DB_NAME=sice_desarrollo`:

```text
npm run db:prepare
npm run db:demo
npm start
```

`db:prepare` crea exclusivamente una base nueva autorizada (`sice_desarrollo`, o `sice_pruebas` al pasar ese argumento). Si existe, solo verifica su estructura: no reejecuta DDL, borra ni repara automáticamente tablas. Conserva las 19 tablas escolares y agrega dos tablas técnicas de autenticación, `sesiones` e `intentos_acceso`.

`db:demo` exige desarrollo local, adquiere un bloqueo MySQL y carga una base vacía mediante una transacción. Si encuentra los 23 casos y las seis cuentas demo, no cambia filas. Si encuentra datos distintos o una carga incompleta, se detiene. No ejecuta cargas en el arranque del servidor ni en producción.

Las seis cuentas son `demo.director`, `demo.subdirector`, `demo.coordinador_tutoria`, `demo.docente`, `demo.auxiliar` y `demo.administrador`. Sus contraseñas aleatorias se guardan exclusivamente en `.env.demo.local`, excluido de Git, bajo `DEMO_<ROL>_PASSWORD`. Abrir ese archivo localmente para ingresar; la herramienta no imprime los valores. En MySQL solo se conserva el hash scrypt con sal individual. La carga repetida no restablece contraseñas.

El navegador permite comprobar login, sesión y logout. Para revisar los casos en Workbench, ejecutar `consultar-demo.sql`: son consultas locales de lectura, no una API disponible a los usuarios del sistema. Los módulos de expedientes y de administración de cuentas aún no están habilitados.

## Casos cargados

Cada marcador `DEMO-XX` aparece en el título. El código visible de expediente se deriva de su PK como `INC-000001`; no se cambió el modelo para añadir un código redundante. Fechas SQL en UTC y consultas de revisión en America/Lima (UTC-5). El nivel/grado/sección se obtiene de la matrícula de cada involucrado; los riesgos sin estudiantes indican su ubicación sin inventar una matrícula.

| Escenario | Contenido preparado | Estado |
| --- | --- | --- |
| 01 | Agresión durante recreo; dos involucrados y un testigo estudiantil | En seguimiento, restringido |
| 02 | Insultos reiterados y acompañamiento de Tutoría | En seguimiento, restringido |
| 03 | Posible acoso comunicado por apoderada, pendiente de contraste | Confirmada, restringido |
| 04 | Prendas escolares y justificación familiar por evaluar | En seguimiento |
| 05 | Tardanzas, entrevista y seguimiento posterior | Cerrada |
| 06 | Salida del aula, observación y explicación del estudiante | Confirmada |
| 07 | Desmayo, atención inmediata y comunicación familiar | En seguimiento, restringido |
| 08 | Malestar durante clases y seguimiento al día siguiente | Cerrada, restringido |
| 09 | Angustia emocional con información mínima | En seguimiento, restringido |
| 10 | Caída en educación física, sin gravedad disciplinaria | En seguimiento |
| 11 | Cable expuesto sin estudiantes afectados | En seguimiento |
| 12 | Piso mojado, señalización y secado | Cerrada |
| 13 | Mochila extraviada y recuperada, sin acusaciones | Cerrada |
| 14 | Ventana dañada accidentalmente; circunstancias por contrastar | En seguimiento |
| 15 | Presunta sustracción sin señalar responsables | Confirmada, restringido |
| 16 | Posible maltrato y derivación protectora, sin relato explícito | En seguimiento, restringido |
| 17 | Posible desprotección pendiente de evaluación | Confirmada, restringido |
| 18 | Auxiliar registrador y docente reportante distintos | Cerrada |
| 20 | Rectificación aprobada por Subdirector; versión original conservada | Cerrada, dos versiones |
| 21 | Rectificación rechazada; propuesta conservada sin volverla vigente | En seguimiento, dos versiones |
| 22 | Anulación lógica por duplicado del escenario 11 | Anulada, sin eliminación |
| 23 | Revisión concluida con reunión, cuatro participantes y acta | En seguimiento; solicitud pendiente |
| 24 | Director inhibido; solicitud pendiente sin suplencia del Administrador | En seguimiento, restringido |

Resultado en `sice_desarrollo`: **23 incidencias, 27 versiones, 39 actuaciones, 5 solicitudes, 1 revisión con 4 participantes y 1 conflicto de interés**. Se incluyen 6 roles/cuentas, 8 estudiantes, 4 apoderadas, 4 aulas y 8 matrículas. Estados: 4 confirmadas, 12 en seguimiento, 6 cerradas y 1 anulada. Las comunicaciones familiares se documentan donde corresponden; en Protección estudiantil quedan sujetas a evaluación de seguridad.

Las resoluciones, reuniones e inhibición son datos preparados por el cargador, no resultados producidos por módulos de negocio. Sus procedimientos y criterios institucionales no se aprueban mediante esta carga. No hay rutas para solicitar, evaluar, aprobar, anular, editar hechos o generar reportes.

## Escenarios 19 y 25

**19 — Testigo adulto protegido: documentado, no cargado.** Escenario pendiente: una apoderada reporta un hecho y un trabajador adulto lo presencia, sin participar en una revisión. Debe poder relacionarse al testigo con la versión y protegerse su identidad mediante el expediente restringido. `involucrados` solo admite estudiantes; no se crea un estudiante ficticio, una asistencia falsa ni una lista de identidades en texto. Requiere acordar la generalización de esa relación y, si se solicita acceso parcial, revisar también la confidencialidad. No se modifica esa decisión pendiente.

**25 — Intento de modificación no autorizado: prueba automatizada, sin nueva incidencia.** `npm run test:mysql` intenta GET/PATCH/PUT/DELETE de un expediente restringido con cada uno de los seis roles, recibe 403 y comprueba que versión e historial del caso no cambien. Sin sesión recibe 401. Actualmente se deniega el módulo completo: esto acredita el bloqueo de la fase, no una política futura de edición/lectura granular ni inmutabilidad frente a acceso SQL administrativo.

## Verificación y límites

- La suite MySQL usa exclusivamente `sice_pruebas`, conserva una copia sintética reproducible y credenciales locales separadas en `.env.pruebas.local`. No usa almacenamiento simulado. Rechazos de integridad dentro de transacciones revertidas; las pruebas HTTP generan sesiones y eventos de acceso reales. Nunca borra expedientes para limpiar pruebas.
- Se comprueban los metadatos de las 19 tablas, las 64 FK y sus índices, y los 41 CHECK activos; 41 entradas inválidas son rechazadas por CHECK, además de referencias incompatibles y duplicados. Un dato puede infringir varios CHECK: no se presupone su orden de evaluación.
- Autenticación probada: seis roles, credenciales válidas/incorrectas, cookies, persistencia de sesión, rotación, expiración, inactividad, revocación, cambios de cuenta y permisos, CSRF, límites de intentos y arranque sin conexión configurada.
- Chrome: 320/768/1280 px sin desbordamiento, logo cargado y flujo de acceso completo. Capturas locales en `.local/verificacion/`, excluidas de Git.
- Pendientes: gestión real de cuentas con autorización institucional, lectura de expedientes según matriz aprobada, formularios, seguimiento, flujos de solicitudes/revisión/conflictos y reportes. Tampoco se han configurado una cuenta SQL de privilegios mínimos ni transporte HTTPS real: `Secure` y rechazo de HTTP se prueban con la configuración del proxy local.
