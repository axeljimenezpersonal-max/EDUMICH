/**
 * Presentación de nombres de personas.
 *
 * El padrón del Estado y muchos registros llegan en MAYÚSCULAS
 * ("FARIAS CHAVEZ CAMILA GUADALUPE"). Para la interfaz eso se siente a
 * formulario y "grita"; se lee mejor con capitalización propia
 * ("Farias Chavez Camila Guadalupe").
 *
 * IMPORTANTE — esto es SOLO para mostrar en pantalla. Los documentos oficiales
 * (credencial, cédula, matrícula, certificados, PDF) deben conservar el nombre
 * tal cual lo tiene el Estado: no pasar por aquí lo que va a esos artefactos.
 *
 * Notas:
 * - Conectores de apellidos españoles (de, del, la, las, los, y, e) quedan en
 *   minúscula, salvo al inicio del nombre.
 * - No se recuperan acentos: si el origen guardó "FARIAS" sin acento, aquí sale
 *   "Farias". No lo empeora, solo no lo inventa.
 * - Respeta guiones y apóstrofos ("Pérez-Gómez", "D'Anna").
 */

const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e']);

/** Capitaliza una palabra suelta respetando guiones y apóstrofos internos. */
function capitalizarPalabra(palabra: string): string {
  return palabra
    .split(/([-'’])/) // conserva los separadores
    .map((parte) =>
      /[-'’]/.test(parte)
        ? parte
        : parte
          ? parte.charAt(0).toLocaleUpperCase('es-MX') + parte.slice(1).toLocaleLowerCase('es-MX')
          : parte,
    )
    .join('');
}

/**
 * La forma en que un nombre se CAPTURA y se guarda: MAYÚSCULAS, con acentos.
 *
 * Es el espejo de `normalizarNombre` del API (`utils/estudianteDatos.ts`), que
 * es quien manda: el servidor normaliza pase lo que pase. Esto existe para que
 * la persona lo VEA mientras teclea, y entienda sin que nadie se lo explique
 * que da igual cómo lo escriba — que es justo la duda que genera capturar al
 * mismo alumno dos veces desde dos lugares distintos.
 *
 * A diferencia del servidor, aquí NO se recortan ni colapsan los espacios: se
 * está escribiendo, y quitarle el espacio que acaba de teclear le impide
 * escribir el segundo apellido.
 *
 * Los acentos se conservan (`toLocaleUpperCase('es-MX')` hace á→Á y ñ→Ñ): la
 * regla de ASCII del proyecto es para archivos y claves, no para el nombre de
 * una persona.
 */
export function enMayusculas(valor: string): string {
  return valor.toLocaleUpperCase('es-MX');
}

/**
 * Formatea un nombre para mostrarlo. Devuelve cadena vacía si la entrada es
 * vacía/nula. Colapsa espacios de más.
 */
export function formatearNombre(valor: string | null | undefined): string {
  if (!valor) return '';
  const palabras = valor.trim().split(/\s+/);
  return palabras
    .map((palabra, i) => {
      const min = palabra.toLocaleLowerCase('es-MX');
      // Los conectores van en minúscula, pero nunca la primera palabra.
      if (i > 0 && CONECTORES.has(min)) return min;
      return capitalizarPalabra(palabra);
    })
    .join(' ');
}
