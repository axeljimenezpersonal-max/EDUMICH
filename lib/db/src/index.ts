import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Pool endurecido para Neon (y cualquier Postgres serverless/gestionado).
//
// Neon cierra del lado del SERVIDOR las conexiones que quedan ociosas unos
// minutos. Con la configuración por defecto de node-postgres ese cliente ya
// muerto se queda dentro del pool, y la SIGUIENTE petición que lo toma falla con
// un error de conexión ("Connection terminated unexpectedly" / ECONNRESET) →
// un 500 intermitente que "un día falla y otro no" (justo el del login).
//
// Se corrige cerrando NOSOTROS el cliente ocioso antes que Neon (idleTimeout por
// debajo de su corte), con keepAlive para que intermediarios no maten la
// conexión en silencio, y con un tope de espera para no colgar la petición.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});

// SIN este manejador, un error en un cliente OCIOSO del pool se emite como un
// evento 'error' que nadie escucha: node lo trata como excepción no capturada y
// puede tumbar el proceso entero. Aquí solo se registra; node-postgres ya
// descarta automáticamente del pool al cliente dañado.
pool.on("error", (err) => {
  console.error("[db] error en cliente ocioso del pool (descartado):", err);
});

/**
 * ¿El error viene de la CONEXIÓN (no de la lógica de la consulta)?
 *
 * Son los cortes de conexión típicos de Neon/Postgres gestionado: el servidor
 * cierra una conexión ociosa y el cliente que quedó en el pool se entera al
 * usarlo. Estos SÍ se pueden reintentar; un error de SQL o de datos NO.
 *
 * Exportado para que la capa HTTP también lo reconozca y no muestre un 500 seco.
 */
export function esErrorDeConexion(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code ?? "";
  return (
    /terminated|ECONNRESET|ETIMEDOUT|EPIPE|connection.*(closed|reset|timeout)|server closed the connection|timeout expired/i.test(
      msg,
    ) ||
    // 57P01 admin shutdown · 08006 connection failure · 08003 connection does not exist
    ["ECONNRESET", "ETIMEDOUT", "EPIPE", "57P01", "08006", "08003"].includes(
      code,
    )
  );
}

// ── Reintento GLOBAL ante cortes de conexión ────────────────────────────────
//
// Toda consulta de la app (Drizzle y SQL directo) pasa por `pool.query`. Aquí lo
// envolvemos para que, si falla por un corte de conexión, se reintente UNA vez:
// el pool ya descartó al cliente muerto, así que el segundo intento toma uno
// sano. Con esto la resiliencia no depende de que cada ruta se acuerde de
// reintentar — queda cubierta TODA la aplicación en un solo lugar.
//
// Solo se reintentan errores de CONEXIÓN (no de SQL/datos), y el caso típico
// —cliente ocioso que Neon ya cerró— falla ANTES de ejecutar la consulta, de
// modo que reintentar no la duplica.
const queryOriginal = pool.query.bind(pool) as (
  ...args: unknown[]
) => unknown;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pool as any).query = function (...args: unknown[]): unknown {
  // Forma con callback (último argumento función): node-postgres la maneja por
  // su cuenta; no la usamos para reintentar. Drizzle siempre usa la forma de
  // promesa.
  if (typeof args[args.length - 1] === "function") {
    return queryOriginal(...args);
  }
  const resultado = queryOriginal(...args) as Promise<unknown>;
  return Promise.resolve(resultado).catch((e: unknown) => {
    if (esErrorDeConexion(e)) {
      console.warn("[db] reintentando consulta tras corte de conexión");
      return queryOriginal(...args) as Promise<unknown>;
    }
    throw e;
  });
};

export const db = drizzle(pool, { schema });

export * from "./schema";
