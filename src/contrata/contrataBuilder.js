// Genera el XML de comunicacion de contratos de Contrat@ (SEPE).
// Raiz <CONTRATOS> con un <CONTRATO_xxx> por ficha (xxx = tipo de contrato).
//
// IMPORTANTE (a validar antes de produccion): el orden exacto de elementos, el
// formato de fecha y algunas enumeraciones se han tomado del XSD oficial
// (EsquemaContratos50.xsd) y deben verificarse contra el XSD + un fichero real
// del SEPE. Todo lo dudoso esta centralizado y marcado para corregir en un sitio.

import { sexoCodigo, paisCodigo, tipoContratoInfo } from './codigos.js';

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// PENDIENTE validar formato de fecha del SEPE. De momento AAAA-MM-DD.
function fmtFecha(iso) {
  return String(iso || '').trim();
}

// Emite <TAG>valor</TAG> solo si hay valor (omite opcionales vacios).
function el(tag, valor) {
  const v = String(valor ?? '').trim();
  return v === '' ? '' : `      <${tag}>${esc(v)}</${tag}>\n`;
}

// El Contrat@ usa NOMBRE_APELLIDOS con el nombre primero (confirmado contra un
// Contrat@ real: "NAYARA PIRES ANDRES").
function nombreApellidos(t) {
  return [t.nombre, t.apellido1, t.apellido2]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join(' ');
}

const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// Construye un bloque <CONTRATO_xxx> a partir de una ficha canonica.
export function construirContratoElemento(ficha) {
  const tipo = String(ficha?.contrato?.tipo || '').trim();
  if (!tipo) throw new Error('La ficha no tiene tipo de contrato.');
  const info = tipoContratoInfo(tipo);
  const t = ficha.trabajador || {};
  const e = ficha.empresa || {};
  const c = ficha.contrato || {};

  let s = `  <CONTRATO_${esc(tipo)}>\n`;

  s += '    <DATOS_EMPRESA>\n';
  s += el('CIF_NIF_EMPRESA', e.cif);
  s += el('CODIGO_CUENTA_COTIZACION', soloDigitos(e.ccc));
  s += '    </DATOS_EMPRESA>\n';

  s += '    <DATOS_TRABAJADOR>\n';
  s += el('IDENTIFICADORPFISICA', t.ipf);
  s += el('NOMBRE_APELLIDOS', nombreApellidos(t));
  s += el('SEXO', sexoCodigo(t.sexo));
  s += el('FECHA_NACIMIENTO', fmtFecha(t.fechaNacimiento));
  s += el('NACIONALIDAD', paisCodigo(t.nacionalidad));
  if (paisCodigo(t.paisResidencia) === '724') {
    s += el('MUNICIPIO_RESIDENCIA', t.municipioResidencia);
  }
  s += el('PAIS_RESIDENCIA', paisCodigo(t.paisResidencia));
  s += el('NUMERO_SEGURIDAD_SOCIAL', t.naf);
  s += '    </DATOS_TRABAJADOR>\n';

  s += '    <DATOS_GENERALES_CONTRATO>\n';
  s += el('FECHA_INICIO', fmtFecha(c.fechaInicio));
  // Los temporales exigen fecha de termino; en indefinidos se omite.
  if (!info || info.temporal) s += el('FECHA_TERMINO', fmtFecha(c.fechaFin));
  s += el('CODIGO_OCUPACION', c.ocupacion);
  s += '    </DATOS_GENERALES_CONTRATO>\n';

  s += `  </CONTRATO_${esc(tipo)}>\n`;
  return s;
}

// Documento completo a partir de una o varias fichas.
export function construirContrataXml(fichas) {
  const lista = Array.isArray(fichas) ? fichas : [fichas];
  const cuerpo = lista.map(construirContratoElemento).join('');
  return `<?xml version="1.0" encoding="ISO-8859-1"?>\n<CONTRATOS>\n${cuerpo}</CONTRATOS>\n`;
}

// Mismo XML como Buffer en latin1 (ISO-8859-1) para descarga/transmision.
export function construirContrataBuffer(fichas) {
  return Buffer.from(construirContrataXml(fichas), 'latin1');
}
