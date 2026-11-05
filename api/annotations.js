export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 410;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      mode: "mock",
      storage: "none",
      error:
        "Mockupen sparar inga annoteringar. Alla markeringar finns endast i flikens arbetsminne.",
    }),
  );
}
