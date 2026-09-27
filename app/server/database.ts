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
  if (!admin) {
    // Supabase's session-mode pooler (5432) caps the whole project at 15 clients, which
    // local dev, scripts and every Vercel instance share. Transaction mode (6543) is built
    // for this; prepare:false below is what it requires.
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".pooler.supabase.com") && parsed.port === "5432") {
      parsed.port = "6543";
      url = parsed.href;
    }
  }
  return postgres(url, {
    ssl: "require",
    max: process.env.VERCEL ? 2 : 8,
    idle_timeout: process.env.VERCEL ? 10 : 300,
    connect_timeout: 15,
    prepare: false,
  });
}
