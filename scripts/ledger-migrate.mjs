// Applies server/ledger/migrations/*.sql to the ledger database (Turso), in
// name order, each in its own transaction, and records what ran in
// _ledger_migrations so a migration never runs twice.
//
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/ledger-migrate.mjs           # apply
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/ledger-migrate.mjs --check   # report only
//
// GitHub Actions runs it (.github/workflows/ledger-database.yml). A file: URL
// works too, for a local copy.

import { createClient } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../server/ledger/migrations/", import.meta.url));
const check = process.argv.includes("--check");
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error("TURSO_DATABASE_URL is not set");
  process.exit(1);
}

const client = createClient({ url, authToken });
await client.execute(
  "CREATE TABLE IF NOT EXISTS _ledger_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
);
const applied = new Set((await client.execute("SELECT name FROM _ledger_migrations")).rows.map((r) => r.name));
const files = readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const pending = files.filter((f) => !applied.has(f));

console.log(`Connected. Applied: ${[...applied].join(", ") || "none"}. Pending: ${pending.join(", ") || "none"}.`);
if (check) process.exit(0);

for (const name of pending) {
  const tx = await client.transaction("write");
  try {
    await tx.executeMultiple(readFileSync(dir + name, "utf8"));
    await tx.execute({ sql: "INSERT INTO _ledger_migrations (name, applied_at) VALUES (?, ?)", args: [name, Date.now()] });
    await tx.commit();
    console.log(`Applied ${name}`);
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error(`Failed on ${name}: ${e?.message ?? e}`);
    process.exit(1);
  } finally {
    tx.close();
  }
}

// The schema's chart of accounts is seeded by the migration; show balances as a quick health read.
const balances = await client.execute("SELECT code, SUM(balance_sen) AS sen FROM account_balances GROUP BY code ORDER BY code");
console.log(`Ledger accounts with a balance: ${balances.rows.filter((r) => Number(r.sen) !== 0).length}`);
client.close();
