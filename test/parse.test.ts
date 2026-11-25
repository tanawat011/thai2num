import { describe, expect, it } from "vitest";
import { parse, ThaiNumberError } from "../src/index.js";

const value = (text: string, opts?: Parameters<typeof parse>[1]) => {
  const r = parse(text, opts);
  if (r.approx) throw new Error("approx");
  return r.value;
};

describe("parse — the examples from the brief", () => {
  it("baht text", () => {
    expect(parse("หนึ่งพันสองร้อยห้าสิบบาทถ้วน")).toEqual({
      approx: false, value: "1250", number: 1250, unit: "baht", baht: "1250", satang: "00", reading: "standard",
    });
    expect(parse("สามร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์")).toEqual({
      approx: false, value: "321.50", number: 321.5, unit: "baht", baht: "321", satang: "50", reading: "standard",
    });
  });

  it("ล้านล้าน and beyond, exactly", () => {
    expect(value("ล้านล้าน")).toBe("1000000000000");
    expect(value("หนึ่งล้านล้านล้าน")).toBe("1000000000000000000");
    expect(value("หนึ่งล้านห้าแสนล้าน")).toBe("1500000000000");
    expect(value("เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าล้านล้านล้านล้าน")).toBe("999999" + "0".repeat(24));
    const huge = parse("เก้าแสนเก้าหมื่นเก้าพันเก้าร้อยเก้าสิบเก้าล้านล้านล้านล้าน");
    expect(huge.approx === false && huge.number).toBeUndefined(); // not exact as a JS number: none given
  });

  it("เอ็ด and ยี่", () => {
    expect(value("สิบเอ็ด")).toBe("11");
    expect(value("ยี่สิบเอ็ด")).toBe("21");
    expect(value("หนึ่งร้อยเอ็ด")).toBe("101");
    expect(value("หนึ่งร้อยหนึ่ง")).toBe("101");
    expect(value("ห้าสิบเอ็ดล้าน")).toBe("51000000");
    expect(value("หนึ่งล้านเอ็ด")).toBe("1000001");
  });

  it("Thai digits ๐–๙", () => {
    expect(value("๑๒๕๐")).toBe("1250");
    expect(value("๑,๒๕๐.๕๐ บาท")).toBe("1250.50");
    expect(value("๒๕๖๙")).toBe("2569");
  });

  it("digits mixed with words", () => {
    expect(value("1.5 ล้าน")).toBe("1500000");
    expect(value("1.5ล้าน")).toBe("1500000");
    expect(value("2.75 แสน")).toBe("275000");
    expect(value("2 แสน 5")).toBe("250000");
    expect(value("3 หมื่น 2 พัน")).toBe("32000");
    expect(value("12 ล้านบาท")).toBe("12000000");
    expect(value("1,250 บาท")).toBe("1250");
  });

  it("other ordinary forms", () => {
    expect(value("ศูนย์")).toBe("0");
    expect(value("สิบ")).toBe("10");
    expect(value("ร้อย")).toBe("100");
    expect(value("ลบห้า")).toBe("-5");
    expect(value("สามจุดหนึ่งสี่")).toBe("3.14");
    expect(value("ห้าสิบสตางค์")).toBe("0.50");
    expect(value("ศูนย์บาทถ้วน")).toBe("0");
    expect(value("สิบบาทตรง")).toBe("10");
    expect(value("หนึ่ง พัน สอง ร้อย")).toBe("1200"); // spaces are fine
  });
});

describe("parse — spoken shortcuts (each flagged, with the written reading in `alternative`)", () => {
  it("a digit after ร้อย / พัน / หมื่น / แสน / ล้าน is a tenth of it", () => {
    expect(parse("สองพันห้า")).toMatchObject({ value: "2500", reading: "spoken", alternative: "2005" });
    expect(parse("แสนห้า")).toMatchObject({ value: "150000", reading: "spoken", alternative: "100005" });
    expect(parse("ห้าหมื่นสาม")).toMatchObject({ value: "53000", reading: "spoken", alternative: "50003" });
    expect(parse("ล้านสอง")).toMatchObject({ value: "1200000", reading: "spoken", alternative: "1000002" });
    expect(parse("ร้อยห้า")).toMatchObject({ value: "150", reading: "spoken", alternative: "105" });
    expect(parse("2 แสน 5")).toMatchObject({ value: "250000", reading: "spoken", alternative: "200005" });
  });

  it("spoken: false reads them as written, and still says the other reading", () => {
    expect(parse("สองพันห้า", { spoken: false })).toMatchObject({ value: "2005", reading: "standard", alternative: "2500" });
  });

  it("formal money is always read as written", () => {
    expect(parse("สองพันห้าบาทถ้วน")).toMatchObject({ value: "2005", reading: "standard" });
    expect(parse("สองพันห้าบาทถ้วน")).not.toHaveProperty("alternative");
    expect(parse("สองพันห้าบาทห้าสิบสตางค์")).toMatchObject({ value: "2005.50" });
  });

  it("not for หนึ่ง (101) or เอ็ด, nor when a smaller place follows", () => {
    expect(parse("ร้อยเอ็ด")).toMatchObject({ value: "101", reading: "standard" });
    expect(parse("หนึ่งร้อยหนึ่ง")).toMatchObject({ value: "101", reading: "standard" });
    expect(parse("สองพันห้าร้อย")).toMatchObject({ value: "2500", reading: "standard" });
    expect(parse("สองพันห้าสิบ")).toMatchObject({ value: "2050", reading: "standard" });
  });

  it("ร้อยนึง / พันนึง: spoken 'one hundred / one thousand'", () => {
    expect(parse("ร้อยนึง")).toMatchObject({ value: "100", reading: "spoken", alternative: "101" });
    expect(parse("พันนึง")).toMatchObject({ value: "1000", reading: "spoken" });
  });

  it("half: ครึ่งแสน, ครึ่งล้าน, ล้านครึ่ง, พันครึ่ง, สองครึ่ง", () => {
    expect(parse("ครึ่งแสน")).toMatchObject({ value: "50000", reading: "spoken" });
    expect(parse("ครึ่งล้าน")).toMatchObject({ value: "500000", reading: "spoken" });
    expect(parse("ล้านครึ่ง")).toMatchObject({ value: "1500000" });
    expect(parse("สองล้านครึ่ง")).toMatchObject({ value: "2500000" });
    expect(parse("พันครึ่ง")).toMatchObject({ value: "1500" });
    expect(parse("สองครึ่ง")).toMatchObject({ value: "2.5" });
    expect(parse("ครึ่ง")).toMatchObject({ value: "0.5" });
  });
});

describe("parse — approximate numbers are ranges, never a made-up exact value", () => {
  it("กว่า / เศษ: more than the number, below the next step of its last place", () => {
    expect(parse("ร้อยกว่า")).toEqual({ approx: true, kind: "more", said: "100", min: "100", minInclusive: false, max: "200", maxInclusive: false });
    expect(parse("ห้าพันกว่า")).toMatchObject({ approx: true, min: "5000", max: "6000" });
    expect(parse("สามร้อยห้าสิบกว่า")).toMatchObject({ min: "350", max: "360" });
    expect(parse("สิบกว่า")).toMatchObject({ min: "10", max: "20" });
    expect(parse("ล้านกว่า")).toMatchObject({ min: "1000000", max: "2000000" });
    expect(parse("สองพันห้ากว่า")).toMatchObject({ min: "2500", max: "2600" });
    expect(parse("120 กว่า")).toMatchObject({ min: "120", max: "130" });
    expect(parse("สองร้อยกว่าบาท")).toMatchObject({ approx: true, unit: "baht", min: "200", max: "300" });
    expect(parse("พันเศษ")).toMatchObject({ approx: true, kind: "more", min: "1000", max: "2000" });
  });

  it("ประมาณ / ราว / ราวๆ, เกือบ, หลาย, หลัก", () => {
    expect(parse("ประมาณสามพัน")).toEqual({ approx: true, kind: "about", said: "3000" });
    expect(parse("ราวๆ 500")).toMatchObject({ kind: "about", said: "500" });
    expect(parse("เกือบล้าน")).toMatchObject({ kind: "almost", max: "1000000", maxInclusive: false });
    expect(parse("หลายร้อย")).toMatchObject({ kind: "several", min: "200", max: "1000" });
    expect(parse("หลักพัน")).toMatchObject({ kind: "order", min: "1000", minInclusive: true, max: "10000", maxInclusive: false });
    expect(parse("หลักสิบล้าน")).toMatchObject({ kind: "order", min: "10000000", max: "100000000" });
  });

  it("approximate results carry no value and no number", () => {
    const r = parse("ร้อยกว่า");
    expect(r).not.toHaveProperty("value");
    expect(r).not.toHaveProperty("number");
  });
});

describe("parse — invalid input gives a clear error, never a wrong number", () => {
  const bad: Array<[string, RegExp]> = [
    ["", /empty/],
    ["   ", /empty/],
    ["abc", /not a number word/],
    ["สองสาม", /cannot follow.*"สอง or สาม"/],
    ["ร้อยพัน", /"พัน" cannot come after "ร้อย"/],
    ["สิบสิบ", /cannot come after/],
    ["ห้าพันแสน", /cannot come after/],
    ["ยี่ร้อย", /only used before "สิบ"/],
    ["เอ็ดสิบ", /เอ็ด" only ends a number/],
    ["ร้อยเอ็ดพัน", /cannot come before|cannot come after/],
    ["ศูนย์ร้อย", /is not a number/],
    ["หนึ่งบาทสองบาท", /only satang can follow/],
    ["ห้าสิบสตางค์บาท", /cannot come here/],
    ["หนึ่งร้อยบาทหนึ่งร้อยสตางค์", /satang must be a whole number from 0 to 99/],
    ["สามจุด", /needs digits after it/],
    ["บาท", /needs a number before it/],
    ["ถ้วน", /only follows "บาท"/],
    ["กว่า", /needs a number before it/],
    ["ลบ", /no number found/],
    ["หลายสาม", /goes with ร้อย/],
    ["1.2.3", /cannot come here|cannot follow|not a number word/],
    ["แสนดี", /not a number word/],
    ["สองพันห้า คน", /not a number word/],
  ];
  for (const [text, msg] of bad) {
    it(JSON.stringify(text), () => {
      let error: unknown;
      try {
        parse(text);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ThaiNumberError);
      expect((error as ThaiNumberError).message).toMatch(msg);
      expect((error as ThaiNumberError).index).toBeGreaterThanOrEqual(0);
    });
  }

  it("strict mode refuses forms that are understandable but not standard", () => {
    expect(value("สองสิบ")).toBe("20");
    expect(value("หนึ่งสิบ")).toBe("10");
    expect(() => parse("สองสิบ", { strict: true })).toThrow(/ยี่สิบ/);
    expect(() => parse("หนึ่งสิบ", { strict: true })).toThrow(/not standard/);
    expect(() => parse("สิบหนึ่ง", { strict: true })).toThrow(/สิบเอ็ด/);
    expect(() => parse("ร้อยนึง", { strict: true })).toThrow(/หนึ่ง/);
  });
});
