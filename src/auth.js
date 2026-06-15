// Autenticacion propia (login + sesion por cookie firmada), sin dependencias.
// Sustituye al Basic Auth de nginx. Patron similar a Patrimonio/B3.
//
// Config por entorno (.env del CT):
//   APP_USER         usuario (por defecto 'gestoria')
//   APP_PASS_HASH    hash scrypt "scrypt$<saltHex>$<hashHex>" (preferido)
//   APP_PASS         contraseña en claro (alternativa simple si no hay hash)
//   SESSION_SECRET   secreto HMAC de la cookie (fijar para que la sesion sobreviva a reinicios)
//   SESSION_DIAS     duracion de la sesion (def. 7)
// Si no hay ni HASH ni PASS, la auth queda DESACTIVADA (modo dev local: app abierta).

import crypto from 'node:crypto';

const USER = process.env.APP_USER || 'gestoria';
const PASS_HASH = process.env.APP_PASS_HASH || '';
const PASS_PLAIN = process.env.APP_PASS || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TTL_S = (Number(process.env.SESSION_DIAS) || 7) * 86400;
const COOKIE = 'altas_sess';

export const authConfigurada = () => Boolean(PASS_HASH || PASS_PLAIN);

const b64u = (v) => Buffer.from(v).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function tsEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verificarHash(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  try {
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), hashHex.length / 2);
    return tsEqual(derived.toString('hex'), hashHex);
  } catch { return false; }
}

export function comprobarCredenciales(usuario, password) {
  if (!authConfigurada()) return false;
  const okU = tsEqual(usuario || '', USER);
  const okP = PASS_HASH ? verificarHash(password || '', PASS_HASH) : tsEqual(password || '', PASS_PLAIN);
  return okU && okP;
}

export function crearToken(usuario) {
  const payload = b64u(JSON.stringify({ u: usuario, exp: Math.floor(Date.now() / 1000) + TTL_S }));
  return `${payload}.${hmac(payload)}`;
}

export function verificarToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!tsEqual(sig, hmac(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

function leerCookie(req, nombre) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === nombre) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setCookie(res, req, valor, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https'; // detras de nginx TLS
  let s = `${COOKIE}=${valor}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
  if (secure) s += '; Secure';
  res.setHeader('Set-Cookie', s);
}

export function ponerCookieSesion(res, req, usuario) { setCookie(res, req, crearToken(usuario), TTL_S); }
export function borrarCookieSesion(res, req) { setCookie(res, req, '', 0); }
export function sesionDe(req) { return verificarToken(leerCookie(req, COOKIE)); }

export function requireAuth(req, res, next) {
  if (!authConfigurada()) return next(); // dev local sin credenciales: abierto
  const s = sesionDe(req);
  if (s) { req.usuario = s.u; return next(); }
  res.status(401).json({ error: 'No autenticado.' });
}
