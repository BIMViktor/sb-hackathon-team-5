import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const handlers = Object.fromEntries(
  await Promise.all(
    ["me", "annotations", "status"].map(async (name) => [
      name,
      (await import(`../api/${name}.js`)).default,
    ]),
  ),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".ttf": "font/ttf",
  ".pfb": "application/octet-stream",
};
http
  .createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://localhost");
      const name = u.pathname.match(/^\/api\/(me|annotations|status)$/)?.[1];
      if (name) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        if (chunks.length) req.body = JSON.parse(Buffer.concat(chunks));
        return handlers[name](req, res);
      }
      const target = path.resolve(
        "dist",
        "." + (u.pathname === "/" ? "/index.html" : u.pathname),
      );
      if (!target.startsWith(path.resolve("dist") + path.sep)) {
        res.writeHead(403);
        return res.end();
      }
      const bytes = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(3000, "127.0.0.1", () => console.log("Local: http://127.0.0.1:3000"));
