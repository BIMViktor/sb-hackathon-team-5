const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export function validateAnnotation(a) {
  if (
    !a ||
    !Number.isInteger(a.pageIndex) ||
    a.pageIndex < 0 ||
    a.pageIndex > 100000 ||
    !["pen", "highlight"].includes(a.tool) ||
    !/^#[0-9a-f]{6}$/i.test(a.color) ||
    !Number.isFinite(a.width) ||
    a.width < 0.1 ||
    a.width > 100
  )
    throw fail("Ogiltig annotering.");
  if (
    !Array.isArray(a.points) ||
    !a.points.length ||
    a.points.length > 20000 ||
    a.points.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e7),
    )
  )
    throw fail("Ogiltiga PDF-koordinater.");
  if (
    typeof a.createdRevision !== "string" ||
    a.createdRevision.length > 150 ||
    !a.pageSignature ||
    !Array.isArray(a.pageSignature.view) ||
    a.pageSignature.view.length !== 4 ||
    a.pageSignature.view.some((n) => !Number.isFinite(n)) ||
    ![0, 90, 180, 270].includes(a.pageSignature.rotation) ||
    !Number.isFinite(a.pageSignature.userUnit) ||
    a.pageSignature.userUnit <= 0
  )
    throw fail("Sidans geometri saknas.");
  return {
    pageIndex: a.pageIndex,
    tool: a.tool,
    color: a.color,
    width: a.width,
    points: a.points,
    createdRevision: a.createdRevision,
    pageSignature: a.pageSignature,
  };
}
export function validateProof(value, environment, projectId, documentId) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw fail("Giltig StreamBIM-nedladdningslänk krävs.", 403);
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    u.origin !== environment ||
    !/^https:\/\/(app|sweden|japan|australia|staging|dev)\.streambim\.com$/.test(
      environment,
    )
  )
    throw fail("Otillåten StreamBIM-miljö.", 403);
  const prefix = `/project-${projectId}/api/v1/documents/${documentId}/`;
  if (
    !u.pathname.startsWith(prefix) ||
    !/^\d+$/.test(projectId) ||
    !/^\d+$/.test(documentId) ||
    !u.pathname
      .slice(prefix.length)
      .match(/^(?:\d+\/download|download(?:\/[^/]+)?)$/) ||
    !u.searchParams.size
  )
    throw fail("Nedladdningslänken tillhör inte dokumentet.", 403);
  return u;
}
async function authorize(request, env, scope) {
  const proof = request.headers.get("x-streambim-download");
  const u = validateProof(proof, ...scope);
  // Validate a session-issued, document-scoped URL on every read/write. HEAD only:
  // no PDF body passes through this server, and the URL/token is never persisted.
  const response = await (env.SB_FETCH || fetch)(u.href, {
    method: "HEAD",
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/pdf" },
  });
  if (
    !response.ok ||
    !(response.headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/pdf")
  )
    throw fail(
      "StreamBIM kunde inte verifiera dokumentåtkomst. Öppna dokumentet igen. PDF-länken måste stödja signerad HEAD.",
      403,
    );
}
export async function api(request, env) {
  try {
    const url = new URL(request.url),
      actor = request.headers.get("oai-authenticated-user-id");
    if (!actor)
      throw fail(
        "Logga in på Sites för att använda annoteringsdatabasen.",
        401,
      );
    if (url.pathname === "/api/me")
      return json({
        id: actor,
        name:
          request.headers.get("oai-authenticated-user-email") || "Användare",
      });
    if (!env.DB) throw fail("Databasen är inte ansluten.", 503);
    if (
      request.method !== "GET" &&
      request.headers.get("origin") !== url.origin
    )
      throw fail("Otillåtet ursprung.", 403);
    if (url.pathname !== "/api/annotations")
      throw fail("Endast annoteringar kan lagras här.", 404);
    const scope = [
      url.searchParams.get("environment") || "",
      url.searchParams.get("projectId") || "",
      url.searchParams.get("documentId") || "",
    ];
    await authorize(request, env, scope);
    const [environment, projectId, documentId] = scope,
      db = env.DB;
    if (request.method === "GET") {
      const { results } = await db
        .prepare(
          "SELECT * FROM annotations WHERE environment=? AND project_id=? AND document_id=?",
        )
        .bind(...scope)
        .all();
      return json(
        results.map((a) => ({
          ...JSON.parse(a.body),
          id: a.id,
          version: a.version,
          deleted: !!a.deleted,
          createdBy: a.created_by,
          updatedBy: a.updated_by,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        })),
      );
    }
    if (request.method === "POST") {
      const text = await request.text();
      if (text.length > 1500000) throw fail("För stort streck.", 413);
      const b = JSON.parse(text);
      if (
        !/^[a-zA-Z0-9-]{8,100}$/.test(b.operationId) ||
        !/^[a-zA-Z0-9-]{8,100}$/.test(b.id) ||
        !Number.isInteger(b.expectedVersion) ||
        b.expectedVersion < 0 ||
        typeof b.deleted !== "boolean"
      )
        throw fail("Ogiltig operation.");
      const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
        ),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const prior = await db
        .prepare("SELECT * FROM operations WHERE id=?")
        .bind(b.operationId)
        .first();
      if (prior) {
        if (
          prior.actor !== actor ||
          prior.environment !== environment ||
          prior.project_id !== projectId ||
          prior.document_id !== documentId ||
          prior.request_hash !== hash
        )
          throw fail("Operations-ID används redan.", 409);
        return json(JSON.parse(prior.response));
      }
      const a = validateAnnotation(b.annotation),
        now = new Date().toISOString(),
        body = JSON.stringify(a),
        response = JSON.stringify({
          id: b.id,
          version: b.expectedVersion + 1,
          deleted: b.deleted,
          updatedAt: now,
          updatedBy: actor,
        });
      let mutation;
      if (b.expectedVersion === 0) {
        if (b.deleted) throw fail("Kan inte radera ett osparat streck.");
        mutation = db
          .prepare(
            "INSERT OR IGNORE INTO annotations VALUES(?,?,?,?,?,?,1,0,?,?,?,?,?)",
          )
          .bind(
            b.id,
            ...scope,
            a.pageIndex,
            body,
            actor,
            actor,
            now,
            now,
            b.operationId,
          );
      } else
        mutation = db
          .prepare(
            "UPDATE annotations SET body=?,page_index=?,version=version+1,deleted=?,updated_by=?,updated_at=?,last_operation=? WHERE id=? AND environment=? AND project_id=? AND document_id=? AND version=? AND deleted=0",
          )
          .bind(
            body,
            a.pageIndex,
            b.deleted ? 1 : 0,
            actor,
            now,
            b.operationId,
            b.id,
            ...scope,
            b.expectedVersion,
          );
      const receipt = db
        .prepare(
          "INSERT OR IGNORE INTO operations SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM annotations WHERE id=? AND environment=? AND project_id=? AND document_id=? AND last_operation=?)",
        )
        .bind(
          b.operationId,
          ...scope,
          actor,
          hash,
          response,
          b.id,
          ...scope,
          b.operationId,
        );
      await db.batch([mutation, receipt]);
      const done = await db
        .prepare("SELECT * FROM operations WHERE id=?")
        .bind(b.operationId)
        .first();
      if (!done || done.request_hash !== hash || done.actor !== actor)
        throw fail(
          "Annoteringen har ändrats av en annan användare. Din ändring finns kvar i den osparade kön.",
          409,
        );
      return json(JSON.parse(done.response));
    }
    throw fail("Metoden stöds inte.", 405);
  } catch (e) {
    return json(
      { error: e.status ? e.message : "Åtgärden misslyckades. Försök igen." },
      e.status || 500,
    );
  }
}
