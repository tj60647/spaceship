export type DecisionResult = { answers: Record<string, { type: string; score?: number; noul?: number }>; usage?: { cost?: number }; latency: number }
export function resultCard(result: DecisionResult, model: string, input: string, question: string, criteria: string[]) {
  const article = document.createElement("article"),
    heading = document.createElement("h3"),
    answer = document.createElement("p"),
    prompt = document.createElement("p"),
    snapshot = document.createElement("details"),
    snapshotTitle = document.createElement("summary"),
    context = document.createElement("p"),
    rubric = document.createElement("p"),
    raw = document.createElement("details"),
    rawTitle = document.createElement("summary"),
    data = document.createElement("pre")
  heading.textContent = `${model} · ${result.latency} ms · ${result.usage?.cost === undefined ? "cost pending" : `$${result.usage.cost.toFixed(6)}`}`
  const value = result.answers.question
  answer.textContent =
    value?.type === "score"
      ? `Score: ${value.score?.toFixed(2)} out of ${criteria.length - 1}. Level 0 is lowest.`
      : value?.type === "noul"
        ? `Estimated probability of “yes”: ${((value.noul || 0) * 100).toFixed(1)}%. This is a model judgment, not verified accuracy.`
        : "No supported answer was returned."
  prompt.textContent = question
  snapshotTitle.textContent = "Text and scale used for this run"
  context.textContent = input
  rubric.textContent = criteria.map((text, i) => `${i}: ${text}`).join(" / ")
  snapshot.append(snapshotTitle, context, rubric)
  rawTitle.textContent = "Structured response (for building an app)"
  data.textContent = JSON.stringify(result.answers, null, 2)
  raw.append(rawTitle, data)
  article.append(heading, answer, prompt, snapshot, raw)
  return article
}
