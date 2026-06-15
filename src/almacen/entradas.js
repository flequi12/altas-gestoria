// Registro persistente de entradas (altas procesadas). Almacen simple en un JSON
// sobre un volumen Docker, sin dependencias. Volumen bajo unos 20-50/mes -> de sobra.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FICHERO = path.join(DATA_DIR, 'entradas.json');

async function leer() {
  try {
    const arr = JSON.parse(await fs.readFile(FICHERO, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function escribir(arr) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = FICHERO + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(arr, null, 2), 'utf8');
  await fs.rename(tmp, FICHERO); // escritura atomica
}

// Campos de resumen para el listado (la ficha completa va aparte).
export function resumenEntrada(ficha) {
  const t = ficha?.trabajador || {};
  const e = ficha?.empresa || {};
  const c = ficha?.contrato || {};
  return {
    trabajador: [t.nombre, t.apellido1, t.apellido2].map((x) => String(x || '').trim()).filter(Boolean).join(' '),
    ipf: String(t.ipf || '').trim(),
    empresaCif: String(e.cif || '').trim(),
    empresaRazon: String(e.razonSocial || '').trim(),
    tipo: String(c.tipo || '').trim(),
    fechaInicio: String(c.fechaInicio || '').trim(),
  };
}

export async function listarEntradas() {
  return leer();
}

export async function guardarEntrada(ficha, fechaIso) {
  const arr = await leer();
  const entrada = {
    id: crypto.randomUUID(),
    fecha: fechaIso || new Date().toISOString(),
    ...resumenEntrada(ficha),
    ficha,
  };
  arr.unshift(entrada); // mas reciente primero
  await escribir(arr);
  return entrada;
}
