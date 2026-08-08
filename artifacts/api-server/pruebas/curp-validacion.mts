import { validarCurp, digitoVerificadorCurp } from '../src/utils/curp';
/** Repara el digito 18 de las CURP inventadas para la prueba. */
const fix = (c: string) => c.slice(0, 17) + digitoVerificadorCurp(c.slice(0, 17));
const casos: [string, string, string, string, string][] = [
  ['normal (CURP real del documento)', 'AOTA060308HMNLNDA8',       'ADAN',                 'ALONSO',     'TINOCO'],
  ['MARIA DE LOS ANGELES',        fix('CUGA950712MMNRRN00'), 'MARÍA DE LOS ÁNGELES', 'DE LA CRUZ', 'GARCÍA'],
  ['JOSE DE JESUS',               fix('MALJ880201HMNRPS00'), 'JOSÉ DE JESÚS',        'MARTÍNEZ',   'LÓPEZ'],
  ['sin apellido materno',        fix('PEXJ900101HMNRXN00'), 'JUAN',                 'PÉREZ',      ''],
  ['nombre que NO cuadra (debe reclamar)', 'AOTA060308HMNLNDA8', 'PEDRO',            'ALONSO',     'TINOCO'],
  ['apellido que NO cuadra (debe reclamar)', 'AOTA060308HMNLNDA8', 'ADAN',           'RAMÍREZ',    'TINOCO'],
];
for (const [etiqueta, curp, nombres, apellidoPaterno, apellidoMaterno] of casos) {
  const r = validarCurp(curp, { nombres, apellidoPaterno, apellidoMaterno });
  console.log(`${r.errores.length === 0 ? 'sin errores ' : 'ERRORES     '}  ${etiqueta}`);
  for (const e of r.errores) console.log(`                · ${e}`);
}
