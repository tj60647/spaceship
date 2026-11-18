import { endpoint, json } from "../server/http.js"
import { requireActor } from "../server/access.js"
import { catalogue } from "../server/models.js"
export default endpoint(async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." })
  await requireActor(req)
  json(res, 200, { models: await catalogue() })
})
