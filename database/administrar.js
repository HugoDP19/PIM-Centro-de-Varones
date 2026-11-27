import { spawn } from 'node:child_process';

// Usa autenticación de Windows solo para instalación y bases temporales locales.
export function administrar(texto, base = 'master') {
  if (!/^(master|SICE|sice_test_[a-f0-9]{16})$/i.test(base)) {
    throw new Error('Base administrativa no autorizada.');
  }
  const executable =
    process.env.SQLCMD_PATH ||
    'C:/Program Files/Microsoft SQL Server/Client SDK/ODBC/170/Tools/Binn/SQLCMD.EXE';
  return new Promise((resolve, reject) => {
    const proceso = spawn(
      executable,
      [
        '-S',
        process.env.DB_SETUP_SERVER || 'localhost',
        '-E',
        '-C',
        '-b',
        '-x',
        '-W',
        '-h',
        '-1',
        '-w',
        '65535',
        '-f',
        '65001',
        '-d',
        base
      ],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let salida = '';
    let errores = '';
    proceso.stdout.on('data', (datos) => {
      salida += datos.toString('utf8');
    });
    proceso.stderr.on('data', (datos) => {
      errores += datos.toString('utf8');
    });
    proceso.once('error', () =>
      reject(new Error('No se pudo ejecutar sqlcmd para la administración local.'))
    );
    proceso.once('close', (codigo) => {
      if (codigo === 0) {
        resolve(salida.trim());
      } else {
        reject(
          Object.assign(new Error('La operación administrativa SQL Server falló.'), {
            detalle: salida + errores
          })
        );
      }
    });
    proceso.stdin.end('SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;\n' + texto + '\nGO\n');
  });
}
