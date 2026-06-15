// Validadores de identidad fiscal espanola, sin dependencias.
// NIF/NIE/CIF implementan el digito/letra de control oficial.
// NAF (Numero de Afiliacion a la Seguridad Social): solo formato por ahora
// (el algoritmo de control se calibrara contra datos reales antes de bloquear).
// Todos NORMALIZAN (mayusculas, sin espacios/guiones/puntos) y NUNCA rechazan
// algo valido por una limpieza agresiva.

const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';
const LETRAS_CONTROL_CIF = 'JABCDEFGHI';

export function normalizar(valor) {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/[\s.\-_/]/g, '');
}

// DNI/NIF: 8 digitos + letra de control.
export function validarNif(valor) {
  const v = normalizar(valor);
  if (!/^\d{8}[A-Z]$/.test(v)) return false;
  const numero = parseInt(v.slice(0, 8), 10);
  return LETRAS_NIF[numero % 23] === v[8];
}

// NIE: X/Y/Z + 7 digitos + letra. X->0, Y->1, Z->2, luego como NIF.
export function validarNie(valor) {
  const v = normalizar(valor);
  if (!/^[XYZ]\d{7}[A-Z]$/.test(v)) return false;
  const prefijo = { X: '0', Y: '1', Z: '2' }[v[0]];
  const numero = parseInt(prefijo + v.slice(1, 8), 10);
  return LETRAS_NIF[numero % 23] === v[8];
}

// CIF: letra de organizacion + 7 digitos + control (digito o letra).
// Se acepta si el control coincide con el digito O con la letra calculados
// (lado seguro: no rechazar un CIF valido por la regla de tipo).
export function validarCif(valor) {
  const v = normalizar(valor);
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) return false;
  const cuerpo = v.slice(1, 8);
  let sumaPar = 0;
  let sumaImpar = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(cuerpo[i]);
    if (i % 2 === 0) {
      // posiciones impares (1a, 3a, 5a, 7a): x2 y suma de digitos
      const d = n * 2;
      sumaImpar += Math.floor(d / 10) + (d % 10);
    } else {
      sumaPar += n;
    }
  }
  const e = (10 - ((sumaPar + sumaImpar) % 10)) % 10;
  const controlDigito = String(e);
  const controlLetra = LETRAS_CONTROL_CIF[e];
  return v[8] === controlDigito || v[8] === controlLetra;
}

// Detecta el tipo y valida. Devuelve { valido, tipo, valor }.
export function validarDocumento(valor) {
  const v = normalizar(valor);
  if (/^[XYZ]/.test(v)) return { valido: validarNie(v), tipo: 'NIE', valor: v };
  if (/^[ABCDEFGHJNPQRSUVW]/.test(v)) return { valido: validarCif(v), tipo: 'CIF', valor: v };
  if (/^\d/.test(v)) return { valido: validarNif(v), tipo: 'NIF', valor: v };
  return { valido: false, tipo: null, valor: v };
}

// NAF / NUSS: 12 digitos (provincia 2 + numero 8 + control 2).
// Solo validacion de formato; el digito de control se confirmara con datos reales.
export function validarNafFormato(valor) {
  const v = normalizar(valor);
  return /^\d{11,12}$/.test(v); // a veces se maneja con 11 (sin provincia explicita)
}
