import { spawn } from "node:child_process";
import http from "node:http";
// Only this loopback development gateway supplies a mock Sites identity.
const child = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--ip",
    "127.0.0.1",
    "--port",
    "8788",
    "--local",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      CLOUDFLARE_CF_FETCH_ENABLED: "false",
    },
  },
);
http
  .createServer(async (req, res) => {
    try {
      const headers = {
        ...req.headers,
        "oai-authenticated-user-id": "local-preview",
        "oai-authenticated-user-email": "preview@localhost",
      };
      delete headers.host;
      if (
        headers.origin === "http://127.0.0.1:3000" ||
        headers.origin === "http://localhost:3000"
      )
        headers.origin = "http://127.0.0.1:8788";
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const upstream = await fetch(`http://127.0.0.1:8788${req.url}`, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      const responseHeaders = Object.fromEntries(upstream.headers);
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];
      res.writeHead(upstream.status, responseHeaders);
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.writeHead(503);
      res.end("Preview is starting. Reload in a moment.");
    }
  })
  .listen(3000, "127.0.0.1", () => console.log("Local: http://127.0.0.1:3000"));
process.on("SIGINT", () => {
  child.kill();
  process.exit();
});
