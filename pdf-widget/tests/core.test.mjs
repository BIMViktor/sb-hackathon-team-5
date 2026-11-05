import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import {
  api as coreApi,
  validateAnnotation,
  validateProof,
} from "../server/annotations.js";
const api = (request, env) =>
  coreApi(request, { ...env, actor: request.headers.get("x-test-actor") });
import {
  screenToPdf,
  pdfToScreen,
  zoomAt,
  hitStroke,
} from "../src/geometry.js";
import { demoPdf } from "../scripts/fixtures.mjs";
import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const environment = "https://app.streambim.com",
  scope =
    "environment=" +
    encodeURIComponent(environment) +
    "&projectId=42&documentId=1002";
const annotation = {
  pageIndex: 0,
  tool: "pen",
  color: "#123456",
  width: 2,
  points: [
    [10, 20],
    [100, 200],
  ],
  createdRevision: "1002-2",
  pageSignature: { view: [0, 0, 1190, 842], rotation: 0, userUnit: 1 },
};
function adapter(db) {
  return {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return db.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
        execute() {
          return db.prepare(sql).run(...args);
        },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const result = statements.map((s) => s.execute());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
async function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(
    await readFile(new URL("./sqlite-schema.sql", import.meta.url), "utf8"),
  );
  const methods = [];
  return {
    db,
    env: {
      DB: adapter(db),
      SB_FETCH: async (url, opts) => {
        methods.push(opts.method);
        return new Response(null, {
          headers: { "content-type": "application/pdf" },
        });
      },
    },
    methods,
  };
}
function req(method = "GET", body, extra = {}) {
  return new Request("https://widget.test/api/annotations?" + scope, {
    method,
    headers: {
      "x-test-actor": "alice",
      origin: "https://widget.test",
      "x-streambim-download":
        environment + "/project-42/api/v1/documents/1002/2/download?token=test",
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const op = (expectedVersion = 0, deleted = false) => ({
  id: "stroke-12345678",
  operationId: crypto.randomUUID(),
  expectedVersion,
  deleted,
  annotation,
});
test("native PDF coordinates round-trip across rotation, crop, zoom, pan and resize", async () => {
  const pdf = await getDocument({
    data: await demoPdf(2),
    isEvalSupported: false,
  }).promise;
  for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
    const page = await pdf.getPage(pageNumber),
      viewport = page.getViewport({ scale: 1 });
    for (const camera of [
      { scale: 0.3, x: 99, y: -122 },
      { scale: 2.75, x: -981, y: 100 },
      { scale: 1.2, x: 17, y: 38 },
    ]) {
      const p = [page.view[0] + 100, page.view[1] + 150];
      const q = screenToPdf(pdfToScreen(p, camera, viewport), camera, viewport);
      assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9);
      const anchor = [250, 90],
        next = zoomAt(camera, anchor, 1.7);
      const before = screenToPdf(anchor, camera, viewport),
        after = screenToPdf(anchor, next, viewport);
      assert.ok(Math.hypot(before[0] - after[0], before[1] - after[1]) < 1e-9);
    }
  }
  await pdf.destroy();
});
test("generous stroke hit area preserves visible geometry", () => {
  const points = [
      [1, 1],
      [100, 100],
    ],
    copy = structuredClone(points);
  assert.equal(hitStroke([50, 55], points, 8), true);
  assert.deepEqual(points, copy);
});
test("validation rejects corrupt geometry and forged document/environment proofs", () => {
  assert.deepEqual(validateAnnotation(annotation), annotation);
  assert.throws(() =>
    validateAnnotation({ ...annotation, points: [[NaN, 2]] }),
  );
  assert.throws(() =>
    validateProof(
      "https://evil.test/project-42/api/v1/documents/1002/2/download?token=x",
      environment,
      "42",
      "1002",
    ),
  );
  assert.throws(() =>
    validateProof(
      environment + "/project-43/api/v1/documents/1002/2/download?token=x",
      environment,
      "42",
      "1002",
    ),
  );
});
test("save, reload, retry deduplication, authorship, revision independence", async () => {
  const { db, env, methods } = await setup();
  const body = op();
  const first = await api(req("POST", body), env);
  assert.equal(first.status, 200);
  const receipt = await first.json();
  const retry = await api(req("POST", body), env);
  assert.deepEqual(await retry.json(), receipt);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM annotations").get().n, 1);
  const all = await (await api(req(), env)).json();
  assert.deepEqual(all[0].points, annotation.points);
  assert.equal(all[0].createdBy, "alice");
  assert.equal(all[0].createdRevision, "1002-2");
  assert.ok(methods.every((m) => m === "HEAD"));
  assert.deepEqual(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name)
      .sort(),
    ["annotations", "operations"],
  );
  db.close();
});
test("concurrent updates conflict, deletion cannot resurrect; other user sees edits", async () => {
  const { db, env } = await setup();
  assert.equal((await api(req("POST", op()), env)).status, 200);
  const edit = op(1);
  edit.annotation = { ...annotation, color: "#abcdef" };
  assert.equal(
    (await api(req("POST", edit, { "x-test-actor": "bob" }), env)).status,
    200,
  );
  assert.equal((await api(req("POST", op(1)), env)).status, 409);
  let rows = await (await api(req(), env)).json();
  assert.equal(rows[0].updatedBy, "bob");
  assert.equal(rows[0].color, "#abcdef");
  assert.equal((await api(req("POST", op(2, true)), env)).status, 200);
  assert.equal((await api(req("POST", op(3)), env)).status, 409);
  assert.equal((await api(req("POST", op()), env)).status, 409);
  rows = await (await api(req(), env)).json();
  assert.equal(rows[0].deleted, true);
  db.close();
});
test("scope isolation, no unauthenticated writes, no PDF upload endpoints", async () => {
  const { db, env } = await setup();
  await api(req("POST", op()), env);
  const other = req();
  const u = new URL(other.url);
  u.searchParams.set("projectId", "43");
  const result = await api(new Request(u, { headers: other.headers }), env);
  assert.equal(result.status, 403);
  assert.equal(
    (await api(req("GET", null, { "x-test-actor": "" }), env)).status,
    401,
  );
  assert.equal(
    (
      await api(
        new Request("https://widget.test/api/import", {
          headers: { "x-test-actor": "alice" },
        }),
        env,
      )
    ).status,
    404,
  );
  db.close();
});
