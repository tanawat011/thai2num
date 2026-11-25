import { fromDigits, type Dec } from "./decimal.js";

export type Token =
  | { k: "digit"; v: number; form: "plain" | "et" | "yi" | "colloquial"; from: number; to: number; text: string }
  | { k: "num"; d: Dec; from: number; to: number; text: string }
  | { k: "mult"; p: number; from: number; to: number; text: string } // สิบ p=1 … แสน p=5
  | { k: "million"; from: number; to: number; text: string }
  | { k: "point" | "half" | "minus" | "baht" | "satang" | "even"; from: number; to: number; text: string }
  | { k: "more"; from: number; to: number; text: string } // กว่า เศษ
  | { k: "about" | "almost" | "several" | "order"; from: number; to: number; text: string };

type WordKind =
  | { k: "digit"; v: number; form: "plain" | "et" | "yi" | "colloquial" }
  | { k: "mult"; p: number }
  | { k: "million" | "point" | "half" | "minus" | "baht" | "satang" | "even" | "more" | "about" | "almost" | "several" | "order" };

/** Every word the reader knows. Longest match wins. */
export const WORDS: ReadonlyArray<[string, WordKind]> = [
  ["ศูนย์", { k: "digit", v: 0, form: "plain" }],
  ["หนึ่ง", { k: "digit", v: 1, form: "plain" }],
  ["นึง", { k: "digit", v: 1, form: "colloquial" }], // spoken spelling of หนึ่ง: ร้อยนึง
  ["เอ็ด", { k: "digit", v: 1, form: "et" }], // 1 in the units place: สิบเอ็ด, ร้อยเอ็ด
  ["สอง", { k: "digit", v: 2, form: "plain" }],
  ["ยี่", { k: "digit", v: 2, form: "yi" }], // 2 in the tens place: ยี่สิบ
  ["สาม", { k: "digit", v: 3, form: "plain" }],
  ["สี่", { k: "digit", v: 4, form: "plain" }],
  ["ห้า", { k: "digit", v: 5, form: "plain" }],
  ["หก", { k: "digit", v: 6, form: "plain" }],
  ["เจ็ด", { k: "digit", v: 7, form: "plain" }],
  ["แปด", { k: "digit", v: 8, form: "plain" }],
  ["เก้า", { k: "digit", v: 9, form: "plain" }],
  ["สิบ", { k: "mult", p: 1 }],
  ["ร้อย", { k: "mult", p: 2 }],
  ["พัน", { k: "mult", p: 3 }],
  ["หมื่น", { k: "mult", p: 4 }],
  ["แสน", { k: "mult", p: 5 }],
  ["ล้าน", { k: "million" }],
  ["จุด", { k: "point" }],
  ["ครึ่ง", { k: "half" }],
  ["ลบ", { k: "minus" }],
  ["บาท", { k: "baht" }],
  ["สตางค์", { k: "satang" }],
  ["ถ้วน", { k: "even" }],
  ["ตรง", { k: "even" }],
  ["กว่า", { k: "more" }],
  ["เศษ", { k: "more" }],
  ["ประมาณ", { k: "about" }],
  ["ราวๆ", { k: "about" }],
  ["ราว ๆ", { k: "about" }],
  ["ราว", { k: "about" }],
  ["เกือบ", { k: "almost" }],
  ["หลาย", { k: "several" }],
  ["หลัก", { k: "order" }],
];

const BY_LENGTH = [...WORDS].sort((a, b) => b[0].length - a[0].length);

/** 1250, 1,250.50, ๑,๒๕๐.๕๐ — grouping commas only in threes. */
const DIGITS = /[0-9\u0E50-\u0E59]+(?:,[0-9\u0E50-\u0E59]{3})*(?:\.[0-9\u0E50-\u0E59]+)?/y;

export const isSpace = (c: string | undefined): boolean => c === " " || c === "\u00A0" || c === "\t" || c === "\u200B";

/** The token starting exactly at `i`, or undefined. */
export function tokenAt(text: string, i: number): Token | undefined {
  DIGITS.lastIndex = i;
  const m = DIGITS.exec(text);
  if (m) {
    let t = m[0];
    // a grouped number's first group has one to three digits ("1,250", not "12345,678")
    if (t.includes(",") && !/^[0-9\u0E50-\u0E59]{1,3},/.test(t)) t = t.slice(0, t.indexOf(","));
    return { k: "num", d: fromDigits(t), from: i, to: i + t.length, text: t };
  }
  for (const [word, kind] of BY_LENGTH) {
    if (text.startsWith(word, i)) {
      return { ...kind, from: i, to: i + word.length, text: word } as Token;
    }
  }
  return undefined;
}
