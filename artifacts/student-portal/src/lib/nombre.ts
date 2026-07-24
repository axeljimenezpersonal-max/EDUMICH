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
