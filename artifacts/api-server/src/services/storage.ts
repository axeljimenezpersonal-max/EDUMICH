/**
 * Adaptador de almacenamiento de archivos (local ↔ AWS S3).
 *
 * ── Activación de S3 ─────────────────────────────────────────────────────────
 *  Variables en Railway (las estándar del SDK de AWS + bucket):
 *    STORAGE_DRIVER=s3
 *    S3_BUCKET=edumich-storage
 *    AWS_REGION=us-east-1            (o S3_REGION)
 *    AWS_ACCESS_KEY_ID=...
 *    AWS_SECRET_ACCESS_KEY=...
 *
 * ── Convención de referencias (`ref`) ────────────────────────────────────────
 *  - Local: ruta absoluta en disco (comportamiento histórico; filas viejas de la
 *    BD guardan esto en `ruta_archivo`).
 *  - S3:    `s3:<key>` (p. ej. `s3:expediente/1783..._foto.jpeg`).
 *  Los helpers `archivoStream` / `archivoExiste` / `archivoEliminar` resuelven
 *  por prefijo, de modo que una BD con refs mixtos (viejos locales + nuevos S3)
 *  sigue sirviendo todo sin migración big-bang.
 */
import { createReadStream, existsSync } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageDriver {
  /** Guarda datos bajo una `key` lógica y devuelve la `ref` para leerla luego. */
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

// ── Driver S3 ────────────────────────────────────────────────────────────────
const S3_PREFIX = 's3:';
export const refEsS3 = (ref: string): boolean => ref.startsWith(S3_PREFIX);
const s3Key = (ref: string): string => (refEsS3(ref) ? ref.slice(S3_PREFIX.length) : ref);

let s3Singleton: { client: S3Client; bucket: string } | null = null;

function s3(): { client: S3Client; bucket: string } {
  if (s3Singleton) return s3Singleton;
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET no está configurado (requerido para STORAGE_DRIVER=s3 o refs "s3:").');
  const region = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
  // Credenciales: cadena estándar del SDK (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, perfil, rol IAM…)
  s3Singleton = { client: new S3Client({ region }), bucket };
  return s3Singleton;
}

function crearDriverS3(): StorageDriver {
  return {
    async put(key, data, contentType) {
      const { client, bucket } = s3();
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
      return { ref: `${S3_PREFIX}${key}` };
    },
    getStream(ref) {
      // GetObject es async pero la interfaz devuelve Readable síncrono:
      // se entrega un PassThrough que se conecta (o destruye) al resolver.
      const { client, bucket } = s3();
      const pass = new PassThrough();
      client
        .send(new GetObjectCommand({ Bucket: bucket, Key: s3Key(ref) }))
        .then((r) => (r.Body as Readable).pipe(pass))
        .catch((err) => pass.destroy(err instanceof Error ? err : new Error(String(err))));
      return pass;
    },
    async exists(ref) {
      const { client, bucket } = s3();
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: s3Key(ref) }));
        return true;
      } catch {
        return false;
      }
    },
    async remove(ref) {
      const { client, bucket } = s3();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: s3Key(ref) })).catch(() => {});
    },
  };
}

// ── Driver activo (para NUEVAS subidas) ──────────────────────────────────────
export const storage: StorageDriver =
  process.env.STORAGE_DRIVER === 's3' ? crearDriverS3() : crearDriverLocal();

export const STORAGE_ES_EFIMERO = process.env.STORAGE_DRIVER !== 's3' && !process.env.RAILWAY_VOLUME_MOUNT_PATH;

// ── Helpers por-ref: sirven refs mixtos sin importar el driver activo ────────
const s3Driver = crearDriverS3();
const localDriver = crearDriverLocal();
const driverDe = (ref: string): StorageDriver => (refEsS3(ref) ? s3Driver : localDriver);

/** Stream de lectura para cualquier ref (local o s3:). */
export function archivoStream(ref: string): Readable {
  return driverDe(ref).getStream(ref);
}

/** ¿Existe el archivo? (local o s3:) */
export function archivoExiste(ref: string): Promise<boolean> {
  return driverDe(ref).exists(ref);
}

/** Borra el archivo de cualquier ref (idempotente). */
export function archivoEliminar(ref: string): Promise<void> {
  return driverDe(ref).remove(ref);
}

/**
 * URL firmada temporal para descargas directas desde S3 (libros pesados, etc.).
 * Solo aplica a refs `s3:`; para refs locales devuelve null (servir por stream).
 */
export async function urlFirmada(ref: string, segundos = 3600): Promise<string | null> {
  if (!refEsS3(ref)) return null;
  const { client, bucket } = s3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: s3Key(ref) }), { expiresIn: segundos });
}
