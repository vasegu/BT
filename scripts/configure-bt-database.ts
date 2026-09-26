// One-time local server credential provisioning. Never print connection strings/passwords.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { parseEnv } from "node:util";
import { database } from "../app/server/database.ts";
const path = new URL("../app/.env.database.local", import.meta.url);
const values = parseEnv(readFileSync(path, "utf8"));
if (!values.BT_DATABASE_URL) {
  const db = database(true),
    password = randomBytes(32).toString("hex");
  try {
    await db.unsafe(`alter role bt_runtime password '${password}'`);
  } finally {
    await db.end();
  }
  const url = new URL(
    readFileSync(
      new URL("../supabase/.temp/pooler-url", import.meta.url),
      "utf8",
    ).trim(),
  );
  url.username = `bt_runtime.${values.SUPABASE_PROJECT_REF}`;
  url.password = password;
  writeFileSync(
    path,
    readFileSync(path, "utf8") + `\nBT_DATABASE_URL=${url.href}\n`,
    { mode: 0o600 },
  );
  chmodSync(path, 0o600);
}
const check = database();
try {
  await check`select count(*) from runtime.sessions`;
  console.log(
    "Private presenter connection verified. Browser roles remain denied.",
  );
} finally {
  await check.end();
}
