import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { migrate } from "./migrate.mjs";
const require = createRequire(import.meta.url),
  pdfRoot = path.dirname(require.resolve("pdfjs-dist/package.json"));
await migrate();
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["pdf-widget/src/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  outfile: "dist/app.js",
});
await cp("pdf-widget/src/app.css", "dist/app.css");
await cp("pdf-widget/src/index.html", "dist/index.html");
await cp(path.join(pdfRoot, "build/pdf.worker.min.mjs"), "dist/pdf.worker.mjs");
await cp(path.join(pdfRoot, "standard_fonts"), "dist/standard_fonts", {
  recursive: true,
});
console.log(
  "Vercel frontend byggd. API-funktioner levereras från api/. Inga PDF-filer ingår i bygget.",
);
