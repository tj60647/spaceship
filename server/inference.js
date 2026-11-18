import { endpoint, sameOrigin, bodyOf, json, fail } from "./http.js"
import { requireActor } from "./access.js"
import { validateCall } from "./models.js"
import { reserve, settle } from "./usage.js"

export function inference(operation) {
  return endpoint(async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." })
    sameOrigin(req)
    const actor = await requireActor(req)
    if (!process.env.OPENROUTER_API_KEY) fail(503, "Model access is not configured yet.")
    const { request, cost } = await validateCall(await bodyOf(req), operation)
    const id = await reserve(actor.email, request.model, operation, cost)
    const started = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 55000)
    const abort = () => {
      if (!res.writableEnded) controller.abort()
    }
    res.on("close", abort)
    let usage
    try {
      const response = await fetch(`https://openrouter.ai/api/${operation === "generate" ? "v1/chat/completions" : "alpha/decisions"}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "X-Title": "Spaceship classroom adaptation — original by Chuanqi Sun",
        },
        body: JSON.stringify(request),
      })
      if (!response.ok) fail(response.status === 429 ? 429 : 502, "The selected model could not answer. Try another model or retry shortly.")
      if (operation === "decide") {
        const result = await response.json()
        usage = result.usage
        if (!result.answers) fail(502, "The decision model returned an invalid answer.")
        for (const [key, q] of Object.entries(request.questions)) {
          const answer = result.answers[key]
          if (
            !answer ||
            answer.type !== q.type ||
            (q.type === "score" && (!Number.isFinite(answer.score) || answer.score < 0 || answer.score > q.criteria.length - 1)) ||
            (q.type === "noul" && (!Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1))
          )
            fail(502, "This model did not return the required scoring data. Choose another model.")
        }
        await settle(id, usage, Date.now() - started, "complete")
        return json(res, 200, { ...result, requestId: id, latency: Date.now() - started })
      }
      res.setHeader("Content-Type", "text/event-stream")
      res.setHeader("Cache-Control", "no-store")
      res.setHeader("X-Accel-Buffering", "no")
      let buffer = ""
      if (!response.body) fail(502, "The model returned no stream.")
      for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
        buffer += chunk
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.startsWith("data:") || line.slice(5).trim() === "[DONE]") continue
          const event = JSON.parse(line.slice(5))
          if (event.usage) usage = event.usage
          if (event.error) fail(502, "The model stream was interrupted.")
          const content = event.choices?.[0]?.delta?.content
          if (content) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
        }
      }
      await settle(id, usage, Date.now() - started, "complete")
      res.write(`data: ${JSON.stringify({ usage, requestId: id, model: request.model, latency: Date.now() - started })}\n\ndata: [DONE]\n\n`)
      res.end()
    } catch (error) {
      await settle(id, usage, Date.now() - started, "failed")
      if (res.headersSent && !res.destroyed) res.write(`data: ${JSON.stringify({ error: "Generation stopped before completion." })}\n\n`)
      throw error
    } finally {
      clearTimeout(timeout)
      res.off("close", abort)
    }
  })
}
