import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, iaConfigurada } from './config.js';
import { extraerFicha } from './ai/extraccion.js';
import { construirContrataXml } from './contrata/contrataBuilder.js';
import { TIPOS_CONTRATO } from './contrata/codigos.js';
import { fichaVacia, camposQueFaltan } from './dominio/esquema.js';
import { validarDocumento, validarNafFormato } from './validadores/identidad.js';
import { listarEntradas, guardarEntrada } from './almacen/entradas.js';
import { requireAuth, comprobarCredenciales, ponerCookieSesion, borrarCookieSesion, sesionDe, authConfigurada } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Autenticacion: protege /api/* salvo login/logout/me/health ---
const RUTAS_PUBLICAS = new Set(['/api/login', '/api/logout', '/api/me', '/api/health']);
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') || RUTAS_PUBLICAS.has(req.path)) return next();
  return requireAuth(req, res, next);
});
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body || {};
  if (comprobarCredenciales(usuario, password)) {
    ponerCookieSesion(res, req, usuario);
    return res.json({ ok: true, usuario });
  }
  res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
});
app.post('/api/logout', (req, res) => { borrarCookieSesion(res, req); res.json({ ok: true }); });
app.get('/api/me', (req, res) => {
  const s = sesionDe(req);
  if (s) return res.json({ usuario: s.u, authConfigurada: authConfigurada() });
  res.status(401).json({ authConfigurada: authConfigurada() });
});

// Valida los identificadores de una ficha y lista lo que falta.
function validarFicha(ficha) {
  const avisos = [];
  const cif = ficha?.empresa?.cif;
  if (cif) {
    const d = validarDocumento(cif);
    if (!d.valido || d.tipo !== 'CIF') avisos.push(`CIF de empresa no valido: ${cif}`);
  }
  const ipf = ficha?.trabajador?.ipf;
  if (ipf) {
    const d = validarDocumento(ipf);
    if (!d.valido || (d.tipo !== 'NIF' && d.tipo !== 'NIE')) {
      avisos.push(`NIF/NIE del trabajador no valido: ${ipf}`);
    }
  }
  const naf = ficha?.trabajador?.naf;
  if (naf && !validarNafFormato(naf)) avisos.push(`NAF con formato extrano: ${naf}`);

  return { faltan: camposQueFaltan(ficha), avisos };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/estado', (_req, res) => {
  res.json({
    iaConfigurada: iaConfigurada(),
    modelo: config.anthropic.model,
    tiposContrato: TIPOS_CONTRATO,
  });
});

// Extraccion IA: { texto?, imagenes?: [{media_type, data}] } -> { ficha, validacion }
app.post('/api/extraer', async (req, res) => {
  try {
    const { texto = '', imagenes = [] } = req.body || {};
    if (!texto.trim() && (!Array.isArray(imagenes) || imagenes.length === 0)) {
      return res.status(400).json({ error: 'Aporta texto o al menos una imagen.' });
    }
    const ficha = await extraerFicha({ texto, imagenes });
    res.json({ ficha, validacion: validarFicha(ficha) });
  } catch (e) {
    if (e.code === 'IA_NO_CONFIGURADA') {
      return res.status(503).json({ error: e.message });
    }
    console.error('extraer:', e.code || '', e.message, e.detalle || '');
    res.status(502).json({ error: e.message, detalle: e.detalle });
  }
});

// Revalida una ficha editada a mano (sin tocar la IA).
app.post('/api/validar', (req, res) => {
  const ficha = { ...fichaVacia(), ...(req.body?.ficha || {}) };
  res.json({ validacion: validarFicha(ficha) });
});

// Genera el Contrat@ XML: { fichas: [...], descargar?: bool }
app.post('/api/contrata', (req, res) => {
  try {
    const fichas = req.body?.fichas || (req.body?.ficha ? [req.body.ficha] : []);
    if (!fichas.length) return res.status(400).json({ error: 'No hay fichas.' });
    const xml = construirContrataXml(fichas);
    if (req.body?.descargar) {
      res.setHeader('Content-Type', 'application/xml; charset=ISO-8859-1');
      res.setHeader('Content-Disposition', 'attachment; filename="contrata.xml"');
      return res.send(Buffer.from(xml, 'latin1'));
    }
    res.json({ xml });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Registro persistente de entradas (altas procesadas)
app.get('/api/entradas', async (_req, res) => {
  try { res.json(await listarEntradas()); }
  catch (e) { console.error('entradas list:', e.message); res.status(500).json({ error: 'No se pudo leer el registro.' }); }
});
app.post('/api/entradas', async (req, res) => {
  try {
    const ficha = req.body?.ficha;
    if (!ficha) return res.status(400).json({ error: 'Falta la ficha.' });
    res.json(await guardarEntrada(ficha));
  } catch (e) { console.error('entradas save:', e.message); res.status(500).json({ error: 'No se pudo guardar.' }); }
});

app.listen(config.port, () => {
  console.log(`altas-gestoria escuchando en http://localhost:${config.port}`);
  console.log(`IA: ${iaConfigurada() ? 'configurada (' + config.anthropic.model + ')' : 'NO configurada (pon ANTHROPIC_API_KEY)'}`);
});
