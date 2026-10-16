import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __stokioDb?: ReturnType<typeof drizzle>;
};

function getPool(): Pool {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_MISSING");
  }
  globalForDb.__arenaNextJsPostgresqlPool ??= new Pool({ connectionString: databaseUrl });
  return globalForDb.__arenaNextJsPostgresqlPool;
}

/**
 * La connexion est créée à la première requête, pas au chargement du module.
 * Ainsi, une variable DATABASE_URL absente produit un message compréhensible
 * dans l'interface au lieu d'une erreur interne sur tout le site.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, property) {
    globalForDb.__stokioDb ??= drizzle(getPool());
    const instance = globalForDb.__stokioDb as unknown as Record<string | symbol, unknown>;
    const value = instance[property];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});

export const pool = { get current() { return getPool(); } };
