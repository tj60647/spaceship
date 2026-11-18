import test from "node:test"
import assert from "node:assert/strict"
import { validateCall } from "../server/models.js"
test("provider requests constrain models, schema, tokens and price reservations", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: [
        {
          id: "test/decision",
          name: "Decision",
          architecture: { input_modalities: ["text"], output_modalities: ["decisions"] },
          pricing: { prompt: "0.000001", completion: "0" },
        },
        {
          id: "test/unbounded",
          architecture: { input_modalities: ["text"], output_modalities: ["decisions"] },
          pricing: { prompt: "0.000001", completion: "0.01" },
        },
        { id: "openai/gpt-oss-20b", name: "Generation", pricing: { prompt: "0.000001", completion: "0.000002" } },
      ],
    }),
  })
  try {
    const input = {
      model: "test/decision",
      input: "Text",
      questions: { q: { type: "score", instructions: "Score suspense", criteria: ["None", "High"], unexpected: "discard" } },
    }
    const result = await validateCall(input, "decide")
    assert.equal(result.request.state, "Text")
    assert.equal(result.request.input, undefined)
    assert.equal(result.request.questions.q.unexpected, undefined)
    assert.ok(result.cost > 0)
    await assert.rejects(validateCall({ ...input, model: "test/unbounded" }, "decide"), /available model/)
    await assert.rejects(validateCall({ ...input, questions: { q: { type: "score", instructions: "Score", criteria: ["Only one"] } } }, "decide"), /criteria/)
    await assert.rejects(validateCall({ ...input, input: "a".repeat(20001) }, "decide"), /Invalid/)
    const generate = { model: "openai/gpt-oss-20b", system: "System", user: "User", temperature: 0.4, maxCompletionTokens: 100 }
    assert.equal((await validateCall(generate, "generate")).request.max_tokens, 100)
    await assert.rejects(validateCall({ ...generate, maxCompletionTokens: 100000 }, "generate"), /limits/)
  } finally {
    globalThis.fetch = original
  }
})
