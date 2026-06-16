// Runner de pruebas sin framework. `npm test` -> node test/run.js
import {
  validarNif, validarNie, validarCif, validarDocumento, validarNafFormato, normalizar,
} from '../src/validadores/identidad.js';
import { fichaVacia, camposQueFaltan } from '../src/dominio/esquema.js';
import { construirContrataXml } from '../src/contrata/contrataBuilder.js';
import { municipioCodigo, municipioReconocido, ocupacionCodigo, normNombre } from '../src/datos/oficiales.js';
import { decodificarAfiAlta, construirAfiAltaPreliminar, RECORD_LEN } from '../src/afi/afiAlta.js';

let pasan = 0, fallan = 0;
const ok = (cond, msg) => { if (cond) { pasan++; } else { fallan++; console.error('  ✕ ' + msg); } };
const grupo = (n) => console.log('\n— ' + n);

grupo('NIF');
ok(validarNif('38132419Y'), '38132419Y valido');
ok(validarNif('28926192N'), '28926192N valido');
ok(!validarNif('38132419X'), '38132419X (letra mal) invalido');
ok(!validarNif('1234567A'), 'longitud corta invalido');
ok(validarNif('38132419-y'), 'normaliza guion y minuscula');

grupo('NIE');
ok(validarNie('X1234567L'), 'X1234567L valido');
ok(!validarNie('X1234567M'), 'X1234567M (letra mal) invalido');

grupo('CIF');
ok(validarCif('B91222919'), 'B91222919 valido (control digito)');
ok(validarCif('A58818501'), 'A58818501 valido');
ok(!validarCif('B91222918'), 'B91222918 (control mal) invalido');

grupo('Deteccion de documento');
ok(validarDocumento('38132419Y').tipo === 'NIF', 'detecta NIF');
ok(validarDocumento('X1234567L').tipo === 'NIE', 'detecta NIE');
ok(validarDocumento('B91222919').tipo === 'CIF', 'detecta CIF');
ok(!validarDocumento('HOLA').valido, 'basura invalida');

grupo('NAF (formato)');
ok(validarNafFormato('081032005803'), '12 digitos valido');
ok(!validarNafFormato('12'), 'corto invalido');
ok(normalizar('08 1032 005803') === '081032005803', 'normaliza espacios');

grupo('Ficha: campos que faltan');
ok(camposQueFaltan(fichaVacia()).length === 7, 'ficha vacia: 7 obligatorios faltan');

grupo('Contrat@ XML - indefinido (100)');
const f = fichaVacia();
f.empresa.cif = 'B91222919'; f.empresa.ccc = '0111 41 1479609 80';
f.trabajador.ipf = '38132419Y'; f.trabajador.nombre = 'MANUEL';
f.trabajador.apellido1 = 'CHECA'; f.trabajador.apellido2 = 'ARTASU';
f.trabajador.sexo = 'H'; f.trabajador.naf = '081032005803';
f.trabajador.nacionalidad = 'ES'; f.trabajador.paisResidencia = 'ES';
f.trabajador.municipioResidencia = '41049';
f.contrato.tipo = '100'; f.contrato.fechaInicio = '2026-06-15'; f.contrato.ocupacion = '5000';
const xml = construirContrataXml(f);
ok(xml.includes('<?xml'), 'tiene prologo XML');
ok(xml.includes('<CONTRATOS>') && xml.includes('</CONTRATOS>'), 'raiz CONTRATOS');
ok(xml.includes('<CONTRATO_100>'), 'elemento CONTRATO_100');
ok(xml.includes('<CIF_NIF_EMPRESA>') && xml.includes('<CIF_NIF>B91222919</CIF_NIF>'), 'CIF anidado');
ok(xml.includes('<CODIGO_CUENTA_COTIZACION>011141147960980</CODIGO_CUENTA_COTIZACION>'), 'CCC a digitos');
ok(xml.includes('<IDENTIFICADORPFISICA>D38132419Y</IDENTIFICADORPFISICA>'), 'IPF con prefijo D (NIF)');
ok(xml.includes('<NOMBRE>MANUEL</NOMBRE>'), 'NOMBRE anidado');
ok(xml.includes('<PRIMER_APELLIDO>CHECA</PRIMER_APELLIDO>'), 'PRIMER_APELLIDO');
ok(xml.includes('<SEGUNDO_APELLIDO>ARTASU</SEGUNDO_APELLIDO>'), 'SEGUNDO_APELLIDO');
ok(xml.includes('<SEXO>1</SEXO>'), 'sexo H -> 1');
ok(xml.includes('<NACIONALIDAD>724</NACIONALIDAD>'), 'nacionalidad ES -> 724');
ok(xml.includes('<MUNICIPIO_RESIDENCIA>41049</MUNICIPIO_RESIDENCIA>'), 'municipio residencia');
ok(xml.includes('<FECHA_INICIO>20260615</FECHA_INICIO>'), 'fecha inicio AAAAMMDD');
ok(xml.includes('<CODIGO_OCUPACION>5000    </CODIGO_OCUPACION>'), 'ocupacion 8 chars (4+4)');
ok(xml.includes('<IND_ERE>N</IND_ERE>'), 'prestaciones IND_ERE por defecto N');
ok(!xml.includes('<FECHA_TERMINO>'), 'indefinido: sin FECHA_TERMINO');
ok(!xml.includes('<DATOS_CONTRATO_TIEMPO_PARCIAL>'), 'completa: sin bloque tiempo parcial');

grupo('Contrat@ XML - temporal (402) con fin');
const t = fichaVacia();
t.empresa.cif = 'B91222919'; t.trabajador.ipf = '38132419Y';
t.trabajador.nombre = 'ANA'; t.trabajador.apellido1 = 'GIL';
t.contrato.tipo = '402'; t.contrato.fechaInicio = '2026-06-01'; t.contrato.fechaFin = '2026-09-01';
const xml2 = construirContrataXml(t);
ok(xml2.includes('<CONTRATO_402>'), 'elemento CONTRATO_402');
ok(xml2.includes('<FECHA_TERMINO>20260901</FECHA_TERMINO>'), 'temporal: FECHA_TERMINO AAAAMMDD');

grupo('Contrat@ XML - parcial (200) con tiempo parcial');
const p = fichaVacia();
p.empresa.cif = 'B91222919'; p.trabajador.ipf = '38132419Y';
p.trabajador.nombre = 'LUCIA'; p.trabajador.apellido1 = 'AGUILERA';
p.contrato.tipo = '200'; p.contrato.fechaInicio = '2026-01-20';
p.contrato.tipoJornada = 'A'; p.contrato.horasJornada = '002000';
const xml3 = construirContrataXml(p);
ok(xml3.includes('<DATOS_CONTRATO_TIEMPO_PARCIAL>'), 'parcial: bloque tiempo parcial');
ok(xml3.includes('<TIPO_JORNADA>A</TIPO_JORNADA>') && xml3.includes('<HORAS_JORNADA>002000</HORAS_JORNADA>'), 'jornada parcial');

grupo('Contrat@ XML - escape');
const e = fichaVacia();
e.empresa.cif = 'B91222919'; e.trabajador.ipf = '38132419Y';
e.trabajador.nombre = 'X<Y'; e.trabajador.apellido1 = 'Z';
e.contrato.tipo = '100'; e.contrato.fechaInicio = '2026-01-01';
ok(construirContrataXml(e).includes('<NOMBRE>X&lt;Y</NOMBRE>'), 'escapa < en NOMBRE');

grupo('Codigos oficiales (INE / CNO)');
ok(municipioCodigo('Guillena') === '41049', 'municipio Guillena -> 41049');
ok(municipioCodigo('El Cuervo de Sevilla') === '41903', 'municipio con articulo delante -> codigo');
ok(municipioCodigo('41049') === '41049', 'municipio ya en codigo pasa');
ok(municipioCodigo('Pueblo Que No Existe') === null, 'municipio inexistente -> null');
ok(!municipioReconocido('99999'), 'codigo 99999 no reconocido');
ok(ocupacionCodigo('Camareros asalariados') === '5120', 'ocupacion por nombre -> 5120');
ok(ocupacionCodigo('5120') === '5120', 'ocupacion ya en codigo pasa');
ok(normNombre('Alcalá del Río') === 'alcala del rio', 'normaliza acentos');

grupo('Contrat@ XML - coercion municipio/ocupacion por nombre');
const cc = fichaVacia();
cc.empresa.cif = 'B91222919'; cc.trabajador.ipf = '38132419Y';
cc.trabajador.nombre = 'EVA'; cc.trabajador.apellido1 = 'RUIZ';
cc.trabajador.paisResidencia = 'ES'; cc.trabajador.municipioResidencia = 'Guillena';
cc.contrato.tipo = '100'; cc.contrato.fechaInicio = '2026-06-01'; cc.contrato.ocupacion = 'Camareros asalariados';
const xmlc = construirContrataXml(cc);
ok(xmlc.includes('<MUNICIPIO_RESIDENCIA>41049</MUNICIPIO_RESIDENCIA>'), 'municipio nombre -> codigo INE en el XML');
ok(xmlc.includes('<CODIGO_OCUPACION>5120    </CODIGO_OCUPACION>'), 'ocupacion nombre -> CNO en el XML');

grupo('AFI alta - decodificador (layout real, valores anonimizados)');
const pad = (s) => (s.length < RECORD_LEN ? s.padEnd(RECORD_LEN, ' ') : s.slice(0, RECORD_LEN));
const afi = [
  pad('DID' + 'RYC26WABF1TC100' + '999999' + 'A172240400000X' + '20260115120000' + 'HUELLA123'),
  pad('DAU' + '20220103' + 'GESTORIA DEMO SLP'),
  pad('DEM' + '281234500000017'),
  pad('RZS' + 'EMPRESA DEMO, S.L.'),
  pad('NAN' + 'JUAN'.padEnd(15) + 'PEREZ'.padEnd(20) + 'LOPEZ'.padEnd(20)),
  pad('DTR' + '281234567890' + '100000' + '12345678Z' + '2000041100'),
  pad('DRE' + '0101' + '20260115' + '00000000' + '20260115'),
  pad('DMO' + '0' + '20260115' + '08'),
].join('\r\n');
ok(afi.split('\r\n').every((l) => l.length === RECORD_LEN), 'todos los registros miden 70');
const dec = decodificarAfiAlta(afi);
ok(dec.autorizacion === '999999', 'DID autorizacion');
ok(dec.autorizado.razonSocial === 'GESTORIA DEMO SLP', 'DAU razon social');
ok(dec.empresa.ccc === '281234500000017', 'DEM CCC (15 digitos)');
ok(dec.empresa.razonSocial === 'EMPRESA DEMO, S.L.', 'RZS razon social');
ok(dec.trabajador.nombre === 'JUAN', 'NAN nombre');
ok(dec.trabajador.apellido1 === 'PEREZ', 'NAN apellido1');
ok(dec.trabajador.apellido2 === 'LOPEZ', 'NAN apellido2');
ok(dec.trabajador.naf === '281234567890', 'DTR NAF (12)');
ok(dec.trabajador.ipf === '12345678Z', 'DTR IPF/NIF');
ok(dec.alta.fechaRealAlta === '20260115', 'DRE fecha real alta');
ok(dec.alta.grupoCotizacion === '08', 'DMO grupo cotizacion');

grupo('AFI alta - generador preliminar (round-trip de campos confirmados)');
const datosAfi = {
  empresa: { ccc: '281234500000017', razonSocial: 'EMPRESA DEMO, S.L.' },
  trabajador: { nombre: 'Juan', apellido1: 'Perez', apellido2: 'Lopez', naf: '281234567890', ipf: '12345678Z' },
  alta: { fechaRealAlta: '20260115', grupoCotizacion: '08' },
};
const gen = construirAfiAltaPreliminar(datosAfi);
ok(gen.split(/\r?\n/).filter(Boolean).every((l) => l.length === RECORD_LEN), 'generado: registros de 70');
const rt = decodificarAfiAlta(gen);
ok(rt.empresa.ccc === '281234500000017', 'round-trip CCC');
ok(rt.trabajador.naf === '281234567890', 'round-trip NAF');
ok(rt.trabajador.ipf === '12345678Z', 'round-trip IPF');
ok(rt.trabajador.nombre === 'JUAN', 'round-trip nombre (mayusculas)');
ok(rt.alta.grupoCotizacion === '08', 'round-trip grupo cotizacion');

console.log(`\n=== ${pasan} OK, ${fallan} fallan ===`);
process.exit(fallan ? 1 : 0);
