import { mkdir, writeFile } from "node:fs/promises";
import { sites } from "@openai/sites-vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sites(),
    {
      name: "dungeon-familiar-sites-worker",
      apply: "build",
      async closeBundle() {
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
