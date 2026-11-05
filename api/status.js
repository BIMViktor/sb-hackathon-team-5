import { databaseUrl, getSql } from "../server/database.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end();
  }
  if (!databaseUrl()) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        databaseReady: false,
        reason: "DATABASE_URL eller POSTGRES_URL saknas",
        hosting: "vercel",
      }),
    );
  }
  try {
    const sql = getSql();
    await sql`SELECT 1 FROM rb_annotations LIMIT 0`;
    await sql`SELECT 1 FROM rb_sessions LIMIT 0`;
    res.end(JSON.stringify({ databaseReady: true, hosting: "vercel" }));
  } catch {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        databaseReady: false,
        reason: "Databasen eller migreringen är inte tillgänglig",
        hosting: "vercel",
      }),
    );
  }
}
