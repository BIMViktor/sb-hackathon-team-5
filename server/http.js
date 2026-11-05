export function webRequest(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers))
    if (value !== undefined)
      headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  const origin = `https://${req.headers.host}`;
  return new Request(origin + req.url, {
    method: req.method,
    headers,
    body: ["GET", "HEAD"].includes(req.method)
      ? undefined
      : typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body || {}),
  });
}
export async function send(res, response) {
  res.statusCode = response.status;
  for (const [name, value] of response.headers) res.setHeader(name, value);
  res.end(Buffer.from(await response.arrayBuffer()));
}
export function errorResponse(error) {
  return Response.json(
    {
      error: error.status
        ? error.message
        : "Databasen kunde inte användas. Kontrollera databasanslutning och migrering i Vercel.",
    },
    { status: error.status || 503, headers: { "Cache-Control": "no-store" } },
  );
}
