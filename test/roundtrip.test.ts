import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parse, type ExactNumber } from "../src/index.js";
import { bahtWords, endsLikeShortcut, grouped, thaiDigits, thaiWords } from "./words.js";

const exact = (text: string, opts?: Parameters<typeof parse>[1]): ExactNumber => {
  const r = parse(text, opts);
  if (r.approx) throw new Error(`approx for ${text}`);
  return r;
};

/** Whole numbers from 0 to 10^30, weighted toward the shapes that matter. */
const wholeNumbers = fc.oneof(
  fc.bigInt({ min: 0n, max: 999n }),
  fc.bigInt({ min: 0n, max: 9_999_999n }),
  fc.bigInt({ min: 0n, max: 10n ** 30n }),
  // mostly zeros: 1000005, 20000000300 … the hard cases for ล้าน and เอ็ด
  fc.array(fc.constantFrom(0, 0, 0, 0, 0, 1, 2, 5, 9), { minLength: 1, maxLength: 30 }).map((ds) => BigInt(ds.join("") || "0")),
);

describe("round trip: standard words → exact value", () => {
  it("money as a cheque writes it (บาทถ้วน / สตางค์), thousands of values", () => {
    fc.assert(
      fc.property(wholeNumbers, fc.integer({ min: 0, max: 99 }), fc.boolean(), (baht, satang, et) => {
        const text = bahtWords(baht, satang, et);
        const r = exact(text);
        const want = satang === 0 ? baht.toString() : `${baht}.${String(satang).padStart(2, "0")}`;
        expect(r.value, text).toBe(want);
        expect(r.unit).toBe("baht");
        expect(r.baht).toBe(baht.toString());
        expect(r.satang).toBe(String(satang).padStart(2, "0"));
        expect(r.reading).toBe("standard");
        expect(r.alternative).toBeUndefined();
      }),
      { numRuns: 4000 },
    );
  });

  it("plain numbers with spoken: false read exactly as written", () => {
    fc.assert(
      fc.property(wholeNumbers, fc.boolean(), (n, et) => {
        const text = thaiWords(n, et);
        expect(exact(text, { spoken: false }).value, text).toBe(n.toString());
      }),
      { numRuns: 4000 },
    );
  });

  it("plain numbers with the default (spoken) reading: the written value is the value or the alternative", () => {
    fc.assert(
      fc.property(wholeNumbers, (n) => {
        const text = thaiWords(n);
        const r = exact(text);
        if (endsLikeShortcut(text)) {
          expect(r.reading, text).toBe("spoken");
          expect(r.alternative, text).toBe(n.toString());
        } else {
          expect(r.value, text).toBe(n.toString());
          expect(r.alternative, text).toBeUndefined();
        }
      }),
      { numRuns: 4000 },
    );
  });

  it("digits: Arabic and Thai, with and without grouping commas, with baht and satang", () => {
    fc.assert(
      fc.property(wholeNumbers, fc.integer({ min: 0, max: 99 }), fc.boolean(), fc.boolean(), (n, satang, thai, commas) => {
        let text = commas ? grouped(n) : n.toString();
        if (satang) text += `.${String(satang).padStart(2, "0")}`;
        text += " บาท";
        if (thai) text = thaiDigits(text);
        const r = exact(text);
        expect(r.value, text).toBe(satang ? `${n}.${String(satang).padStart(2, "0")}` : n.toString());
      }),
      { numRuns: 3000 },
    );
  });

  it("a JS number is given only when it is exact", () => {
    fc.assert(
      fc.property(wholeNumbers, (n) => {
        const r = exact(n.toString());
        if (r.number !== undefined) expect(BigInt(r.number)).toBe(n);
        if (n <= BigInt(Number.MAX_SAFE_INTEGER)) expect(r.number).toBe(Number(n));
      }),
      { numRuns: 2000 },
    );
  });

  it("decimals × multipliers stay exact (1.5 ล้าน, 2.75 แสน)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999 }), fc.integer({ min: 1, max: 3 }), fc.constantFrom(["ล้าน", 6], ["แสน", 5], ["หมื่น", 4], ["พัน", 3]), (int, places, [word, p]) => {
        const frac = String(int % 10 ** places).padStart(places, "0");
        const whole = Math.floor(int / 10 ** places);
        const text = `${whole}.${frac} ${word}`;
        const want = (BigInt(`${whole}${frac}`) * 10n ** BigInt(Number(p) - places)).toString();
        expect(exact(text).value, text).toBe(want); // p ≥ 3 ≥ places: always a whole number
      }),
      { numRuns: 2000 },
    );
  });
});
