import { api, selectedModel, defaults, type Model, type Session } from "../llm/connection.ts"
import { examples, loadExample } from "./examples.ts"
import { resultCard, type DecisionResult } from "./results.ts"
import type { createViews } from "./views.ts"

export function createLab(views: ReturnType<typeof createViews>) {
  const form = document.querySelector<HTMLFormElement>("#decision-form")!,
    models = form.elements.namedItem("model") as HTMLSelectElement,
    examplesMenu = document.querySelector<HTMLSelectElement>("#example")!,
    status = document.querySelector<HTMLOutputElement>("#lab-status")!,
    results = document.querySelector<HTMLElement>("#results")!,
    run = document.querySelector<HTMLButtonElement>("#evaluate")!,
    useModel = document.querySelector<HTMLButtonElement>("#use-model")!
  let signedIn = false,
    busy = false
  function updateControls() {
    run.disabled = !signedIn || busy || !models.value
    useModel.disabled = !signedIn || !models.value
    const probability = (form.elements.namedItem("type") as HTMLSelectElement).value === "noul"
    document.querySelector<HTMLElement>("#criteria-label")!.hidden = probability
    const levels = (form.elements.namedItem("criteria") as HTMLTextAreaElement).value.split("\n").filter((line) => line.trim()).length
    document.querySelector("#scale-summary")!.textContent = probability ? "Answer · probability of yes" : `Answer scale · 0 to ${Math.max(0, levels - 1)}`
  }
  function chooseExample() {
    const example = examples[examplesMenu.value]
    loadExample(form, example)
    document.querySelector("#example-next")!.textContent = example.next
    document.querySelector<HTMLElement>("#worked-example")!.hidden = true
    document.querySelector<HTMLElement>("#answer-intro")!.hidden = false
    document.querySelector<HTMLElement>("#show-source")!.hidden = examplesMenu.value !== "relevance"
    views.show("answer")
    updateControls()
  }
  function selectModel(id: string) {
    models.value = id
    if (!models.value) models.selectedIndex = -1
    updateControls()
  }
  examplesMenu.addEventListener("change", chooseExample)
  form.addEventListener("change", updateControls)
  document.querySelector("#show-source")!.addEventListener("click", () => views.show("source"))
  document.querySelector("#reset-example")!.addEventListener("click", () => {
    chooseExample()
    status.textContent = "Example reset. Model choice and live results kept."
  })
  document.querySelector("#restore-defaults")!.addEventListener("click", () => {
    localStorage.removeItem("spaceship.decision")
    examplesMenu.value = "relevance"
    chooseExample()
    selectModel(defaults.decision)
    status.textContent = `Restored Gemini Decision 1 and the relevance example. No API call made.${models.value ? "" : " Gemini is not in the available list right now; choose another model to run an experiment."} Reload the flight deck to apply the restored model.`
  })
  document.querySelector("#show-example")!.addEventListener("click", () => {
    const example = examples[examplesMenu.value],
      box = document.querySelector<HTMLElement>("#worked-example")!
    box.hidden = false
    document.querySelector<HTMLElement>("#answer-intro")!.hidden = true
    views.show("answer")
    document.querySelector("#worked-value")!.textContent =
      example.type === "score"
        ? `Illustrative answer: ${example.answer} out of ${example.criteria.length - 1}`
        : `Illustrative answer: ${example.answer * 100}% estimated probability of “yes”`
    document.querySelector("#worked-reason")!.textContent = example.explanation
  })
  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    if (run.disabled) return
    busy = true
    updateControls()
    status.textContent = "asking the model…"
    views.show("results")
    const fields = new FormData(form),
      type = String(fields.get("type")),
      model = models.value,
      input = String(fields.get("input")),
      instructions = String(fields.get("question")),
      criteria =
        type === "score"
          ? String(fields.get("criteria"))
              .split("\n")
              .map((x) => x.trim())
              .filter(Boolean)
          : []
    try {
      const result = await api<DecisionResult>("decide", {
        model,
        input,
        questions: { question: { type, instructions, ...(type === "score" ? { criteria } : {}) } },
      })
      results.prepend(resultCard(result, model, input, instructions, criteria))
      document.querySelector<HTMLElement>("#results-empty")!.hidden = true
      status.textContent = "Run complete. Compare it with your prediction; then change one thing and try again."
    } catch (error) {
      status.textContent = (error as Error).message
    } finally {
      busy = false
      updateControls()
    }
  })
  useModel.addEventListener("click", () => {
    localStorage.setItem("spaceship.decision", models.value)
    status.textContent = "Decision model saved in this browser. Launch or reload live mode on the flight deck to use it. The lab question is not transferred."
  })
  document.querySelector("#clear")!.addEventListener("click", () => {
    results.replaceChildren()
    document.querySelector<HTMLElement>("#results-empty")!.hidden = false
    status.textContent = "Run results cleared."
  })
  chooseExample()
  return {
    onSession: async (session: Session) => {
      signedIn = !!session.user
      document.querySelector("#live-hint")!.textContent = signedIn
        ? "Run the current inputs, then compare the result with your prediction."
        : "Sign in to run your edited inputs. Live calls use the shared spending limit."
      updateControls()
      if (!signedIn) {
        results.replaceChildren()
        document.querySelector<HTMLElement>("#results-empty")!.hidden = false
        return
      }
      const { models: available } = await api<{ models: Model[] }>("config")
      models.replaceChildren(
        ...available.filter((m) => m.kind === "decision").map((m) => new Option(`${m.name} · $${(m.inputPrice * 1e6).toFixed(3)}/M input`, m.id)),
      )
      selectModel(selectedModel("decision"))
      if (!models.value) status.textContent = "Your saved model is unavailable. Choose a model from the list to run an experiment."
    },
  }
}
