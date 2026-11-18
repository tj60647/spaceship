import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "./db.js"
import { fail } from "./http.js"

export async function reserve(email, model, operation, cost, database = db()) {
  return database.transaction(async (tx) => {
    const config = (await tx.execute(sql`select * from spaceship_settings where id=1 for update`)).rows[0]
    if (!config || config.paused) fail(403, "Live calls are paused for everyone. The owner can resume them in Admin.")
    if (!(await tx.execute(sql`select email from spaceship_members where email=${email} and active=true`)).rows.length)
      fail(403, "This invitation is no longer active.")
    const totals = (
      await tx.execute(
        sql`select coalesce(sum(cost),0)::float8 as cost, count(*) filter(where status='pending' and created_at>now()-interval '90 seconds')::int as pending, count(*) filter(where email=${email} and created_at>now()-interval '1 minute')::int as recent, count(*) filter(where email=${email} and status='pending' and created_at>now()-interval '90 seconds')::int as personal from spaceship_calls`,
      )
    ).rows[0]
    if (totals.cost + cost > config.budget)
      fail(
        402,
        "This request would exceed the shared demo spending limit. The owner can raise the total limit in Admin; it applies to everyone, including the owner.",
      )
    if (totals.pending >= 20 || totals.personal >= 4 || totals.recent >= 90) fail(429, "Model requests are busy. Wait a moment and retry.")
    const id = randomUUID()
    await tx.execute(sql`insert into spaceship_calls(id,email,model,operation,cost) values(${id},${email},${model},${operation},${cost})`)
    return id
  })
}
export async function settle(id, usage, latency, status, database = db()) {
  const cost = typeof usage?.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : null
  const tokens = usage?.total_tokens ?? (usage?.input_tokens || usage?.prompt_tokens || 0) + (usage?.output_tokens || usage?.completion_tokens || 0)
  await database.execute(
    sql`update spaceship_calls set cost=coalesce(${cost},cost), tokens=${Number.isInteger(tokens) ? tokens : null}, latency=${latency},status=${cost === null ? "estimated" : status} where id=${id} and status='pending'`,
  )
}
