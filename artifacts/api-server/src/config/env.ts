/**
 * Configuración central de secretos y entorno.
 *
 * Política de seguridad (venta a gobierno):
 *  - En PRODUCCIÓN, los secretos son OBLIGATORIOS: si faltan, el servidor NO arranca
 *    (fail-closed). Esto evita el riesgo de firmar sesiones/QR con un valor por defecto
 *    conocido y públicamente legible en el repositorio.
 *  - En DESARROLLO se permite un fallback, pero con una ADVERTENCIA ruidosa, para no
 *    frenar el trabajo local.
 *
 * Genera valores seguros con:  openssl rand -hex 32
 *
 * Variables requeridas en producción (configúralas en Railway):
 *   SESSION_SECRET   — firma de la cookie de sesión (HMAC)
 *   QR_SECRET        — firma de los pases de examen por QR (HMAC)
 */

const isProd = process.env.NODE_ENV === 'production';

/**
 * Devuelve el valor de una env var obligatoria.
 * En producción aborta el arranque si falta; en dev usa un fallback ruidoso.
 */
function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim() !== '') return value;

  if (isProd) {
    throw new Error(
      `[config] Falta la variable de entorno obligatoria "${name}" en producción. ` +
        `Configúrala antes de iniciar el servidor (genera una con: openssl rand -hex 32). Abortando.`,
    );
  }

  console.warn(
    `[config] ⚠️  "${name}" no definida — usando un fallback SOLO de desarrollo. ` +
      `NUNCA debe usarse en producción.`,
  );
  return devFallback;
}

/** Secreto HMAC de la cookie de sesión (pa_session). */
export const SESSION_SECRET = requiredSecret(
  'SESSION_SECRET',
  'dev-only-session-secret-NOT-for-production',
);

/** Secreto HMAC de los pases de examen por QR. */
export const QR_SECRET = requiredSecret(
  'QR_SECRET',
  'dev-only-qr-secret-NOT-for-production',
);
