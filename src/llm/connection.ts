export type Model = { id: string; name: string; kind: "generation" | "decision"; inputPrice: number; outputPrice: number }
export type Session = { configured: boolean; user: { email: string; role: string } | null; usage?: { cost: number; calls: number } }
export const defaults = { generation: "openai/gpt-oss-120b", decision: "google/gemini-decision-1" }
export function selectedModel(kind: keyof typeof defaults) {
  return localStorage.getItem(`spaceship.${kind}`) || defaults[kind]
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    credentials: "same-origin",
    ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || "The request failed.")
  return data as T
}
export function showFailure(message: string) {
  dispatchEvent(new CustomEvent("model-error", { detail: message }))
}
export function recordUsage(value: unknown) {
  dispatchEvent(new CustomEvent("model-usage", { detail: value }))
}
export async function authorizedLive() {
  localStorage.removeItem("cerebras-api-key")
  localStorage.removeItem("gemini-api-key")
  if (new URLSearchParams(location.search).get("live") !== "true") return false
  try {
    return !!(await api<Session>("session")).user
  } catch {
    return false
  }
}
