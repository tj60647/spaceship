import { inference } from "../server/inference.js"
export const config = { maxDuration: 60 }
export default inference("generate")
