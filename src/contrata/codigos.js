// Subconjunto de codigos de Contrat@/SEPE de uso comun. El catalogo completo vive
// en las "Tablas de codigos" de la Ayuda XML del SEPE; aqui solo los habituales
// para guiar la UI y decidir si un contrato exige fecha de fin.
// `el` = nombre del elemento XML del contrato (<CONTRATO_xxx>).

export const TIPOS_CONTRATO = {
  '100': { desc: 'Indefinido ordinario - tiempo completo', temporal: false, parcial: false },
  '109': { desc: 'Indefinido fijo-discontinuo', temporal: false, parcial: false },
  '189': { desc: 'Indefinido - tiempo completo (fomento)', temporal: false, parcial: false },
  '200': { desc: 'Indefinido ordinario - tiempo parcial', temporal: false, parcial: true },
  '209': { desc: 'Indefinido - tiempo parcial (fomento)', temporal: false, parcial: true },
  '402': { desc: 'Temporal por circunstancias de la produccion - t. completo', temporal: true, parcial: false },
  '403': { desc: 'Temporal por circunstancias de la produccion - t. parcial', temporal: true, parcial: true },
  '410': { desc: 'Temporal de sustitucion - tiempo completo', temporal: true, parcial: false },
  '411': { desc: 'Temporal de sustitucion - tiempo parcial', temporal: true, parcial: true },
  '420': { desc: 'Formacion en alternancia', temporal: true, parcial: false },
  '421': { desc: 'Formativo para la obtencion de practica profesional', temporal: true, parcial: false },
};

export function tipoContratoInfo(codigo) {
  return TIPOS_CONTRATO[String(codigo || '').trim()] || null;
}

// Sexo -> codigo SEPE. PENDIENTE confirmar contra tabla oficial (TEDSEXO):
// se usa el habitual 1=varon, 6=mujer; centralizado para corregir en un sitio.
export function sexoCodigo(sexo) {
  const s = String(sexo || '').trim().toUpperCase();
  if (s === 'H' || s === 'V') return '1';   // hombre / varon
  if (s === 'M' || s === 'F') return '6';   // mujer
  return '';
}

// Pais ISO -> codigo numerico SEPE (724 = Espana). Tabla parcial; ampliable.
export function paisCodigo(pais) {
  const p = String(pais || '').trim().toUpperCase();
  if (p === 'ES' || p === 'ESP' || p === 'ESPANA' || p === 'ESPAÑA' || p === '724') return '724';
  return p; // se deja tal cual; la UI/validacion avisa si no es numerico
}
