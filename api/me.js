import { getSql } from "../server/database.js";
import { createSession } from "../server/session.js";
import { webRequest, send } from "../server/http.js";
export default async function handler(req, res) {
  if (req.method !== "GET")
    return send(res, new Response(null, { status: 405 }));
  try {
    const session = await createSession(webRequest(req), getSql());
    return send(
      res,
      Response.json(
        {
          id: session.actor,
          name: "Besökare " + session.actor.slice(-4),
          databaseReady: true,
          identityType: "browser-session",
        },
        {
          headers: {
            "Cache-Control": "no-store",
            ...(session.cookie ? { "Set-Cookie": session.cookie } : {}),
          },
        },
      ),
    );
  } catch (error) {
    return send(
      res,
      Response.json(
        {
          id: null,
          name: "Läsläge",
          databaseReady: false,
          error: error.status
            ? error.message
            : "Databasanslutningen eller migreringen kunde inte verifieras.",
        },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );
  }
}
