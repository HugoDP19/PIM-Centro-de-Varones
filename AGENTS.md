# Reglas de trabajo

- Alcance actual: configuración inicial. Consultar PROJECT_CONTEXT.md antes de ampliar funcionalidades.
- Aplicar Clean Code, KISS, DRY y YAGNI: nombres descriptivos, funciones pequeñas y responsabilidades claras. Evitar clases, capas y dependencias sin necesidad.
- Usar HTML5, CSS3, Bootstrap 5 y JavaScript vanilla; Node.js, Express y mysql2. Sin React, Angular, TypeScript, ORM ni Docker.
- Interfaz en public/, servidor en src/, scripts SQL en database/ y pruebas en test/. Mantener image/ y el logo original.
- Separar interfaz, lógica y consultas SQL cuando se implementen. Parametrizar consultas, validar entradas y autorizar acciones en el servidor.
- No sustituir MySQL con memoria ni simular conexiones. No inventar credenciales ni imprimir secretos.
- Las reglas de autorización de PROJECT_CONTEXT.md prevalecen sobre permisos configurables. No permitir eliminación física de incidencias.
- Implementar hash seguro de contraseñas, sesiones protegidas, cookies httpOnly y auditoría en sus fases correspondientes; no afirmar que ya existen.
- Mantener diseño responsive, HTML semántico y mensajes comprensibles. No exponer errores internos al cliente.
- Revisar git status antes de editar; preservar cambios y recursos existentes. Commits por cambio lógico: tipo(alcance): descripción. No push ni Pull Request sin autorización explícita.
- No versionar .env, contraseñas ni secretos. Mantener .env.example sin credenciales.
- Ejecutar npm test después de cambios del servidor y documentar verificaciones y límites reales. Actualizar PROJECT_CONTEXT.md al cerrar cada fase.
- Documentación breve, en español y sin emojis.
