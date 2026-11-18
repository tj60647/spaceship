import { api, selectedModel, type Model, type Session } from "../llm/connection.ts"
export function bindModeToggle(toggle: HTMLButtonElement, dialog: HTMLDialogElement, isLive: boolean) {
  const form = dialog.querySelector("form")!
  const status = dialog.querySelector<HTMLOutputElement>("output")!
  const auth = dialog.querySelector<HTMLElement>("[data-auth]")!
  const models = dialog.querySelector<HTMLElement>("[data-models]")!
  const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement
  toggle.setAttribute("aria-pressed", `${isLive}`)
  toggle.querySelector("b")!.textContent = isLive ? "flight" : "sim"
  toggle.addEventListener("click", () => {
    dialog.showModal()
    void refresh()
  })
  async function refresh() {
    status.textContent = "checking access…"
    models.hidden = auth.hidden = true
    try {
      const session = await api<Session>("session")
      if (!session.configured) {
        status.textContent = "Live access is awaiting server configuration. The simulator is available."
        return
      }
      auth.hidden = !!session.user
      if (!session.user) {
        status.textContent = "Sign in with your invited email."
        return
      }
      const { models: catalogue } = await api<{ models: Model[] }>("config")
      for (const kind of ["generation", "decision"] as const) {
        const select = form.elements.namedItem(kind) as HTMLSelectElement
        select.replaceChildren(...catalogue.filter((m) => m.kind === kind).map((m) => new Option(m.name, m.id)))
        select.value = selectedModel(kind)
        if (!select.value) select.selectedIndex = 0
      }
      models.hidden = false
      dialog.querySelector<HTMLAnchorElement>("[data-admin]")!.hidden = session.user.role !== "owner"
      status.textContent = `${session.user.email} · $${Number(session.usage?.cost || 0).toFixed(4)} used/reserved`
    } catch (error) {
      status.textContent = (error as Error).message
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    const action = (event.submitter as HTMLButtonElement)?.value
    if (action === "sim") return reload(false)
    if (action === "live") {
      for (const kind of ["generation", "decision"]) localStorage.setItem(`spaceship.${kind}`, input(kind).value)
      return reload(true)
    }
    const buttons = [...form.querySelectorAll("button")]
    buttons.forEach((b) => (b.disabled = true))
    try {
      const result = await api<{ message?: string }>("auth", { action, email: input("email").value, code: input("code").value })
      if (action === "send") status.textContent = result.message || "Check your email."
      else await refresh()
    } catch (error) {
      status.textContent = (error as Error).message
    } finally {
      buttons.forEach((b) => (b.disabled = false))
    }
  })
  function reload(live: boolean) {
    const url = new URL(location.href)
    if (live) url.searchParams.set("live", "true")
    else url.searchParams.delete("live")
    location.assign(url)
  }
}
