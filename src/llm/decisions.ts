import { selectedModel, showFailure, recordUsage } from "./connection.ts"
const API_URL = "/api/decide"

export type Resolution = "low" | "medium" | "high" | "ultra_high"

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mime_type: string; resolution?: Resolution }
  | { type: "audio"; data: string; mime_type: string }
  | { type: "video"; data: string; mime_type: string; resolution?: Exclude<Resolution, "ultra_high"> }

export type Question =
  | { type: "noul"; instructions: string; criteria?: { true_description?: string; false_description?: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }

export type Answer =
  | { type: "noul"; noul: number; confidence: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; legend: Record<string, string>; confidence: number }

export type DecisionResponse = {
  answers: Record<string, Answer>
  usage: {
    input_tokens: number
    output_tokens: number
    total_tokens?: number
    cost?: number
  }
}

export type DecisionRequest = {
  model: string
  input: string | ContentBlock[]
  questions: Record<string, Question>
}

export async function createDecisions(request: DecisionRequest, signal: AbortSignal) {
  const response = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, model: selectedModel("decision") }),
  })
  const body = await response.json()

  if (!response.ok) {
    const message = body.error || "Decision scoring failed."
    showFailure(message)
    throw new Error(message)
  }
  recordUsage(body)

  return body as DecisionResponse
}
