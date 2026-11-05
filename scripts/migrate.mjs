import { readFile } from "node:fs/promises";
import { getSql, databaseUrl } from "../server/database.js";
export async function migrate() {
  if (!databaseUrl()) {
    console.log(
      "Ingen DATABASE_URL/POSTGRES_URL: publicerar läsaren med gemensam sparning inaktiverad.",
    );
    return;
  }
  const sql = getSql();
  try {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(6510035)`;
      const migration = await readFile(
        new URL("../migrations/0001_annotations.sql", import.meta.url),
        "utf8",
      );
      for (const statement of migration
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean))
        await tx.unsafe(statement);
    });
    console.log("Annoteringsdatabasen är migrerad.");
  } catch {
    throw new Error(
      "Databasmigrering misslyckades. Kontrollera Vercels servermiljö och databasbehörighet.",
    );
  } finally {
    await sql.end();
  }
}
if (process.argv[1]?.endsWith("migrate.mjs")) await migrate();
