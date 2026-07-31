/**
 * Nombre de los archivos del expediente que se descargan.
 *
 * Se arma igual para administración y para gestores, desde aquí, porque un
 * archivo que se llama distinto según quién lo bajó deja de servir como
 * referencia cuando dos personas hablan del mismo documento.
 *
 * Forma:  <Tipo>_<APELLIDOS-INICIALES>_<matrícula · folio · id>.<ext>
 *
 *     CURP_RAMIREZ-TORRES-AS_20261601000123.pdf
 *     Acta-de-nacimiento_HERNANDEZ-LOPEZ-MJ_9.pdf
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
 * - **El identificador al final**, porque es lo que se busca y se pega, y
 *   porque deja los documentos de una misma persona juntos al ordenar por
 *   nombre.
 */

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
 * `identificador` es la matrícula oficial si ya la tiene; si no, el folio de
 * pre-registro; y como último recurso el id interno. Se prefiere la matrícula
 * porque es la que aparece en los oficios: quien recibe el archivo la reconoce.
 */
export function nombreArchivoExpediente(
  tipo: string,
  persona: DatosNombreArchivo,
  identificador: string,
  ext: string,
): string {
  const etiqueta = etiquetaPersona(persona);
  const partes = [TIPO_ARCHIVO[tipo] ?? tipo, etiqueta, identificador].filter(Boolean);
  return `${partes.join('_')}.${ext}`.replace(/[^a-zA-Z0-9_\-.]/g, '');
}
