// Teaches Node's loader the `~/` alias that Nuxt resolves for us everywhere
// else, so shared/*.ts can be imported by the test runner unchanged.
//
// Without this the modules under test would have to be copied and rewritten
// before every run, which is how they were being verified before — and a copy
// is not the thing that ships.
//
// Two jobs: map `~/x` to `<repo>/x`, and add the `.ts` extension that the
// source omits (Nuxt's bundler fills it in; bare Node does not).

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("~/")) return next(specifier, context);

  const target = new URL(specifier.slice(2), root);
  if (!/\.[cm]?[jt]s$/.test(target.pathname)) {
    for (const ext of [".ts", ".mjs", ".js"]) {
      const withExt = new URL(target.href + ext);
      if (existsSync(fileURLToPath(withExt))) {
        return next(withExt.href, context);
      }
    }
  }
  return next(target.href, context);
}
