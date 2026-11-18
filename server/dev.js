export function localApi() {
  return {
    name: "spaceship-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = new URL(req.url, "http://localhost").pathname.match(/^\/api\/(session|auth|config|admin|generate|decide)$/)?.[1]
        if (!route) return next()
        try {
          const { default: handler } = await import(`../api/${route}.js`)
          await handler(req, res)
        } catch {
          res.statusCode = 503
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify({ error: "Local API unavailable." }))
        }
      })
    },
  }
}
