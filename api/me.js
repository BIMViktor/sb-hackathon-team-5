export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({ mode: "mock", storage: "none", databaseRequired: false }),
  );
}
