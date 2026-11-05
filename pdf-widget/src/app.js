import * as pdfjs from "pdfjs-dist/build/pdf.mjs";
import { StreamBIM } from "./streambim.js";
const sb = new StreamBIM();
import {
  screenToPdf,
  pdfToScreen,
  hitStroke,
  zoomAt,
  pageSignature,
  samePage,
} from "./geometry.js";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
const $ = (id) => document.getElementById(id),
  stage = $("stage"),
  plane = $("plane"),
  canvas = $("pdfCanvas"),
  group = $("strokes");
const S = {
  docs: [],
  doc: null,
  revision: null,
  pdf: null,
  page: null,
  pageIndex: 0,
  viewport: null,
  camera: { x: 0, y: 0, scale: 1 },
  tool: "hand",
  color: "#da654f",
  widths: { pen: 2, highlight: 12 },
  annotations: [],
  selected: null,
  labels: new Set(),
  epoch: 0,
  pageEpoch: 0,
  undo: [],
  redo: [],
  queue: [],
  saving: false,
  me: null,
  pointers: new Map(),
  gesture: null,
  space: false,
  render: null,
  task: null,
  revWarning: "",
  pageWarning: "",
  syncError: "",
  persistence: false,
  storageWarning: "",
};
const colors = [
  ["#da654f", "Korall"],
  ["#d9ae37", "Gul"],
  ["#428d79", "Grön"],
  ["#4384ad", "Blå"],
  ["#615c91", "Lila"],
  ["#263d41", "Grafit"],
];
const queueKey = () => `ritningsbord-outbox-v1:${S.me?.id || "unknown"}`;
function persist() {
  try {
    localStorage.setItem(queueKey(), JSON.stringify(S.queue));
  } catch {
    toast(
      "Det lokala lagringsutrymmet är fullt. Behåll sidan öppen och exportera osparade annoteringar.",
    );
  }
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 4500);
}
function status() {
  const failed = S.queue.some((x) => x.error);
  const q = S.queue.length;
  $("syncStatus").innerHTML =
    `<i class="online-dot"></i>${!S.me ? "Inte ansluten till StreamBIM" : !S.persistence ? "Läsläge · gemensam sparning ej ansluten" : q ? (failed ? "Sparning misslyckades" : `Sparar ${q} ändring${q > 1 ? "ar" : ""}…`) : S.syncError ? "Synkronisering misslyckades" : "Sparat · synkas automatiskt"}`;
  $("syncStatus").classList.toggle("error", failed || !!S.syncError);
  $("retryButton").hidden = !failed;
  $("exportButton").hidden = !q;
  $("undoButton").disabled = !S.undo.length || q > 0;
  $("redoButton").disabled = !S.redo.length || q > 0;
  $("deleteButton").disabled = !selected() || q > 0;
  $("applyStyle").disabled = !selected() || q > 0;
}
async function request(path, options = {}) {
  if (path === "/api/documents") return sb.documents();
  const match = path.match(/^\/api\/documents\/([^/]+)\/(annotations|pdf)/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (match[2] === "pdf") {
      const rid = new URL(path, location.origin).searchParams.get("revision");
      return sb.pdf(
        id,
        S.doc.revisions.find((r) => r.id === rid),
      );
    }
    options = {
      ...options,
      headers: {
        ...options.headers,
        "X-StreamBIM-Download": await sb.proof(id),
      },
    };
    path = sb.annotationPath(id);
  }
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("json") ? await res.json() : null;
  if (!res.ok) {
    const e = new Error(
      body?.error || `Kunde inte slutföra åtgärden (${res.status}).`,
    );
    e.status = res.status;
    throw e;
  }
  return body || res;
}
function selected() {
  return S.annotations.find((a) => a.id === S.selected && !a.deleted);
}
function activeAnnotations() {
  return S.annotations.filter((a) => !a.deleted);
}
function notice() {
  const texts = [S.storageWarning, S.revWarning, S.pageWarning].filter(Boolean);
  $("notice").textContent = texts.join(" ");
  $("notice").hidden = !texts.length;
}
function setTool(tool) {
  if (!S.persistence && tool !== "hand") {
    toast(
      "Gemensam sparning är inte ansluten. Ritverktygen aktiveras när databas och dokumentåtkomst är verifierade.",
    );
    return;
  }
  S.tool = tool;
  S.gesture = null;
  for (const b of document.querySelectorAll("[data-tool]"))
    b.classList.toggle("active", b.dataset.tool === tool);
  stage.dataset.tool = tool;
  $("gestureHint").textContent =
    tool === "hand"
      ? "Dra för att panorera · mushjul för att zooma"
      : "Två fingrar navigerar · mellanslag + dra panorerar";
  renderSizes();
  draw();
}
function renderSizes() {
  const highlight = S.tool === "highlight",
    widths = highlight ? [8, 12, 20] : [1, 2, 4],
    current = S.widths[highlight ? "highlight" : "pen"];
  $("sizes").replaceChildren(
    ...widths.map((w) => {
      const b = document.createElement("button");
      b.className = "size-button" + (w === current ? " active" : "");
      b.setAttribute("aria-label", `${w} PDF-enheter`);
      b.title = `${w} PDF-enheter · bredden följer dokumentets zoom`;
      b.innerHTML = `<i style="height:${Math.min(20, w * S.camera.scale * (S.page?.userUnit || 1))}px"></i><small>${w} pt*</small>`;
      b.onclick = () => {
        S.widths[highlight ? "highlight" : "pen"] = w;
        renderSizes();
      };
      return b;
    }),
  );
}
function renderColors() {
  $("colors").replaceChildren(
    ...colors.map(([c, name]) => {
      const b = document.createElement("button");
      b.className = "color-button" + (S.color === c ? " active" : "");
      b.setAttribute("aria-label", name);
      b.innerHTML = `<i style="background:${c}"></i>`;
      b.onclick = () => {
        S.color = c;
        renderColors();
      };
      return b;
    }),
  );
}
function renderLibrary() {
  const query = $("searchInput").value.toLocaleLowerCase("sv"),
    all = $("labelMode").value === "all";
  const docs = S.docs.filter(
    (d) =>
      d.name.toLocaleLowerCase("sv").includes(query) &&
      (!S.labels.size ||
        (all
          ? [...S.labels].every((x) => d.labels.includes(x))
          : [...S.labels].some((x) => d.labels.includes(x)))),
  );
  $("docCount").textContent = S.docs.length;
  const nodes = docs.map((d) => {
    const b = document.createElement("button");
    b.className = "document-card" + (d.id === S.doc?.id ? " selected" : "");
    const icon = document.createElement("span");
    icon.className = "doc-icon";
    icon.textContent = "PDF";
    const content = document.createElement("span");
    content.className = "doc-text";
    const name = document.createElement("strong");
    name.textContent = d.name.replace(/\.pdf$/i, "");
    const label = document.createElement("small");
    label.textContent = d.labels
      .map((x) => sb.labelNames?.get(x) || x)
      .join(" · ");
    const meta = document.createElement("span");
    meta.className = "doc-meta";
    meta.textContent = `Rev. ${d.revisions[0]?.number || "—"} · ${d.numRevisions || d.revisions.length} revisioner`;
    if (d.annotation_count != null) {
      const count = document.createElement("span");
      count.className = "count-badge";
      count.textContent = `✎ ${d.annotation_count}`;
      meta.append(count);
    }
    content.append(name, label, meta);
    b.append(icon, content);
    b.onclick = () => openDocument(d);
    return b;
  });
  if (!nodes.length) {
    const p = document.createElement("p");
    p.className = "no-results";
    p.textContent = "Inga PDF-filer matchar sökningen.";
    nodes.push(p);
  }
  $("documents").replaceChildren(...nodes);
  const available = [...new Set(S.docs.flatMap((d) => d.labels))].sort();
  $("labels").replaceChildren(
    ...available.map((label) => {
      const b = document.createElement("button");
      b.className = "label-chip" + (S.labels.has(label) ? " active" : "");
      b.textContent = sb.labelNames?.get(label) || label;
      b.setAttribute("aria-pressed", String(S.labels.has(label)));
      b.onclick = () => {
        S.labels.has(label) ? S.labels.delete(label) : S.labels.add(label);
        renderLibrary();
      };
      return b;
    }),
  );
}
async function library() {
  const docs = await request("/api/documents");
  for (const d of docs)
    d.annotation_count = S.docs.find(
      (old) => old.id === d.id,
    )?.annotation_count;
  S.docs = docs;
  renderLibrary();
  if (S.doc) {
    const updated = S.docs.find((d) => d.id === S.doc.id);
    if (updated && updated.revisions[0]?.id !== S.doc.revisions[0]?.id) {
      S.revWarning =
        "En ny revision finns. Din öppna PDF behålls. Välj den nya revisionen när du vill byta.";
      notice();
      updated.revisions = await sb.revisions(updated.id);
      S.doc = updated;
      renderRevisions();
    }
  }
}
function renderRevisions() {
  $("revisionSelect").replaceChildren(
    ...S.doc.revisions.map((r, i) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = `Rev. ${r.number}${i === 0 ? " · senaste" : ""}`;
      return o;
    }),
  );
  $("revisionSelect").value = S.revision?.id || "";
}
async function openDocument(doc, revisionId) {
  const epoch = ++S.epoch;
  try {
    const [fresh, revisions] = await Promise.all([
      sb.document(doc.id),
      sb.revisions(doc.id),
    ]);
    if (epoch !== S.epoch) return;
    doc = { ...doc, revisions, latestId: fresh.latestId };
    if (!revisionId) revisionId = fresh.latestId;
  } catch (e) {
    toast(e.message);
    return;
  }
  ++S.pageEpoch;
  S.task?.destroy();
  S.render?.cancel();
  S.pdf?.destroy();
  S.pdf = null;
  S.page = null;
  S.gesture = null;
  S.pointers.clear();
  S.doc = doc;
  S.revision =
    doc.revisions.find((r) => r.id === revisionId) || doc.revisions[0];
  S.selected = null;
  S.annotations = [];
  S.undo = [];
  S.redo = [];
  S.pageIndex = 0;
  S.revWarning = "";
  S.pageWarning = "";
  notice();
  $("sidebar").classList.remove("open");
  $("documentName").textContent = doc.name;
  $("documentPath").textContent = `RITNINGSBIBLIOTEK / ${doc.labels
    .map((x) => sb.labelNames?.get(x) || x)
    .join(" / ")
    .toUpperCase()}`;
  renderRevisions();
  renderLibrary();
  $("loading").hidden = false;
  $("loading").querySelector("strong").textContent = "Öppnar PDF…";
  plane.hidden = true;
  $("empty").hidden = true;
  draw();
  try {
    const [response, annotations] = await Promise.all([
      request(
        `/api/documents/${encodeURIComponent(doc.id)}/pdf?revision=${encodeURIComponent(S.revision.id)}`,
      ),
      S.me?.databaseReady
        ? request(`/api/documents/${encodeURIComponent(doc.id)}/annotations`)
            .then((records) => {
              if (epoch === S.epoch) {
                S.persistence = true;
                S.storageWarning = "";
              }
              return records;
            })
            .catch((error) => {
              if (epoch === S.epoch) {
                S.persistence = false;
                S.storageWarning = error.message;
                setTool("hand");
              }
              return [];
            })
        : Promise.resolve([]),
    ]);
    if (epoch !== S.epoch) return;
    S.doc.annotation_count = S.persistence
      ? annotations.filter((a) => !a.deleted).length
      : null;
    const card = S.docs.find((d) => d.id === doc.id);
    if (card) card.annotation_count = S.doc.annotation_count;
    renderLibrary();
    let data;
    data = await response.arrayBuffer();
    if (epoch !== S.epoch) return;
    S.task = pdfjs.getDocument({
      data: new Uint8Array(data),
      isEvalSupported: false,
      standardFontDataUrl: "/standard_fonts/",
    });
    const pdf = await S.task.promise;
    if (epoch !== S.epoch) {
      pdf.destroy();
      return;
    }
    S.pdf = pdf;
    S.annotations = annotations;
    overlayPending();
    await showPage(0);
    status();
  } catch (e) {
    if (epoch !== S.epoch) return;
    $("loading").hidden = true;
    S.page = null;
    toast(e.message);
    $("empty").hidden = false;
    $("empty").querySelector("h2").textContent = "PDF-filen kunde inte öppnas";
    $("empty").querySelector("p").textContent = e.message;
  }
}
async function changeRevision(id) {
  if (!S.doc || id === S.revision?.id) return;
  const doc = S.doc;
  await openDocument(doc, id);
  S.revWarning =
    "Revisionsbyte: sidordningen kan ha ändrats. Annoteringar använder samma sidindex och ursprungliga PDF-koordinater. Kontrollera ritningen innan du fortsätter.";
  notice();
}
async function showPage(index) {
  if (!S.pdf) return;
  const oldPage = S.page;
  const oldTask = S.render;
  if (oldPage) {
    Promise.resolve(oldTask?.promise)
      .catch(() => {})
      .finally(() => oldPage.cleanup());
  }
  const pdf = S.pdf,
    epoch = S.epoch,
    pageEpoch = ++S.pageEpoch;
  index = Math.max(0, Math.min(pdf.numPages - 1, index));
  S.render?.cancel();
  S.gesture = null;
  S.selected = null;
  S.page = null;
  plane.hidden = true;
  $("loading").hidden = false;
  const page = await pdf.getPage(index + 1);
  if (epoch !== S.epoch || pageEpoch !== S.pageEpoch) return;
  S.page = page;
  S.pageIndex = index;
  S.viewport = page.getViewport({ scale: 1 });
  plane.style.width = `${S.viewport.width}px`;
  plane.style.height = `${S.viewport.height}px`;
  $("overlay").setAttribute(
    "viewBox",
    `0 0 ${S.viewport.width} ${S.viewport.height}`,
  );
  group.setAttribute("transform", `matrix(${S.viewport.transform.join(" ")})`);
  $("pageInput").value = index + 1;
  $("pageTotal").textContent = `/ ${pdf.numPages}`;
  $("pageInput").max = pdf.numPages;
  $("prevPage").disabled = index === 0;
  $("nextPage").disabled = index === pdf.numPages - 1;
  fit();
  updatePageWarning();
  await raster();
  if (epoch !== S.epoch || pageEpoch !== S.pageEpoch) return;
  $("loading").hidden = true;
  plane.hidden = false;
  draw();
}
function updatePageWarning() {
  if (!S.page) return;
  const mismatch = activeAnnotations().filter(
    (a) =>
      a.pageIndex === S.pageIndex &&
      !samePage(a.pageSignature, pageSignature(S.page)),
  );
  const missing = activeAnnotations().filter(
    (a) => a.pageIndex >= S.pdf.numPages,
  );
  S.pageWarning = [
    mismatch.length
      ? `${mismatch.length} annoteringar skapades med annan sidstorlek, beskärning eller rotation. De ligger kvar på sina PDF-koordinater.`
      : "",
    missing.length
      ? `${missing.length} annoteringar hör till sidor som saknas i denna revision. De bevaras.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  notice();
}
async function raster() {
  if (!S.page || !S.viewport) return;
  S.render?.cancel();
  const epoch = S.epoch,
    pageEpoch = S.pageEpoch,
    page = S.page;
  const base = S.viewport;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const desired = Math.min(4, Math.max(1, S.camera.scale * dpr));
  const maxPixels = 16000000;
  const scale = Math.min(
    desired,
    Math.sqrt(maxPixels / (base.width * base.height)),
  );
  const viewport = page.getViewport({ scale });
  const off = document.createElement("canvas");
  off.width = Math.ceil(viewport.width);
  off.height = Math.ceil(viewport.height);
  const task = page.render({ canvasContext: off.getContext("2d"), viewport });
  S.render = task;
  try {
    await task.promise;
    if (epoch !== S.epoch || pageEpoch !== S.pageEpoch) return;
    canvas.width = off.width;
    canvas.height = off.height;
    canvas.getContext("2d").drawImage(off, 0, 0);
    off.width = off.height = 0;
  } catch (e) {
    if (e.name !== "RenderingCancelledException")
      toast("Sidan kunde inte renderas: " + e.message);
  }
}
function scheduleRaster() {
  clearTimeout(scheduleRaster.timer);
  scheduleRaster.timer = setTimeout(raster, 180);
}
function transform() {
  const c = S.camera;
  plane.style.transform = `translate(${c.x}px,${c.y}px) scale(${c.scale})`;
  $("zoomValue").textContent = `${Math.round(c.scale * 100)}%`;
  renderSizes();
}
function fit() {
  if (!S.viewport) return;
  const r = stage.getBoundingClientRect();
  const scale = Math.max(
    0.08,
    Math.min(
      (r.width - 60) / S.viewport.width,
      (r.height - 110) / S.viewport.height,
    ),
  );
  S.camera = {
    scale,
    x: (r.width - S.viewport.width * scale) / 2,
    y: Math.max(48, (r.height - S.viewport.height * scale) / 2 - 10),
  };
  transform();
  scheduleRaster();
}
function zoom(factor, anchor) {
  if (!S.page) return;
  const r = stage.getBoundingClientRect();
  S.camera = zoomAt(S.camera, anchor || [r.width / 2, r.height / 2], factor);
  transform();
  scheduleRaster();
}
function draw() {
  if (!S.viewport) {
    group.replaceChildren();
    renderAnnotations();
    return;
  }
  const list = activeAnnotations().filter((a) => a.pageIndex === S.pageIndex);
  if (S.gesture?.type === "draw") list.push(S.gesture.annotation);
  group.replaceChildren(
    ...list.map((a) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const pts = a.points;
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0]} ${pts[i][1]}`;
      if (pts.length === 1) d += ` l0.001 0`;
      p.setAttribute("d", d);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", a.color);
      p.setAttribute("stroke-width", a.width);
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      if (a.tool === "highlight") {
        p.setAttribute("opacity", ".32");
        p.style.mixBlendMode = "multiply";
      }
      if (a.id === S.selected) {
        p.setAttribute("stroke-dasharray", `${a.width * 3} ${a.width}`);
      }
      return p;
    }),
  );
  renderAnnotations();
  status();
}
function renderAnnotations() {
  const list = activeAnnotations();
  $("annotationCount").textContent = list.length;
  $("annotationList").replaceChildren(
    ...list.map((a) => {
      const b = document.createElement("button");
      b.className =
        "annotation-item" + (a.id === S.selected ? " selected" : "");
      const c = document.createElement("i");
      c.style.background = a.color;
      const text = document.createElement("span"),
        title = document.createElement("strong"),
        sub = document.createElement("small");
      title.textContent = `${a.tool === "highlight" ? "Överstrykning" : "Pennstreck"} · sida ${a.pageIndex + 1}`;
      sub.textContent = `${a.width} PDF-enh. · ${a.updatedBy?.slice(0, 18) || "sparar…"}`;
      text.append(title, sub);
      b.append(c, text);
      b.onclick = async () => {
        if (a.pageIndex >= S.pdf.numPages) {
          toast("Sidan saknas i den valda revisionen.");
          return;
        }
        if (a.pageIndex !== S.pageIndex) await showPage(a.pageIndex);
        S.selected = a.id;
        setTool("select");
        draw();
      };
      return b;
    }),
  );
}
function localPoint(e) {
  const r = stage.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}
function pdfPoint(e) {
  return screenToPdf(localPoint(e), S.camera, S.viewport);
}
function inside(p) {
  const v = S.page.view;
  return p[0] >= v[0] && p[0] <= v[2] && p[1] >= v[1] && p[1] <= v[3];
}
function pinchState() {
  const ps = [...S.pointers.values()].slice(0, 2),
    a = ps[0],
    b = ps[1];
  return {
    center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
  };
}
stage.addEventListener("pointerdown", (e) => {
  if (!S.page || e.button !== 0) return;
  e.preventDefault();
  stage.focus({ preventScroll: true });
  stage.setPointerCapture(e.pointerId);
  S.pointers.set(e.pointerId, localPoint(e));
  if (S.pointers.size >= 2) {
    if (S.gesture?.type === "move") {
      const a = selected();
      if (a) Object.assign(a, S.gesture.before);
    }
    const p = pinchState();
    S.gesture = { type: "pinch", ...p, camera: { ...S.camera } };
    draw();
    return;
  }
  const point = pdfPoint(e);
  if (!S.persistence && S.tool !== "hand") return;
  if (S.tool === "hand" || S.space) {
    S.gesture = { type: "pan", start: localPoint(e), camera: { ...S.camera } };
    return;
  }
  if (!inside(point)) return;
  if (S.tool === "select") {
    const tol = 14 / (S.camera.scale * (S.page.userUnit || 1));
    const hit = [...activeAnnotations()]
      .reverse()
      .find(
        (a) =>
          a.pageIndex === S.pageIndex &&
          hitStroke(point, a.points, tol + a.width / 2),
      );
    S.selected = hit?.id || null;
    if (hit && !S.queue.length)
      S.gesture = { type: "move", start: point, before: structuredClone(hit) };
    draw();
    return;
  }
  const tool = S.tool;
  S.gesture = {
    type: "draw",
    annotation: {
      id: crypto.randomUUID(),
      pageIndex: S.pageIndex,
      tool,
      color: S.color,
      width: S.widths[tool],
      points: [point],
      createdRevision: S.revision.id,
      pageSignature: pageSignature(S.page),
      version: 0,
    },
  };
  draw();
});
stage.addEventListener("pointermove", (e) => {
  if (!S.pointers.has(e.pointerId) || !S.page) return;
  e.preventDefault();
  S.pointers.set(e.pointerId, localPoint(e));
  const g = S.gesture;
  if (!g) return;
  if (g.type === "pinch" && S.pointers.size >= 2) {
    const p = pinchState();
    const c = zoomAt(g.camera, g.center, p.distance / g.distance);
    c.x += p.center[0] - g.center[0];
    c.y += p.center[1] - g.center[1];
    S.camera = c;
    transform();
    scheduleRaster();
    return;
  }
  if (g.type === "pan") {
    const p = localPoint(e);
    S.camera = {
      ...g.camera,
      x: g.camera.x + p[0] - g.start[0],
      y: g.camera.y + p[1] - g.start[1],
    };
    transform();
    return;
  }
  if (g.type === "draw") {
    for (const ev of e.getCoalescedEvents?.() || [e]) {
      const p = pdfPoint(ev);
      if (inside(p) && g.annotation.points.length < 20000) {
        const prev = g.annotation.points.at(-1);
        if (Math.hypot(prev[0] - p[0], prev[1] - p[1]) > 0.15)
          g.annotation.points.push(p);
      }
    }
    draw();
  }
  if (g.type === "move") {
    const p = pdfPoint(e),
      a = selected();
    if (a)
      a.points = g.before.points.map((q) => [
        q[0] + p[0] - g.start[0],
        q[1] + p[1] - g.start[1],
      ]);
    draw();
  }
});
function endPointer(e, cancel = false) {
  if (!S.pointers.has(e.pointerId)) return;
  const g = S.gesture;
  S.pointers.delete(e.pointerId);
  if (cancel && g?.type === "move") {
    const a = selected();
    if (a) Object.assign(a, g.before);
  }
  if (S.pointers.size > 0) {
    if (g?.type === "move") {
      const a = selected();
      if (a) Object.assign(a, g.before);
    }
    S.gesture = { type: "blocked" };
    draw();
    return;
  }
  S.gesture = null;
  if (!cancel && g?.type === "draw") {
    const a = g.annotation;
    S.annotations.push(a);
    enqueue(a, false);
    S.undo.push({ before: null, after: structuredClone(a) });
    S.redo = [];
  } else if (g?.type === "move") {
    const a = selected();
    if (
      !cancel &&
      a &&
      JSON.stringify(a.points) !== JSON.stringify(g.before.points)
    ) {
      enqueue(a, false);
      S.undo.push({ before: g.before, after: structuredClone(a) });
      S.redo = [];
    }
  }
  draw();
}
stage.addEventListener("pointerup", (e) => endPointer(e));
stage.addEventListener("pointercancel", (e) => endPointer(e, true));
stage.addEventListener("lostpointercapture", (e) => {
  if (S.pointers.has(e.pointerId)) endPointer(e, true);
});
stage.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoom(Math.exp(-e.deltaY * 0.0015), localPoint(e));
  },
  { passive: false },
);
stage.addEventListener("contextmenu", (e) => e.preventDefault());
function resetGesture() {
  if (S.gesture?.type === "move") {
    const a = selected();
    if (a) Object.assign(a, S.gesture.before);
  }
  S.gesture = null;
  S.pointers.clear();
  S.space = false;
  draw();
}
window.addEventListener("blur", resetGesture);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetGesture();
});
window.addEventListener("keydown", (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || $("helpDialog").open)
    return;
  if (e.code === "Space") {
    e.preventDefault();
    S.space = true;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    removeSelected();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    history(e.shiftKey ? "redo" : "undo");
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") S.space = false;
});
function enqueue(a, deleted) {
  const op = {
    operationId: crypto.randomUUID(),
    id: a.id,
    expectedVersion: a.version || 0,
    deleted,
    annotation: structuredClone(a),
    documentId: S.doc.id,
    environment: sb.environment,
    projectId: sb.projectId,
  };
  S.queue.push(op);
  persist();
  status();
  flush();
}
function overlayPending() {
  for (const op of S.queue.filter(
    (q) =>
      q.documentId === S.doc?.id &&
      q.environment === sb.environment &&
      q.projectId === sb.projectId,
  )) {
    const current = S.annotations.find((a) => a.id === op.id);
    const a = { ...op.annotation, deleted: op.deleted };
    if (current) Object.assign(current, a);
    else S.annotations.push(a);
  }
}
async function flush() {
  if (!S.persistence) return;
  if (S.saving) return;
  S.saving = true;
  try {
    while (S.queue.length) {
      const op = S.queue[0];
      if (op.error) break;
      if (op.environment !== sb.environment || op.projectId !== sb.projectId) {
        op.error = "Öppna rätt StreamBIM-projekt för att spara denna ändring.";
        persist();
        break;
      }
      try {
        const { documentId } = op;
        const body = {
          operationId: op.operationId,
          id: op.id,
          expectedVersion: op.expectedVersion,
          deleted: op.deleted,
          annotation: op.annotation,
        };
        const result = await request(
          `/api/documents/${encodeURIComponent(documentId)}/annotations`,
          { method: "POST", body: JSON.stringify(body) },
        );
        S.queue.shift();
        persist();
        if (S.doc?.id === documentId) {
          const a = S.annotations.find((a) => a.id === op.id);
          if (a) Object.assign(a, result);
        }
        status();
      } catch (e) {
        op.error = e.message;
        op.conflict = e.status === 409;
        persist();
        status();
        toast(e.message);
        break;
      }
    }
  } finally {
    S.saving = false;
    draw();
    if (!S.queue.length) library().catch(() => {});
  }
}
async function sync() {
  if (!S.doc || !S.pdf || S.saving || !S.me?.databaseReady) return;
  const epoch = S.epoch,
    id = S.doc.id;
  try {
    const records = await request(
      `/api/documents/${encodeURIComponent(id)}/annotations`,
    );
    if (epoch !== S.epoch) return;
    S.annotations = records;
    overlayPending();
    S.syncError = "";
    S.persistence = true;
    S.storageWarning = "";
    notice();
    updatePageWarning();
    draw();
  } catch (e) {
    S.syncError = e.message;
    status();
  }
}
function removeSelected() {
  const a = selected();
  if (!a || S.queue.length) return;
  const before = structuredClone(a);
  a.deleted = true;
  enqueue(a, true);
  S.undo.push({ before, after: null });
  S.redo = [];
  S.selected = null;
  draw();
}
function history(direction) {
  if (S.queue.length) return;
  const stack = direction === "undo" ? S.undo : S.redo,
    entry = stack.pop();
  if (!entry) return;
  const source = direction === "undo" ? entry.after : entry.before,
    target = direction === "undo" ? entry.before : entry.after;
  if (source) {
    const current = S.annotations.find((a) => a.id === source.id && !a.deleted);
    if (
      !current ||
      JSON.stringify([current.points, current.color, current.width]) !==
        JSON.stringify([source.points, source.color, source.width])
    ) {
      toast(
        "Strecket har ändrats av en annan användare. Ångra kan inte skriva över den ändringen.",
      );
      return;
    }
  }
  if (!target) {
    const current = S.annotations.find((a) => a.id === source.id && !a.deleted);
    if (!current) {
      toast("Strecket har redan ändrats av en annan användare.");
      return;
    }
    current.deleted = true;
    enqueue(current, true);
  } else {
    let current = S.annotations.find((a) => a.id === target.id && !a.deleted);
    if (!source || !current) {
      current = {
        ...structuredClone(target),
        id: crypto.randomUUID(),
        version: 0,
        deleted: false,
      };
      S.annotations.push(current);
      target.id = current.id;
    } else
      Object.assign(current, {
        points: structuredClone(target.points),
        color: target.color,
        width: target.width,
      });
    enqueue(current, false);
  }
  (direction === "undo" ? S.redo : S.undo).push(entry);
  draw();
}
$("searchInput").oninput = renderLibrary;
$("labelMode").onchange = renderLibrary;
$("clearLabels").onclick = () => {
  S.labels.clear();
  renderLibrary();
};
$("refreshButton").onclick = () => library().catch((e) => toast(e.message));
$("revisionSelect").onchange = (e) => changeRevision(e.target.value);
document
  .querySelectorAll("[data-tool]")
  .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
$("zoomIn").onclick = () => zoom(1.25);
$("zoomOut").onclick = () => zoom(0.8);
$("fitButton").onclick = fit;
$("prevPage").onclick = () =>
  showPage(S.pageIndex - 1).catch((e) => toast(e.message));
$("nextPage").onclick = () =>
  showPage(S.pageIndex + 1).catch((e) => toast(e.message));
$("pageInput").onchange = (e) => {
  const n = Number(e.target.value);
  if (Number.isInteger(n) && n >= 1)
    showPage(n - 1).catch((err) => toast(err.message));
};
$("undoButton").onclick = () => history("undo");
$("redoButton").onclick = () => history("redo");
$("deleteButton").onclick = removeSelected;
$("libraryToggle").onclick = () => $("sidebar").classList.toggle("open");
$("annotationToggle").onclick = () =>
  ($("annotationPanel").hidden = !$("annotationPanel").hidden);
$("closePanel").onclick = () => ($("annotationPanel").hidden = true);
$("applyStyle").onclick = () => {
  const a = selected();
  if (!a || S.queue.length) return;
  const before = structuredClone(a);
  a.color = S.color;
  a.width = S.widths[a.tool];
  enqueue(a, false);
  S.undo.push({ before, after: structuredClone(a) });
  S.redo = [];
  draw();
};
$("retryButton").onclick = () => {
  for (const op of S.queue) delete op.error;
  persist();
  flush();
};
$("exportButton").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { format: "ritningsbord-outbox-v1", operations: S.queue },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "osparade-annoteringar.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("copyUrl").onclick = () =>
  navigator.clipboard
    .writeText(location.origin + "/")
    .then(() => toast("Widgetadressen kopierad."));
$("helpButton").onclick = () => $("helpDialog").showModal();
$("closeHelp").onclick = $("startButton").onclick = () =>
  $("helpDialog").close();
new ResizeObserver(() => {
  if (S.page) {
    transform();
    scheduleRaster();
  }
}).observe(stage);
window.addEventListener("online", () => {
  for (const op of S.queue) if (!op.conflict) delete op.error;
  flush();
  sync();
});
window.addEventListener("beforeunload", (e) => {
  if (S.queue.length) {
    e.preventDefault();
    e.returnValue = "";
  }
});
async function init() {
  renderColors();
  renderSizes();
  status();
  try {
    await sb.connect();
    S.me = await request("/api/me");
    if (!S.me.databaseReady) {
      S.persistence = false;
      S.storageWarning =
        S.me.error || "Gemensam databas är inte ansluten i Vercel.";
      notice();
    }
    document.querySelector(".workspace").firstChild.textContent =
      `StreamBIM · projekt ${sb.projectId} `;
    $("avatar").textContent = S.me.name.slice(0, 1).toUpperCase();
    try {
      S.queue = S.me.id
        ? JSON.parse(localStorage.getItem(queueKey()) || "[]")
        : [];
    } catch {
      S.queue = [];
      toast("Den lokala sparningskön kunde inte läsas.");
    }
    await library();
    if (S.docs.length) await openDocument(S.docs[0]);
    else {
      $("loading").hidden = true;
      $("empty").hidden = false;
    }
    flush();
    setInterval(() => {
      if (!document.hidden) sync();
    }, 2500);
    setInterval(() => {
      if (!document.hidden) library().catch(() => {});
    }, 15000);
  } catch (e) {
    $("loading").hidden = true;
    $("documentName").textContent = "Öppna som StreamBIM-widget";
    $("empty").querySelector("h2").textContent =
      "Dina ritningar stannar i StreamBIM.";
    status();
    $("empty").hidden = false;
    $("empty").querySelector("p").textContent = e.message;
    toast(e.message);
  }
}
init();
