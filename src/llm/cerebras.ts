import { selectedModel, showFailure, recordUsage } from "./connection.ts"
const API_URL = "/api/generate"

export type CompletionRequest = {
  system: string
  user: string
  temperature: number
  maxCompletionTokens: number
  signal: AbortSignal
}

export async function* streamCompletion({ system, user, temperature, maxCompletionTokens, signal }: CompletionRequest) {
  const response = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: selectedModel("generation"), system, user, temperature, maxCompletionTokens }),
  })

  if (!response.ok) {
    const message = (await response.json()).error || "Generation failed."
    showFailure(message)
    throw new Error(message)
  }
  if (!response.body) throw new Error("no response body")

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    buffer += value

    const events = buffer.split("\n")
    buffer = events.pop() ?? ""

    for (const line of events) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : ""
      if (!data || data === "[DONE]") continue
      const event = JSON.parse(data)
      if (event.error) {
        showFailure(event.error)
        throw new Error(event.error)
      }
      if (event.usage) recordUsage(event)
      const content = event.choices?.[0]?.delta?.content
      if (content) yield content as string
    }
  }
}
