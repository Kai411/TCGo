// Postcode → state, used to pre-fill the State field on address forms.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MY_STATES, stateForPostcode } from "~/shared/my-states";

describe("stateForPostcode", () => {
  it("knows the common cities", () => {
    const cases: [string, string][] = [
      ["47300", "sgr"], // Petaling Jaya
      ["50450", "kul"], // Kuala Lumpur
      ["10200", "png"], // George Town
      ["80000", "jhr"], // Johor Bahru
      ["88000", "sbh"], // Kota Kinabalu
      ["93050", "srw"], // Kuching
      ["62000", "pjy"], // Putrajaya
      ["63000", "sgr"], // Cyberjaya
      ["39000", "phg"], // Cameron Highlands
      ["75000", "mlk"], // Melaka
      ["01000", "pls"], // Kangar
      ["87000", "lbn"], // Labuan
    ];
    for (const [pc, code] of cases) assert.equal(stateForPostcode(pc), code, pc);
  });

  it("only answers with codes the forms offer", () => {
    const codes = new Set(MY_STATES.map((s) => s.code));
    for (let n = 0; n < 100; n++) {
      const code = stateForPostcode(String(n).padStart(2, "0") + "000");
      if (code) assert.ok(codes.has(code), `${n} -> ${code}`);
    }
  });

  it("stays quiet until there are five digits", () => {
    for (const pc of ["", "473", "4730a", "473001", undefined, null]) {
      assert.equal(stateForPostcode(pc as string), null);
    }
  });

  it("stays quiet on prefixes nobody uses", () => {
    assert.equal(stateForPostcode("99000"), null);
    assert.equal(stateForPostcode("03000"), null);
  });
});
