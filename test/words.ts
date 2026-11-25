/**
 * A writer of Thai number words by the standard rules (as BAHTTEXT and Thai cheques write them),
 * for the round-trip tests. Written for the tests — independent of the reader in src/.
 */
const DIGIT = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACE = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
const MILLION = 1_000_000n;

/** 1 … 999,999. `higher`: something comes before this block (so a final 1 may be เอ็ด). */
function block(n: number, higher: boolean, et: boolean): string {
  const digits = String(n).padStart(6, "0").split("").map(Number);
  let s = "";
  digits.forEach((d, i) => {
    const p = 5 - i;
    if (d === 0) return;
    if (p === 1) s += d === 1 ? "สิบ" : d === 2 ? "ยี่สิบ" : `${DIGIT[d]}สิบ`;
    else if (p === 0) s += d === 1 && (n > 1 || higher) && et ? "เอ็ด" : DIGIT[d];
    else s += DIGIT[d]! + PLACE[p];
  });
  return s;
}

/**
 * Standard Thai words for a whole number. `et`: write a final one after other digits as เอ็ด
 * (สิบเอ็ด, หนึ่งร้อยเอ็ด) — false writes หนึ่ง where that is also correct (หนึ่งร้อยหนึ่ง).
 * After สิบ it is always เอ็ด.
 */
export function thaiWords(n: bigint, et = true): string {
  if (n === 0n) return "ศูนย์";
  const fix = (s: string) => s.replace(/สิบหนึ่ง$/, "สิบเอ็ด");
  if (n < MILLION) return fix(block(Number(n), false, et));
  const rest = n % MILLION;
  return fix(thaiWords(n / MILLION, et) + "ล้าน" + (rest ? block(Number(rest), true, et) : ""));
}

/** As a cheque writes an amount: ...บาทถ้วน or ...บาท...สตางค์. */
export function bahtWords(baht: bigint, satang: number, et = true): string {
  if (satang === 0) return `${thaiWords(baht, et)}บาทถ้วน`;
  const s = `${thaiWords(BigInt(satang), et)}สตางค์`;
  return baht === 0n ? s : `${thaiWords(baht, et)}บาท${s}`;
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
export const thaiDigits = (s: string): string => s.replace(/[0-9]/g, (d) => THAI_DIGITS[Number(d)]!);
export const grouped = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Standard words that end in "multiplier ≥ ร้อย, then 2–9": the spoken shortcut reads these differently. */
export const endsLikeShortcut = (words: string): boolean => /(ร้อย|พัน|หมื่น|แสน|ล้าน)(สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า)$/.test(words);
