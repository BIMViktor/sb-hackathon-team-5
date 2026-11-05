import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SessionAnnotations } from "../pdf-widget/src/session-annotations.js";
import { isCalibratedPdf } from "../pdf-widget/src/document-filter.js";
import { StreamBIM } from "../pdf-widget/src/streambim.js";
import annotations from "../api/annotations.js";
test("mock annotations are volatile, scoped by environment/project/document and shared across revisions", () => {
  const session = new SessionAnnotations();
  const records = session.forDocument(
    "https://app.streambim.com",
    "42",
    "1002",
  );
  records.push({
    id: "stroke",
    createdRevision: "1002-1",
    points: [[5, 10]],
    deleted: false,
  });
  assert.equal(
    session.forDocument("https://app.streambim.com", "42", "1002"),
    records,
  );
  assert.equal(session.count("https://app.streambim.com", "42", "1002"), 1);
  assert.equal(
    session.forDocument("https://app.streambim.com", "43", "1002").length,
    0,
  );
  assert.equal(
    session.forDocument("https://sweden.streambim.com", "42", "1002").length,
    0,
  );
  assert.equal(
    new SessionAnnotations().forDocument(
      "https://app.streambim.com",
      "42",
      "1002",
    ).length,
    0,
  );
});
test("calibration requires a document alignment, not merely a scale value", () => {
  const d = {
    attributes: { filename: "Plan.PDF", scale: 100 },
    relationships: { "document-alignments": { data: [] } },
  };
  assert.equal(isCalibratedPdf(d), false);
  d.relationships["document-alignments"].data.push({
    id: "1002-1000",
    type: "document-alignments",
  });
  assert.equal(isCalibratedPdf(d), true);
  assert.equal(
    isCalibratedPdf({ ...d, attributes: { filename: "Plan.ifc" } }),
    false,
  );
  assert.equal(
    isCalibratedPdf({
      ...d,
      attributes: { filename: "Plan.pdf", "is-deleted": true },
    }),
    false,
  );
  assert.equal(
    isCalibratedPdf({ attributes: { filename: "Plan.pdf", scale: 100 } }),
    false,
  );
});
test("StreamBIM document adapter keeps only aligned PDFs and preserves label IDs", async () => {
  const client = new StreamBIM();
  client.projectId = "42";
  const doc = (id, filename, aligned) => ({
    id,
    attributes: { filename, revision: 2, "num-revisions": 2 },
    relationships: {
      "document-revision": { data: { id: id + "-2" } },
      "document-alignments": { data: aligned ? [{ id: id + "-1000" }] : [] },
      labels: { data: [{ id: "label-1" }] },
    },
  });
  client.request = async (path) =>
    path.includes("document-labels")
      ? { data: [{ id: "label-1", attributes: { name: "Arkitekt" } }] }
      : path.includes("/folders")
        ? { data: [] }
        : {
            data: [
              doc("1", "Plan.pdf", true),
              doc("2", "Uncalibrated.pdf", false),
              doc("3", "Model.ifc", true),
            ],
          };
  const list = await client.documents();
  assert.deepEqual(
    list.map((d) => d.id),
    ["1"],
  );
  assert.deepEqual(list[0].labels, ["label-1"]);
  assert.equal(list[0].latestId, "1-2");
});
test("previous revision and unsigned download paths use observed StreamBIM endpoints", async () => {
  const client = new StreamBIM();
  client.projectId = "42";
  client.environment = "https://app.streambim.com";
  const calls = [];
  client.request = async (path) => {
    calls.push(path);
    return path.endsWith("/microtoken")
      ? { microtoken: "temporary-token" }
      : "documents/1002/download/plan.pdf";
  };
  const url = await client.downloadLink("1002", { number: 1 });
  assert.equal(
    calls[0],
    "/project-42/api/v1/documents/1002/downloadlink?revision=1",
  );
  assert.equal(calls[1], "/project-42/api/v1/microtoken");
  assert.equal(new URL(url).searchParams.get("microtoken"), "temporary-token");
});
test("mock client has no persistent annotation storage and server rejects annotation writes", async () => {
  const source = await readFile(
    new URL("../pdf-widget/src/app.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /localStorage|indexedDB|sessionStorage|\/api\/me|\/api\/annotations/,
  );
  let response;
  const res = {
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(value) {
      response = JSON.parse(value);
    },
  };
  annotations({ method: "POST", body: { points: [[1, 2]] } }, res);
  assert.equal(res.statusCode, 410);
  assert.equal(response.storage, "none");
  assert.equal(response.mode, "mock");
});
