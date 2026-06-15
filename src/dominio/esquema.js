// Ficha canonica trabajador + contrato. Es la representacion estructurada unica
// que produce la extraccion IA y de la que parten los generadores (Contrat@, AFI).
// Los nombres de campo se mapean luego a cada formato de destino.

export function fichaVacia() {
  return {
    empresa: {
      cif: '',
      ccc: '',            // Codigo Cuenta Cotizacion (15 digitos)
      razonSocial: '',
    },
    trabajador: {
      ipf: '',            // NIF / NIE
      naf: '',            // Numero de Afiliacion a la Seguridad Social
      nombre: '',
      apellido1: '',
      apellido2: '',
      sexo: '',           // 'H' | 'M' (se mapea al codigo del destino)
      fechaNacimiento: '',// AAAA-MM-DD
      nacionalidad: 'ES',
      paisResidencia: 'ES',
      municipioResidencia: '',
      domicilio: '',
      telefono: '',
      email: '',
    },
    contrato: {
      tipo: '',           // codigo de tipo de contrato (ver contrata/codigos.js)
      fechaInicio: '',    // AAAA-MM-DD
      fechaFin: '',       // AAAA-MM-DD (temporales)
      jornada: '',        // 'completa' | 'parcial'
      coeficienteParcial: '', // % de jornada si parcial
      grupoCotizacion: '',
      ocupacion: '',      // codigo CNO (4 digitos)
      nivelFormativo: '', // codigo nivel formativo
      tipoJornada: '',    // D/S/M/A (si parcial)
      horasJornada: '',   // horas de jornada (si parcial)
      categoria: '',
      convenio: '',
      salarioBruto: '',
      observaciones: '',
    },
    // Notas de la extraccion (de donde salio cada cosa, dudas, etc.)
    _meta: {
      fuente: '',         // 'email' | 'whatsapp' | 'foto' | 'llamada' | 'mixto'
      avisos: [],         // strings con dudas/datos que faltan
    },
  };
}

// Campos minimos para poder emitir un Contrat@/AFI; se usan para avisar al gestor.
export const CAMPOS_OBLIGATORIOS = [
  ['empresa.cif', 'CIF de la empresa'],
  ['empresa.ccc', 'Codigo Cuenta Cotizacion'],
  ['trabajador.ipf', 'NIF/NIE del trabajador'],
  ['trabajador.nombre', 'Nombre'],
  ['trabajador.apellido1', 'Primer apellido'],
  ['contrato.tipo', 'Tipo de contrato'],
  ['contrato.fechaInicio', 'Fecha de inicio'],
];

export function valorRuta(obj, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Devuelve la lista de campos obligatorios que faltan (etiquetas legibles).
export function camposQueFaltan(ficha) {
  return CAMPOS_OBLIGATORIOS
    .filter(([ruta]) => {
      const v = valorRuta(ficha, ruta);
      return v == null || String(v).trim() === '';
    })
    .map(([, etiqueta]) => etiqueta);
}
