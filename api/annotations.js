import { api } from "../pdf-widget/server/annotations.js";
import { getSql, databaseAdapter } from "../server/database.js";
import { findSession } from "../server/session.js";
import { webRequest, send, errorResponse } from "../server/http.js";
export default async function handler(req, res) {
  try {
    const request = webRequest(req),
      sql = getSql(),
      actor = await findSession(request, sql);
    return send(res, await api(request, { DB: databaseAdapter(sql), actor }));
  } catch (error) {
    return send(res, errorResponse(error));
  }
}
