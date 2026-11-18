import { chromium } from "playwright-core"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { resolve, extname } from "node:path"
import assert from "node:assert/strict"
const server = createServer(async (req, res) => {
  try {
    let p = req.url.split("?")[0]
    if (p.endsWith("/")) p += "index.html"
    res.setHeader("Content-Type", { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(p)] || "application/octet-stream")
    res.end(await readFile(resolve("dist", "." + p)))
  } catch {
    res.writeHead(404).end()
  }
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const browser = await chromium.launch({ channel: "chrome", headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  let signedIn = false,
    blocked = false,
    offline = false,
    calls = 0
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error") console.log(m.text())
  })
  page.on("pageerror", (e) => errors.push(e.message))
  await page.route("**/api/**", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()
    if (name === "session")
      return r.fulfill({
        status: offline ? 503 : 200,
        json: offline ? { error: "offline" } : { configured: true, user: signedIn ? { email: "test@example.com", role: "owner" } : null },
      })
    if (name === "auth") {
      signedIn = r.request().postDataJSON().action !== "logout"
      return r.fulfill({ json: {} })
    }
    if (name === "config")
      return r.fulfill({
        json: {
          models: [
            { id: "openai/gpt-oss-120b", name: "GPT OSS", kind: "generation" },
            { id: "google/gemini-decision-1", name: "Gemini Decision", kind: "decision" },
          ],
        },
      })
    if (name === "generate") {
      calls++
      if (blocked) return r.fulfill({ status: 402, json: { error: "The demo allowance is exhausted. Ask the owner to raise it." } })
      return r.fulfill({
        contentType: "text/event-stream",
        body:
          "data: " + JSON.stringify({ choices: [{ delta: { content: " The astronaut followed a distant signal. ".repeat(75) } }] }) + "\n\ndata: [DONE]\n\n",
      })
    }
    return r.fulfill({ json: { answers: {} } })
  })
  const root = `http://127.0.0.1:${server.address().port}/`
  await page.goto(root)
  await page.waitForFunction(() => document.querySelector("#flight-state").textContent.includes("Simulator"))
  assert.equal(calls, 0)
  await page.locator("#flight-action").click()
  await page.locator("[name=email]").fill("test@example.com")
  await page.locator("[value=verify]").click()
  await page.waitForFunction(() => document.querySelector("#flight-state").textContent.includes("Live generation"))
  await page.waitForTimeout(400)
  await page.locator("#pointer").hover()
  await page.mouse.down()
  await page.mouse.move(900, 500, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector("#text").textContent.includes("astronaut"))
  assert(calls > 0)
  assert(!page.url().includes("live=true"))
  await page.screenshot({ path: "logs/flight-live.png" })
  await page.goto(root + "lab/")
  await page.goto(root)
  await page.waitForTimeout(400)
  await page.locator("#pointer").hover()
  await page.mouse.down()
  await page.mouse.move(900, 500, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector("#text").textContent.includes("astronaut"))
  await page.locator("#flight-action").click()
  await page.locator("[value=sim]").click()
  await page.waitForFunction(() => document.querySelector("#flight-state").textContent.includes("simulator selected"))
  let before = calls
  await page.reload()
  await page.waitForTimeout(500)
  assert.equal(calls, before)
  await page.locator("#flight-action").click()
  await page.locator("[data-models]").waitFor()
  await page.locator("[value=live]").click()
  await page.waitForTimeout(400)
  await page.locator("#pointer").hover()
  await page.mouse.down()
  await page.mouse.move(900, 500, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector("#text").textContent.includes("astronaut"))
  blocked = true
  before = calls
  await page.reload()
  await page.locator("#model-error").waitFor()
  assert.match(await page.locator("#model-error").innerText(), /allowance is exhausted/)
  await page.waitForTimeout(1800)
  assert.equal(calls, before + 1)
  assert(await page.locator("#flight-admin").isVisible())
  assert(!/lorem|ipsum/i.test(await page.locator("#text").innerText()))
  await page.screenshot({ path: "logs/flight-blocked.png" })
  blocked = false
  await page.locator("#flight-retry").click()
  await page.waitForTimeout(400)
  await page.locator("#pointer").hover()
  await page.mouse.down()
  await page.mouse.move(900, 500, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(() => document.querySelector("#text").textContent.includes("astronaut"))
  await page.locator("#flight-action").click()
  await page.locator("[value=logout]").click()
  await page.waitForFunction(() => document.querySelector("#flight-state").textContent.includes("Simulator"))
  before = calls
  await page.waitForTimeout(500)
  assert.equal(calls, before)
  offline = true
  await page.reload()
  await page.waitForFunction(() => document.querySelector("#flight-state").textContent.includes("Could not check"))
  assert.equal(calls, before)
  assert.equal(await page.locator("#text").innerText(), "")
  await page.locator("#flight-action").click()
  await page.locator("[value=sim]").click()
  await page.waitForFunction(() => document.querySelector("#flight-state").textContent.includes("Simulator"))
  assert.deepEqual(errors, [])
  console.log(
    "PASS: anonymous simulation, sign-in auto-live, streaming, lab return, explicit simulator preference, allowance stop/no retries, recovery, logout, access failure. All APIs mocked; no paid calls.",
  )
} finally {
  await browser.close()
  server.close()
}
