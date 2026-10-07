// Does every file actually import what it uses?
//
// This exists because the production build says yes when the answer is no.
// It resolves imports and compiles templates, but a bare identifier that
// resolves to nothing is valid JavaScript until it runs — so both of these
// shipped green and crashed the page on open:
//
//   layouts/seller.vue      SHEETS read IconMore before its const  (TDZ)
//   composables/useSellerOrders.ts
//                           withoutMergedChildren used, never imported
//
// The second was worse: an import I added by string-anchoring on
// `import { computed` silently did nothing, because Nuxt auto-imports
// `computed` and that line does not exist. The code looked right in the diff.
//
// Nuxt auto-imports composables/ and components/, but NOT shared/ — so shared
// is exactly where a missing import becomes a runtime ReferenceError.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const walk = (dir: string, out: string[] = []): string[] => {
  let entries: string[];
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = `${dir}/${e}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(vue|ts)$/.test(e)) out.push(rel);
  }
  return out;
};

/** Every value exported from shared/ — the modules Nuxt will not auto-import. */
const sharedExports = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const f of readdirSync(join(ROOT, "shared"))) {
    if (!f.endsWith(".ts")) continue;
    const src = readFileSync(join(ROOT, "shared", f), "utf8");
    // Values only. A type used without importing it is a compile concern,
    // not a crash.
    const names = [...src.matchAll(/^export const (\w+)/gm)].map((m) => m[1]!);
    if (names.length) map.set(f.replace(/\.ts$/, ""), names);
  }
  return map;
};

const importedNames = (body: string): Set<string> => {
  const out = new Set<string>();
  for (const m of body.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from/g)) {
    for (const raw of m[1]!.split(",")) {
      const n = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!.trim();
      if (n) out.add(n);
    }
  }
  // `export { X } from "..."` is a re-export, not a use.
  for (const m of body.matchAll(/export\s*\{([^}]*)\}\s*from/g)) {
    for (const raw of m[1]!.split(",")) out.add(raw.trim().split(/\s+as\s+/)[0]!.trim());
  }
  return out;
};

describe("every shared/ identifier is imported where it is used", () => {
  const shared = sharedExports();
  const files = [
    ...walk("pages"),
    ...walk("components"),
    ...walk("composables"),
    ...walk("layouts"),
    ...walk("middleware"),
    ...walk("server"),
  ];

  it("finds files to check", () => {
    assert.ok(files.length > 50, `only found ${files.length} files`);
    assert.ok(shared.size > 5, `only found ${shared.size} shared modules`);
  });

  it("has no identifier used without an import", () => {
    const missing: string[] = [];

    for (const rel of files) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      // For an SFC only the script block can reference an identifier this way;
      // the template resolves against the component's own bindings.
      const body = src.includes("<script setup")
        ? src.slice(src.indexOf("<script setup"))
        : src;
      const have = importedNames(body);
      // A file that declares the name itself is not missing an import — it
      // has its own. shared/buyer-qr and server/utils/auth-codes both export
      // a normaliseEmail, and neither is wrong.
      for (const m of body.matchAll(/(?:^|\s)(?:export\s+)?(?:const|function|let|class)\s+(\w+)/g)) {
        have.add(m[1]!);
      }
      // Locals inside a function body count too.
      for (const m of body.matchAll(/\b(?:const|let)\s+(\w+)\s*[:=]/g)) have.add(m[1]!);

      for (const [mod, names] of shared) {
        for (const name of names) {
          if (have.has(name)) continue;
          // A call or a value position, ignoring comments and property access.
          const used = new RegExp(`(?<![\\w.$])${name}\\s*[(,)\\]};.]`);
          for (const line of body.split("\n")) {
            const t = line.trim();
            if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
            if (used.test(line)) {
              missing.push(`${rel} uses ${name} (shared/${mod}) without importing it`);
              break;
            }
          }
        }
      }
    }

    assert.deepEqual(missing, [], `\n  ${missing.join("\n  ")}\n`);
  });
});
