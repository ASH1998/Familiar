import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sites(),
    {
      name: "dungeon-familiar-sites-worker",
      apply: "build",
      async closeBundle() {
        // Sites exposes dist/client through the Worker's ASSETS binding. Vite emits static
        // files at the dist root, so mirror them into the conventional client directory.
        const entries = await readdir("dist", { withFileTypes: true });
        await mkdir("dist/client", { recursive: true });
        await Promise.all(
          entries
            .filter(({ name }) => ![".openai", "client", "server"].includes(name))
            .map(({ name }) => cp(`dist/${name}`, `dist/client/${name}`, { recursive: true })),
        );

        await mkdir("dist/server", { recursive: true });
        await writeFile(
          "dist/server/index.js",
          [
            "export default {",
            "  async fetch(request, env) {",
            "    return env.ASSETS.fetch(request);",
            "  },",
            "};",
            "",
          ].join("\n"),
        );
      },
    },
  ],
  server: { port: 5173 },
  build: { target: "es2022", outDir: "dist" },
});
