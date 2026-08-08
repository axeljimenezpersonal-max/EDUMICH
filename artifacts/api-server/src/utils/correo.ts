/**
 * Utilidades de direcciones de correo.
 */

/**
 * El dominio de las direcciones que Módula emite y que NO tienen buzón detrás.
 *
 * Son de dos clases y las dos se comportan igual —nada de lo que se les mande
 * llega a ninguna parte— así que se reconocen con la misma regla:
 *
 *   · `utec@modula22.mx`  — identifica a un centro dentro de la plataforma.
 *   · `AOTA060308…@sin-correo.modula22.mx` — la que se le pone a un alumno que
 *     no tiene correo. Existe sólo porque una cuenta necesita un identificador
 *     único para iniciar sesión, no porque se pretenda escribirle ahí.
 */
const DOMINIO_SIN_BUZON = /@(?:[a-z0-9-]+\.)?modula22\.mx$/i;

/** ¿Es una dirección emitida por Módula, sin buzón detrás? */
export function esCorreoSinBuzon(email: string | null | undefined): boolean {
  return !!email && DOMINIO_SIN_BUZON.test(email.trim());
}

/**
 * La dirección interna de un alumno que no dio correo.
 *
 * Se deriva de la CURP porque es lo único único que ese alumno ya tiene, y en
 * ASCII —la CURP lo es por construcción— para que sea una dirección válida.
 * Cuando la persona consiga un correo, el centro lo captura y esta desaparece.
 */
export function correoSinBuzonPara(curp: string): string {
  return `${curp.trim().toLowerCase()}@sin-correo.modula22.mx`;
}

/**
 * Enmascara una dirección para poder decir A DÓNDE se envió algo sin revelarla.
 *
 * Hace falta porque una cuenta de Módula tiene DOS direcciones: la de acceso
 * (a veces institucional, `utec@modula22.mx`, sin buzón detrás) y la de
 * contacto, que es donde de verdad llegan los mensajes. Decir "revisa tu
 * correo" no sirve cuando quien lo lee no sabe cuál de las dos se usó.
 *
 * Se conserva el dominio completo y la primera letra del buzón: es suficiente
 * para que la persona reconozca su propia dirección ("ah, la de gmail") y no
 * para que un tercero la deduzca desde la pantalla de recuperación.
 *
 *     axel.jimenez@gmail.com  →  a•••••••••••@gmail.com
 *     ab@hotmail.com          →  a•@hotmail.com
 *     a@hotmail.com           →  •@hotmail.com
 */
export function enmascararCorreo(direccion: string): string {
  const correo = direccion.trim();
  const arroba = correo.lastIndexOf('@');
  // Sin arroba no es una dirección: no se adivina nada, se tapa entera.
  if (arroba <= 0) return '•'.repeat(Math.max(correo.length, 3));

  const buzon = correo.slice(0, arroba);
  const dominio = correo.slice(arroba);

  // Con una sola letra, mostrarla sería mostrar el buzón completo.
  if (buzon.length === 1) return `•${dominio}`;
  return `${buzon[0]}${'•'.repeat(buzon.length - 1)}${dominio}`;
}
