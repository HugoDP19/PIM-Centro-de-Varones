import { PDFDocument } from 'pdfkit';
import { fileURLToPath } from 'node:url';

const guinda = '#881d32';
const fecha = (valor) => valor ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor)) : 'No precisada';
const nombreEstado = (valor) => valor.replaceAll('_', ' ');
const fechaCivil = (valor) => new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', dateStyle: 'short' }).format(new Date(valor));

export function generarInforme(datos) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, compress: false,
      info: { Title: 'INFORME DE INCIDENCIA ESCOLAR', Author: 'I.E.P. N.° 20874 Centro de Varones' } });
    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(partes)));
    const ancho = doc.page.width - 96;
    const limite = doc.page.height - 60;
    const codigo = `INC-${String(datos.incidencia.id).padStart(6, '0')}`;
    const emision = fecha(new Date());

    function cabecera() {
      doc.image(fileURLToPath(new URL('../image/images.jpg', import.meta.url)), 48, 35, { fit: [46, 58] });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(guinda).text('I.E.P. N.° 20874 CENTRO DE VARONES', 106, 40, { width: ancho - 58, lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor('#444444').text('San Vicente de Cañete', 106, 57, { width: ancho - 58, lineBreak: false });
      doc.fontSize(8).text(`${codigo}  |  Emitido: ${emision}`, 106, 74, { width: ancho - 58, lineBreak: false });
      doc.moveTo(48, 104).lineTo(48 + ancho, 104).lineWidth(1).strokeColor(guinda).stroke();
      doc.x = 48; doc.y = 118;
    }
    function espacio(alto) {
      if (doc.y + alto > limite) doc.addPage();
    }
    function lineas(texto, anchoTexto, fuente = 'Helvetica', tamano = 10) {
      doc.font(fuente).fontSize(tamano);
      const resultado = [];
      for (const parrafo of String(texto ?? 'No registrado').split('\n')) {
        let linea = '';
        for (const palabra of parrafo.split(/\s+/)) {
          if (!palabra) continue;
          if (doc.widthOfString(`${linea} ${palabra}`.trim()) <= anchoTexto) linea = `${linea} ${palabra}`.trim();
          else {
            if (linea) resultado.push(linea);
            linea = '';
            for (const letra of palabra) {
              if (doc.widthOfString(linea + letra) > anchoTexto) { resultado.push(linea); linea = ''; }
              linea += letra;
            }
          }
        }
        resultado.push(linea || '');
      }
      return resultado;
    }
    function parrafo(contenido, reservaFinal = 0) {
      const filas = lineas(contenido, ancho);
      for (const [indice, fila] of filas.entries()) {
        const restantes = filas.length - indice;
        if (reservaFinal && restantes <= 6 && doc.y + restantes * 14 + reservaFinal > limite) doc.addPage();
        espacio(14);
        const y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor('#222222').text(fila, 48, y, { width: ancho, lineBreak: false });
        doc.y = y + 14;
      }
      doc.y += 7;
    }
    function seccion(titulo) {
      espacio(64);
      const y = doc.y;
      doc.rect(48, y, ancho, 24).fill(guinda);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('white').text(titulo, 56, y + 7, { width: ancho - 16, lineBreak: false });
      doc.y = y + 32;
    }
    function tabla(encabezados, filas, proporciones) {
      const anchos = proporciones.map((p) => p * ancho);
      const fila = (valores, esCabecera = false) => {
        const textos = valores.map((v, i) => lineas(v, anchos[i] - 14, esCabecera ? 'Helvetica-Bold' : 'Helvetica', 9));
        const alto = Math.max(...textos.map((p) => p.length)) * 13 + 14;
        if (!esCabecera && doc.y + alto > limite) { doc.addPage(); fila(encabezados, true); }
        else espacio(alto);
        const y = doc.y;
        let x = 48;
        valores.forEach((_valor, indice) => {
          doc.rect(x, y, anchos[indice], alto).fillAndStroke(esCabecera ? guinda : '#ffffff', '#d1c7ca');
          textos[indice].forEach((linea, posicion) => doc.font(esCabecera ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
            .fillColor(esCabecera ? '#ffffff' : '#222222').text(linea, x + 7, y + 7 + posicion * 13, { width: anchos[indice] - 14, lineBreak: false }));
          x += anchos[indice];
        });
        doc.y = y + alto;
      };
      fila(encabezados, true);
      filas.forEach((valores) => fila(valores));
      doc.y += 12;
    }
    function actuaciones(filas, reserva = 0) {
      if (!filas.length) { parrafo('No hay registros en esta sección.', reserva); return; }
      for (const [indice, fila] of filas.entries()) {
        const columnas = [ancho * .25, ancho * .45, ancho * .30];
        const valores = [fecha(fila.realizada_en), fila.autor, fila.cargo_autor];
        const metadatos = valores.map((valor, i) => lineas(valor, columnas[i] - 16, 'Helvetica', 9));
        const altoCabecera = 28 + Math.max(...metadatos.map(texto => texto.length)) * 12;
        const contenido = [];
        function agregar(texto, negrita = false) {
          for (const linea of lineas(texto, ancho - 20, negrita ? 'Helvetica-Bold' : 'Helvetica', 10)) contenido.push({ linea, negrita });
        }
        agregar(fila.detalle);
        if (fila.responsable || fila.fecha_limite) {
          agregar('Seguimiento', true);
          agregar([fila.responsable ? `Responsable: ${fila.responsable}` : null,
            fila.fecha_limite ? `Plazo: ${fechaCivil(fila.fecha_limite)}` : null].filter(Boolean).join(' · '));
        }
        const reservaFinal = indice === filas.length - 1 ? reserva : 0;
        const altoCompleto = altoCabecera + contenido.length * 14 + 20;
        // Mantener unidos los registros cortos; dividir únicamente los que exceden una página.
        if (altoCompleto + reservaFinal <= limite - 118) espacio(altoCompleto + reservaFinal);
        else espacio(altoCabecera + 62);
        let posicion = 0;
        while (posicion < contenido.length) {
          const y = doc.y;
          let x = 48;
          metadatos.forEach((texto, i) => {
            doc.rect(x, y, columnas[i], altoCabecera).fillAndStroke('#f5f2f3', '#d1c7ca');
            doc.font('Helvetica-Bold').fontSize(8).fillColor(guinda).text(['Fecha y hora', 'Registrado por', 'Cargo'][i], x + 8, y + 7, { lineBreak: false });
            texto.forEach((linea, n) => doc.font('Helvetica').fontSize(9).fillColor('#222222').text(linea, x + 8, y + 22 + n * 12, { lineBreak: false }));
            x += columnas[i];
          });
          const restantes = contenido.length - posicion;
          let capacidad = Math.floor((limite - y - altoCabecera - 20) / 14);
          if (reservaFinal && restantes <= capacidad && altoCabecera + restantes * 14 + 20 + reservaFinal > limite - y) {
            capacidad = Math.max(1, restantes - 6);
          }
          const cantidad = Math.min(restantes, capacidad);
          const alto = cantidad * 14 + 20;
          doc.rect(48, y + altoCabecera, ancho, alto).fillAndStroke('#ffffff', '#d1c7ca');
          for (let n = 0; n < cantidad; n++) {
            const { linea, negrita } = contenido[posicion + n];
            doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#222222')
              .text(linea, 58, y + altoCabecera + 9 + n * 14, { width: ancho - 20, lineBreak: false });
          }
          posicion += cantidad;
          doc.y = y + altoCabecera + alto + 12;
          if (posicion < contenido.length) {
            doc.addPage();
            doc.font('Helvetica-Bold').fontSize(9).fillColor(guinda).text('Continuación del registro', 48, doc.y, { lineBreak: false });
            doc.y += 18;
          }
        }
      }
    }
    try {
      doc.on('pageAdded', cabecera);
      cabecera();
      doc.font('Helvetica-Bold').fontSize(15).fillColor(guinda).text('INFORME DE INCIDENCIA ESCOLAR', { align: 'center', width: ancho });
      doc.moveDown();
      const { incidencia: i, version: v } = datos;
      seccion('1. DATOS GENERALES');
      tabla(['Dato', 'Registro'], [
        ['Código / estado', `${codigo} / ${nombreEstado(i.estado)}`], ['Categoría / tipo', `${nombreEstado(v.categoria)} / ${v.tipo}`],
        ['Título', v.titulo], ['Fecha y hora del hecho', fecha(v.ocurrida_en)], ['Lugar', v.lugar || 'No precisado'],
        ['Prioridad / confidencialidad', `${i.prioridad} / ${i.confidencialidad}`]
      ], [.28, .72]);
      seccion('2. PERSONAS INVOLUCRADAS');
      if (datos.involucrados.length) tabla(['Nombre', 'Participación', 'Contexto escolar'], datos.involucrados.map((p) => [p.nombre, p.participacion,
        p.nivel ? `${p.nivel} · ${p.grado}.º ${p.seccion} · ${p.anio_lectivo}` : p.es_estudiante ? 'Matrícula no precisada' : 'Persona adulta o externa']), [.43, .20, .37]);
      else parrafo('Sin estudiantes ni otras personas involucradas identificadas.');
      seccion('3. REPORTANTE Y REGISTRADOR');
      tabla(['Función', 'Identificación'], [['Reportante', `${v.nombre_reportante} · ${v.condicion_reportante}`],
        ['Registrador', `${i.nombre_registrador} · ${i.cargo_registrador}`], ['Fecha de registro', fecha(i.registrada_en)]], [.28, .72]);
      seccion('4. DESCRIPCIÓN DETALLADA');
      parrafo(v.descripcion);
      const campos = { ambito_convivencia: 'Ámbito', requiere_mediacion: 'Requiere mediación', gravedad_disciplinaria: 'Gravedad disciplinaria', norma_referida: 'Norma referida',
        sintomas_observados: 'Observaciones de salud', requiere_atencion_inmediata: 'Atención inmediata', riesgo_identificado: 'Riesgo observado', riesgo_persistente: 'Riesgo persistente',
        descripcion_dano: 'Afectación de bienes', monto_estimado: 'Importe estimado', moneda: 'Moneda', riesgo_inmediato: 'Riesgo inmediato', requiere_derivacion: 'Requiere derivación' };
      for (const [campo, etiqueta] of Object.entries(campos)) {
        if (v[campo] !== null && v[campo] !== undefined) parrafo(`${etiqueta}: ${campo.startsWith('requiere_') || ['riesgo_inmediato', 'riesgo_persistente'].includes(campo) ? (v[campo] ? 'Sí' : 'No') : v[campo]}`);
      }
      seccion('5. ACTUACIONES REALIZADAS');
      actuaciones(datos.actuaciones.filter((a) => a.tipo === 'actuacion'));
      const altoNombre = lineas(i.nombre_registrador, ancho / 2 - 12, 'Helvetica', 9).length * 12;
      const reservaFirma = 145 + Math.max(0, altoNombre - 24);
      espacio(160);
      seccion('6. SEGUIMIENTO Y ESTADO');
      const ultima = datos.actuaciones.at(-1);
      tabla(['Estado actual', 'Prioridad de atención', 'Versión vigente'], [[nombreEstado(i.estado), i.prioridad,
        `${v.numero_version}. Versiones anteriores conservadas.`]], [.30, .30, .40]);
      if (ultima?.responsable) parrafo(`Responsable de seguimiento: ${ultima.responsable}${ultima.fecha_limite ? ` · Plazo: ${fechaCivil(ultima.fecha_limite)}` : ''}`);
      // Reservar el encabezado junto a su contenido y las firmas cuando no hay observaciones.
      if (!datos.actuaciones.some(a => a.tipo === 'observacion')) espacio(reservaFirma + 38);
      seccion('7. OBSERVACIONES AUTORIZADAS');
      actuaciones(datos.actuaciones.filter((a) => a.tipo === 'observacion'), reservaFirma);
      espacio(reservaFirma - 15);
      const y = doc.y + 22;
      doc.moveTo(56, y + 30).lineTo(48 + ancho / 2 - 20, y + 30).strokeColor('#777777').lineWidth(.6).stroke();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#222222').text('Firma del registrador', 48, y + 40, { width: ancho / 2 - 12, align: 'center' });
      doc.font('Helvetica').fontSize(9).text(i.nombre_registrador, 48, y + 57, { width: ancho / 2 - 12, align: 'center' });
      doc.text(i.cargo_registrador, 48, y + 57 + altoNombre + 9, { width: ancho / 2 - 12, align: 'center' });
      doc.roundedRect(48 + ancho / 2 + 14, y, ancho / 2 - 14, 105, 3).strokeColor('#b6a7ac').stroke();
      doc.font('Helvetica-Bold').fontSize(9).text('Sello del Director', 48 + ancho / 2 + 20, y + 77, { width: ancho / 2 - 26, align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#555555').text('Espacio reservado para sello físico', 48 + ancho / 2 + 20, y + 91, { width: ancho / 2 - 26, align: 'center' });
      const rango = doc.bufferedPageRange();
      for (let pagina = rango.start; pagina < rango.start + rango.count; pagina++) {
        doc.switchToPage(pagina);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(8).fillColor('#666666').text(`${codigo} · Página ${pagina + 1} de ${rango.count}`, 48, doc.page.height - 35, { width: ancho, align: 'right', lineBreak: false });
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}
