import { randomBytes, createHash } from "node:crypto"
import { sql } from "drizzle-orm"
import { db } from "./db.js"
import { fail } from "./http.js"

export const hash = (value) => createHash("sha256").update(value).digest("hex")
export const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "")
export async function memberByEmail(email, database = db()) {
  return (await database.execute(sql`select * from spaceship_members where email=${email} and active=true`)).rows[0]
}
export async function actorOf(req, database = db()) {
  const token = String(req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("spaceship_session="))
    ?.split("=")[1]
  if (!token) return null
  return (
    (
      await database.execute(
        sql`select m.* from spaceship_sessions s join spaceship_members m on m.email=s.email where s.hash=${hash(token)} and s.expires_at>now() and m.active=true`,
      )
    ).rows[0] || null
  )
}
export async function requireActor(req) {
  const actor = await actorOf(req)
  if (!actor) fail(401, "Sign in with your invited email to use live models.")
  return actor
}
export function requireOwner(actor) {
  if (actor.role !== "owner") fail(403, "Owner access required.")
}
export async function issueSession(res, email, database = db()) {
  const token = randomBytes(32).toString("hex")
  await database.execute(sql`insert into spaceship_sessions(hash,email,expires_at) values(${hash(token)},${email},now()+interval '12 hours')`)
  res.setHeader(
    "Set-Cookie",
    `spaceship_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.VERCEL || process.env.APP_ORIGIN?.startsWith("https:") ? "; Secure" : ""}`,
  )
}
export async function rateLimit(key, max, seconds, database = db()) {
  const result = await database.execute(
    sql`insert into spaceship_limits(key,count,expires_at) values(${hash(key)},1,now()+${seconds}*interval '1 second') on conflict(key) do update set count=case when spaceship_limits.expires_at<now() then 1 else spaceship_limits.count+1 end, expires_at=case when spaceship_limits.expires_at<now() then excluded.expires_at else spaceship_limits.expires_at end returning count`,
  )
  if (result.rows[0].count > max) fail(429, "Too many attempts. Please wait before trying again.")
}
