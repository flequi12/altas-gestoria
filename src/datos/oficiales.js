// Códigos oficiales para el Contrat@: municipios (INE, 5 dígitos) y ocupaciones
// (CNO-2011, grupo primario de 4 dígitos). Los datasets se generan offline desde
// fuentes oficiales (INE / EUSTAT) y se versionan como JSON compacto [[codigo, nombre], ...].
//   - municipios.json: 8.132 municipios (codeforspain / INE).
//   - cno2011.json: 502 grupos primarios CNO-2011 (EUSTAT, en castellano).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cargar = (f) => JSON.parse(readFileSync(path.join(__dirname, f), 'utf8'));

export const MUNICIPIOS = cargar('municipios.json'); // [[codigo5, nombre], ...]
export const OCUPACIONES = cargar('cno2011.json');   // [[codigo4, nombre], ...]

// Normaliza un nombre para casar: sin acentos, minúsculas, solo alfanumérico+espacios.
export function normNombre(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const munPorCodigo = new Map(MUNICIPIOS.map(([c, n]) => [c, n]));
const munPorNombre = new Map(MUNICIPIOS.map(([c, n]) => [normNombre(n), c]));
const ocuPorCodigo = new Map(OCUPACIONES.map(([c, n]) => [c, n]));
const ocuPorNombre = new Map(OCUPACIONES.map(([c, n]) => [normNombre(n), c]));

function municipioPorNombre(valor) {
  const n = normNombre(valor);
  if (!n) return null;
  if (munPorNombre.has(n)) return munPorNombre.get(n);
  // El INE escribe el artículo al final ("Cuervo de Sevilla, El"); la gente lo pone
  // delante ("El Cuervo de Sevilla"). Probamos moviéndolo al final.
  const m = n.match(/^(el|la|los|las|l) (.+)$/);
  if (m && munPorNombre.has(`${m[2]} ${m[1]}`)) return munPorNombre.get(`${m[2]} ${m[1]}`);
  return null;
}

// Devuelve el código de municipio (5 díg.) a partir de un código o un nombre; null si no casa.
// LENIENT con códigos: si ya son 5 dígitos se devuelven aunque no estén en el callejero
// (que de eso avisa la validación), para no descartar silenciosamente datos del gestor.
export function municipioCodigo(valor) {
  const v = String(valor ?? '').trim();
  if (/^\d{5}$/.test(v)) return v;
  return municipioPorNombre(v);
}
export const municipioNombre = (c) => munPorCodigo.get(String(c ?? '').trim()) || null;
export const municipioReconocido = (c) => munPorCodigo.has(String(c ?? '').trim());

// Igual para la ocupación (CNO-2011, 4 dígitos).
export function ocupacionCodigo(valor) {
  const v = String(valor ?? '').trim();
  if (/^\d{4}$/.test(v)) return v;
  const n = normNombre(v);
  return n ? (ocuPorNombre.get(n) || null) : null;
}
export const ocupacionNombre = (c) => ocuPorCodigo.get(String(c ?? '').trim()) || null;
export const ocupacionReconocida = (c) => ocuPorCodigo.has(String(c ?? '').trim());
