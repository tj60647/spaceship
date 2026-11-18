import test from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { sql } from "drizzle-orm"
import { actorOf, hash, requireOwner, rateLimit } from "../server/access.js"
import { reserve, settle } from "../server/usage.js"
import { sameOrigin } from "../server/http.js"

test("access and allowance enforcement", async () => {
  const client = new PGlite(),
    database = drizzle(client)
  try {
    await migrate(database, { migrationsFolder: "drizzle" })
    await database.execute(sql`insert into spaceship_members(email,role) values('owner@example.com','owner'),('student@example.com','participant')`)
    await database.execute(sql`insert into spaceship_settings(id,budget) values(1,0)`)
    await database.execute(
      sql`insert into spaceship_sessions(hash,email,expires_at) values(${hash("test-token")},'student@example.com',now()+interval '1 hour')`,
    )
    assert.equal(await actorOf({ headers: {} }, database), null)
    const req = { headers: { cookie: "spaceship_session=test-token" } }
    const student = await actorOf(req, database)
    assert.equal(student.email, "student@example.com")
    assert.throws(() => requireOwner(student), /Owner access/)
    await assert.rejects(reserve(student.email, "test", "decide", 0.01, database), /spending limit/)
    await database.execute(sql`update spaceship_settings set budget=.03`)
    const id = await reserve(student.email, "test", "decide", 0.02, database)
    await assert.rejects(reserve(student.email, "test", "decide", 0.02, database), /spending limit/)
    await settle(id, { cost: 0.005, total_tokens: 50 }, 100, "complete", database)
    await settle(id, { cost: 0 }, 100, "complete", database)
    assert.equal((await database.execute(sql`select cost from spaceship_calls where id=${id}`)).rows[0].cost, 0.005)
    const unknown = await reserve(student.email, "test", "decide", 0.02, database)
    await settle(unknown, undefined, 100, "failed", database)
    assert.equal((await database.execute(sql`select cost from spaceship_calls where id=${unknown}`)).rows[0].cost, 0.02)
    await database.execute(sql`update spaceship_members set active=false where email=${student.email}`)
    assert.equal(await actorOf(req, database), null)
    await rateLimit("test", 1, 600, database)
    await assert.rejects(rateLimit("test", 1, 600, database), /Too many/)
  } finally {
    await client.close()
  }
})
test("mutations reject cross-site and non-JSON requests", () => {
  process.env.APP_ORIGIN = "https://spaceship.example.com"
  assert.throws(() => sameOrigin({ headers: { origin: "https://attacker.example", "content-type": "application/json" } }), /directly/)
  assert.throws(() => sameOrigin({ headers: { origin: process.env.APP_ORIGIN, "content-type": "text/plain" } }), /JSON/)
  sameOrigin({ headers: { origin: process.env.APP_ORIGIN, "content-type": "application/json" } })
})
