# altas-gestoria

Herramienta para **automatizar las altas de trabajadores en la Seguridad Social y la comunicación de contratos**, para una gestoría (Public & Private Auditores) que trabaja con **Sistema RED** + **NominaSol** (de escritorio).

## El problema real

El cuello de botella **no** es enviar a la Seguridad Social ni a NominaSol — eso ya lo hacen.
El tiempo se pierde **transcribiendo a mano** los datos del trabajador que llegan en un caos de
formatos: email, WhatsApp, foto del DNI, llamada de teléfono.

```
Lo penoso (manual hoy)                         Ya es fácil (1 clic)
─────────────────────────                      ────────────────────
Caos de entrada  ──►  [ALTAS-GESTORIA]  ──►  ALTA en RED  ──►  importar ITA
(email/WhatsApp/      extrae + valida       + Contrat@         a NominaSol
 foto/llamada)        ◄── aquí entramos     (gestor revisa     (sync, sin
                                             y transmite)        cambios)
```

## Decisión de arquitectura

- **No reconstruimos** lo que NominaSol/SILTRA ya hacen.
- El `.ITA` (Informe de Trabajadores en Alta) es un informe de la TGSS de **quién YA está en
  alta** → es el sync TGSS→NominaSol que la gestoría ya hace en 1 clic. **No** es el canal de
  un alta nueva.
- **Nuestro valor**: convertir el caos de entrada en una **ficha validada** y, a partir de ella,
  generar el **Contrat@ XML** (Fase 1) y el **fichero AFI de alta** (Fase 2). El gestor revisa y
  transmite. NominaSol se sincroniza con su import ITA habitual.

## Fases

- **Fase 1 (en curso)** — Bandeja de intake + extracción IA + validación (NIF/NIE/CIF/NAF) +
  **generación de Contrat@ XML** (XSD oficial del SEPE). Bajo riesgo, máximo ahorro de tecleo.
- **Fase 2** — Generación del **AFI de alta** (legal-crítico; estilo VeriFactu: validar contra
  spec oficial + fichero real + revisión humana obligatoria antes de transmitir).
- **Fase 3 (opcional)** — Comunicación de Períodos de Actividad (XML mensual repetitivo).

## Stack

- Node 20+ · Express · SPA vanilla (un `public/index.html`).
- IA por la **API de Claude vía `fetch` nativo** (sin SDK). Única dependencia: `express`.
- Validadores fiscales propios, sin dependencias, cubiertos por `npm test`.

## Arranque

```bash
npm install
cp .env.example .env   # y pon ANTHROPIC_API_KEY
npm test               # validadores + Contrat@ (sin red)
npm start              # http://localhost:3010
```

## Estructura

```
src/
  config.js               configuración (entorno)
  server.js               API Express + estáticos
  dominio/esquema.js      ficha canónica trabajador+contrato + catálogos
  validadores/identidad.js NIF / NIE / CIF / NAF (+ normalización)
  contrata/codigos.js     tablas de códigos (tipo de contrato, etc.)
  contrata/contrataBuilder.js  ficha -> <CONTRATOS> XML del SEPE
  ai/extraccion.js        intake libre + fotos -> ficha (tool-use)
public/index.html         bandeja: pegar/subir -> revisar -> generar XML
test/                     runner propio sin framework
```

> **RGPD**: este repo puede tocar datos personales reales de trabajadores. Los ficheros de datos
> (`.ITA`, `.msj`, `.pdf`, `.xml`, `uploads/`, `.env`) están en `.gitignore`. Usar muestras
> anonimizadas para desarrollo.
