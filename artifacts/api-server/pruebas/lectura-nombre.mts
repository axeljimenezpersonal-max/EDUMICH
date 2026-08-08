/** Prueba de la particion del nombre con la CURP. No toca la base ni la red. */
import { partirNombreConCurp } from '../src/services/lecturaDocumentos';
import { inicialesParaCurp, digitoVerificadorCurp } from '../src/utils/curp';

const ENC = 'ESTADOS UNIDOS MEXICANOS CONSTANCIA DE LA CLAVE ÚNICA DE REGISTRO DE POBLACIÓN DIRECCIÓN GENERAL DEL REGISTRO NACIONAL DE POBLACIÓN E IDENTIDAD SEGOB SECRETARÍA DE GOBERNACIÓN';
const PIE = 'CURP CERTIFICADA: VERIFICADA CON EL REGISTRO CIVIL CIUDAD DE MÉXICO A 02 DE ENERO DE 2023';

let fallos = 0;
function caso(nombre: string, texto: string, curp: string, esperado: string | null) {
  const r = partirNombreConCurp(texto.toUpperCase().replace(/\s+/g, ' '), curp);
  const got = r ? `${r.nombres} | ${r.apellidoPaterno} | ${r.apellidoMaterno}` : null;
  const ok = got === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : 'FALLA '} ${nombre}\n         esperado: ${esperado}\n         obtenido: ${got}`);
}

// ── El documento real de la captura ────────────────────────────────────────
const CURP = 'AOTA060308HMNLNDA8';
console.log(`\nCURP ${CURP} — digito de control: ${digitoVerificadorCurp(CURP.slice(0, 17))} (impreso: ${CURP[17]})`);
console.log('iniciales de "ADAN / ALONSO / TINOCO":', inicialesParaCurp('ADAN', 'ALONSO', 'TINOCO'), '\n');

caso('orden de lectura (rotulo, luego valor)',
  `${ENC} CLAVE: ${CURP} NOMBRE ADAN ALONSO TINOCO FECHA DE INSCRIPCIÓN 03/05/2006 FOLIO 124675486 ENTIDAD DE REGISTRO MICHOACAN DE OCAMPO ${PIE}`,
  CURP, 'ADAN | ALONSO | TINOCO');

caso('orden de DIBUJO: todos los rotulos, luego todos los valores  <-- el que fallaba',
  `${ENC} CLAVE: NOMBRE FECHA DE INSCRIPCIÓN FOLIO ENTIDAD DE REGISTRO ${CURP} ADAN ALONSO TINOCO 03/05/2006 124675486 MICHOACAN DE OCAMPO ${PIE}`,
  CURP, 'ADAN | ALONSO | TINOCO');

caso('por columnas, el nombre despues del folio',
  `${ENC} FOLIO 124675486 ENTIDAD DE REGISTRO MICHOACAN DE OCAMPO CLAVE: ${CURP} NOMBRE ADAN ALONSO TINOCO ${PIE}`,
  CURP, 'ADAN | ALONSO | TINOCO');

caso('con los tres rotulos separados (constancia de otra maqueta)',
  `${ENC} CURP ${CURP} PRIMER APELLIDO ALONSO SEGUNDO APELLIDO TINOCO NOMBRE(S) ADAN ${PIE}`,
  CURP, 'ADAN | ALONSO | TINOCO');

// ── Nombres dificiles de partir ────────────────────────────────────────────
// CURPs armadas con las mismas reglas; el digito 18 no lo usa esta funcion.
caso('MARIA DE LOS ANGELES DE LA CRUZ GARCIA',
  `${ENC} CLAVE: CUGA950712MMNRRN08 NOMBRE MARÍA DE LOS ÁNGELES DE LA CRUZ GARCÍA FECHA DE INSCRIPCIÓN ${PIE}`,
  'CUGA950712MMNRRN08', 'MARÍA DE LOS ÁNGELES | DE LA CRUZ | GARCÍA');

caso('JOSE DE JESUS MARTINEZ LOPEZ',
  `${ENC} CLAVE: MALJ880201HMNRPS04 NOMBRE JOSÉ DE JESÚS MARTÍNEZ LÓPEZ ${PIE}`,
  'MALJ880201HMNRPS04', 'JOSÉ DE JESÚS | MARTÍNEZ | LÓPEZ');

caso('un solo apellido (materno = X en la CURP)',
  `${ENC} CLAVE: PEXJ900101HMNRXN09 NOMBRE JUAN PÉREZ ${PIE}`,
  'PEXJ900101HMNRXN09', 'JUAN | PÉREZ | ');

caso('dos nombres y dos apellidos',
  `${ENC} CLAVE: ROHL010203MMNDRZ05 NOMBRE LUZ ELENA RODRÍGUEZ HERNÁNDEZ ${PIE}`,
  'ROHL010203MMNDRZ05', 'LUZ ELENA | RODRÍGUEZ | HERNÁNDEZ');

// ── Lo que NO debe proponer ────────────────────────────────────────────────
caso('el nombre no esta en el texto -> no inventa',
  `${ENC} CLAVE: ${CURP} FECHA DE INSCRIPCIÓN 03/05/2006 FOLIO 124675486 ${PIE}`,
  CURP, null);

caso('la CURP no corresponde al nombre impreso -> no inventa',
  `${ENC} CLAVE: ZZZZ060308HMNLNDA8 NOMBRE ADAN ALONSO TINOCO ${PIE}`,
  'ZZZZ060308HMNLNDA8', null);

console.log(fallos === 0 ? '\n== TODOS LOS CASOS PASAN ==\n' : `\n== ${fallos} CASO(S) FALLAN ==\n`);
process.exit(fallos === 0 ? 0 : 1);
