import { isCalibratedPdf } from "./document-filter.js";
import { connect, WindowMessenger } from "penpal";
const allowed =
  /^https:\/\/(app|sweden|japan|australia|staging|dev)\.streambim\.com$/;
export class StreamBIM {
  constructor() {
    this.connection = null;
  }
  async connect() {
    if (window.parent === window)
      throw new Error(
        "Öppna den här adressen som widget i StreamBIM. Projekt och inloggad session hämtas automatiskt därifrån.",
      );
    let origin = location.ancestorOrigins?.[0];
    const listener = (e) => {
      if (e.source === window.parent && allowed.test(e.origin))
        origin = e.origin;
    };
    window.addEventListener("message", listener);
    try {
      this.connection = connect({
        messenger: new WindowMessenger({
          remoteWindow: window.parent,
          allowedOrigins: [allowed],
        }),
        methods: {},
        timeout: 20000,
      });
      this.api = await this.connection.promise;
      this.projectId = String(await this.api.getProjectId());
      if (!/^\d+$/.test(this.projectId) || !allowed.test(origin || ""))
        throw new Error("Kunde inte verifiera StreamBIM-miljön.");
      this.environment = origin;
      this.email = await this.api.getUserEmail();
      this.api.setShowExpandButton(true).catch(() => {});
    } finally {
      window.removeEventListener("message", listener);
    }
  }
  async request(path, options = {}) {
    let raw;
    try {
      raw = await this.api.makeApiRequest({ url: path, ...options });
    } catch {
      throw new Error(
        "StreamBIM-anropet misslyckades: " +
          path.split("?")[0] +
          ". Kontrollera dokumentbehörighet och anslutning.",
      );
    }
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  base() {
    return `/project-${this.projectId}/api/v1`;
  }
  async documents() {
    const [labels, folders] = await Promise.all([
      this.request(this.base() + "/v2/document-labels"),
      this.request(this.base() + "/v2/folders"),
    ]);
    const names = (this.labelNames = new Map(
      (labels.data || []).map((l) => [l.id, l.attributes.name]),
    ));
    const folderMap = new Map((folders.data || []).map((f) => [f.id, f]));
    let skip = 0,
      result = [];
    for (;;) {
      const response = await this.request(
        this.base() +
          `/v2/documents?filter[fileExtensions]=pdf&page[limit]=200&page[skip]=${skip}`,
      );
      if (!Array.isArray(response.data))
        throw new Error("StreamBIM returnerade ingen dokumentlista.");
      for (const d of response.data) {
        if (!isCalibratedPdf(d)) continue;
        const labelIds = new Set(
          (d.relationships?.labels?.data || []).map((l) => l.id),
        );
        let folder = d.relationships?.parent?.data?.id;
        const seen = new Set();
        while (folder && folderMap.has(folder) && !seen.has(folder)) {
          seen.add(folder);
          const f = folderMap.get(folder);
          for (const l of f.relationships?.labels?.data || [])
            labelIds.add(l.id);
          folder = f.relationships?.parent?.data?.id;
        }
        result.push(this.normalize(d, [...labelIds]));
      }
      skip += response.data.length;
      if (response.data.length < 200 || skip >= response.meta?.total) break;
      if (skip >= 10000)
        throw new Error(
          "Biblioteket är för stort för prototypens gräns på 10 000 dokument.",
        );
    }
    return result;
  }
  normalize(d, labels = []) {
    const n = d.attributes.revision,
      rid = d.relationships?.["document-revision"]?.data?.id;
    if (!rid) throw new Error("Dokumentets aktuella revisions-ID saknas.");
    return {
      id: d.id,
      name: d.attributes.filename,
      labels,
      annotation_count: null,
      revisions: [{ id: rid, number: n }],
      latestId: rid,
      numRevisions: d.attributes["num-revisions"],
      calibrationCount:
        d.relationships?.["document-alignments"]?.data?.length || 0,
    };
  }
  async document(id) {
    const response = await this.request(
      this.base() + "/v2/documents/" + encodeURIComponent(id),
    );
    if (!isCalibratedPdf(response.data))
      throw new Error(
        "Dokumentet är inte längre en kalibrerad PDF i StreamBIM.",
      );
    return this.normalize(response.data);
  }
  async revisions(id) {
    const response = await this.request(
      this.base() +
        "/v2/document-revisions?filter[document]=" +
        encodeURIComponent(id),
    );
    return (response.data || [])
      .map((r) => ({
        id: r.id,
        number: r.attributes.revision,
        active: r.attributes["is-active-revision"],
      }))
      .sort((a, b) => b.number - a.number);
  }
  async downloadLink(documentId, revision) {
    const raw = await this.request(
      this.base() +
        `/documents/${encodeURIComponent(documentId)}/downloadlink` +
        (revision ? `?revision=${encodeURIComponent(revision.number)}` : ""),
      { accept: "application/json" },
    );
    const path = typeof raw === "string" ? raw : raw?.data;
    if (typeof path !== "string")
      throw new Error("StreamBIM returnerade ingen nedladdningslänk.");
    let url;
    if (/^https:\/\//.test(path)) url = new URL(path);
    else if (path.startsWith("/project-"))
      url = new URL(path, this.environment);
    else
      url = new URL(
        this.environment + this.base() + "/" + path.replace(/^\//, ""),
      );
    if (
      url.origin !== this.environment ||
      !url.pathname.startsWith(this.base() + `/documents/${documentId}/`)
    )
      throw new Error(
        "Nedladdningslänken ligger utanför dokumentets verifierade StreamBIM-adress.",
      );
    if (!url.searchParams.size) {
      // Same short-lived-token flow used by StreamBIM's storeservice.microtokenUrl.
      const response = await this.request(this.base() + "/microtoken", {
        accept: "application/json",
      });
      if (typeof response?.microtoken !== "string" || !response.microtoken)
        throw new Error(
          "StreamBIM kunde inte utfärda en tillfällig nedladdningslänk.",
        );
      url.searchParams.set("microtoken", response.microtoken);
    }
    return url.href;
  }
  async pdf(documentId, revision) {
    const url = await this.downloadLink(documentId, revision);
    const response = await fetch(url, {
      credentials: "omit",
      cache: "no-store",
      redirect: "follow",
      referrerPolicy: "no-referrer",
    });
    if (
      !response.ok ||
      (response.headers.get("content-type") || "").includes("text/html")
    )
      throw new Error(
        "PDF-binärdata kunde inte hämtas direkt från StreamBIM. Kontrollera signerad länk och CORS för widgetens Vercel-adress.",
      );
    return response;
  }
}
