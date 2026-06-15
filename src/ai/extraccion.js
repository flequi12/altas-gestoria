// Extraccion de la ficha de alta a partir de texto libre (email/WhatsApp/llamada
// transcrita) y/o imagenes (foto del DNI, contrato escaneado). Usa la API de
// Claude por fetch nativo (sin SDK) y fuerza una herramienta para obtener salida
// estructurada y validable.

import { config, iaConfigurada } from '../config.js';
import { fichaVacia } from '../dominio/esquema.js';

const SYSTEM = `Eres un asistente de una gestoria laboral espanola. Extraes los datos
necesarios para dar de alta a un trabajador en la Seguridad Social y comunicar su
contrato, a partir de informacion que llega en formatos desordenados (email, WhatsApp,
foto del DNI, contrato escaneado, notas de una llamada).

Reglas:
- Rellena solo lo que puedas deducir con seguridad. Si un dato no aparece, dejalo VACIO.
- NO inventes NIF/NIE, NAF, fechas ni codigos.
- Fechas SIEMPRE en formato AAAA-MM-DD.
- Sexo: "H" (hombre) o "M" (mujer) si se deduce; si no, vacio.
- Nacionalidad y pais de residencia en codigo ISO de 2 letras (ES por defecto si es claramente espanol).
- Separa nombre, primer apellido y segundo apellido cuando sea posible.
- En "avisos" anota en frases cortas: datos que faltan, ambiguedades, o cosas que el
  gestor debe revisar (p.ej. "tipo de contrato no indicado", "DNI ilegible en la foto").
- Indica la fuente principal en "fuente".`;

const TOOL = {
  name: 'registrar_ficha',
  description: 'Registra la ficha estructurada del trabajador y su contrato.',
  input_schema: {
    type: 'object',
    properties: {
      empresa: {
        type: 'object',
        properties: {
          cif: { type: 'string', description: 'CIF/NIF de la empresa empleadora' },
          ccc: { type: 'string', description: 'Codigo Cuenta Cotizacion (si aparece)' },
          razonSocial: { type: 'string' },
        },
      },
      trabajador: {
        type: 'object',
        properties: {
          ipf: { type: 'string', description: 'NIF o NIE del trabajador' },
          naf: { type: 'string', description: 'Numero de Afiliacion a la Seguridad Social (12 digitos)' },
          nombre: { type: 'string' },
          apellido1: { type: 'string' },
          apellido2: { type: 'string' },
          sexo: { type: 'string', enum: ['H', 'M', ''] },
          fechaNacimiento: { type: 'string', description: 'AAAA-MM-DD' },
          nacionalidad: { type: 'string', description: 'ISO 2 letras' },
          paisResidencia: { type: 'string', description: 'ISO 2 letras' },
          municipioResidencia: { type: 'string' },
          domicilio: { type: 'string' },
          telefono: { type: 'string' },
          email: { type: 'string' },
        },
      },
      contrato: {
        type: 'object',
        properties: {
          tipo: { type: 'string', description: 'Codigo de tipo de contrato si se conoce (p.ej. 100, 402, 410)' },
          fechaInicio: { type: 'string', description: 'AAAA-MM-DD' },
          fechaFin: { type: 'string', description: 'AAAA-MM-DD (temporales)' },
          jornada: { type: 'string', enum: ['completa', 'parcial', ''] },
          coeficienteParcial: { type: 'string', description: '% de jornada si parcial' },
          grupoCotizacion: { type: 'string' },
          ocupacion: { type: 'string', description: 'Ocupacion / CNO' },
          categoria: { type: 'string' },
          convenio: { type: 'string' },
          salarioBruto: { type: 'string' },
          observaciones: { type: 'string' },
        },
      },
      fuente: { type: 'string', enum: ['email', 'whatsapp', 'foto', 'llamada', 'mixto', ''] },
      avisos: { type: 'array', items: { type: 'string' } },
    },
    required: ['trabajador', 'contrato'],
  },
};

// Copia solo claves conocidas de `datos` sobre `base` (evita basura inesperada).
function fusionar(base, datos) {
  if (!datos || typeof datos !== 'object') return base;
  for (const seccion of ['empresa', 'trabajador', 'contrato']) {
    if (datos[seccion] && typeof datos[seccion] === 'object') {
      for (const k of Object.keys(base[seccion])) {
        if (datos[seccion][k] != null && datos[seccion][k] !== '') {
          base[seccion][k] = String(datos[seccion][k]).trim();
        }
      }
    }
  }
  if (datos.fuente) base._meta.fuente = String(datos.fuente);
  if (Array.isArray(datos.avisos)) base._meta.avisos = datos.avisos.map(String);
  return base;
}

// imagenes: [{ media_type: 'image/jpeg'|'image/png'|..., data: '<base64>' }]
export async function extraerFicha({ texto = '', imagenes = [] } = {}) {
  if (!iaConfigurada()) {
    const err = new Error('IA no configurada (falta ANTHROPIC_API_KEY).');
    err.code = 'IA_NO_CONFIGURADA';
    throw err;
  }

  const content = [];
  for (const img of imagenes) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.media_type, data: img.data },
    });
  }
  content.push({
    type: 'text',
    text:
      'Extrae la ficha de alta del trabajador a partir de esta informacion ' +
      '(usa la herramienta registrar_ficha):\n\n' +
      (texto || '(sin texto; usa solo las imagenes)'),
  });

  const cuerpo = {
    model: config.anthropic.model,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL.name },
    messages: [{ role: 'user', content }],
  };

  const resp = await fetch(config.anthropic.baseUrl, {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': config.anthropic.version,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cuerpo),
  });

  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    const err = new Error(`Error de la API de Claude (${resp.status}).`);
    err.code = 'IA_ERROR';
    err.status = resp.status;
    err.detalle = detalle.slice(0, 500);
    throw err;
  }

  const data = await resp.json();
  const bloque = (data.content || []).find((b) => b.type === 'tool_use' && b.name === TOOL.name);
  if (!bloque) {
    const err = new Error('La IA no devolvio la ficha estructurada.');
    err.code = 'IA_SIN_FICHA';
    throw err;
  }

  return fusionar(fichaVacia(), bloque.input);
}
