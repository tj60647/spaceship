export function createViews(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  function show(name: string, focus = false) {
    for (const tab of tabs) {
      const selected = tab.dataset.view === name
      tab.setAttribute("aria-selected", String(selected))
      tab.tabIndex = selected ? 0 : -1
      root.querySelector<HTMLElement>(`#${tab.getAttribute("aria-controls")}`)!.hidden = !selected
      if (selected && focus) tab.focus()
    }
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener("click", () => show(tab.dataset.view!))
    tab.addEventListener("keydown", (event) => {
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index - 1 + tabs.length) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : -1
      if (next < 0) return
      event.preventDefault()
      show(tabs[next].dataset.view!, true)
    })
  }
  return { show }
}
