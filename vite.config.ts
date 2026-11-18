import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, loadEnv } from "vite"
import { localApi } from "./server/dev.js"

for (const [key, value] of Object.entries(loadEnv("development", process.cwd(), ""))) process.env[key] ??= value

export default defineConfig({
  plugins: [localApi()],
  base: process.env.VITE_BASE_PATH || "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        lab: resolve(import.meta.dirname, "lab/index.html"),
        admin: resolve(import.meta.dirname, "admin/index.html"),
        report: resolve(import.meta.dirname, "report/index.html"),
        ...Object.fromEntries(
          readdirSync(resolve(import.meta.dirname, "extra"))
            .filter((file) => file.endsWith(".html"))
            .map((file) => [`extra/${file.slice(0, -".html".length)}`, resolve(import.meta.dirname, "extra", file)]),
        ),
      },
    },
  },
})
