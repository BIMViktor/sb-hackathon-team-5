import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp, readdir } from "node:fs/promises";
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
const app = await build({
  entryPoints: ["src/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  write: false,
});
const assets = {};
const add = (path, type, data) =>
  (assets[path] = { type, data: Buffer.from(data).toString("base64") });
add("/", "text/html; charset=utf-8", await readFile("src/index.html"));
add("/app.css", "text/css; charset=utf-8", await readFile("src/app.css"));
add("/app.js", "text/javascript; charset=utf-8", app.outputFiles[0].contents);
add(
  "/pdf.worker.mjs",
  "text/javascript; charset=utf-8",
  await readFile("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
);
for (const f of await readdir("node_modules/pdfjs-dist/standard_fonts"))
  if (!f.includes("LICENSE"))
    add(
      `/standard_fonts/${f}`,
      "application/octet-stream",
      await readFile(`node_modules/pdfjs-dist/standard_fonts/${f}`),
    );
const worker = await build({
  entryPoints: ["worker/runtime.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  write: false,
  define: { __ASSETS__: JSON.stringify(assets) },
});
await writeFile("dist/server/index.js", worker.outputFiles[0].contents);
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
console.log(
  `Built Worker with ${Object.keys(assets).length} embedded assets (${Math.round(worker.outputFiles[0].contents.length / 1024)} KB)`,
);
