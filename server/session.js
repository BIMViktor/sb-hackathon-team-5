import { randomBytes, randomUUID, createHash } from "node:crypto";
const COOKIE = "__Host-rb-session",
  MAX_AGE = 60 * 60 * 24 * 30;
export function tokenHash(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function cookieToken(cookie = "") {
  const value = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value || "") ? value : null;
}
export async function findSession(request, sql) {
  const token = cookieToken(request.headers.get("cookie") || "");
  if (!token) return null;
  const rows =
    await sql`SELECT actor FROM rb_sessions WHERE token_hash=${tokenHash(token)} AND expires_at > NOW()`;
  return rows[0]?.actor || null;
}
export async function createSession(request, sql) {
  const existing = await findSession(request, sql);
  if (existing) return { actor: existing };
  const token = randomBytes(32).toString("hex"),
    actor = "browser:" + randomUUID();
  await sql`INSERT INTO rb_sessions(token_hash,actor,expires_at) VALUES(${tokenHash(token)},${actor},NOW() + INTERVAL '30 days')`;
  return {
    actor,
    cookie: `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${MAX_AGE}; Partitioned`,
  };
}
