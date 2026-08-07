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
import { validarCurp, fechaNacimientoDeCurp, sexoDeCurp, ENTIDADES_CURP } from '../utils/curp';

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
 * El nombre, tal como lo escribe la constancia de RENAPO.
 *
 * El documento rotula sus campos ("NOMBRE(S)", "PRIMER APELLIDO"...), así que
 * se buscan esas etiquetas en vez de adivinar por posición: una constancia con
 * otra maquetación seguiría funcionando mientras conserve sus rótulos.
 */
function nombreDeConstancia(texto: string): Pick<CamposLeidos, 'nombres' | 'apellidoPaterno' | 'apellidoMaterno'> {
  const campo = (etiquetas: string[]): string | undefined => {
    for (const e of etiquetas) {
      // Hasta el siguiente rótulo conocido o el fin: los valores no traen
      // separador propio.
      const m = new RegExp(`${e}[:\\s]+([A-ZÁÉÍÓÚÑ ]{2,60}?)(?=\\s*(?:PRIMER|SEGUNDO|NOMBRE|FECHA|SEXO|ENTIDAD|CURP|CLAVE|$))`).exec(texto);
      const v = m?.[1]?.trim();
      if (v && v.length >= 2) return v;
    }
    return undefined;
  };
  return {
    apellidoPaterno: campo(['PRIMER APELLIDO', 'APELLIDO PATERNO']),
    apellidoMaterno: campo(['SEGUNDO APELLIDO', 'APELLIDO MATERNO']),
    nombres: campo(['NOMBRE\\(S\\)', 'NOMBRES', 'NOMBRE']),
  };
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
      const esActa = /ACTA DE NACIMIENTO|REGISTRO CIVIL/.test(texto);
      return {
        ok: true,
        fuente: esActa ? 'pdf_acta' : 'pdf_curp',
        campos: {
          curp,
          fechaNacimiento: fechaNacimientoDeCurp(curp),
          sexo: sexoDeCurp(curp),
          entidadNacimiento: ENTIDADES_CURP[curp.slice(11, 13)],
          ...nombreDeConstancia(texto),
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
