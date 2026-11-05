import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { databaseAdapter, translate } from "../server/database.js";
import {
  createSession,
  findSession,
  cookieToken,
  tokenHash,
} from "../server/session.js";
import { api } from "../pdf-widget/server/annotations.js";
async function setup() {
  const pg = new PGlite();
  await pg.exec(
    await readFile(
      new URL("../migrations/0001_annotations.sql", import.meta.url),
      "utf8",
    ),
  );
  const makeSql = (connection) => {
    const sql = (strings, ...values) =>
      connection
        .query(
          strings.reduce((text, s, i) => text + (i ? "$" + i : "") + s, ""),
          values,
        )
        .then((r) => r.rows);
    sql.unsafe = (text, args = []) =>
      connection.query(text, args).then((r) => r.rows);
    sql.begin = (callback) =>
      connection.transaction((tx) => callback(makeSql(tx)));
    return sql;
  };
  return { pg, sql: makeSql(pg) };
}
const annotation = {
  pageIndex: 0,
  tool: "pen",
  color: "#123456",
  width: 2,
  points: [
    [1, 2],
    [3, 4],
  ],
  createdRevision: "1002-2",
  pageSignature: { view: [0, 0, 595, 842], rotation: 0, userUnit: 1 },
};
const scope =
  "environment=https%3A%2F%2Fapp.streambim.com&projectId=42&documentId=1002";
function request(body) {
  return new Request("https://widget.vercel.app/api/annotations?" + scope, {
    method: body ? "POST" : "GET",
    headers: {
      origin: "https://widget.vercel.app",
      "x-streambim-download":
        "https://app.streambim.com/project-42/api/v1/documents/1002/2/download?token=stub",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("PostgreSQL transactions preserve idempotency, reject stale changes and protect tombstones", async () => {
  const { pg, sql } = await setup();
  try {
    const env = {
      DB: databaseAdapter(sql),
      actor: "alice",
      SB_FETCH: async () =>
        new Response(null, { headers: { "content-type": "application/pdf" } }),
    };
    const operation = {
      id: crypto.randomUUID(),
      operationId: crypto.randomUUID(),
      expectedVersion: 0,
      deleted: false,
      annotation,
    };
    const first = await api(request(operation), env);
    assert.equal(first.status, 200);
    assert.deepEqual(
      await (await api(request(operation), env)).json(),
      await first.json(),
    );
    assert.equal(
      (await pg.query("SELECT COUNT(*)::int n FROM rb_annotations")).rows[0].n,
      1,
    );
    const edit = {
      ...operation,
      operationId: crypto.randomUUID(),
      expectedVersion: 1,
      annotation: { ...annotation, color: "#abcdef" },
    };
    assert.equal(
      (await api(request(edit), { ...env, actor: "bob" })).status,
      200,
    );
    assert.equal(
      (await api(request({ ...edit, operationId: crypto.randomUUID() }), env))
        .status,
      409,
    );
    const del = {
      ...edit,
      operationId: crypto.randomUUID(),
      expectedVersion: 2,
      deleted: true,
    };
    assert.equal((await api(request(del), env)).status, 200);
    assert.equal(
      (
        await api(
          request({
            ...del,
            operationId: crypto.randomUUID(),
            expectedVersion: 3,
            deleted: false,
          }),
          env,
        )
      ).status,
      409,
    );
    const all = await (await api(request(), env)).json();
    assert.equal(all[0].deleted, true);
    assert.deepEqual(all[0].points, annotation.points);
  } finally {
    await pg.close();
  }
});
test("browser sessions use server-issued, hashed, expiring cookies and ignore claimed identity headers", async () => {
  const { pg, sql } = await setup();
  try {
    const initial = new Request("https://widget.vercel.app/api/me");
    const created = await createSession(initial, sql);
    assert.match(created.cookie, /HttpOnly; Secure; SameSite=None/);
    assert.match(created.cookie, /Partitioned/);
    const token = cookieToken(created.cookie);
    assert.ok(token);
    const row = (await pg.query("SELECT * FROM rb_sessions")).rows[0];
    assert.equal(row.token_hash, tokenHash(token));
    assert.notEqual(row.token_hash, token);
    const incoming = new Request(initial.url, {
      headers: { cookie: created.cookie },
    });
    assert.equal(await findSession(incoming, sql), created.actor);
    assert.equal((await createSession(incoming, sql)).cookie, undefined);
    assert.equal(
      await findSession(
        new Request(initial.url, {
          headers: { cookie: "__Host-rb-session=" + "f".repeat(64) },
        }),
        sql,
      ),
      null,
    );
    const forged = new Request(
      "https://widget.vercel.app/api/annotations?" + scope,
      { headers: { "oai-authenticated-user-id": "admin" } },
    );
    assert.equal((await api(forged, { DB: databaseAdapter(sql) })).status, 401);
    await pg.exec(
      "UPDATE rb_sessions SET expires_at=NOW()-INTERVAL '1 second'",
    );
    assert.equal(await findSession(incoming, sql), null);
  } finally {
    await pg.close();
  }
});
test("Postgres adapter numbers parameters and confines tables to the app namespace", () => {
  assert.equal(
    translate("SELECT * FROM annotations WHERE environment=? AND project_id=?"),
    "SELECT * FROM rb_annotations WHERE environment=$1 AND project_id=$2",
  );
  assert.equal(
    translate("INSERT OR IGNORE INTO operations VALUES(?)"),
    "INSERT INTO rb_operations VALUES($1) ON CONFLICT DO NOTHING",
  );
});
