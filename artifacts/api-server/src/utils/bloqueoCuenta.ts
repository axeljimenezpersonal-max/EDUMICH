/**
 * Bloqueo de acceso POR CUENTA, además del límite por IP.
 *
 * El límite por IP no protege de lo que importa: un atacante con varias
 * direcciones puede insistir sobre el MISMO correo sin activarlo nunca. Y la
 * contraseña temporal del alumno es corta, así que la cuenta es el objetivo
 * natural.
 *
 * ⚠️ LIMITACIÓN CONOCIDA: el contador vive en la memoria del proceso. Con varias
 * instancias en AWS el umbral efectivo se multiplica por el número de
 * instancias y se reinicia en cada despliegue. Antes de escalar debe moverse a
 * un almacén compartido (ElastiCache); está anotado en
 * `docs/seguridad/03-identidad-y-acceso.md` §3.2. Hoy, con una sola instancia,
 * es una mejora real frente a no tener nada.
 *
 * Vive aparte de `routes/auth.ts` para poder probarlo: un error aquí no deja
 * pasar a un atacante, deja fuera a TODOS los usuarios legítimos.
 */

export const MAX_FALLOS = 10;
export const BLOQUEO_MS = 15 * 60 * 1000;

interface Registro { n: number; hasta: number }

const fallos = new Map<number, Registro>();

/**
 * Minutos que le quedan de bloqueo a la cuenta, o 0 si puede intentar.
 *
 * Bloquea SÓLO al alcanzar el umbral. `hasta` delimita la ventana en la que se
 * cuentan los fallos, no es un bloqueo por sí mismo: sin comprobar `n`, un
 * único dedazo dejaría al usuario fuera quince minutos.
 */
export function bloqueoDeCuenta(userId: number, ahora = Date.now()): number {
  const f = fallos.get(userId);
  if (!f || f.hasta <= ahora || f.n < MAX_FALLOS) return 0;
  return Math.max(1, Math.ceil((f.hasta - ahora) / 60000));
}

/**
 * Cuenta un intento fallido.
 *
 * Los fallos se acumulan mientras la ventana siga viva; si venció, se empieza
 * de cero. Cada fallo nuevo reabre la ventana, así que insistir sin pausa
 * mantiene el bloqueo en pie.
 */
export function registrarFalloDeCuenta(userId: number, ahora = Date.now()): void {
  const f = fallos.get(userId);
  const n = (f && f.hasta > ahora ? f.n : 0) + 1;
  fallos.set(userId, { n, hasta: ahora + BLOQUEO_MS });

  // Poda: al pasar de mil entradas se tiran las vencidas, que serán la mayoría.
  // Evita que un barrido sobre muchas cuentas haga crecer la memoria sin freno.
  if (fallos.size > 1000) {
    for (const [k, v] of fallos) if (v.hasta <= ahora) fallos.delete(k);
  }
}

/** Se llama tras un acceso correcto: el contador se olvida. */
export function limpiarFallosDeCuenta(userId: number): void {
  fallos.delete(userId);
}

/** Sólo para pruebas. */
export function _reiniciar(): void {
  fallos.clear();
}
