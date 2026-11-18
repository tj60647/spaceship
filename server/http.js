export function fail(status, message) {
  throw Object.assign(new Error(message), { status })
}
export function json(res, status, data) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Content-Type", "application/json")
  res.statusCode = status
  res.end(JSON.stringify(data))
}
export function sameOrigin(req) {
  const origin = req.headers.origin
  const expected = (process.env.APP_ORIGIN || (!process.env.VERCEL ? "http://127.0.0.1:5173" : ""))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  if (!expected.includes(origin) || req.headers["sec-fetch-site"] === "cross-site") fail(403, "Open this app directly to continue.")
  if (!String(req.headers["content-type"] || "").startsWith("application/json")) fail(415, "JSON is required.")
}
export async function bodyOf(req) {
  let value = req.body
  if (!value) {
    let raw = ""
    for await (const chunk of req) {
      raw += chunk
      if (Buffer.byteLength(raw) > 64000) fail(413, "Request is too large.")
    }
    value = raw
  }
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      fail(400, "Invalid JSON.")
    }
  }
  if (!value || Array.isArray(value) || typeof value !== "object" || Buffer.byteLength(JSON.stringify(value)) > 64000) fail(400, "Invalid request.")
  return value
}
export function endpoint(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (res.headersSent) {
        res.end()
        return
      }
      json(res, error.status || 503, { error: error.status ? error.message : "Service unavailable. Please try again shortly." })
    }
  }
}
