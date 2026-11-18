import { api, type Session } from "./llm/connection.ts"
export async function bindCrew(onSession: (session: Session) => void | Promise<void>) {
  const form = document.querySelector<HTMLFormElement>("#crew")!,
    status = document.querySelector<HTMLOutputElement>("#access-status")!,
    logout = document.querySelector<HTMLButtonElement>("#logout")!
  async function refresh() {
    const session = await api<Session>("session")
    form.hidden = !session.configured || !!session.user
    logout.hidden = !session.user
    document.querySelector<HTMLButtonElement>("#sign-in")!.hidden = !!session.user || !session.configured
    if (session.user) document.querySelector<HTMLDialogElement>("#crew-dialog")!.close()
    status.textContent = !session.configured
      ? "Live access is awaiting server configuration. The simulator is available."
      : session.user
        ? `${session.user.email} · ${session.user.role}`
        : "Sign in with your invited email."
    document.querySelector<HTMLOutputElement>("#access-summary")!.textContent = status.textContent
    await onSession(session)
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault()
    const button = event.submitter as HTMLButtonElement
    button.disabled = true
    try {
      const fields = new FormData(form)
      const result = await api<{ message?: string }>("auth", { action: button.value, email: fields.get("email"), code: fields.get("code") })
      if (button.value === "verify") await refresh()
      else status.textContent = result.message || "Check your email."
    } catch (error) {
      status.textContent = (error as Error).message
    } finally {
      button.disabled = false
    }
  })
  logout.addEventListener("click", async () => {
    try {
      await api("auth", { action: "logout" })
      await refresh()
    } catch (error) {
      status.textContent = (error as Error).message
    }
  })
  try {
    await refresh()
  } catch (error) {
    status.textContent = (error as Error).message
  }
}
