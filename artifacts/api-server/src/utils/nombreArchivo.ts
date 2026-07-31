/**
 * Nombre de los archivos del expediente que se descargan.
 *
 * Se arma igual para administración y para gestores, desde aquí, porque un
 * archivo que se llama distinto según quién lo bajó deja de servir como
 * referencia cuando dos personas hablan del mismo documento.
 *
 * Forma:  <Tipo>_<APELLIDOS-INICIALES>_<id>.<ext>
 *
 *     CURP_RAMIREZ-TORRES-AS_9.pdf
 *     Acta-de-nacimiento_HERNANDEZ-LOPEZ-MJ_14.pdf
 *
 * Por qué así:
 *
 * - **El nombre va dentro.** Antes decía `CURP_alumno-9`: al adjuntarlo a un
 *   correo no había forma de notar que era el documento equivocado. El apellido
 *   a la vista convierte ese error en algo visible antes de enviarlo, y ese es
 *   el error que de verdad importa —mandarle a alguien el acta de otro—.
 * - **Iniciales para los nombres de pila.** Resuelve el caso de quien tiene dos
 *   (Ana Sofía → AS, José María → JM) sin alargar el archivo ni tener que
 *   decidir cuál de los dos "cuenta".
 * - **El número corto al final**, no la matrícula. La matrícula son 14 dígitos
 *   que harían el archivo largo e incómodo de adjuntar, y es un dato oficial
 *   que no tiene por qué andar repartido en carpetas de Descargas. El número
 *   interno basta para distinguir a dos homónimos, que es lo único que se le
 *   pide.
 */

/**
 * Quita acentos y ñ CONSERVANDO todo lo demás: `Muñoz` → `Munoz`.
 *
 * Va antes de sanear un nombre de archivo. Si se saneara directo, cada acento
 * se volvería un guion bajo (`Muñoz` → `Mu_oz`) y el nombre queda ilegible
 * justo para quien tiene que reconocerlo en una carpeta.
 */
export function aplanarAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N');
}

/** Quita acentos, ñ y cualquier cosa que no sobreviva a un sistema de archivos. */
function aplanar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos
    .replace(/ñ/gi, 'N')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // "DE LA CRUZ" → "DELACRUZ"
}

/** Iniciales de todos los nombres de pila: "Ana Sofía" → "AS". */
function iniciales(nombres: string): string {
  return nombres
    .trim()
    .split(/\s+/)
    .map((p) => aplanar(p).charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, 3); // tres bastan; más solo alarga
}

export interface DatosNombreArchivo {
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  /** Respaldo cuando el expediente aún no tiene los campos desglosados. */
  nombreCompleto?: string | null;
}

/**
 * `RAMIREZ-TORRES-AS`, o cadena vacía si no hay con qué armarlo.
 *
 * Cada apellido se recorta a 14 caracteres: los compuestos muy largos harían
 * un nombre de archivo incómodo de leer, que es justo lo que se quiere evitar.
 */
export function etiquetaPersona(datos: DatosNombreArchivo): string {
  let { nombres, apellidoPaterno, apellidoMaterno } = datos;

  // Expedientes viejos guardaban solo el nombre completo en una sola cadena.
  // Se parte por posición: en México el orden es nombres, paterno, materno.
  if (!apellidoPaterno && datos.nombreCompleto) {
    const partes = datos.nombreCompleto.trim().split(/\s+/);
    if (partes.length >= 3) {
      apellidoMaterno = partes.pop() ?? '';
      apellidoPaterno = partes.pop() ?? '';
      nombres = partes.join(' ');
    } else if (partes.length === 2) {
      apellidoPaterno = partes.pop() ?? '';
      nombres = partes.join(' ');
    } else {
      nombres = datos.nombreCompleto;
    }
  }

  const trozos = [
    aplanar(apellidoPaterno ?? '').slice(0, 14),
    aplanar(apellidoMaterno ?? '').slice(0, 14),
    iniciales(nombres ?? ''),
  ].filter(Boolean);

  return trozos.join('-');
}

const TIPO_ARCHIVO: Record<string, string> = {
  curp: 'CURP',
  acta_nacimiento: 'Acta-de-nacimiento',
  ine: 'Identificacion-oficial',
  comprobante_domicilio: 'Comprobante-de-domicilio',
  certificado_secundaria: 'Certificado-de-secundaria',
  foto: 'Fotografia',
};

/**
 * Nombre completo del archivo, ya seguro para descargar.
 *
 * `alumnoId` es el número interno del alumno. Va solo para desempatar homónimos
 * —dos "GARCIA-LOPEZ-J" en la misma carpeta— y para tener a qué ficha volver.
 */
export function nombreArchivoExpediente(
  tipo: string,
  persona: DatosNombreArchivo,
  alumnoId: number,
  ext: string,
): string {
  const etiqueta = etiquetaPersona(persona);
  const partes = [TIPO_ARCHIVO[tipo] ?? tipo, etiqueta, String(alumnoId)].filter(Boolean);
  return `${partes.join('_')}.${ext}`.replace(/[^a-zA-Z0-9_\-.]/g, '');
}
