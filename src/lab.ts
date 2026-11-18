import { bindCrew } from "./crew.ts"
import { createViews } from "./lab/views.ts"
import { createLab } from "./lab/controller.ts"

const workspace = document.querySelector<HTMLElement>(".lesson-workspace")!
const views = createViews(workspace)
const lab = createLab(views)
await bindCrew(lab.onSession)
