import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { endpoint, sameOrigin, bodyOf, json, fail } from "../server/http.js"
import { requireActor, requireOwner, normalizeEmail } from "../server/access.js"
import { db } from "../server/db.js"

export default endpoint(async (req, res) => {
  const actor = await requireActor(req)
  requireOwner(actor)
  if (req.method === "GET") {
    const [roster, settings, usage, activity] = await Promise.all([
      db().execute(
        sql`select m.email,m.role,m.active,m.user_id is not null as joined,coalesce(sum(c.cost),0)::float8 as cost,count(c.id)::int as calls from spaceship_members m left join spaceship_calls c on c.email=m.email group by m.email order by m.created_at`,
      ),
      db().execute(sql`select * from spaceship_settings where id=1`),
      db().execute(
        sql`select coalesce(sum(cost),0)::float8 as cost,count(*)::int as calls,count(*) filter(where status in ('pending','estimated'))::int as estimated from spaceship_calls`,
      ),
      db().execute(sql`select action,detail,created_at from spaceship_audit order by created_at desc limit 30`),
    ])
    return json(res, 200, { roster: roster.rows, settings: settings.rows[0], usage: usage.rows[0], activity: activity.rows })
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  sameOrigin(req)
  const body = await bodyOf(req)
  await db().transaction(async (tx) => {
    await tx.execute(sql`select id from spaceship_settings where id=1 for update`)
    if (body.action === "roster") {
      if (!Array.isArray(body.emails) || body.emails.length > 100) fail(400, "Add at most 100 addresses at a time.")
      for (const raw of body.emails) {
        const email = normalizeEmail(raw)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(400, "The roster contains an invalid email.")
        await tx.execute(sql`insert into spaceship_members(email) values(${email}) on conflict(email) do update set active=true`)
      }
    } else if (body.action === "revoke") {
      const email = normalizeEmail(body.email)
      const target = (await tx.execute(sql`select role from spaceship_members where email=${email}`)).rows[0]
      if (!target || target.role === "owner") fail(400, "The owner cannot be revoked from this panel.")
      await tx.execute(sql`update spaceship_members set active=false where email=${email}`)
      await tx.execute(sql`delete from spaceship_sessions where email=${email}`)
    } else if (body.action === "settings") {
      if (!Number.isFinite(body.budget) || body.budget < 0 || body.budget > 100 || typeof body.paused !== "boolean")
        fail(400, "Set a budget between $0 and $100.")
      await tx.execute(sql`update spaceship_settings set budget=${body.budget},paused=${body.paused} where id=1`)
    } else fail(400, "Unknown action.")
    await tx.execute(
      sql`insert into spaceship_audit(id,actor,action,detail) values(${randomUUID()},${actor.email},${body.action},${JSON.stringify(body)}::jsonb)`,
    )
  })
  json(res, 200, { ok: true })
})
