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
export type FlightMode = { live: boolean; session?: Session; error?: string }
export async function flightMode(): Promise<FlightMode> {
  localStorage.removeItem("cerebras-api-key")
  localStorage.removeItem("gemini-api-key")
  const requested = new URLSearchParams(location.search).get("live")
  if (requested === "false") localStorage.setItem("spaceship.mode", "sim")
  if (requested === "true") localStorage.removeItem("spaceship.mode")
  try {
    const session = await api<Session>("session")
    if (localStorage.getItem("spaceship.mode") === "sim") return { live: false, session }
    if (requested === "true" && !session.user) return { live: true, session, error: "Sign in to resume live generation." }
    return { live: !!session.user, session }
  } catch {
    if (localStorage.getItem("spaceship.mode") === "sim") return { live: false }
    return { live: true, error: "Could not check your access. Retry or choose the simulator." }
  }
}
