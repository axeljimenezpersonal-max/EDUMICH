/**
 * Utilidades de direcciones de correo.
 */

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
