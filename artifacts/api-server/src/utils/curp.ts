/**
 * Validación de CURP — filtro de auditoría en tres capas (sin servicios externos):
 *
 *  1. ESTRUCTURA: formato oficial de 18 caracteres + dígito verificador.
 *     El carácter 18 es una suma de control con algoritmo público (RENAPO);
 *     una CURP inventada casi siempre falla aquí.
 *  2. CONSISTENCIA: la CURP codifica fecha de nacimiento, sexo, entidad de
 *     nacimiento e iniciales del nombre. Se cruzan contra lo declarado.
 *  3. UNICIDAD: se verifica en las rutas (estudiantes + solicitudes activas).
 *
 * La verificación en línea contra RENAPO requiere convenio institucional
 * (no hay API pública); estas capas cubren errores de dedo y CURPs falsas.
 */

const CURP_REGEX = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

/** Entidades federativas según posiciones 12-13 de la CURP. */
export const ENTIDADES_CURP: Record<string, string> = {
  AS: 'Aguascalientes', BC: 'Baja California', BS: 'Baja California Sur',
  CC: 'Campeche', CL: 'Coahuila', CM: 'Colima', CS: 'Chiapas', CH: 'Chihuahua',
  DF: 'Ciudad de México', DG: 'Durango', GT: 'Guanajuato', GR: 'Guerrero',
  HG: 'Hidalgo', JC: 'Jalisco', MC: 'Estado de México', MN: 'Michoacán',
  MS: 'Morelos', NT: 'Nayarit', NL: 'Nuevo León', OC: 'Oaxaca', PL: 'Puebla',
  QT: 'Querétaro', QR: 'Quintana Roo', SP: 'San Luis Potosí', SL: 'Sinaloa',
  SR: 'Sonora', TC: 'Tabasco', TS: 'Tamaulipas', TL: 'Tlaxcala',
  VZ: 'Veracruz', YN: 'Yucatán', ZS: 'Zacatecas', NE: 'Nacido en el extranjero',
};

/** Dígito verificador oficial (carácter 18). */
export function digitoVerificadorCurp(curp17: string): number {
  const alfabeto = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    suma += alfabeto.indexOf(curp17[i]) * (18 - i);
  }
  return (10 - (suma % 10)) % 10;
}

function quitarAcentos(s: string): string {
  return s
    .toUpperCase()
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
    .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ü/g, 'U')
    .trim();
}

// Partículas que RENAPO ignora en apellidos/nombres compuestos.
const PARTICULAS = new Set(['DA', 'DAS', 'DE', 'DEL', 'DER', 'DI', 'DIE', 'DD', 'EL', 'LA', 'LOS', 'LAS', 'LE', 'LES', 'MAC', 'MC', 'VAN', 'VON', 'Y']);

/** Primera palabra significativa (ignora partículas tipo "DE LA"). */
function palabraSignificativa(texto: string): string {
  const palabras = quitarAcentos(texto).split(/\s+/).filter(Boolean);
  for (const p of palabras) {
    if (!PARTICULAS.has(p)) return p;
  }
  return palabras[0] ?? '';
}

/** Primera letra para la CURP (Ñ se sustituye por X). */
function inicialCurp(palabra: string): string {
  const ch = palabra[0] ?? '';
  return ch === 'Ñ' ? 'X' : ch;
}

/** Nombre de pila que usa la CURP: si el primero es MARIA/JOSE y hay más, usa el segundo. */
function nombreParaCurp(nombres: string): string {
  const palabras = quitarAcentos(nombres).split(/\s+/).filter(Boolean);
  if (palabras.length > 1 && ['MARIA', 'MA', 'MA.', 'JOSE', 'J', 'J.'].includes(palabras[0])) {
    return palabras[1];
  }
  return palabraSignificativa(nombres);
}

export interface DatosDeclarados {
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string; // YYYY-MM-DD
  sexo?: string; // 'hombre' | 'mujer' | 'no_definir'
}

export interface ResultadoCurp {
  valida: boolean;
  errores: string[];
  /**
   * Lo que la CURP YA DICE, para llenar el formulario en vez de pedirlo.
   *
   * La CURP no es un identificador opaco: sus 18 caracteres codifican la fecha
   * de nacimiento, el sexo y la entidad de nacimiento. Esta capa ya los
   * calculaba —para regañar cuando no coincidían con lo tecleado—, y hacer que
   * la persona escriba a mano un dato que el sistema puede deducir, para
   * después corregirla, es pedirle trabajo y castigarla por hacerlo.
   *
   * Sólo se devuelve cuando la CURP pasó la verificación completa (formato +
   * dígito de control): deducir de una CURP inválida sería inventar.
   */
  derivado?: {
    fechaNacimiento: string; // YYYY-MM-DD
    sexo: 'hombre' | 'mujer' | 'no_definir';
    entidadNacimiento?: string;
  };
  /** @deprecated Usa `derivado.entidadNacimiento`. Se conserva por compatibilidad. */
  entidadNacimiento?: string;
}

/**
 * La fecha de nacimiento que trae la CURP.
 *
 * Posiciones 5-10 (AAMMDD). El siglo lo decide el carácter 17: en las CURP del
 * siglo XX es un dígito, y en las del XXI una letra — RENAPO lo usó justamente
 * para desempatar. Sin esa regla, alguien nacido en 2005 se registraría como
 * nacido en 1905.
 */
export function fechaNacimientoDeCurp(curp: string): string {
  const esSiglo21 = /[A-Z]/.test(curp[16]);
  return `${esSiglo21 ? '20' : '19'}${curp.slice(4, 6)}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`;
}

/** El sexo que trae la CURP (posición 11). `X` = no binario, en las recientes. */
export function sexoDeCurp(curp: string): 'hombre' | 'mujer' | 'no_definir' {
  if (curp[10] === 'H') return 'hombre';
  if (curp[10] === 'M') return 'mujer';
  return 'no_definir';
}

export function validarCurp(curpRaw: string, datos: DatosDeclarados = {}): ResultadoCurp {
  const errores: string[] = [];
  const curp = (curpRaw ?? '').toUpperCase().trim();

  // ── Capa 1: estructura ──
  if (curp.length !== 18) {
    return { valida: false, errores: ['La CURP debe tener exactamente 18 caracteres.'] };
  }
  if (!CURP_REGEX.test(curp)) {
    return {
      valida: false,
      errores: ['La CURP no tiene el formato oficial. Revisa que la hayas copiado tal como aparece en tu documento.'],
    };
  }
  if (digitoVerificadorCurp(curp) !== Number(curp[17])) {
    return {
      valida: false,
      errores: ['La CURP no pasa la verificación oficial (dígito de control). Revisa que esté bien escrita.'],
    };
  }

  // ── Capa 2: consistencia con lo declarado ──

  // Fecha de nacimiento (posiciones 5-10: AAMMDD; el siglo lo indica el
  // carácter 17: dígito = 1900s, letra = 2000s).
  if (datos.fechaNacimiento && /^\d{4}-\d{2}-\d{2}$/.test(datos.fechaNacimiento)) {
    const [anio, mes, dia] = datos.fechaNacimiento.split('-');
    const esSiglo21 = /[A-Z]/.test(curp[16]);
    const anioCurp = (esSiglo21 ? '20' : '19') + curp.slice(4, 6);
    if (anioCurp !== anio || curp.slice(6, 8) !== mes || curp.slice(8, 10) !== dia) {
      errores.push('La fecha de nacimiento no coincide con la que viene codificada en la CURP.');
    }
  }

  // Sexo (posición 11: H/M; X para no binario en CURPs recientes).
  if (datos.sexo === 'hombre' && curp[10] !== 'H') {
    errores.push('El sexo declarado no coincide con el de la CURP.');
  }
  if (datos.sexo === 'mujer' && curp[10] !== 'M') {
    errores.push('El sexo declarado no coincide con el de la CURP.');
  }

  // Iniciales (posiciones 1, 3 y 4). La posición 2 (vocal del apellido) se
  // omite porque RENAPO la sustituye en palabras inconvenientes.
  if (datos.apellidoPaterno) {
    const esperada = inicialCurp(palabraSignificativa(datos.apellidoPaterno));
    if (esperada && curp[0] !== esperada) {
      errores.push('El apellido paterno no coincide con las iniciales de la CURP.');
    }
  }
  if (datos.apellidoMaterno !== undefined) {
    const esperada = datos.apellidoMaterno.trim()
      ? inicialCurp(palabraSignificativa(datos.apellidoMaterno))
      : 'X';
    if (esperada && curp[2] !== esperada) {
      errores.push('El apellido materno no coincide con las iniciales de la CURP.');
    }
  }
  if (datos.nombres) {
    const esperada = inicialCurp(nombreParaCurp(datos.nombres));
    if (esperada && curp[3] !== esperada) {
      errores.push('El nombre no coincide con las iniciales de la CURP.');
    }
  }

  // ── Lo que la CURP dice, para llenar el formulario ──
  //
  // Se calcula SÓLO si no hubo errores: si la CURP no cuadra con lo que la
  // persona ya escribió, autollenar el resto encima sería empeorar el enredo
  // en vez de resolverlo. Primero se aclara la contradicción.
  const entidad = ENTIDADES_CURP[curp.slice(11, 13)];
  const valida = errores.length === 0;

  return {
    valida,
    errores,
    entidadNacimiento: entidad,
    ...(valida
      ? {
          derivado: {
            fechaNacimiento: fechaNacimientoDeCurp(curp),
            sexo: sexoDeCurp(curp),
            entidadNacimiento: entidad,
          },
        }
      : {}),
  };
}
