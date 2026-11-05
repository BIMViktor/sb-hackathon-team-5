import { api } from "./api.js";
const assets = __ASSETS__;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    const asset = assets[url.pathname];
    if (!asset) return new Response("Not found", { status: 404 });
    if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", { status: 405 });
    const bytes = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : bytes, {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control":
          url.pathname === "/" ? "no-store" : "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self' https://*.streambim.com",
      },
    });
  },
};
