// Publish firestore.rules to the live project — with the service account
// already in .env, so no Firebase CLI, no global npm install (which needs
// sudo on a stock macOS node), and no browser login.
//
// Why this exists: the rules file is only a file. Firestore enforces whatever
// was last PUBLISHED, and until 2026-09-17 that was the console's "anyone
// signed in may write anything" default — the repo's rules had never been
// deployed. Publishing must be as easy as running a script, or it won't happen.
//
//   node scripts/deploy-firestore-rules.mjs                 # dry run: diff live vs file
//   node scripts/deploy-firestore-rules.mjs --yes           # compile and publish
//   node scripts/deploy-firestore-rules.mjs --history       # recent rulesets, newest first
//   node scripts/deploy-firestore-rules.mjs --rollback <id> # re-publish an earlier ruleset
//
// Publishing compiles the file server-side first; a syntax error is reported
// with its line and nothing changes. Every publish prints the id of the
// ruleset it replaced, which --rollback takes.

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getSecurityRules } from "firebase-admin/security-rules";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const b64 = env.NUXT_FIREBASE_SERVICE_ACCOUNT;
if (!b64) {
  console.error("NUXT_FIREBASE_SERVICE_ACCOUNT missing from .env");
  process.exit(1);
}
const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
}
const rules = getSecurityRules();

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const history = args.includes("--history");
const rollbackIdx = args.indexOf("--rollback");
const rollbackTo = rollbackIdx >= 0 ? args[rollbackIdx + 1] : null;

const RULES_FILE = new URL("../firestore.rules", import.meta.url);
const project = serviceAccount.project_id;

const live = async () => {
  const ruleset = await rules.getFirestoreRuleset();
  return { ruleset, source: ruleset.source.map((f) => f.content).join("\n") };
};

if (history) {
  const { ruleset: current } = await live();
  const { rulesets } = await rules.listRulesetMetadata(20);
  for (const r of rulesets) {
    console.log(`${r.name === current.name ? "*" : " "} ${r.name}  ${r.createTime}`);
  }
  console.log("\n* = live");
  process.exit(0);
}

if (rollbackTo) {
  const { ruleset: current } = await live();
  if (current.name === rollbackTo) {
    console.log(`${rollbackTo} is already live.`);
    process.exit(0);
  }
  await rules.releaseFirestoreRuleset(rollbackTo);
  console.log(`Published ${rollbackTo} to ${project} (was ${current.name}).`);
  process.exit(0);
}

const local = readFileSync(RULES_FILE, "utf8");
const { ruleset: current, source: liveSource } = await live();
console.log(`Project ${project}. Live ruleset ${current.name} (${current.createTime}).`);

if (liveSource === local) {
  console.log("Live rules already match firestore.rules — nothing to publish.");
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "firestore-rules-"));
const livePath = join(dir, "live.rules");
writeFileSync(livePath, liveSource);
const diff = spawnSync("diff", ["-u", "--label", "live", "--label", "firestore.rules", livePath, RULES_FILE.pathname], {
  encoding: "utf8",
});
const changed = (diff.stdout.match(/^[+-](?![+-])/gm) || []).length;
console.log(`\n${diff.stdout.trim()}\n`);
console.log(`${changed} changed line(s).`);

if (!yes) {
  console.log("\nDry run. Re-run with --yes to publish.");
  process.exit(0);
}

let ruleset;
try {
  ruleset = await rules.createRulesetFromSource({ name: "firestore.rules", content: local });
} catch (e) {
  console.error("\nfirestore.rules did not compile — nothing was published.\n");
  console.error(e?.message || e);
  process.exit(1);
}
await rules.releaseFirestoreRuleset(ruleset);
console.log(`\nPublished ${ruleset.name} to ${project}.`);
console.log(`Roll back with: node scripts/deploy-firestore-rules.mjs --rollback ${current.name}`);
