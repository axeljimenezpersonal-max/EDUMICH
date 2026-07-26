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

export const db = drizzle(pool, { schema });

export * from "./schema";
