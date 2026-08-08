/**
 * Leer los datos que ya vienen dentro del documento.
 *
 * El alumno sube su constancia de CURP, su acta y su identificación, y después
 * teclea a mano los mismos datos que esos papeles ya traen. Este servicio los
 * lee y los PROPONE, para que la persona confirme en vez de transcribir.
 *
 * ── La regla que ordena todo esto ───────────────────────────────────────────
 *
 * **Nada se da por bueno sin comprobación.** Un dato mal leído que se guarda en
 * silencio es peor que no leer nada: una CURP con un carácter cambiado es una
 * matrícula equivocada, y una matrícula equivocada es un certificado a nombre
 * de otra persona. Por eso cada lectura tiene que pasar una verificación
 * ARITMÉTICA antes de proponerse:
 *
 *   · La CURP trae su propio dígito de control (RENAPO).
 *   · La zona de lectura mecánica del INE trae dígitos de control por campo.
 *
 * Si el dígito no cuadra, la lectura estuvo mal y se descarta. No se propone
 * "lo más probable": se dice que no se pudo leer y la persona teclea, que es
 * exactamente lo que hacía antes. El peor caso de esta función es el estado
 * actual del sistema.
 *
 * ── Dos caminos, muy distintos en precisión ─────────────────────────────────
 *
 * 1. PDF (constancia de CURP, actas nuevas): el texto ESTÁ dentro del archivo.
 *    No hay OCR ni interpretación — se extrae y ya. Precisión exacta.
 *
 * 2. Imagen (foto del INE): hay que reconocer caracteres, y ahí sí puede
 *    fallar. Se lee únicamente la ZONA DE LECTURA MECÁNICA del reverso —los
 *    tres renglones en tipografía OCR-B, diseñados para que los lea una
 *    máquina— y no el frente, que es texto libre sobre un fondo con guilloches.
 *
 * ── Por qué el reconocimiento corre AQUÍ y no en un servicio de terceros ────
 *
 * Mandar la identificación o el acta de un menor a la nube de otra empresa es
 * una transferencia de datos personales a un tercero, y eso en una plataforma
 * de gobierno exige estar en el aviso de privacidad y respaldado por contrato
 * (LGPDPPSO). Tesseract corre dentro del mismo contenedor: el documento no
 * sale de la infraestructura del Estado.
 */
import { spawn } from 'node:child_process';
import { validarCurp, fechaNacimientoDeCurp, sexoDeCurp, ENTIDADES_CURP, inicialesParaCurp, PARTICULAS } from '../utils/curp';

/** De dónde salió cada dato. Viaja hasta la base para poder auditarlo después. */
export type FuenteDato = 'pdf_curp' | 'pdf_acta' | 'ine_mrz';

export interface CamposLeidos {
  curp?: string;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  fechaNacimiento?: string;
  sexo?: 'hombre' | 'mujer' | 'no_definir';
  entidadNacimiento?: string;
}

export interface Lectura {
  ok: boolean;
  /** Qué documento se reconoció, o null si no se pudo identificar. */
  fuente: FuenteDato | null;
  campos: CamposLeidos;
  /** Explicación para la persona cuando no se pudo leer. Nunca técnica. */
  aviso?: string;
}

const SIN_LECTURA = (aviso: string): Lectura => ({ ok: false, fuente: null, campos: {}, aviso });

// ─── 1. PDF: el texto ya está adentro ─────────────────────────────────────

/**
 * Saca el texto de un PDF. Sin OCR: `pdfjs` lee los objetos de texto que el
 * generador del documento dejó ahí.
 *
 * Si el PDF es un ESCANEO (una imagen dentro de un PDF) no habrá texto y esto
 * devuelve vacío — que es la respuesta correcta, no un error: significa "de
 * aquí no se puede leer nada", y quien lo subió tendrá que teclear.
 */
async function textoDePdf(archivo: Buffer): Promise<string> {
  // Import dinámico: `pdfjs-dist` es pesado y sólo hace falta cuando alguien
  // sube un PDF, no en cada arranque del servidor.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(archivo),
    // Un PDF puede traer JavaScript embebido y fuentes remotas. Nada de eso
    // hace falta para leer texto, y todo eso es superficie de ataque en un
    // archivo que sube cualquiera desde internet.
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  let texto = '';
  // Sólo las dos primeras páginas: la constancia de CURP y el acta traen sus
  // datos ahí, y limitarlo evita que un PDF de mil páginas ocupe el servidor.
  const paginas = Math.min(doc.numPages, 2);
  for (let i = 1; i <= paginas; i++) {
    const contenido = await (await doc.getPage(i)).getTextContent();
    // `items` mezcla fragmentos de texto con marcas de estructura; sólo los
    // primeros traen `str`.
    texto += contenido.items.map((x) => ('str' in x ? x.str : '')).join(' ') + ' ';
  }
  await doc.destroy();
  return texto.replace(/\s+/g, ' ').toUpperCase();
}

/** La CURP que aparezca en un texto, sólo si pasa su dígito de control. */
function curpDeTexto(texto: string): string | null {
  // Se prueban TODAS las coincidencias, no la primera: la constancia de CURP
  // trae también el folio y otras cadenas que se le parecen. La que manda es
  // la que pasa la verificación de RENAPO.
  const candidatas = texto.match(/[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d/g) ?? [];
  for (const c of candidatas) {
    if (validarCurp(c).valida) return c;
  }
  return null;
}

/**
 * Qué documento es. Importa porque la pantalla se lo dice a la persona ("se
 * llenó desde tu acta de nacimiento"), y decirlo mal hace dudar de todo lo
 * demás: si se equivoca en cuál papel subí, ¿por qué le creo los datos?
 *
 * La constancia se reconoce PRIMERO y por su título. Antes se preguntaba sólo
 * si el texto mencionaba "REGISTRO CIVIL", y toda constancia de CURP trae al
 * pie "CURP Certificada: verificada con el Registro Civil" — así que TODAS se
 * anunciaban como actas de nacimiento.
 */
function tipoDeDocumento(texto: string): FuenteDato {
  if (/CLAVE ÚNICA DE REGISTRO DE POBLACIÓN|CLAVE UNICA DE REGISTRO DE POBLACION|CONSTANCIA DE LA CLAVE/.test(texto)) {
    return 'pdf_curp';
  }
  // El acta se declara en su título o en la estructura del libro registral. Se
  // exige "ACTA" junto a algo del registro: "REGISTRO CIVIL" suelto aparece en
  // la letra chica de documentos que no son actas.
  if (/ACTA DE NACIMIENTO|ACTA DE REGISTRO|LIBRO\b.*\bOFICIAL[IÍ]A|OFICIAL[IÍ]A\b.*\bLIBRO/.test(texto)) {
    return 'pdf_acta';
  }
  return 'pdf_curp';
}

type Nombre = { nombres: string; apellidoPaterno: string; apellidoMaterno: string };

/**
 * Palabras que estos documentos traen impresas y que nunca son parte de un
 * nombre: rótulos, membretes y la letra chica. Se excluyen para que un tramo
 * de texto administrativo no pueda hacerse pasar por el nombre de alguien.
 *
 * Las partículas ("DE", "LA", "DEL"...) NO están aquí a propósito: son parte
 * legítima de muchos apellidos mexicanos.
 */
const PALABRAS_DEL_DOCUMENTO = new Set([
  'ESTADOS', 'UNIDOS', 'MEXICANOS', 'CONSTANCIA', 'CLAVE', 'UNICA', 'ÚNICA',
  'REGISTRO', 'POBLACION', 'POBLACIÓN', 'DIRECCION', 'DIRECCIÓN', 'GENERAL',
  'NACIONAL', 'IDENTIDAD', 'SECRETARIA', 'SECRETARÍA', 'GOBERNACION',
  'GOBERNACIÓN', 'SEGOB', 'NOMBRE', 'NOMBRES', 'APELLIDO', 'APELLIDOS',
  'PATERNO', 'MATERNO', 'PRIMER', 'SEGUNDO', 'FECHA', 'INSCRIPCION',
  'INSCRIPCIÓN', 'FOLIO', 'ENTIDAD', 'SEXO', 'CURP', 'CERTIFICADA',
  'VERIFICADA', 'CIVIL', 'NACIMIENTO', 'ACTA', 'CIUDAD', 'HOMBRE', 'MUJER',
  'MASCULINO', 'FEMENINO', 'DATOS', 'PERSONALES', 'EDAD', 'AÑOS', 'ANOS',
  'MUNICIPIO', 'LOCALIDAD', 'DOMICILIO', 'LIBRO', 'OFICIALIA', 'OFICIALÍA',
  'JUEZ', 'OFICIAL', 'TOMO', 'FOJA', 'ANIO', 'AÑO', 'ANO',
]);
// Aquí NO van los nombres de las entidades, aunque "MICHOACAN DE OCAMPO" esté
// impreso al lado del nombre y tenga su misma forma. Se intentó y salió peor:
// "Ciudad de México" mete DE a la lista, "San Luis Potosí" mete SAN y LUIS,
// "Nuevo León" mete NUEVO — y con eso se rompen los apellidos compuestos (DE LA
// CRUZ, DE JESÚS) y nombres de pila comunes. Contra las entidades ya protegen
// la comprobación contra la CURP y la exigencia de que la respuesta sea única.

const ES_PALABRA_DE_NOMBRE = /^[A-ZÁÉÍÓÚÑ]{1,25}$/;

/** Vacío es válido (no hay materno); con contenido, no puede colgar de una partícula. */
function trozoMalFormado(trozo: string): boolean {
  const p = trozo.split(' ').filter(Boolean).map((x) => quitarAcentosSimple(x));
  if (p.length === 0) return false;
  return PARTICULAS.has(p[p.length - 1]) || p.every((x) => PARTICULAS.has(x));
}

function quitarAcentosSimple(s: string): string {
  return s.replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
}

/**
 * Los tres campos del nombre cuando la constancia los trae rotulados por
 * separado. Devuelve `null` si falta el paterno o el nombre: media partición no
 * sirve para nada, y quien llama lo verifica contra la CURP antes de usarlo.
 */
function nombrePorRotulos(texto: string): Nombre | null {
  const campo = (etiquetas: string[]): string => {
    for (const e of etiquetas) {
      const m = new RegExp(`${e}[:\\s]+([A-ZÁÉÍÓÚÑ ]{2,60}?)(?=\\s*(?:PRIMER|SEGUNDO|NOMBRE|FECHA|SEXO|ENTIDAD|FOLIO|CURP|CLAVE|$))`).exec(texto);
      const v = m?.[1]?.trim();
      if (v && v.length >= 2) return v;
    }
    return '';
  };
  const apellidoPaterno = campo(['PRIMER APELLIDO', 'APELLIDO PATERNO']);
  const nombres = campo(['NOMBRE\\(S\\)', 'NOMBRES']);
  if (!apellidoPaterno || !nombres) return null;
  return { nombres, apellidoPaterno, apellidoMaterno: campo(['SEGUNDO APELLIDO', 'APELLIDO MATERNO']) };
}

/**
 * Parte un nombre corrido usando la CURP como llave.
 *
 * ── Por qué no se leen los rótulos ──────────────────────────────────────────
 *
 * Antes se buscaban las etiquetas del documento ("PRIMER APELLIDO", "NOMBRE(S)")
 * y se tomaba lo que seguía. Falla por dos razones, y las dos se vieron en una
 * sola constancia real:
 *
 *   1. Hay constancias con UN solo campo "Nombre" —el nombre completo corrido—
 *      y no los tres rótulos separados.
 *   2. `pdfjs` devuelve el texto en el orden en que el PDF lo DIBUJA, que no es
 *      el orden en que se lee. En una maqueta de columnas, lo que sigue al
 *      rótulo "Nombre" puede ser el rótulo "Folio" y no el nombre. Eso fue
 *      exactamente lo que acabó escrito en el formulario: "FOLIO".
 *
 * Cualquier arreglo basado en rótulos sigue dependiendo de cómo esté maquetado
 * cada PDF, y hay tantas maquetas como generadores de constancias.
 *
 * ── Lo que sí es invariante ─────────────────────────────────────────────────
 *
 * La CURP codifica cómo se parte el nombre: inicial del apellido paterno, su
 * primera vocal interna, inicial del materno e inicial del nombre de pila. Con
 * "ADAN ALONSO TINOCO" y `AOTA`, sólo una partición reproduce esas letras —
 * ALONSO(A,O) TINOCO(T) ADAN(A)— y las otras quedan descartadas por aritmética,
 * no por parecer menos probables.
 *
 * Así que se busca, en el texto alrededor de la CURP, un tramo de palabras y
 * una forma de partirlo que la reproduzcan. Y se exige que sea **el único**: si
 * dos tramos distintos cuadran, no se propone nada. Un nombre equivocado en un
 * expediente es peor que un campo vacío, porque el vacío se ve y el error no.
 *
 * La vocal interna sólo desempata, nunca descarta: RENAPO la sustituye cuando
 * las cuatro letras forman una palabra inconveniente (ver `inicialesParaCurp`).
 */
export function partirNombreConCurp(texto: string, curp: string): Nombre | null {
  const objetivo = { paterno: curp[0], materno: curp[2], nombre: curp[3], vocal: curp[1] };

  const cuadra = (n: Nombre) => {
    const ini = inicialesParaCurp(n.nombres, n.apellidoPaterno, n.apellidoMaterno);
    return ini.paterno === objetivo.paterno && ini.materno === objetivo.materno && ini.nombre === objetivo.nombre;
  };

  // Camino 1: el documento ya trae la partición hecha en tres rótulos. Cuando
  // están, mandan — nadie sabe mejor que RENAPO dónde parte ese nombre. Pero se
  // comprueba igual contra la CURP: los rótulos se leen por posición en el
  // texto, y esa posición depende de la maqueta. Verificados, un mal recorte
  // simplemente no pasa y se sigue al camino 2.
  const rotulado = nombrePorRotulos(texto);
  if (rotulado && cuadra(rotulado)) return rotulado;

  const todas = texto.split(/\s+/).filter(Boolean);

  // Se busca cerca de la CURP, no en toda la hoja: el nombre siempre está en el
  // recuadro de datos, y la letra chica del pie son cientos de palabras que sólo
  // aportan coincidencias falsas.
  const iCurp = todas.findIndex((t) => t.includes(curp));
  const region = iCurp >= 0
    ? todas.slice(Math.max(0, iCurp - 40), iCurp + 40)
    : todas.slice(0, 120);

  const candidatos = new Map<string, Nombre>();
  const registrar = (n: Nombre) => {
    if (!n.nombres || !n.apellidoPaterno) return;
    // Ningún trozo puede TERMINAR en partícula ni ser sólo partículas. Las
    // partículas se pegan a lo que va DESPUÉS —"de la Cruz", nunca "Cruz de"—
    // y esto es lo que desambigua sin adivinar: sin la regla, "MARÍA DE LOS
    // ÁNGELES DE | LA CRUZ | GARCÍA" reproduce las mismas letras de la CURP que
    // la partición correcta, y las dos se quedarían empatadas.
    if ([n.nombres, n.apellidoPaterno, n.apellidoMaterno].some(trozoMalFormado)) return;
    if (!cuadra(n)) return;
    candidatos.set(`${n.nombres}|${n.apellidoPaterno}|${n.apellidoMaterno}`, n);
  };

  // Se parten TRAMOS COMPLETOS de palabras seguidas, no cualquier subventana.
  //
  // Un nombre ocupa un campo entero, y en el texto ese campo viene delimitado
  // por un rótulo, un número o el borde de la región. Tomar subventanas hacía
  // que de "JOSÉ DE JESÚS MARTÍNEZ LÓPEZ" también salieran "DE JESÚS MARTÍNEZ
  // LÓPEZ" y "JESÚS MARTÍNEZ LÓPEZ" —las tres cuadran con la CURP, porque
  // quitar nombres de pila del principio no cambia ninguna de las cuatro
  // letras— y el empate obligaba a no proponer nada. Un tramo completo no tiene
  // ese problema: las palabras impresas están todas, y lo único que se decide
  // es dónde parten.
  const tramos: string[][] = [];
  let actual: string[] = [];
  for (const t of region) {
    if (ES_PALABRA_DE_NOMBRE.test(t) && !PALABRAS_DEL_DOCUMENTO.has(t)) actual.push(t);
    else { if (actual.length >= 2) tramos.push(actual); actual = []; }
  }
  if (actual.length >= 2) tramos.push(actual);

  for (const tramo of tramos) {
    // Más de nueve palabras seguidas no es un nombre, es un renglón de prosa.
    // ("María de los Ángeles de la Cruz García" son ocho.)
    if (tramo.length > 9) continue;
    // Orden natural del documento: nombre(s), paterno, materno.
    for (let nNom = 1; nNom < tramo.length; nNom++) {
      for (let nPat = 1; nNom + nPat <= tramo.length; nPat++) {
        registrar({
          nombres: tramo.slice(0, nNom).join(' '),
          apellidoPaterno: tramo.slice(nNom, nNom + nPat).join(' '),
          apellidoMaterno: tramo.slice(nNom + nPat).join(' '),
        });
      }
    }
  }

  const unicos = [...candidatos.values()];
  if (unicos.length === 1) return unicos[0];
  if (unicos.length === 0) return null;

  // Empate: desempata la vocal interna del paterno. Si sigue habiendo más de
  // uno, no se propone — adivinar aquí es escribir el apellido de otro.
  const conVocal = unicos.filter(
    (n) => inicialesParaCurp(n.nombres, n.apellidoPaterno, n.apellidoMaterno).vocalPaterno === objetivo.vocal,
  );
  return conVocal.length === 1 ? conVocal[0] : null;
}

// ─── 2. INE: la zona de lectura mecánica ──────────────────────────────────

/**
 * Los tres renglones del reverso del INE, en formato TD1 (norma ICAO 9303) —
 * el mismo de los pasaportes.
 *
 * Cada campo trae un dígito de control calculado con pesos 7-3-1. Ese dígito
 * es lo que convierte un reconocimiento de caracteres —que puede equivocarse—
 * en un dato confiable: si no cuadra, la lectura estuvo mal y se descarta.
 */
function digitoControlIcao(cadena: string): number {
  const pesos = [7, 3, 1];
  let suma = 0;
  for (let i = 0; i < cadena.length; i++) {
    const c = cadena[i];
    const valor = c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55; // A=10
    suma += valor * pesos[i % 3];
  }
  return suma % 10;
}

export function leerMrz(textoCrudo: string): Lectura {
  // Los renglones de la MRZ son los únicos de 30 caracteres del alfabeto
  // A-Z0-9<. El resto de lo que el reconocedor haya visto en la credencial se
  // descarta por no tener esa forma.
  const renglones = textoCrudo
    .toUpperCase()
    .split('\n')
    .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 28 && l.length <= 32);

  if (renglones.length < 2) {
    return SIN_LECTURA('No se distinguió la banda de datos del reverso. Toma la foto derecha, con buena luz y que se vean completos los tres renglones de abajo.');
  }

  // El renglón 2 es el que trae fecha de nacimiento y sexo, y el que se puede
  // verificar. Se localiza por su forma —6 dígitos, control, H/M/X— en vez de
  // suponer que es el segundo: una foto ladeada altera el orden.
  const l2 = renglones.find((l) => /^\d{6}\d[HMX<]/.test(l));
  if (!l2) {
    return SIN_LECTURA('La banda de datos se leyó incompleta. Vuelve a intentarlo con la credencial plana y sin reflejos.');
  }

  const fechaCruda = l2.slice(0, 6);
  const control = Number(l2[6]);
  if (digitoControlIcao(fechaCruda) !== control) {
    // El caso que justifica todo el diseño: se leyó algo, pero no cuadra.
    return SIN_LECTURA('La fecha no se leyó con certeza, así que no se rellenó nada. Puedes capturarla a mano.');
  }

  // Año de dos dígitos: la credencial no dice el siglo. Una fecha de
  // nacimiento futura es imposible, así que si cae adelante de hoy pertenece
  // al siglo pasado.
  const yy = Number(fechaCruda.slice(0, 2));
  const anioActual = new Date().getFullYear() % 100;
  const siglo = yy > anioActual ? 1900 : 2000;
  const fechaNacimiento = `${siglo + yy}-${fechaCruda.slice(2, 4)}-${fechaCruda.slice(4, 6)}`;

  const marcaSexo = l2[7];
  const sexo = marcaSexo === 'M' ? 'mujer' : marcaSexo === 'H' ? 'hombre' : undefined;

  // La CURP a veces viene en el primer renglón. Sólo se toma si pasa su propio
  // dígito de control — la misma regla de siempre.
  const curp = curpDeTexto(renglones.join(' ').replace(/</g, ''));

  const campos: CamposLeidos = { fechaNacimiento, ...(sexo ? { sexo } : {}) };
  if (curp) {
    campos.curp = curp;
    campos.entidadNacimiento = ENTIDADES_CURP[curp.slice(11, 13)];
  }
  return { ok: true, fuente: 'ine_mrz', campos };
}

/** Reconocimiento de caracteres, dentro del contenedor. */
async function textoDeImagen(archivo: Buffer): Promise<string | null> {
  return new Promise((resolve) => {
    // `--psm 6`: un bloque de texto uniforme, que es exactamente la banda MRZ.
    // La lista de caracteres se restringe al alfabeto de la norma: eso solo
    // elimina la mayoría de las confusiones (O/0, I/1) sin ningún modelo.
    const p = spawn('tesseract', ['stdin', 'stdout', '--psm', '6',
      '-c', 'tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let salida = '';
    let fallo = false;
    p.stdout.on('data', (d) => { salida += d.toString(); });
    p.on('error', () => { fallo = true; resolve(null); });
    // Tope de tiempo: una imagen enorme no puede dejar ocupado el servidor.
    const alarma = setTimeout(() => { p.kill('SIGKILL'); resolve(null); }, 15_000);
    p.on('close', () => { clearTimeout(alarma); if (!fallo) resolve(salida || null); });
    p.stdin.on('error', () => { /* el proceso murió antes de recibir; ya se resolvió */ });
    p.stdin.end(archivo);
  });
}

// ─── La puerta de entrada ─────────────────────────────────────────────────

/**
 * Lee un documento y propone lo que encontró.
 *
 * NUNCA lanza: un fallo al leer se contesta con `ok: false` y un aviso en
 * español. Esto es una comodidad, y una comodidad que rompe el trámite deja de
 * serlo — si no se puede leer, la persona teclea como siempre.
 */
export async function leerDocumento(archivo: Buffer, mime: string): Promise<Lectura> {
  try {
    if (mime === 'application/pdf') {
      const texto = await textoDePdf(archivo);
      if (!texto.trim()) {
        return SIN_LECTURA('Este PDF es una imagen escaneada, así que no trae texto que leer. Puedes capturar los datos a mano.');
      }
      const curp = curpDeTexto(texto);
      if (!curp) {
        return SIN_LECTURA('No se encontró una CURP válida en el documento. Revisa que sea el archivo correcto.');
      }
      return {
        ok: true,
        fuente: tipoDeDocumento(texto),
        campos: {
          curp,
          fechaNacimiento: fechaNacimientoDeCurp(curp),
          sexo: sexoDeCurp(curp),
          entidadNacimiento: ENTIDADES_CURP[curp.slice(11, 13)],
          // Puede venir vacío: si el nombre no se pudo partir con certeza, esos
          // tres campos se quedan como estaban y la persona los teclea. El aviso
          // de la pantalla nombra sólo lo que de verdad se llenó.
          ...(partirNombreConCurp(texto, curp) ?? {}),
        },
      };
    }

    if (mime.startsWith('image/')) {
      const texto = await textoDeImagen(archivo);
      if (texto === null) {
        return SIN_LECTURA('La lectura automática no está disponible en este momento. Captura los datos a mano.');
      }
      return leerMrz(texto);
    }

    return SIN_LECTURA('Ese tipo de archivo no se puede leer. Sube el PDF o una foto.');
  } catch {
    // A propósito sin detalle: el mensaje lo lee un alumno, no un programador.
    return SIN_LECTURA('No se pudo leer el documento. Captura los datos a mano.');
  }
}
