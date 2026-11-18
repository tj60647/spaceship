import { WorkOS } from "@workos-inc/node"
import { sql } from "drizzle-orm"
import { endpoint, sameOrigin, bodyOf, json, fail } from "../server/http.js"
import { normalizeEmail, memberByEmail, rateLimit, issueSession, hash } from "../server/access.js"
import { db } from "../server/db.js"

export default endpoint(async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
  sameOrigin(req)
  const body = await bodyOf(req)
  if (body.action === "logout") {
    const token = String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("spaceship_session="))
      ?.split("=")[1]
    if (token) await db().execute(sql`delete from spaceship_sessions where hash=${hash(token)}`)
    res.setHeader("Set-Cookie", "spaceship_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0")
    return json(res, 200, { ok: true })
  }
  const email = normalizeEmail(body.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fail(400, "Enter a valid email address.")
  const ip = String(req.headers["x-vercel-forwarded-for"] || req.socket?.remoteAddress || "unknown")
  await rateLimit(`auth:ip:${ip}`, 30, 600)
  await rateLimit(`auth:${body.action}:${email}`, body.action === "send" ? 3 : 8, 600)
  if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID) fail(503, "Sign-in is not configured yet.")
  const workos = new WorkOS(process.env.WORKOS_API_KEY, { clientId: process.env.WORKOS_CLIENT_ID })
  const member = await memberByEmail(email)
  if (body.action === "send") {
    if (member) await workos.userManagement.createMagicAuth({ email })
    return json(res, 200, { message: "If this email is invited, a sign-in code is on its way." })
  }
  if (body.action !== "verify" || !/^\d{6}$/.test(body.code || "")) fail(400, "Enter the six-digit code from your email.")
  if (!member) fail(401, "This code or invitation is not valid.")
  let result
  try {
    result = await workos.userManagement.authenticateWithMagicAuth({ clientId: process.env.WORKOS_CLIENT_ID, email, code: body.code })
  } catch {
    fail(401, "This code has expired or is not valid. Request a new code.")
  }
  if (!result.user.emailVerified || normalizeEmail(result.user.email) !== email || (member.user_id && member.user_id !== result.user.id))
    fail(403, "This identity does not match the invitation.")
  const current = await memberByEmail(email)
  if (!current) fail(403, "This invitation is no longer active.")
  const bound = await db().execute(
    sql`update spaceship_members set user_id=${result.user.id} where email=${email} and active=true and (user_id is null or user_id=${result.user.id}) returning email`,
  )
  if (!bound.rows.length) fail(403, "This invitation is no longer valid.")
  await issueSession(res, email)
  json(res, 200, { ok: true })
})
