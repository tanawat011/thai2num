import { describe, expect, it } from "vitest";
import { findAll } from "../src/index.js";

const brief = (text: string) =>
  findAll(text).map((f) => (f.approx ? `${f.text}≈(${f.min ?? ""},${f.max ?? ""})` : `${f.text}=${f.value}`));

describe("findAll", () => {
  it("finds numbers in words and digits, with offsets", () => {
    const text = "ราคาสองพันห้าร้อยบาท ส่งฟรีเมื่อซื้อเกิน 1.5 พัน";
    const found = findAll(text);
    expect(found.map((f) => [f.text, f.approx ? null : f.value])).toEqual([
      ["สองพันห้าร้อยบาท", "2500"],
      ["1.5 พัน", "1500"],
    ]);
    for (const f of found) expect(text.slice(f.from, f.to)).toBe(f.text);
  });

  it("money with satang, Thai digits, huge values", () => {
    expect(brief("รวม ๑,๒๕๐.๕๐ บาท")).toEqual(["๑,๒๕๐.๕๐ บาท=1250.50"]);
    expect(brief("งบหนึ่งล้านห้าแสนล้านบาท")).toEqual(["หนึ่งล้านห้าแสนล้านบาท=1500000000000"]);
    expect(brief("จ่ายสามร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์แล้ว")).toEqual(["สามร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์=321.50"]);
  });

  it("spoken forms and ranges", () => {
    expect(brief("ตัวละพันห้า")).toEqual(["พันห้า=1500"]);
    expect(brief("ขายได้ 2 แสน 5 ต่อเดือน")).toEqual(["2 แสน 5=250000"]);
    expect(brief("มีคนร้อยกว่าคน")).toEqual(["ร้อยกว่า≈(100,200)"]);
    expect(brief("ขายไปแล้วหลายพันชิ้น")).toEqual(["หลายพัน≈(2000,10000)"]);
    expect(brief("มีประชากรเกือบล้านคน")).toEqual(["เกือบล้าน≈(,1000000)"]);
  });

  it("skips words that only start like numbers", () => {
    expect(brief("เขาสามารถทำได้")).toEqual([]);
    expect(brief("สามีของฉัน")).toEqual([]);
    expect(brief("ห้ามจอด")).toEqual([]);
    expect(brief("ไปห้างกัน")).toEqual([]);
    expect(brief("นั่งเก้าอี้")).toEqual([]);
    expect(brief("ยี่ห้ออะไร")).toEqual([]);
    expect(brief("ระวังหกล้ม")).toEqual([]);
    expect(brief("ล้านนาตะวันออก")).toEqual([]);
    expect(brief("พันธุ์ไม้หายาก")).toEqual([]);
    expect(brief("ร้อยละห้าสิบ")).toEqual(["ห้าสิบ=50"]);
    expect(brief("ร้อยเอกสมชาย")).toEqual([]);
    expect(brief("จังหวัดร้อยเอ็ด")).toEqual([]);
    expect(brief("แสนดีจริงๆ")).toEqual([]);
    expect(brief("ไปศูนย์การค้า")).toEqual([]);
    expect(brief("ลบไฟล์")).toEqual([]);
  });

  it("but keeps the number when it really is one", () => {
    expect(brief("สามพันธุ์")).toEqual(["สาม=3"]);
    expect(brief("อยู่ห่างไปหนึ่งร้อยเอ็ดกิโล")).toEqual(["หนึ่งร้อยเอ็ด=101"]);
    expect(brief("มีแสนคน")).toEqual(["แสน=100000"]);
    expect(brief("หกโมงเย็น")).toEqual(["หก=6"]);
    expect(brief("ราคา100บาท")).toEqual(["100บาท=100"]);
  });

  it("leaves phone numbers, dates, times, versions and codes alone", () => {
    expect(brief("โทร 081-234-5678")).toEqual([]);
    expect(brief("วันที่ 25/11/2569")).toEqual([]);
    expect(brief("เวลา 10:30")).toEqual([]);
    expect(brief("เวอร์ชัน 1.2.3")).toEqual([]);
    expect(brief("รหัส abc123 และ 007")).toEqual([]);
  });

  it("does not glue two numbers into one, nor read สองสาม as a number", () => {
    expect(brief("ไปเที่ยวสองสามวัน")).toEqual([]);
    expect(brief("ราคา 100 200 300")).toEqual(["100=100", "200=200", "300=300"]);
    expect(brief("ได้ 100 บาท 200 บาท")).toEqual(["100 บาท=100", "200 บาท=200"]);
  });

  it("passes options through", () => {
    expect(findAll("ปีสองพันห้า")[0]).toMatchObject({ value: "2500", alternative: "2005" });
    expect(findAll("ปีสองพันห้า", { spoken: false })[0]).toMatchObject({ value: "2005", alternative: "2500" });
  });

  it("never throws", () => {
    for (const t of ["", "บาท", "สตางค์ถ้วน", "ร้อยพันหมื่น", "จุดจุด", "1,2,3", "ครึ่งครึ่ง", "กว่ากว่า", "\u0000", "😀หนึ่ง😀"]) {
      expect(() => findAll(t)).not.toThrow();
    }
    expect(brief("😀หนึ่ง😀")).toEqual(["หนึ่ง=1"]);
  });
});
