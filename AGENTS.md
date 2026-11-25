# Reglas de trabajo

- Alcance actual: estabilización y preparación de entrega. Consultar PROJECT_CONTEXT.md antes de ampliar funcionalidades.
- Aplicar Clean Code, KISS, DRY y YAGNI: nombres descriptivos, funciones pequeñas y responsabilidades claras. Evitar capas y dependencias innecesarias.
- Usar HTML5, CSS3, Bootstrap 5 y JavaScript vanilla; Node.js, Express, SQL Server 2022 y mssql. Sin React, Angular, TypeScript, ORM ni Docker.
- Interfaz en public/, servidor en src/, scripts SQL en database/ y pruebas en test/. Conservar image/ y el logo original, blanco y guinda.
- Separar interfaz, lógica y consultas. Parametrizar valores, validar entradas y autorizar cada acción en el servidor. No simular la conexión ni sustituir SQL Server con memoria.
- Conservar las 22 tablas, sus relaciones y los registros existentes. No ejecutar schema.sql sobre tablas instaladas ni eliminar bases existentes.
- Las reglas de PROJECT_CONTEXT.md y database/REGLAS_FUNCIONALES.md prevalecen sobre permisos configurables. Sin autoaprobación ni eliminación física de incidencias; Administrador sin expedientes.
- Mantener scrypt, sesiones revocables, cookies httpOnly, protección de origen y auditoría. No exponer errores internos ni imprimir credenciales.
- Datos sintéticos exclusivamente en pruebas aisladas; nunca cargarlos al iniciar ni mezclarlos con una instalación real. Verificar identidad antes de eliminar recursos temporales propios.
- Pruebas con escrituras solo en la base temporal propia; comparar SICE antes/después. No guardar capturas, PDF ni resultados temporales en el proyecto.
- Mantener interfaz responsive, HTML semántico y mensajes comprensibles. Comentarios breves en español solo en bloques importantes de JavaScript del backend; no añadir comentarios en public/.
- Revisar git status antes de editar y preservar cambios existentes. Commits por cambio lógico: tipo(alcance): descripción. Sin push ni Pull Request sin autorización explícita.
- No versionar .env, contraseñas ni archivos privados. Mantener .env.example sin credenciales.
- Ejecutar npm test después de cambios del servidor y la integración/navegador cuando se afecten sus flujos. Documentar resultados y límites reales; no declarar completo lo que siga pendiente.
- Actualizar README.md y PROJECT_CONTEXT.md al cerrar la fase. Documentación breve, en español y sin emojis.
