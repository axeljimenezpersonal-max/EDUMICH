/**
 * Adaptador de almacenamiento de archivos.
 *
 * Hoy el almacenamiento es LOCAL (disco del contenedor) y en Railway es EFÍMERO:
 * se borra en cada redeploy. Este adaptador es la base para migrar a un
 * almacenamiento persistente (AWS S3) cambiando solo la configuración, sin tocar
 * la lógica de cada endpoint.
 *
 * ── Cómo migrar a S3 (cuando haya credenciales) ────────────────────────────
 *  1. `pnpm --filter '@workspace/api-server' add @aws-sdk/client-s3`
 *  2. Env en Railway:
 *       STORAGE_DRIVER=s3
 *       S3_BUCKET=...
 *       S3_REGION=...
 *       S3_ACCESS_KEY_ID=...
 *       S3_SECRET_ACCESS_KEY=...
 *  3. Implementar `crearDriverS3()` abajo (put/getStream/exists/remove con el SDK).
 *  4. Migrar cada endpoint de subida para que use `storage.put(...)` en vez de
 *     escribir a disco, y `storage.getStream(...)` / `storage.exists(...)` para
 *     servir. La `key` es una ruta lógica estable (p. ej. `pagos-examen/<archivo>`).
 *
 * Mientras `STORAGE_DRIVER` no sea 's3', se usa el driver local (comportamiento
 * actual) y todo sigue funcionando igual.
 */
import { createReadStream, existsSync } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

export interface StorageDriver {
  /** Guarda datos bajo una `key` lógica y devuelve un identificador para leerla luego. */
  put(key: string, data: Buffer, contentType?: string): Promise<{ ref: string }>;
  /** Abre un stream de lectura para servir el archivo. */
  getStream(ref: string): Readable;
  /** ¿Existe el archivo? */
  exists(ref: string): Promise<boolean>;
  /** Borra el archivo (idempotente). */
  remove(ref: string): Promise<void>;
}

// ── Driver LOCAL (disco) ─────────────────────────────────────────────────────
const BASE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');

function crearDriverLocal(): StorageDriver {
  return {
    async put(key, data) {
      const full = path.join(BASE_DIR, key);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, data);
      return { ref: full };
    },
    getStream(ref) {
      return createReadStream(ref);
    },
    async exists(ref) {
      return existsSync(ref);
    },
    async remove(ref) {
      await fsp.rm(ref, { force: true }).catch(() => {});
    },
  };
}

// ── Driver S3 (pendiente de credenciales) ───────────────────────────────────
function crearDriverS3(): StorageDriver {
  // Implementar con @aws-sdk/client-s3 cuando existan credenciales (ver cabecera).
  throw new Error('STORAGE_DRIVER=s3 pero el driver S3 aún no está implementado. Ver services/storage.ts.');
}

export const storage: StorageDriver =
  process.env.STORAGE_DRIVER === 's3' ? crearDriverS3() : crearDriverLocal();

export const STORAGE_ES_EFIMERO = process.env.STORAGE_DRIVER !== 's3';
