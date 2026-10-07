// Installs the `~/` resolver before any test module loads.
// Used via `node --import ./test/register.mjs`.
import { register } from "node:module";

register("./alias.mjs", import.meta.url);
