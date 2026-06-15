// Runner de pruebas sin framework. `npm test` -> node test/run.js
import {
  validarNif, validarNie, validarCif, validarDocumento, validarNafFormato, normalizar,
} from '../src/validadores/identidad.js';
import { fichaVacia, camposQueFaltan } from '../src/dominio/esquema.js';
import { construirContrataXml } from '../src/contrata/contrataBuilder.js';

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
f.empresa.cif = 'B91222919'; f.empresa.ccc = '011141147960980';
f.trabajador.ipf = '38132419Y'; f.trabajador.nombre = 'MANUEL';
f.trabajador.apellido1 = 'CHECA'; f.trabajador.apellido2 = 'ARTASU';
f.trabajador.sexo = 'H'; f.trabajador.naf = '081032005803';
f.trabajador.nacionalidad = 'ES'; f.trabajador.paisResidencia = 'ES';
f.contrato.tipo = '100'; f.contrato.fechaInicio = '2026-06-15';
const xml = construirContrataXml(f);
ok(xml.includes('<?xml'), 'tiene prologo XML');
ok(xml.includes('<CONTRATOS>') && xml.includes('</CONTRATOS>'), 'raiz CONTRATOS');
ok(xml.includes('<CONTRATO_100>'), 'elemento CONTRATO_100');
ok(xml.includes('<CIF_NIF_EMPRESA>B91222919</CIF_NIF_EMPRESA>'), 'CIF empresa');
ok(xml.includes('<IDENTIFICADORPFISICA>38132419Y</IDENTIFICADORPFISICA>'), 'IPF trabajador');
ok(xml.includes('<NOMBRE_APELLIDOS>CHECA ARTASU MANUEL</NOMBRE_APELLIDOS>'), 'nombre y apellidos');
ok(xml.includes('<SEXO>1</SEXO>'), 'sexo H -> 1');
ok(xml.includes('<NACIONALIDAD>724</NACIONALIDAD>'), 'nacionalidad ES -> 724');
ok(xml.includes('<FECHA_INICIO>2026-06-15</FECHA_INICIO>'), 'fecha inicio');
ok(!xml.includes('<FECHA_TERMINO>'), 'indefinido: sin FECHA_TERMINO');

grupo('Contrat@ XML - temporal (402) con fin');
const t = fichaVacia();
t.empresa.cif = 'B91222919'; t.trabajador.ipf = '38132419Y';
t.trabajador.nombre = 'ANA'; t.trabajador.apellido1 = 'GIL';
t.contrato.tipo = '402'; t.contrato.fechaInicio = '2026-06-01'; t.contrato.fechaFin = '2026-09-01';
const xml2 = construirContrataXml(t);
ok(xml2.includes('<CONTRATO_402>'), 'elemento CONTRATO_402');
ok(xml2.includes('<FECHA_TERMINO>2026-09-01</FECHA_TERMINO>'), 'temporal: FECHA_TERMINO presente');

grupo('Contrat@ XML - escape');
const e = fichaVacia();
e.empresa.cif = 'B91222919'; e.empresa.razonSocial = 'PEPE & CIA';
e.trabajador.ipf = '38132419Y'; e.trabajador.nombre = 'X<Y';
e.trabajador.apellido1 = 'Z'; e.contrato.tipo = '100'; e.contrato.fechaInicio = '2026-01-01';
ok(construirContrataXml(e).includes('Z X&lt;Y'), 'escapa < en el contenido');

console.log(`\n=== ${pasan} OK, ${fallan} fallan ===`);
process.exit(fallan ? 1 : 0);
