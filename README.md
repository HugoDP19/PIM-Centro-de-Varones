# SICE-Local

Sistema de registro y seguimiento de incidencias escolares de la I.E.P. N.° 20874 Centro de Varones, San Vicente de Cañete.

Fase 1: servidor básico, portada institucional y configuración MySQL. No incluye login ni gestión de incidencias.

## Tecnologías

HTML5, CSS3, Bootstrap 5 y JavaScript vanilla; Node.js 24 o superior, Express, MySQL 8, mysql2 y dotenv. PDFKit se incorporará al desarrollar reportes; no se instala todavía. Se usa el ejecutor de pruebas nativo de Node.js, sin dependencias de desarrollo.

## Instalación

1. Abrir este repositorio y ejecutar `npm ci`.
2. Copiar `.env.example` como `.env` y completar los datos reales de MySQL.
3. Ejecutar `npm start` y abrir http://127.0.0.1:3000. Para desarrollo: `npm run dev`.
4. Ejecutar `npm test` para las pruebas y `npm run db:check` para comprobar la conexión real a MySQL.

En PowerShell con scripts deshabilitados, usar `npm.cmd` en lugar de `npm`. No se requiere modificar la política de ejecución.

La portada y `GET /api/health` funcionan sin una conexión MySQL porque no acceden a datos. La ruta informa solamente la disponibilidad HTTP, no el estado de la base de datos. El servidor escucha en loopback por defecto.

Para verificar MySQL se necesitan DB_HOST, DB_PORT (3306 por defecto), DB_NAME, DB_USER y DB_PASSWORD. La base y el usuario deben existir y tener permisos adecuados; esta fase no los crea ni define tablas. Nunca guardar credenciales en Git.

## Estructura

```text
database/            Instrucciones para futuros scripts SQL
image/               Logo institucional original
public/
  css/               Estilos de la portada
  js/                Comprobación de disponibilidad HTTP
  index.html         Portada mínima
src/
  app.js             Aplicación Express y archivos públicos
  server.js          Inicio del servidor
  database.js        Pool MySQL y comprobación explícita
test/                Pruebas HTTP y validación de configuración
.env.example         Variables sin credenciales
.gitignore           Exclusiones de Git
AGENTS.md            Reglas de colaboración
PROJECT_CONTEXT.md   Requisitos, decisiones y estado
package.json         Dependencias y comandos
package-lock.json    Versiones reproducibles
```

Bootstrap se sirve localmente desde su paquete instalado; no se publica todo node_modules ni se depende de una CDN. Express sirve el logo desde `/image/images.jpg` conservando la carpeta image/.

El remoto estaba vacío al clonarlo. El logo se copió sin alterar desde `../images/images.jpg`, recurso ya presente en el espacio de trabajo. No se generó ni reemplazó el escudo.

## Verificación responsive

La portada incluye viewport, contenedor fluido de Bootstrap, espaciado adaptable y una imagen proporcional. Comprobar en navegador a 320, 768 y 1280 píxeles que no haya desplazamiento horizontal y que el nombre y el escudo se vean completos. Los resultados efectivamente comprobados se registran en PROJECT_CONTEXT.md.
