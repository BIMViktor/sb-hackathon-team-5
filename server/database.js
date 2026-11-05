import postgres from "postgres";
let client;
export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}
export function getSql() {
  if (!databaseUrl())
    throw Object.assign(
      new Error(
        "Ingen gemensam databas är ansluten. Projektägaren behöver ange DATABASE_URL eller POSTGRES_URL i Vercel och göra en ny deployment.",
      ),
      { status: 503 },
    );
  return (client ??= postgres(databaseUrl(), {
    max: 3,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  }));
}
export function translate(sql) {
  let index = 0;
  let text = sql
    .replace(/\bannotations\b/g, "rb_annotations")
    .replace(/\boperations\b/g, "rb_operations")
    .replace(/\?/g, () => `$${++index}`);
  if (text.includes("INSERT OR IGNORE"))
    text =
      text.replace("INSERT OR IGNORE", "INSERT") + " ON CONFLICT DO NOTHING";
  return text;
}
export function databaseAdapter(client) {
  return {
    prepare(text) {
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return (await client.unsafe(translate(text), args))[0] || null;
        },
        async all() {
          return { results: await client.unsafe(translate(text), args) };
        },
        run(tx) {
          return tx.unsafe(translate(text), args);
        },
      };
    },
    batch(statements) {
      return client.begin(async (tx) => {
        const results = [];
        for (const s of statements) results.push(await s.run(tx));
        return results;
      });
    },
  };
}
