import {
  add,
  dec,
  type Dec,
  HALF,
  isInteger,
  mul,
  neg,
  ONE,
  pow10,
  toExactNumber,
  toText,
  ZERO,
} from "./decimal.js";
import { isSpace, tokenAt, type Token } from "./tokens.js";

export interface ParseOptions {
  /**
   * Read the spoken shortcut "a digit right after ร้อย / พัน / หมื่น / แสน / ล้าน at the end":
   * สองพันห้า → 2500 (spoken) rather than 2005 (as written out digit by digit). Default true.
   * Either way the other reading is in `alternative`. Formal money text — ending in ถ้วน / ตรง or
   * with สตางค์ — is always read as written (that is what cheques and BAHTTEXT produce).
   */
  spoken?: boolean;
  /** Refuse forms that are understandable but not standard: สองสิบ, หนึ่งสิบ, สิบหนึ่ง, นึง. Default false. */
  strict?: boolean;
}

/** An exact number. */
export interface ExactNumber {
  approx: false;
  /** The value as plain decimal text — exact, any size: "1250", "321.50", "1000000000000". */
  value: string;
  /** The same as a JS number, only when `Number(value)` reads back as the same decimal. */
  number?: number;
  /** "baht" when the words said บาท or สตางค์. */
  unit?: "baht";
  /** Money only: whole baht, e.g. "321". */
  baht?: string;
  /** Money only: satang as two digits, e.g. "50" ("00" for บาทถ้วน). Absent below one satang. */
  satang?: string;
  /** "spoken" when a spoken form decided the value (สองพันห้า → 2500, ล้านครึ่ง, สองครึ่ง). */
  reading: "standard" | "spoken";
  /** When the words have two readings (สองพันห้า: 2500 or 2005), the one NOT chosen. */
  alternative?: string;
}

/** A number that was said approximately. Never carries a made-up exact value. */
export interface ApproxNumber {
  approx: true;
  /**
   * - `more`:    ร้อยกว่า, ห้าพันเศษ — more than the number, less than the next step of its last place
   * - `about`:   ประมาณ / ราว / ราวๆ — around the number, no bounds given
   * - `almost`:  เกือบ — just under the number
   * - `several`: หลายร้อย — 2 × to 10 × the place (exclusive)
   * - `order`:   หลักพัน — the place up to 10 × the place (exclusive)
   */
  kind: "more" | "about" | "almost" | "several" | "order";
  /** The number as said, without the hedge: "100" for ร้อยกว่า. */
  said: string;
  min?: string;
  minInclusive?: boolean;
  max?: string;
  maxInclusive?: boolean;
  unit?: "baht";
}

export type ThaiNumber = ExactNumber | ApproxNumber;

export class ThaiNumberError extends Error {
  override readonly name = "ThaiNumberError";
  constructor(
    message: string,
    /** Where in the input the problem is (UTF-16 offset). */
    readonly index: number,
    readonly input: string,
  ) {
    super(`${message} (at ${index} in "${input}")`);
  }
}

const PLACE_WORD = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    if (isSpace(text[i])) {
      i++;
      continue;
    }
    const t = tokenAt(text, i);
    if (!t) {
      const rest = text.slice(i, i + 12);
      throw new ThaiNumberError(`not a number word: "${rest}${text.length > i + 12 ? "…" : ""}"`, i, text);
    }
    out.push(t);
    i = t.to;
  }
  return out;
}

interface Body {
  value: Dec;
  /** the other reading, when a spoken shortcut applies */
  standard?: Dec | undefined;
  spokenValue?: Dec | undefined;
  spokenForm: boolean;
  /** place value of the last thing said, for กว่า */
  place: Dec;
  /** the same for the spoken reading: a tenth of the multiplier (สองพันห้า → 100) */
  spokenPlace?: Dec | undefined;
  /** only multipliers were said (ร้อย, สิบล้าน): for หลาย / หลัก */
  bare: boolean;
  next: number;
  any: boolean;
}

function readBody(toks: Token[], start: number, input: string, strict: boolean): Body {
  let total = ZERO; // finished million blocks
  let group = ZERO; // current block, below a million
  let pending: { d: Dec; tok: Token } | undefined;
  let lastMult = Infinity; // place exponent of the last สิบ…แสน in this block
  let lastKind: "digit" | "num" | "mult" | "million" | "half" | undefined;
  let lastUnit = ONE; // absolute value of the last multiplier
  let place = ONE;
  let spokenForm = false;
  let bare = true;
  let any = false;
  let i = start;
  const err = (msg: string, t: Token): never => {
    throw new ThaiNumberError(msg, t.from, input);
  };

  for (; i < toks.length; i++) {
    const t = toks[i]!;
    if (t.k === "digit" || t.k === "num") {
      if (pending) {
        const p = pending.tok;
        const hint =
          p.k === "digit" && t.k === "digit" && t.v === p.v + 1
            ? ` ("${p.text}${t.text}" means "${p.text} or ${t.text}", not one number)`
            : "";
        err(`"${t.text}" cannot follow "${p.text}" without ร้อย / พัน / … between them${hint}`, t);
      }
      if (t.k === "digit") {
        if (t.form === "yi" && !(toks[i + 1]?.k === "mult" && (toks[i + 1] as { p: number }).p === 1)) err(`"ยี่" is only used before "สิบ"`, t);
        if (t.form === "et" && !(lastKind === "mult" || lastKind === "million")) err(`"เอ็ด" only ends a number (สิบเอ็ด, ร้อยเอ็ด)`, t);
        if (t.form === "colloquial" && strict) err(`"นึง" is spoken; write "หนึ่ง" (strict mode)`, t);
        if (strict && t.v === 1 && t.form === "plain" && lastKind === "mult" && lastMult === 1) err(`after "สิบ" one is "เอ็ด": สิบเอ็ด (strict mode)`, t);
        pending = { d: dec(t.v), tok: t };
      } else {
        pending = { d: t.d, tok: t };
      }
      bare = false;
      any = true;
      lastKind = t.k;
      continue;
    }
    if (t.k === "mult") {
      const coef = pending?.d ?? ONE;
      const ptok = pending?.tok;
      if (ptok?.k === "digit" && ptok.form === "et") err(`"เอ็ด" cannot come before "${t.text}"`, t);
      if (ptok?.k === "digit" && ptok.v === 0) err(`"ศูนย์${t.text}" is not a number`, t);
      if (t.p >= lastMult) err(`"${t.text}" cannot come after "${PLACE_WORD[lastMult]}" in the same number`, t);
      if (strict && t.p === 1 && ptok?.k === "digit" && (ptok.v === 1 || (ptok.v === 2 && ptok.form !== "yi"))) {
        err(`"${ptok.text}สิบ" is not standard: ${ptok.v === 1 ? "สิบ" : "ยี่สิบ"} (strict mode)`, t);
      }
      const m = dec(pow10(t.p));
      group = add(group, mul(coef, m));
      lastMult = t.p;
      lastUnit = m;
      place = m;
      pending = undefined;
      lastKind = "mult";
      any = true;
      continue;
    }
    if (t.k === "million") {
      // ห้าสิบเอ็ดล้าน: เอ็ด ends the block, and a block can be followed by ล้าน
      let x = add(add(total, group), pending?.d ?? ZERO);
      if (!any) x = ONE;
      lastUnit = lastKind === "million" ? mul(lastUnit, dec(pow10(6))) : dec(pow10(6));
      total = mul(x, dec(pow10(6)));
      group = ZERO;
      pending = undefined;
      lastMult = Infinity;
      place = lastUnit;
      lastKind = "million";
      any = true;
      continue;
    }
    if (t.k === "half") {
      const next = toks[i + 1];
      if (!pending && (next?.k === "mult" || next?.k === "million")) {
        // ครึ่งแสน, ครึ่งล้าน
        pending = { d: HALF, tok: t };
      } else if (!pending && (lastKind === "mult" || lastKind === "million")) {
        // ล้านครึ่ง, พันครึ่ง: and half of that
        const half = mul(lastUnit, HALF);
        if (lastKind === "mult") group = add(group, half);
        else total = add(total, half);
        place = half;
      } else if (pending && isInteger(pending.d) && pending.tok.k !== "half") {
        // สองครึ่ง = 2.5
        pending = { d: add(pending.d, HALF), tok: t };
      } else if (!any && !next) {
        pending = { d: HALF, tok: t };
      } else {
        err(`"ครึ่ง" does not fit here`, t);
      }
      spokenForm = true;
      bare = false;
      any = true;
      lastKind = "half";
      continue;
    }
    if (t.k === "point") {
      // จุด: the digits after it are read one by one
      const intPart = add(add(total, group), pending?.d ?? ZERO);
      if (pending && !isInteger(pending.d)) err(`"จุด" after a number that already has a point`, t);
      let frac = "";
      let j = i + 1;
      for (; j < toks.length; j++) {
        const u = toks[j]!;
        if (u.k === "digit" && u.form !== "et" && u.form !== "yi") frac += String(u.v);
        else if (u.k === "num" && /^[0-9\u0E50-\u0E59]+$/.test(u.text)) frac += toText(u.d).padStart(u.text.length, "0");
        else break;
      }
      if (!frac) err(`"จุด" needs digits after it`, t);
      const value = add(intPart, { n: BigInt(frac), s: frac.length });
      return { value, spokenForm, place: { n: 1n, s: frac.length }, bare: false, next: j, any: true };
    }
    break; // a unit, a hedge or something else: the number ends here
  }

  const value = add(add(total, group), pending?.d ?? ZERO);
  let standard: Dec | undefined;
  let spokenValue: Dec | undefined;
  let spokenPlace: Dec | undefined;
  if (pending) {
    const tok = pending.tok;
    // 2–9 right after a multiplier ≥ ร้อย: สองพันห้า, แสนห้า, ล้านสอง, 2 แสน 5 (not หนึ่ง:
    // หนึ่งร้อยหนึ่ง is 101 as written, and nobody says it for 110)
    const singleDigit =
      (tok.k === "digit" && tok.form === "plain" && tok.v >= 2) || (tok.k === "num" && /^[2-9\u0E52-\u0E59]$/.test(tok.text));
    const at = toks.indexOf(tok);
    const prev = toks[at - 1];
    const afterBig = prev && ((prev.k === "mult" && prev.p >= 2) || prev.k === "million");
    if (singleDigit && afterBig) {
      standard = value;
      spokenValue = add(add(total, group), mul(pending.d, { n: lastUnit.n, s: lastUnit.s + 1 }));
      spokenPlace = { n: lastUnit.n, s: lastUnit.s + 1 };
    }
    // ร้อยนึง, พันนึง, ล้านนึง: spoken "one hundred / one thousand" — the นึง counts the
    // multiplier, it is not one more
    const before = toks[at - 2];
    if (tok.k === "digit" && tok.form === "colloquial" && prev && (prev.k === "mult" || prev.k === "million") && !(before && (before.k === "digit" || before.k === "num"))) {
      standard = value;
      spokenValue = add(total, group);
      spokenPlace = lastUnit;
    }
    place = tok.k === "num" ? placeOf(tok.d) : tok.k === "half" ? HALF : ONE;
  }
  return { value, standard, spokenValue, spokenPlace, spokenForm, place, bare, next: i, any };
}

/** 10^(trailing zeros) of an integer, 10^-decimals of a fraction: the step "กว่า" refers to. */
function placeOf(d: Dec): Dec {
  if (d.s > 0) return { n: 1n, s: d.s };
  if (d.n === 0n) return ONE;
  let k = 0;
  let n = d.n;
  while (n % 10n === 0n) {
    n /= 10n;
    k++;
  }
  return dec(pow10(k));
}

const isPowerOfTen = (d: Dec): boolean => d.s === 0 && /^10*$/.test(d.n.toString());

/**
 * Reads one number written in Thai words (and/or digits) and returns it exactly.
 *
 * ```ts
 * parse("หนึ่งพันสองร้อยห้าสิบบาทถ้วน")      // { approx: false, value: "1250", unit: "baht", baht: "1250", satang: "00", … }
 * parse("สามร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์")   // value "321.50"
 * parse("1.5 ล้าน")                          // value "1500000"
 * parse("ร้อยกว่า")                          // { approx: true, kind: "more", said: "100", min: "100", max: "200", … }
 * ```
 *
 * Throws `ThaiNumberError` (with the offset) for anything that is not one well-formed number.
 */
export function parse(text: string, options: ParseOptions = {}): ThaiNumber {
  const input = text;
  const trimmed = text.trim();
  if (!trimmed) throw new ThaiNumberError("empty input", 0, input);
  const toks = tokenize(text);
  return readNumber(toks, 0, toks.length, input, options);
}

/** Reads toks[start, end) as exactly one number. Shared by parse() and findAll(). */
export function readNumber(toks: Token[], start: number, end: number, input: string, options: ParseOptions): ThaiNumber {
  const strict = options.strict ?? false;
  const useSpoken = options.spoken ?? true;
  const all = toks.slice(0, end);
  let i = start;
  const err = (msg: string, t: Token | undefined): never => {
    throw new ThaiNumberError(msg, t?.from ?? input.length, input);
  };

  let hedge: Extract<Token["k"], "about" | "almost" | "several" | "order"> | undefined;
  const first = all[i];
  if (first && (first.k === "about" || first.k === "almost" || first.k === "several" || first.k === "order")) {
    hedge = first.k;
    i++;
  }
  let negative = false;
  if (all[i]?.k === "minus") {
    negative = true;
    i++;
  }

  const body = readBody(all, i, input, strict);
  i = body.next;
  let more = false;
  if (all[i]?.k === "more") {
    if (!body.any) err(`"${all[i]!.text}" needs a number before it`, all[i]);
    more = true;
    i++;
  }

  // units
  let unit: "baht" | undefined;
  let satang: Dec | undefined;
  let formal = false;
  let value = body.value;
  if (all[i]?.k === "baht") {
    unit = "baht";
    i++;
    if (!body.any) err(`"บาท" needs a number before it`, all[i - 1]);
    if (all[i]?.k === "even") {
      formal = true;
      i++;
    } else if (i < all.length && (all[i]!.k === "digit" || all[i]!.k === "num" || all[i]!.k === "mult")) {
      const s = readBody(all, i, input, strict);
      if (all[s.next]?.k !== "satang") err(`after "บาท" only satang can follow (… สตางค์)`, all[s.next] ?? all[i]);
      if (!isInteger(s.value) || s.value.n > 99n) err(`satang must be a whole number from 0 to 99`, all[i]);
      if (!isInteger(body.value)) err(`a baht amount with a decimal point cannot also have satang`, all[i]);
      satang = s.value;
      formal = true;
      i = s.next + 1;
    }
  } else if (all[i]?.k === "satang") {
    if (!body.any) err(`"สตางค์" needs a number before it`, all[i]);
    if (!isInteger(body.value)) err(`satang must be a whole number`, all[i]);
    unit = "baht";
    satang = body.value;
    value = ZERO;
    formal = true;
    i++;
  } else if (all[i]?.k === "even") {
    err(`"${all[i]!.text}" only follows "บาท"`, all[i]);
  }

  if (i < all.length) {
    const t = all[i]!;
    err(`"${t.text}" cannot come here`, t);
  }
  if (!body.any) err("no number found", all[start]);

  // which reading: spoken shortcut or as written
  let reading: ExactNumber["reading"] = body.spokenForm ? "spoken" : "standard";
  let alternative: Dec | undefined;
  if (body.spokenValue && body.standard && satang === undefined) {
    if (formal || !useSpoken) {
      value = body.standard;
      if (!formal) alternative = body.spokenValue;
    } else {
      value = body.spokenValue;
      alternative = body.standard;
      reading = "spoken";
    }
  }
  const place = reading === "spoken" && body.spokenPlace && value === body.spokenValue ? body.spokenPlace : body.place;
  if (satang !== undefined) value = add(value, { n: satang.n, s: 2 });
  if (negative) {
    value = neg(value);
    if (alternative) alternative = neg(alternative);
  }
  if (negative && (hedge || more)) err(`a negative number cannot be approximate here`, all[start]);

  if (hedge || more) {
    const said = toText(value);
    const out: ApproxNumber = { approx: true, kind: "more", said };
    if (unit) out.unit = unit;
    if (hedge === "several" || hedge === "order") {
      if (!body.bare || !isPowerOfTen(body.value) || more) err(`"${all[start]!.text}" goes with ร้อย / พัน / หมื่น / แสน / ล้าน alone`, all[start]);
      out.kind = hedge;
      out.min = toText(hedge === "several" ? mul(value, dec(2)) : value);
      out.minInclusive = true;
      out.max = toText(mul(value, dec(10)));
      out.maxInclusive = false;
      return out;
    }
    if (more) {
      out.kind = "more";
      out.min = said;
      out.minInclusive = false;
      out.max = toText(add(value, place));
      out.maxInclusive = false;
      return out;
    }
    if (hedge === "almost") {
      out.kind = "almost";
      out.max = said;
      out.maxInclusive = false;
      return out;
    }
    out.kind = "about";
    return out;
  }

  const result: ExactNumber = { approx: false, value: "", reading };
  if (unit === "baht") {
    // money with satang reads with two decimals: 321.50
    const fraction = toText(value).split(".")[1] ?? "";
    result.value = toText(value, fraction.length > 0 && fraction.length <= 2 ? 2 : undefined);
    result.unit = "baht";
    const whole = value.s === 0 ? value : { n: value.n / pow10(value.s), s: 0 };
    result.baht = toText(whole);
    const frac = toText(value).split(".")[1] ?? "";
    if (frac.length <= 2) result.satang = frac.padEnd(2, "0");
  } else {
    result.value = toText(value);
  }
  const n = toExactNumber(value);
  if (n !== undefined) result.number = n;
  if (alternative) result.alternative = toText(alternative);
  return result;
}

