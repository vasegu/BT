import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";

export function database(admin = false) {
  const path = new URL("../.env.database.local", import.meta.url);
  const local = existsSync(path) ? parseEnv(readFileSync(path, "utf8")) : {};
  let url = process.env.BT_DATABASE_URL || local.BT_DATABASE_URL;
  if (admin) {
    const pool = new URL(
      readFileSync(
        new URL("../../supabase/.temp/pooler-url", import.meta.url),
        "utf8",
      ).trim(),
    );
    if (!local.SUPABASE_DB_PASSWORD)
      throw new Error("Missing administrative database password");
    pool.password = local.SUPABASE_DB_PASSWORD;
    url = pool.href;
  }
  if (!url)
    throw new Error("Configure the private BT database connection first.");
  return postgres(url, {
    ssl: "require",
    max: process.env.VERCEL ? 2 : 4,
    idle_timeout: process.env.VERCEL ? 10 : 300,
    connect_timeout: 15,
    prepare: false,
  });
}
