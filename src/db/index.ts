import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// fully lazy singleton — no import-time side effects
// defer creation to runtime so Turbopack doesn't try to resolve and bundle it eagerly, avoiding TDZ
let _db: NodePgDatabase<typeof schema> | null = null;

export function db(): NodePgDatabase<typeof schema> {
  if (!_db) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    _db = drizzle(pool, { schema });
  }
  return _db;
}
