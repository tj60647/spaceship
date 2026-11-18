import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { attachDatabasePool } from "@vercel/functions"

let database
export function db() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error("Live access is not configured yet."), { status: 503 })
  if (!database) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 8000, idleTimeoutMillis: 5000 })
    if (process.env.VERCEL) attachDatabasePool(pool)
    database = drizzle(pool)
  }
  return database
}
