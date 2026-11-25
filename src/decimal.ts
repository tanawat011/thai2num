/**
 * Exact decimal numbers as a BigInt and a count of digits after the point: { n: 32150n, s: 2 } is
 * 321.50. Enough arithmetic for reading numbers — add, multiply, compare — and nothing is ever
 * rounded, so baht and satang stay exact and huge values keep every digit.
 */
export interface Dec {
  readonly n: bigint;
  readonly s: number;
}

export const ZERO: Dec = { n: 0n, s: 0 };
export const ONE: Dec = { n: 1n, s: 0 };
export const HALF: Dec = { n: 5n, s: 1 };

export const dec = (n: bigint | number, s = 0): Dec => ({ n: BigInt(n), s });

export const pow10 = (k: number): bigint => 10n ** BigInt(k);

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  if (a.s === b.s) return [a.n, b.n, a.s];
  if (a.s > b.s) return [a.n, b.n * pow10(a.s - b.s), a.s];
  return [a.n * pow10(b.s - a.s), b.n, b.s];
}

export function add(a: Dec, b: Dec): Dec {
  const [x, y, s] = align(a, b);
  return { n: x + y, s };
}

export function sub(a: Dec, b: Dec): Dec {
  const [x, y, s] = align(a, b);
  return { n: x - y, s };
}

export const mul = (a: Dec, b: Dec): Dec => ({ n: a.n * b.n, s: a.s + b.s });

export function cmp(a: Dec, b: Dec): number {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export const isZero = (a: Dec): boolean => a.n === 0n;
export const isInteger = (a: Dec): boolean => a.s === 0 || a.n % pow10(a.s) === 0n;
export const neg = (a: Dec): Dec => ({ n: -a.n, s: a.s });

/** Drops trailing zeros after the point. */
export function trim(a: Dec): Dec {
  let { n, s } = a;
  while (s > 0 && n % 10n === 0n) {
    n /= 10n;
    s--;
  }
  return { n, s };
}

/** Plain decimal text, no exponent: "1250", "321.5", "-0.05". `places` pads (never rounds). */
export function toText(a: Dec, places?: number): string {
  let { n, s } = trim(a);
  if (places !== undefined && places > s) {
    n *= pow10(places - s);
    s = places;
  }
  const negative = n < 0n;
  let digits = (negative ? -n : n).toString();
  if (s > 0) {
    digits = digits.padStart(s + 1, "0");
    digits = `${digits.slice(0, -s)}.${digits.slice(-s)}`;
  }
  return negative ? `-${digits}` : digits;
}

/** "1,250.50" or "๑,๒๕๐.๕๐" → Dec. Grouping commas are dropped; the caller checks their shape. */
export function fromDigits(text: string): Dec {
  const ascii = text.replace(/[\u0E50-\u0E59]/g, (d) => String(d.charCodeAt(0) - 0x0e50)).replace(/,/g, "");
  const [int = "0", frac = ""] = ascii.split(".");
  return { n: BigInt((int || "0") + frac), s: frac.length };
}

/** The JS number, but only when it is exactly this value. */
export function toExactNumber(a: Dec): number | undefined {
  const text = toText(a);
  const x = Number(text);
  if (!Number.isFinite(x)) return undefined;
  if (isInteger(a)) {
    const i = trim(a);
    return BigInt(Math.trunc(x)) === i.n / pow10(i.s) && Number.isInteger(x) ? x : undefined;
  }
  // a fraction is exact only if the shortest round-trip text of the double is the same decimal
  return String(x) === text ? x : undefined;
}
