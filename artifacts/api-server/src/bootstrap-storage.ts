/**
 * Bootstrap de almacenamiento — DEBE importarse ANTES que cualquier módulo de
 * rutas, porque esos módulos leen `process.env.STORAGE_DIR` en tiempo de carga
 * (constantes a nivel de módulo como EXPEDIENTE_DIR, PAGOS_EXAMEN_DIR, …).
 *
 * Problema que resuelve: sin un volumen persistente, los archivos subidos
 * (fotografías del expediente, comprobantes de pago, etc.) caen en
 * `/tmp/prepa-storage`, que en Railway es EFÍMERO y se borra en cada redeploy.
 * El registro en la base (Neon) sobrevive, pero el archivo desaparece, así que
 * la cédula/credencial se generan sin foto.
 *
 * Solución: si hay un volumen de Railway montado (Railway inyecta
 * `RAILWAY_VOLUME_MOUNT_PATH` automáticamente) y no se fijó `STORAGE_DIR` a mano,
 * usamos ese volumen como base de almacenamiento. Con esto basta con ADJUNTAR un
 * volumen en el panel de Railway para que los archivos persistan; no hace falta
 * configurar además la variable STORAGE_DIR.
 */
import path from 'node:path';

if (!process.env.STORAGE_DIR && process.env.RAILWAY_VOLUME_MOUNT_PATH) {
  process.env.STORAGE_DIR = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'prepa-storage');
  // eslint-disable-next-line no-console
  console.log(`[storage] Volumen persistente detectado. STORAGE_DIR=${process.env.STORAGE_DIR}`);
} else if (!process.env.STORAGE_DIR) {
  // eslint-disable-next-line no-console
  console.warn(
    '[storage] ADVERTENCIA: STORAGE_DIR no definido y sin volumen de Railway. ' +
      'Los archivos subidos irán a /tmp y se perderán en cada redeploy. ' +
      'Adjunta un volumen persistente en Railway para conservarlos.',
  );
}
