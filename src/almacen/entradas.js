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

// Identidad de un alta para deduplicar (NIF/NIE + CIF empresa + fecha de alta).
function claveDedup(o) {
  return [o.ipf, o.empresaCif, o.fechaInicio].map((x) => String(x || '').trim().toUpperCase()).join('|');
}

// Las escrituras son read-modify-write; las serializamos en una cola para que el
// autoguardado (que dispara en cada generacion) no pueda pisar otra escritura.
let cadena = Promise.resolve();
function serializar(tarea) {
  const resultado = cadena.then(() => tarea());
  cadena = resultado.then(() => {}, () => {}); // la cola sigue aunque una tarea falle
  return resultado;
}

export async function listarEntradas() {
  return leer();
}

export function guardarEntrada(ficha, fechaIso) {
  return serializar(async () => {
    const arr = await leer();
    const resumen = resumenEntrada(ficha);
    const clave = claveDedup(resumen);
    const identificable = clave.replace(/\|/g, '') !== '';
    const fecha = fechaIso || new Date().toISOString();

    // Si ya existe una entrada con la misma identidad, se actualiza y sube arriba
    // (evita duplicados al autoguardar en cada generacion del mismo alta).
    if (identificable) {
      const i = arr.findIndex((e) => claveDedup(e) === clave);
      if (i >= 0) {
        const [existente] = arr.splice(i, 1);
        const actualizada = { ...existente, fecha, ...resumen, ficha };
        arr.unshift(actualizada);
        await escribir(arr);
        return actualizada;
      }
    }

    const entrada = { id: crypto.randomUUID(), fecha, ...resumen, ficha };
    arr.unshift(entrada); // mas reciente primero
    await escribir(arr);
    return entrada;
  });
}

export function borrarEntrada(id) {
  return serializar(async () => {
    const arr = await leer();
    const i = arr.findIndex((e) => e.id === id);
    if (i < 0) return false;
    arr.splice(i, 1);
    await escribir(arr);
    return true;
  });
}
