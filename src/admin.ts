import { bindCrew } from "./crew.ts"
import { api } from "./llm/connection.ts"
type AdminData = {
  settings: { budget: number; paused: boolean }
  usage: { cost: number; calls: number; estimated: number }
  roster: { email: string; role: string; active: boolean; joined: boolean; cost: number }[]
  activity: { action: string; created_at: string; detail: unknown }[]
}
const status = document.querySelector<HTMLOutputElement>("#admin-status")!,
  settings = document.querySelector<HTMLFormElement>("#settings")!
async function refresh() {
  const data = await api<AdminData>("admin")
  ;(settings.elements.namedItem("budget") as HTMLInputElement).value = String(data.settings.budget)
  ;(settings.elements.namedItem("paused") as HTMLInputElement).checked = data.settings.paused
  document.querySelector("#usage")!.textContent =
    `$${data.usage.cost.toFixed(4)} used/reserved · ${data.usage.calls} calls · ${data.usage.estimated} pending or estimated`
  document.querySelector("#members")!.replaceChildren(
    ...data.roster.map((member) => {
      const tr = document.createElement("tr")
      for (const value of [member.email, member.role, !member.active ? "revoked" : member.joined ? "active" : "invited", `$${member.cost.toFixed(4)}`]) {
        const td = document.createElement("td")
        td.textContent = value
        tr.append(td)
      }
      const td = document.createElement("td")
      if (member.role !== "owner" && member.active) {
        const button = document.createElement("button")
        button.textContent = "revoke"
        button.onclick = async () => {
          button.disabled = true
          try {
            await api("admin", { action: "revoke", email: member.email })
            await refresh()
          } catch (error) {
            status.textContent = (error as Error).message
            button.disabled = false
          }
        }
        td.append(button)
      }
      tr.append(td)
      return tr
    }),
  )
  document.querySelector("#activity")!.replaceChildren(
    ...data.activity.map((event) => {
      const p = document.createElement("p")
      p.textContent = `${new Date(event.created_at).toLocaleString()} · ${event.action} · ${JSON.stringify(event.detail)}`
      return p
    }),
  )
}
await bindCrew(async (session) => {
  const owner = session.user?.role === "owner"
  document.querySelector<HTMLFieldSetElement>("#admin")!.disabled = !owner
  status.textContent = !owner ? "Owner access required." : ""
  if (!owner) {
    document.querySelector("#members")!.replaceChildren()
    document.querySelector("#activity")!.replaceChildren()
    document.querySelector("#usage")!.textContent = ""
    settings.reset()
  }
  if (owner) await refresh()
})
for (const id of ["settings", "roster"]) {
  const form = document.querySelector<HTMLFormElement>(`#${id}`)!
  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    const button = event.submitter as HTMLButtonElement
    button.disabled = true
    const fields = new FormData(form)
    const body =
      id === "settings"
        ? { action: id, budget: Number(fields.get("budget")), paused: fields.has("paused") }
        : {
            action: id,
            emails: String(fields.get("emails"))
              .split(/[\n,;]+/)
              .map((x) => x.trim())
              .filter(Boolean),
          }
    try {
      await api("admin", body)
      status.textContent = "saved"
      if (id === "roster") form.reset()
      await refresh()
    } catch (error) {
      status.textContent = (error as Error).message
    } finally {
      button.disabled = false
    }
  })
}
