# AFI — Mensaje de Afiliación (Sistema RED / TGSS)

Notas del diseño de registros oficial ("Mensaje de Afiliación (AFI)", Instrucciones
Técnicas, Ed. 09/2020, **versión 9.1**). Fuente: `Mensaje+AFI.pdf`.

## Dos formatos distintos (¡no confundir!)

| | Qué es | Segmentos | Quién lo produce |
|---|---|---|---|
| **Petición `.AFI`** | Lo que se **envía** a la TGSS (alta/baja/variación) | `ETI` · `EMP` · `RZS` · `EXC` · `FCE` · `PES` · `TRA` · `AYN` · `DOM` · `LDD` · `FAB` · `DAM` · … · `ETF` | **Nosotros lo GENERAMOS** |
| **Respuesta `FRA`** | Lo que la TGSS **devuelve** procesado | `DID` · `DAU` · `DEM` · `RZS` · `NAN` · `DTR` · `DRE` · `DMO` | TGSS (es nuestro `.msj` de muestra) |

> ⚠️ El `.msj` de ejemplo (`1792536893.msj`) es una **respuesta FRA**, NO la petición.
> El generador de altas debe producir el formato **petición** (ETI/EMP/RZS/TRA/AYN/FAB…).
> El decodificador en `src/afi/afiAlta.js` lee el formato **FRA respuesta** (útil para leer acuses).

## Estructura de la petición (fichero plano, registros de 70, posiciones 1-based)

Envoltura: **`ETI`** (etiqueta inicio, cabecera del envío: sintaxis `AFI9`, programa,
**clave de autorización**, fecha/hora, referencia) … segmentos … **`ETF`** (etiqueta fin).

### EMP — Identificación de Empresa (Obligatorio)
| Campo | Pos | Long | Notas |
|---|---|---|---|
| Cabecera `EMP` | 1 | 3 | |
| CCC Régimen | 4 | 4 | T-2 |
| CCC Provincia | 8 | 2 | 1..56 |
| CCC Número | 10 | 9 | |
| Tipo id. empresario | 19 | 1 | T-3 |
| País empresario | 20 | 3 | T-12 |
| Nº id. empresario | 23 | 14 | ajuste dcha, ceros a izq |
| CCC Principal (Rég/Prov/Núm) | 39/43/45 | 4/2/9 | |
| **Acción** | 67 | 3 | **T-7** (código alta/baja/variación) |

### RZS — Razón Social (Obligatorio)
`RZS`(1,3) · Indicador razón social(4,1) · Tipo alfabético(5,1) · **Razón social(6,55)** · Clave autorización(61,8).

### TRA — Trabajador *(posiciones a confirmar; extracto algo ruidoso)*
`TRA`(1,3) · **NAF** = Provincia(4,2)+Número(6,10) · IPF: Tipo id.(16,1)+País(17,3)+**Nº id. (20,14)** (ajuste dcha, ceros izq) · Nacionalidad(62,3, T-12) · Indicadores(65,1).

### AYN — Apellidos y Nombre *(claro)*
`AYN`(1,3) · **Primer apellido(4,20)** · **Segundo apellido(24,20)** · **Nombre(44,15)**.
(OJO: aquí el orden es apellido1+apellido2+nombre, al revés que en la respuesta FRA `NAN`.)

### FAB — Fechas de Alta/Baja (Obligatorio para trabajador) — **el corazón del alta**
| Campo | Pos | Long | Notas |
|---|---|---|---|
| Cabecera `FAB` | 1 | 3 | |
| **Acción** | 4 | 3 | **T-7** (alta) |
| Situación | 7 | 2 | T-21 |
| **Fecha real (alta)** | 9 | 8 | formato fecha "4" |
| **Grupo de cotización** | 17 | 2 | T-18 |
| Indicativo grupo diario | 19 | 1 | |
| Clave de contrato de trabajo | 22 | 3 | T-19 |
| Categoría profesional | 30 | 3 | T-61 |
| Fecha de nacimiento | 41 | 8 | |
| Sexo | 49 | 1 | 1=hombre, 2=mujer |

## Formatos comunes (CONFIRMADOS — `Indice+Tablas+y+Formatos+Comunes`)
- **Fecha (formato 4) = `AAAAMMDD`**, 8 posiciones.
- **Hora** = `HHMM`; **Año** = `AAAA`.
- **IPF** (máx 14): ajuste a la **derecha**, relleno de **ceros por la izquierda**; NIF → último carácter letra; NIE → primer y último carácter letras. Ej. `54220712Y` → `0000054220712Y`.
- **Código de empresario** (14): igual, ajuste derecha + ceros izq; CIF empieza por letra, último letra o número.
- **NAF** (máx 12): `PP0NNNNNNNNN` (afiliación anterior a 03/1992) o `PP1NNNNNNNNN` (posterior).
- **Decimal** (máx 11): ajuste izquierda, ceros a la derecha (ej. 0,25 → `25000000000`).

## PENDIENTE para completar el generador
El "Índice de Tablas y Formatos" da los formatos pero **NO los valores de las tablas**
(es una guía: dice qué mensaje/segmento usa cada tabla, no el repertorio de claves).
Falta, por tanto:
- **El valor de T-7 = Acción de ALTA** (y baja/variación) — usado en `EMP`(450) y `FAB`.
- Construcción exacta de la cabecera **`ETI`** (sintaxis `AFI9`, identificador de programa `WSxx`, clave de autorización, referencia/contador) y **`ETF`**.

**Vía más fiable para cerrarlo**: un **AFI de PETICIÓN real** (el `.msj`/`.AFI` que SILTRA
**envió** a la TGSS en una remesa de afiliación — carpeta de envíos `SVA\MsjEnv`). Con él +
este diseño se reproduce **byte a byte** (la acción T-7 y la cabecera ETI salen del propio
fichero). Alternativa: el documento completo de **"Tablas de códigos"** (no el índice).
