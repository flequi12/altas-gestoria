// Genera el XML de comunicacion de contratos de Contrat@ (SEPE).
// Estructura ANIDADA confirmada contra un Contrat@ REAL (ver docs/AFI.md no; ver
// muestra real CONTRATO_200). Raiz <CONTRATOS> con un <CONTRATO_xxx> por ficha.
//
// Aprendido del fichero real:
//   - CIF_NIF_EMPRESA contiene <CIF_NIF>.
//   - NOMBRE_APELLIDOS contiene <NOMBRE>/<PRIMER_APELLIDO>/<SEGUNDO_APELLIDO>.
//   - SEXO: 1=hombre, 2=mujer.
//   - Fechas en AAAAMMDD (sin guiones).
//   - IDENTIFICADORPFISICA lleva prefijo de tipo de documento: NIF -> 'D'.
//   - CODIGO_OCUPACION = 4 posiciones CNO + 4 blancos (8 caracteres).
//   - Bloques DATOS_PRESTACIONES (IND_ERE) y, si parcial, DATOS_CONTRATO_TIEMPO_PARCIAL.

import { sexoCodigo, paisCodigo, tipoContratoInfo } from './codigos.js';
import { validarDocumento, normalizar } from '../validadores/identidad.js';

function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// AAAA-MM-DD (o cualquier fecha con separadores) -> AAAAMMDD.
const fmtFecha = (iso) => String(iso ?? '').replace(/\D/g, '');

// Elemento simple indentado; se omite si el valor esta vacio.
function el(tag, valor, pad) {
  const v = String(valor ?? '').trim();
  return v === '' ? '' : `${' '.repeat(pad)}<${tag}>${esc(v)}</${tag}>\n`;
}

// IDENTIFICADORPFISICA: prefijo de tipo de documento + identificador.
// NIF -> 'D'. NIE -> 'E' (best-effort; confirmar con un NIE real). Otros -> sin prefijo.
function ipfContrata(ipf) {
  const v = normalizar(ipf);
  const tipo = validarDocumento(v).tipo;
  if (tipo === 'NIF') return 'D' + v;
  if (tipo === 'NIE') return 'E' + v;
  return v;
}

// CNO a 8 posiciones (4 del codigo + relleno con blancos a la derecha).
const ocupacion8 = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? '' : s.slice(0, 8).padEnd(8, ' ');
};

export function construirContratoElemento(ficha) {
  const tipo = String(ficha?.contrato?.tipo || '').trim();
  if (!tipo) throw new Error('La ficha no tiene tipo de contrato.');
  const info = tipoContratoInfo(tipo);
  const t = ficha.trabajador || {};
  const em = ficha.empresa || {};
  const c = ficha.contrato || {};

  let s = `  <CONTRATO_${esc(tipo)}>\n`;

  s += '    <DATOS_EMPRESA>\n';
  s += '      <CIF_NIF_EMPRESA>\n';
  s += el('CIF_NIF', normalizar(em.cif), 8);
  s += '      </CIF_NIF_EMPRESA>\n';
  s += el('CODIGO_CUENTA_COTIZACION', String(em.ccc ?? '').replace(/\D/g, ''), 6);
  s += '    </DATOS_EMPRESA>\n';

  s += '    <DATOS_TRABAJADOR>\n';
  s += el('IDENTIFICADORPFISICA', ipfContrata(t.ipf), 6);
  s += '      <NOMBRE_APELLIDOS>\n';
  s += el('NOMBRE', t.nombre, 8);
  s += el('PRIMER_APELLIDO', t.apellido1, 8);
  s += el('SEGUNDO_APELLIDO', t.apellido2, 8);
  s += '      </NOMBRE_APELLIDOS>\n';
  s += el('SEXO', sexoCodigo(t.sexo), 6);
  s += el('FECHA_NACIMIENTO', fmtFecha(t.fechaNacimiento), 6);
  s += el('NACIONALIDAD', paisCodigo(t.nacionalidad), 6);
  if (paisCodigo(t.paisResidencia) === '724') {
    s += el('MUNICIPIO_RESIDENCIA', t.municipioResidencia, 6);
  }
  s += el('PAIS_RESIDENCIA', paisCodigo(t.paisResidencia), 6);
  s += '    </DATOS_TRABAJADOR>\n';

  s += '    <DATOS_GENERALES_CONTRATO>\n';
  s += el('FECHA_INICIO', fmtFecha(c.fechaInicio), 6);
  if (!info || info.temporal) s += el('FECHA_TERMINO', fmtFecha(c.fechaFin), 6);
  s += el('NIVEL_FORMATIVO', c.nivelFormativo, 6);
  const ocu = ocupacion8(c.ocupacion); // 8 chars con blancos: NO recortar
  if (ocu) s += `      <CODIGO_OCUPACION>${esc(ocu)}</CODIGO_OCUPACION>\n`;
  s += el('NACIONALIDAD_CT', paisCodigo(c.nacionalidadCentro || t.paisResidencia || 'ES'), 6);
  s += el('MUNICIPIO_CT', c.municipioCentro || t.municipioResidencia, 6);
  s += `      <INDICATIVO_PRTR>${esc(c.indicativoPrtr || 'N')}</INDICATIVO_PRTR>\n`;
  s += '    </DATOS_GENERALES_CONTRATO>\n';

  s += '    <DATOS_PRESTACIONES>\n';
  s += `      <IND_ERE>${esc(c.indEre || 'N')}</IND_ERE>\n`;
  s += '    </DATOS_PRESTACIONES>\n';

  const esParcial = (info && info.parcial) || c.jornada === 'parcial' || Boolean(c.tipoJornada);
  if (esParcial) {
    s += '    <DATOS_CONTRATO_TIEMPO_PARCIAL>\n';
    s += el('TIPO_JORNADA', c.tipoJornada, 6);
    s += el('HORAS_JORNADA', c.horasJornada, 6);
    s += '    </DATOS_CONTRATO_TIEMPO_PARCIAL>\n';
  }

  s += `  </CONTRATO_${esc(tipo)}>\n`;
  return s;
}

export function construirContrataXml(fichas) {
  const lista = Array.isArray(fichas) ? fichas : [fichas];
  const cuerpo = lista.map(construirContratoElemento).join('');
  return `<?xml version="1.0" encoding="ISO-8859-1"?>\n<CONTRATOS>\n${cuerpo}</CONTRATOS>\n`;
}

export function construirContrataBuffer(fichas) {
  return Buffer.from(construirContrataXml(fichas), 'latin1');
}
