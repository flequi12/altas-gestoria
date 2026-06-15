// AFI - este modulo DECODIFICA el fichero de RESPUESTA (FRA) que devuelve la TGSS
// tras procesar un movimiento (segmentos DID/DAU/DEM/RZS/NAN/DTR/DRE/DMO).
// OJO: NO es el formato de la PETICION de alta. La peticion .AFI (lo que hay que
// GENERAR) usa ETI/EMP/RZS/TRA/AYN/FAB/DAM v9.1 -> ver docs/AFI.md. El generador
// de peticion se construira con el doc "Tablas y Formatos Comunes" (codigos T-7
// accion=alta, T-18, formato fecha, cabecera ETI). Por eso aqui NO hay generador
// de peticion valido.
// Fichero plano de POSICION FIJA, registros de 70 caracteres, un segmento por
// linea identificado por una etiqueta de 3 letras.
//
// ESTADO: las posiciones de los campos de abajo se han fijado EMPIRICAMENTE
// contra un .msj de alta REAL (validado: CCC/NIF/NAF/nombre/apellidos/fechas/
// grupo de cotizacion salen correctos). Lo que un solo fichero NO permite
// deducir con seguridad (codigos internos del DID, DRE, DTR, DMO y el algoritmo
// de la huella/referencia del envio) queda marcado como PENDIENTE_SPEC y debe
// confirmarse contra el diseno de registros oficial del "Mensaje AFI" de la
// seg-social ANTES de generar ficheros para transmitir. Por eso el GENERADOR es
// PRELIMINAR (GENERADOR_VALIDADO = false) y no esta cableado a la API todavia.

export const RECORD_LEN = 70;
export const GENERADOR_VALIDADO = false;

// Offsets [inicio, fin) confirmados contra el .msj real.
export const OFFSETS = {
  DID: { autorizacion: [18, 24], fechaHora: [38, 52], huella: [52, 61] },
  DAU: { fechaAutorizacion: [3, 11], razonSocial: [11, RECORD_LEN] },
  DEM: { ccc: [3, 18] },
  RZS: { razonSocial: [3, RECORD_LEN] },
  NAN: { nombre: [3, 18], apellido1: [18, 38], apellido2: [38, 58] },
  DTR: { naf: [3, 15], ipf: [21, 30] },           // [15,21) y [30,40): PENDIENTE_SPEC
  DRE: { fechaRealAlta: [7, 15], fechaEfectos: [23, 31] }, // [3,7) tipos: PENDIENTE_SPEC
  DMO: { fechaMovimiento: [4, 12], grupoCotizacion: [12, 14] },
};

const corte = (linea, [ini, fin]) => (linea || '').substring(ini, fin).trim();

// Indexa un .msj por etiqueta de segmento (primeras 3 letras de cada registro).
function porSegmento(texto) {
  const mapa = {};
  for (const raw of String(texto).split(/\r?\n/)) {
    if (raw.length >= 3) mapa[raw.substring(0, 3)] = raw;
  }
  return mapa;
}

// Decodifica un AFI de alta en una ficha estructurada (campos confirmados).
export function decodificarAfiAlta(texto) {
  const s = porSegmento(texto);
  const did = s.DID || '';
  const dau = s.DAU || '';
  const dem = s.DEM || '';
  const rzs = s.RZS || '';
  const nan = s.NAN || '';
  const dtr = s.DTR || '';
  const dre = s.DRE || '';
  const dmo = s.DMO || '';
  return {
    autorizacion: corte(did, OFFSETS.DID.autorizacion),
    autorizado: {
      fecha: corte(dau, OFFSETS.DAU.fechaAutorizacion),
      razonSocial: corte(dau, OFFSETS.DAU.razonSocial),
    },
    empresa: {
      ccc: corte(dem, OFFSETS.DEM.ccc),
      razonSocial: corte(rzs, OFFSETS.RZS.razonSocial),
    },
    trabajador: {
      nombre: corte(nan, OFFSETS.NAN.nombre),
      apellido1: corte(nan, OFFSETS.NAN.apellido1),
      apellido2: corte(nan, OFFSETS.NAN.apellido2),
      naf: corte(dtr, OFFSETS.DTR.naf),
      ipf: corte(dtr, OFFSETS.DTR.ipf),
    },
    alta: {
      fechaRealAlta: corte(dre, OFFSETS.DRE.fechaRealAlta),
      grupoCotizacion: corte(dmo, OFFSETS.DMO.grupoCotizacion),
    },
  };
}

// --- Helpers de campo fijo (reutilizables por el generador) ---
export function alfa(valor, ancho) {
  return String(valor ?? '').toUpperCase().slice(0, ancho).padEnd(ancho, ' ');
}
export function num(valor, ancho) {
  return String(valor ?? '').replace(/\D/g, '').slice(0, ancho).padStart(ancho, '0');
}

// Pone `valor` (ya formateado) en [ini,fin) sobre un registro mutable (array de chars).
function colocar(buf, [ini, fin], valor) {
  const v = String(valor).slice(0, fin - ini);
  for (let i = 0; i < v.length; i++) buf[ini + i] = v[i];
}
function registroVacio(tag, relleno = ' ') {
  const buf = new Array(RECORD_LEN).fill(relleno);
  for (let i = 0; i < 3; i++) buf[i] = tag[i];
  return buf;
}

// GENERADOR PRELIMINAR. Coloca los campos confirmados; los tramos no confirmados
// quedan con relleno por defecto. NO usar para transmitir hasta validar contra el
// diseno de registros oficial (de ahi GENERADOR_VALIDADO = false).
export function construirAfiAltaPreliminar(d) {
  if (!d) throw new Error('Faltan datos.');
  const t = d.trabajador || {};
  const linea = (buf) => buf.join('');

  const dem = registroVacio('DEM', '0');
  colocar(dem, OFFSETS.DEM.ccc, num(d.empresa?.ccc, 15));

  const rzs = registroVacio('RZS');
  colocar(rzs, OFFSETS.RZS.razonSocial, alfa(d.empresa?.razonSocial, RECORD_LEN - 3));

  const nan = registroVacio('NAN');
  colocar(nan, OFFSETS.NAN.nombre, alfa(t.nombre, 15));
  colocar(nan, OFFSETS.NAN.apellido1, alfa(t.apellido1, 20));
  colocar(nan, OFFSETS.NAN.apellido2, alfa(t.apellido2, 20));

  const dtr = registroVacio('DTR', '0');
  colocar(dtr, OFFSETS.DTR.naf, num(t.naf, 12));
  colocar(dtr, OFFSETS.DTR.ipf, alfa(t.ipf, 9));

  const dre = registroVacio('DRE', '0');
  colocar(dre, OFFSETS.DRE.fechaRealAlta, num(d.alta?.fechaRealAlta, 8));

  const dmo = registroVacio('DMO', '0');
  colocar(dmo, OFFSETS.DMO.fechaMovimiento, num(d.alta?.fechaRealAlta, 8));
  colocar(dmo, OFFSETS.DMO.grupoCotizacion, num(d.alta?.grupoCotizacion, 2));

  // DID/DAU (cabecera): requieren datos del autorizado y la referencia/huella del
  // envio (PENDIENTE_SPEC) -> se omiten en el preliminar.
  return [dem, rzs, nan, dtr, dre, dmo].map(linea).join('\r\n') + '\r\n';
}
