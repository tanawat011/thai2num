import { readNumber, type ParseOptions, type ThaiNumber } from "./parse.js";
import { isSpace, tokenAt, WORDS, type Token } from "./tokens.js";

const DIGIT_WORDS = WORDS.filter(([, k]) => k.k === "digit").map(([w]) => w);

export type Found = ThaiNumber & {
  /** Start in the text, UTF-16 offset (like String.prototype.slice). */
  from: number;
  /** End, exclusive. */
  to: number;
  /** text.slice(from, to) */
  text: string;
};

/**
 * Thai words that begin like a number but are not one. findAll() never starts or continues a
 * number where one of these begins. Not a full Thai word segmenter — see README "Limits".
 */
const NOT_NUMBERS = [
  "สามารถ", "สามี", "สามัญ", "สามัคคี", "สามเณร", "สามานย์", "สี่เหลี่ยม",
  "ห้าม", "ห้าง", "ห้าว", "เก้าอี้", "ยี่ห้อ", "ยี่สุ่น", "ยี่โถ", "หกล้ม", "หกคะเมน", "แปดเปื้อน",
  "สิบเอก", "สิบโท", "สิบตรี", "สิบตำรวจ", "สิบล้อ",
  "ร้อยเอก", "ร้อยโท", "ร้อยตรี", "ร้อยตำรวจ", "ร้อยเวร", "ร้อยละ", "ร้อยเรียง", "ร้อยกรอง", "ร้อยแก้ว", "ร้อยมาลัย",
  "พันธ", "พันเอก", "พันโท", "พันตรี", "พันจ่า", "พันตำรวจ", "พันทิป", "พันลึก", "พันผูก",
  "หมื่นประมาท", "ล้านนา", "ล้านช้าง", "เอ็ดตะโร", "ศูนย์กลาง", "จุดหมาย", "จุดประสงค์",
];

/** Not a number when it STARTS one (the province); หนึ่งร้อยเอ็ด is still 101. */
const NOT_AT_START = ["ร้อยเอ็ด"];

/** Words after which a bare ร้อย / พัน / แสน … or ศูนย์ is still a number: แสนคน, พันปี. */
const COUNTERS = [
  "คน", "ตัว", "อัน", "ชิ้น", "ครั้ง", "ปี", "เดือน", "วัน", "สัปดาห์", "อาทิตย์", "ชั่วโมง", "ชม", "นาที", "วินาที", "โมง", "ทุ่ม",
  "กิโล", "กม", "กก", "เมตร", "ซม", "มม", "ลิตร", "ไร่", "งาน", "ตารางวา", "ตารางเมตร", "องศา",
  "หลัง", "คัน", "เล่ม", "ใบ", "ลูก", "แห่ง", "ที่", "ข้อ", "เท่า", "เปอร์เซ็นต์", "รอบ", "ชุด", "ห้อง", "ชั้น",
  "ขวด", "แก้ว", "จาน", "กล่อง", "ดอก", "ต้น", "เครื่อง", "เรื่อง", "ราย", "ฉบับ", "แบบ", "หน้า", "ส่วน", "หุ้น",
  "คะแนน", "เสียง", "ดาว", "เม็ด", "แผ่น", "เส้น", "คู่", "โหล", "ฟอง", "หน่วย", "ข้าง", "ฝั่ง", "คำ", "บรรทัด",
  "วิว", "ยอด", "ตำแหน่ง", "ประเทศ", "จังหวัด", "ล้อ", "เหรียญ", "ดอลลาร์", "เยน", "ยูโร", "ปอนด์", "หยวน",
];

const startsWithAny = (text: string, i: number, words: readonly string[]) => words.some((w) => text.startsWith(w, i));
const isThaiLetter = (c: string | undefined) => !!c && c >= "ก" && c <= "ฮ";
const isDigitChar = (c: string | undefined) => !!c && /[0-9๐-๙]/.test(c);

/** Tokens that can be part of a number found in running text. */
function canContinue(t: Token): boolean {
  return t.k !== "minus" && t.k !== "about" && t.k !== "almost" && t.k !== "several" && t.k !== "order";
}

/** A token that can open a number at i (with the look-ahead the hedges need). */
function opener(text: string, t: Token): boolean {
  if (t.k === "minus" || t.k === "point" || t.k === "baht" || t.k === "satang" || t.k === "even" || t.k === "more") return false;
  if (t.k === "half") {
    const next = tokenAt(text, t.to);
    return next?.k === "mult" || next?.k === "million";
  }
  if (t.k === "about" || t.k === "almost" || t.k === "several" || t.k === "order") {
    let j = t.to;
    while (isSpace(text[j])) j++;
    const next = tokenAt(text, j);
    return !!next && (next.k === "digit" || next.k === "num" || next.k === "mult" || next.k === "million");
  }
  if (t.k === "num") {
    // not part of 081-234-5678, 25/11/2569, 10:30, 1.2.3, v2, abc123, or a code with a leading zero
    const before = text[t.from - 1];
    const after = text[t.to];
    if (/[A-Za-z0-9_./:-]/.test(before ?? "") || /[A-Za-z_]/.test(after ?? "")) return false;
    if (/[-/:.]/.test(after ?? "") && isDigitChar(text[t.to + 1])) return false;
    if (/^[0๐][0-9๐-๙]/.test(t.text)) return false;
  }
  return true;
}

/**
 * Finds every number written in Thai words or digits in running text.
 *
 * ```ts
 * findAll("ราคาสองพันห้าร้อยบาท ส่งฟรีเมื่อซื้อเกิน 1.5 พัน")
 * // [{ from: 4, to: 20, text: "สองพันห้าร้อยบาท", value: "2500", unit: "baht", … },
 * //  { from: 41, to: 48, text: "1.5 พัน", value: "1500", … }]
 * ```
 *
 * Never throws: text that is not a well-formed number is skipped.
 */
export function findAll(text: string, options: ParseOptions = {}): Found[] {
  const out: Found[] = [];
  let i = 0;
  while (i < text.length) {
    const first = tokenAt(text, i);
    if (!first || !opener(text, first) || startsWithAny(text, i, NOT_NUMBERS) || startsWithAny(text, i, NOT_AT_START)) {
      i += first?.k === "num" ? first.to - first.from : 1;
      continue;
    }
    // collect tokens, spaces allowed between them
    const toks: Token[] = [first];
    let j = first.to;
    for (;;) {
      let k = j;
      while (isSpace(text[k])) k++;
      if (k - j > 1) break; // at most one space inside a number
      const t = tokenAt(text, k);
      if (!t || !canContinue(t) || startsWithAny(text, k, NOT_NUMBERS)) break;
      if (t.k === "num" && (/[A-Za-z_]/.test(text[t.to] ?? "") || (/[-/:.]/.test(text[t.to] ?? "") && isDigitChar(text[t.to + 1])))) break;
      toks.push(t);
      j = t.to;
    }
    // the longest prefix that reads as one number
    let found: Found | undefined;
    for (let end = toks.length; end > 0 && !found; end--) {
      const last = toks[end - 1]!;
      let n: ThaiNumber;
      try {
        n = readNumber(toks, 0, end, text, options);
      } catch {
        continue;
      }
      const from = first.from;
      const to = last.to;
      if (!plausible(text, toks.slice(0, end), to)) continue;
      found = { ...n, from, to, text: text.slice(from, to) };
    }
    if (found) {
      out.push(found);
      i = found.to;
    } else {
      i += first.k === "num" ? first.to - first.from : 1;
    }
  }
  return out;
}

/** Rules for words that are numbers only in some places. */
function plausible(text: string, toks: Token[], to: number): boolean {
  const kinds = toks.map((t) => t.k);
  // สองสามวัน ("two or three days"): two digits back to back are not one number — report neither
  const next = tokenAt(text, to);
  if (next && (next.k === "digit" || next.k === "num")) return false;
  const from = toks[0]!.from;
  if (DIGIT_WORDS.some((w) => text.endsWith(w, from) && from >= w.length) && (toks[0]!.k === "digit" || toks[0]!.k === "num")) return false;
  const after = text[to];
  const endsWord = !isThaiLetter(after) || startsWithAny(text, to, COUNTERS);
  // a bare multiplier (แสนดี, พันผ้า) or ศูนย์ (ศูนย์การค้า) is a number only before a counter,
  // a unit, a space, punctuation or the end
  const bare = kinds.every((k) => k === "mult" || k === "million");
  const zero = toks.length === 1 && toks[0]!.k === "digit" && (toks[0] as { v: number }).v === 0;
  if ((bare || zero) && !endsWord) return false;
  // a number never ends inside a Thai word that is in the exclusion list
  return true;
}
