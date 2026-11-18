import { fail } from "./http.js"

const generationIds = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
let cached
export async function catalogue() {
  if (cached && cached.until > Date.now()) return cached.models
  const responses = await Promise.all(
    ["", "?output_modalities=decisions"].map((query) => fetch(`https://openrouter.ai/api/v1/models${query}`, { signal: AbortSignal.timeout(10000) })),
  )
  if (responses.some((response) => !response.ok)) fail(503, "The model catalogue is unavailable.")
  const catalogues = await Promise.all(responses.map((response) => response.json()))
  const data = [...new Map(catalogues.flatMap((result) => result.data).map((model) => [model.id, model])).values()]
  const models = data
    .filter(
      (m) =>
        generationIds.includes(m.id) ||
        (m.architecture?.output_modalities?.includes("decisions") && m.architecture?.input_modalities?.includes("text") && !m.id.startsWith("~")),
    )
    .filter(
      (m) =>
        Number.isFinite(Number(m.pricing?.prompt)) &&
        Number(m.pricing?.prompt) >= 0 &&
        Number.isFinite(Number(m.pricing?.completion)) &&
        Number(m.pricing?.completion) >= 0 &&
        Number(m.pricing?.request || 0) === 0,
    )
    .filter((m) => generationIds.includes(m.id) || Number(m.pricing.completion) === 0)
    .map((m) => ({
      id: m.id,
      name: m.name,
      kind: generationIds.includes(m.id) ? "generation" : "decision",
      inputPrice: Number(m.pricing.prompt),
      outputPrice: Number(m.pricing.completion),
    }))
  cached = { models, until: Date.now() + 60000 }
  return models
}
export async function validateCall(body, operation) {
  const model = (await catalogue()).find((m) => m.id === body.model && m.kind === (operation === "generate" ? "generation" : "decision"))
  if (!model) fail(400, "Choose an available model from the list.")
  let request
  if (operation === "generate") {
    if (typeof body.system !== "string" || typeof body.user !== "string" || body.system.length + body.user.length > 20000)
      fail(400, "Prompt is too large or invalid.")
    if (
      !Number.isFinite(body.temperature) ||
      body.temperature < 0 ||
      body.temperature > 2 ||
      !Number.isInteger(body.maxCompletionTokens) ||
      body.maxCompletionTokens < 1 ||
      body.maxCompletionTokens > 2000
    )
      fail(400, "Invalid generation limits.")
    request = {
      model: model.id,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: body.maxCompletionTokens,
      temperature: body.temperature,
      reasoning: { effort: "low" },
      messages: [
        { role: "system", content: body.system },
        { role: "user", content: body.user },
      ],
    }
  } else {
    if (typeof body.input !== "string" || body.input.length > 20000 || !body.questions || typeof body.questions !== "object" || Array.isArray(body.questions))
      fail(400, "Invalid decision input.")
    const questions = Object.entries(body.questions)
    if (!questions.length || questions.length > 100) fail(400, "Use between 1 and 100 questions.")
    for (const [key, q] of questions) {
      if (!/^[a-zA-Z0-9_-]{1,80}$/.test(key) || !q || !["score", "noul"].includes(q.type) || typeof q.instructions !== "string" || q.instructions.length > 2000)
        fail(400, "Invalid question.")
      if (
        q.type === "score" &&
        (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 20 || q.criteria.some((x) => typeof x !== "string" || x.length > 500))
      )
        fail(400, "Invalid scoring criteria.")
    }
    request = {
      model: model.id,
      state: body.input,
      questions: Object.fromEntries(
        questions.map(([key, q]) => [key, { type: q.type, instructions: q.instructions, ...(q.type === "score" ? { criteria: q.criteria } : {}) }]),
      ),
    }
  }
  // UTF-8 byte count deliberately overestimates token count; retain the reservation when upstream usage is unavailable.
  const cost = Math.max(0.000001, (Buffer.byteLength(JSON.stringify(request)) + 2048) * model.inputPrice + (request.max_tokens || 0) * model.outputPrice)
  return { request, cost }
}
