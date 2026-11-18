import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { sql } from "drizzle-orm"
const url = process.env.DATABASE_URL_UNPOOLED
if (!url) throw new Error("Set DATABASE_URL_UNPOOLED for this app's isolated database.")
const email = process.env.OWNER_EMAIL?.trim().toLowerCase()
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Set OWNER_EMAIL before setup.")
const pool = new Pool({ connectionString: url, max: 1 })
try {
  const database = drizzle(pool)
  await migrate(database, { migrationsFolder: "drizzle" })
  await database.execute(sql`insert into spaceship_settings(id,budget) values(1,0) on conflict do nothing`)
  await database.execute(sql`insert into spaceship_members(email,role) values(${email},'owner') on conflict do nothing`)
  console.log("Schema ready. Initial owner invited. Budget starts at $0; configure it in /admin/.")
} finally {
  await pool.end()
}
