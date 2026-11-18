import { endpoint, json } from "../server/http.js"
import { actorOf } from "../server/access.js"
import { db } from "../server/db.js"
import { sql } from "drizzle-orm"

export default endpoint(async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." })
  if (!process.env.DATABASE_URL || !process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID) return json(res, 200, { configured: false, user: null })
  const actor = await actorOf(req)
  const totals = actor
    ? (await db().execute(sql`select coalesce(sum(cost),0)::float8 as cost, count(*)::int as calls from spaceship_calls where email=${actor.email}`)).rows[0]
    : null
  json(res, 200, { configured: true, user: actor ? { email: actor.email, role: actor.role } : null, usage: totals })
})
