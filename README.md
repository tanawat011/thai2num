# thai2num

**Read Thai number words back into exact numbers** — the reverse of baht-text — and find them in
running text.

```ts
import { parse, findAll } from "thai2num";

parse("หนึ่งพันสองร้อยห้าสิบบาทถ้วน").value;      // "1250"
parse("สามร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์").value;   // "321.50"
parse("หนึ่งล้านห้าแสนล้าน").value;               // "1500000000000"
parse("1.5 ล้าน").value;                          // "1500000"
parse("สองพันห้า");   // { value: "2500", reading: "spoken", alternative: "2005", … }
parse("ร้อยกว่า");    // { approx: true, kind: "more", min: "100", max: "200", … } — never a fake 100

findAll("ราคาสองพันห้าร้อยบาท ลดเหลือ 1.5 พัน");
// [{ text: "สองพันห้าร้อยบาท", value: "2500", unit: "baht", from: 4, to: 20, … },
//  { text: "1.5 พัน", value: "1500", from: 29, to: 36, … }]
```

[ภาษาไทยอยู่ด้านล่าง ↓](#ภาษาไทย)

## Why

Turning a number into Thai words is well covered on npm (`thai-baht-text`, `bahttext`, `baht` …).
Going back — reading what someone typed or said — we could not find in JavaScript (we looked on
npm in November 2026); PyThaiNLP has `thaiword_to_num` and `words_to_num` for Python. thai2num aims
to be the careful version of that:

- **Exact.** Values come back as decimal strings computed with BigInt: baht and satang never
  round, ล้านล้านล้าน keeps every digit. A JS `number` is added only when it is exact.
- **Money.** บาท, สตางค์, ถ้วน / ตรง; `baht` and `satang` parts are returned separately.
- **The way people say it.** Spoken shortcuts are understood — and flagged, with the other reading
  alongside, because they are genuinely ambiguous (`สองพันห้า` is 2,500 in speech, 2,005 as written
  digit by digit).
- **Honest about vague numbers.** `ร้อยกว่า`, `หลายพัน`, `หลักล้าน`, `เกือบ`, `ประมาณ` come back as
  ranges or as "about", flagged `approx: true` — never as a made-up exact number.
- **Clear errors.** Anything that is not one well-formed number throws a `ThaiNumberError` that says
  what is wrong and where. No silent wrong numbers.
- **Finds numbers in text**, with offsets, skipping words that only look like numbers
  (`สามารถ`, `ห้าม`, `เก้าอี้`, `ล้านนา` …), phone numbers, dates and versions.
- No dependencies, ESM + CJS + types, works in browsers. About 5 KB gzipped.

## Install

```sh
npm install thai2num
```

A `<script>` build is in the package too: `dist/thai2num.global.js` (global `thai2num`).

## API

### `parse(text, options?) → ThaiNumber`

The whole text must be one number (spaces between words are fine). Returns one of:

```ts
interface ExactNumber {
  approx: false;
  value: string;        // "1250", "321.50", "-5", "3.14", "1000000000000"
  number?: number;      // only when Number(value) reads back as the same decimal
  unit?: "baht";        // when the words said บาท or สตางค์
  baht?: string;        // money: whole baht, "321"
  satang?: string;      // money: two digits, "50" ("00" for ถ้วน)
  reading: "standard" | "spoken";
  alternative?: string; // when the words have two readings, the one not chosen
}

interface ApproxNumber {
  approx: true;
  kind: "more" | "about" | "almost" | "several" | "order";
  said: string;                          // the number without the hedge: "100" for ร้อยกว่า
  min?: string; minInclusive?: boolean;
  max?: string; maxInclusive?: boolean;
  unit?: "baht";
}
```

Money with satang is written with two decimals (`"321.50"`); without satang it has none (`"1250"`).

| option | default | |
|---|---|---|
| `spoken` | `true` | read the spoken shortcuts below; `false` reads every form as written (the other reading is still in `alternative`) |
| `strict` | `false` | refuse forms that are understandable but not standard: `สองสิบ`, `หนึ่งสิบ`, `สิบหนึ่ง`, `นึง` |

### `findAll(text, options?) → Found[]`

Every number in running text, in order: a `ThaiNumber` plus `from`, `to` (UTF-16 offsets, like
`String.prototype.slice`) and `text`. Never throws.

### `ThaiNumberError`

`message` (English, quoting the Thai), `index` (offset in the input), `input`.

## What it reads

| form | example | value |
|---|---|---|
| standard words | `หนึ่งพันสองร้อยห้าสิบ` | 1250 |
| เอ็ด / ยี่ | `ยี่สิบเอ็ด`, `หนึ่งร้อยเอ็ด`, `หนึ่งร้อยหนึ่ง` | 21, 101, 101 |
| ล้าน groups | `ล้านล้าน`, `ห้าสิบเอ็ดล้าน`, `หนึ่งล้านห้าแสนล้าน` | 10¹², 51,000,000, 1.5 × 10¹² |
| money | `…บาทถ้วน`, `…บาท…สตางค์`, `ห้าสิบสตางค์`, `สิบบาทตรง` | exact, with `baht` / `satang` |
| digits | `1,250`, `๑,๒๕๐.๕๐ บาท`, `12345678901234567890` | exact |
| digits × words | `1.5 ล้าน`, `2.75 แสน`, `3 หมื่น 2 พัน` | 1,500,000, 275,000, 32,000 |
| decimal word | `สามจุดหนึ่งสี่` | 3.14 |
| minus | `ลบห้า` | −5 |

### Spoken shortcuts (flagged `reading: "spoken"`)

| form | example | value | `alternative` |
|---|---|---|---|
| a digit 2–9 right after ร้อย / พัน / หมื่น / แสน / ล้าน, at the end, is a tenth of it | `สองพันห้า`, `แสนห้า`, `ห้าหมื่นสาม`, `ล้านสอง`, `2 แสน 5`, `ร้อยห้า` | 2500, 150000, 53000, 1200000, 250000, 150 | 2005, 100005, 50003, 1000002, 200005, 105 |
| `นึง` right after a bare multiplier counts it, it does not add one | `ร้อยนึง`, `พันนึง` | 100, 1000 | 101, 1001 |
| half of a multiplier | `ครึ่งแสน`, `ครึ่งล้าน` | 50000, 500000 | — |
| … and a half | `ล้านครึ่ง`, `สองล้านครึ่ง`, `พันครึ่ง`, `สองครึ่ง` | 1500000, 2500000, 1500, 2.5 | — |

Not shortcuts: `หนึ่ง` and `เอ็ด` after a multiplier (`หนึ่งร้อยหนึ่ง`, `ร้อยเอ็ด` are 101), or a
digit followed by a smaller place (`สองพันห้าร้อย` is 2500 by the book). **Formal money — text
ending in ถ้วน / ตรง, or with สตางค์ — is always read as written**, because that is what cheques
and BAHTTEXT produce: `สองพันห้าบาทถ้วน` is 2005.

### Vague numbers (flagged `approx: true`)

| form | example | result |
|---|---|---|
| กว่า / เศษ — more than the number, below the next step of its last place | `ร้อยกว่า`, `ห้าพันกว่า`, `สามร้อยห้าสิบกว่า`, `สองพันห้ากว่า`, `120 กว่า` | (100, 200), (5000, 6000), (350, 360), (2500, 2600), (120, 130) |
| หลาย — several | `หลายร้อย`, `หลายพัน` | [200, 1000), [2000, 10000) |
| หลัก — "in the …s" | `หลักพัน`, `หลักสิบล้าน` | [1000, 10000), [10⁷, 10⁸) |
| เกือบ — almost | `เกือบล้าน` | max 1000000 (exclusive) |
| ประมาณ / ราว / ราวๆ — about | `ประมาณสามพัน` | `kind: "about"`, `said: "3000"`, no bounds |

## Errors

```ts
parse("สองสาม");   // ThaiNumberError: "สาม" cannot follow "สอง" without ร้อย / พัน / … between them
                   //   ("สองสาม" means "สอง or สาม", not one number) (at 3 in "สองสาม")
parse("ร้อยพัน");  // "พัน" cannot come after "ร้อย" in the same number (at 4 …)
parse("หนึ่งร้อยบาทหนึ่งร้อยสตางค์"); // satang must be a whole number from 0 to 99 (at 12 …)
```

## Tests

- **Round trip**: a separate writer of standard Thai words (`test/words.ts`, the rules cheques
  and BAHTTEXT use) produces text for ~19,000 random values — up to 10³⁰, sparse values like
  1,000,005, random satang, `เอ็ด` and `หนึ่ง` spellings, Arabic and Thai digits with and without
  grouping — and every one must read back to the same value.
- Every spoken form, every hedge, 23 kinds of invalid input, strict mode, and `findAll` on running
  text with look-alike words, phone numbers, dates and versions.

`npm run check` runs lint, typecheck, tests and the build.

## Limits

- **Spoken shortcuts are a guess about intent.** `สองพันห้า` in a chat is almost always 2,500, but
  `ปีสองพันห้า` (the year 2005) is not. The other reading is always in `alternative`; pass
  `spoken: false` when your text is formal.
- `สองสาม` ("two or three") is refused by `parse` and skipped by `findAll`, not turned into a range.
- `findAll` is not a Thai word segmenter. It knows a list of words that start like numbers
  (`สามารถ`, `ห้าม`, `เก้าอี้`, `ยี่ห้อ`, `ล้านนา`, `พันธุ์`, `ร้อยละ`, military ranks …) and accepts a
  bare `ร้อย` / `พัน` / `แสน` or `ศูนย์` only before a counter word, a unit, a space or the end.
  Words not on the list can still be misread; `ร้อยเอ็ด` at the start of a number is taken to be
  the province.
- Ordinals (`ที่หนึ่ง`), fractions other than halves (`สามในสี่`), percentages (`ร้อยละห้า` gives 5,
  not 5 %), Roman numerals and number words of other languages are out of scope.
- Digits with a leading zero (`007`, `081…`) are taken to be codes and skipped by `findAll`.

## Licence

MIT. No third-party data.

---

## ภาษาไทย

**thai2num อ่านตัวเลขที่เขียนเป็นคำไทยกลับเป็นตัวเลขที่แม่นยำ** (กลับด้านของ baht-text) และหาตัวเลขในข้อความยาว ๆ ได้

```ts
import { parse, findAll } from "thai2num";
parse("หนึ่งพันสองร้อยห้าสิบบาทถ้วน").value;     // "1250"
parse("สามร้อยยี่สิบเอ็ดบาทห้าสิบสตางค์").value;  // "321.50"
parse("ร้อยกว่า");   // ช่วง (100, 200) ติดธง approx — ไม่แต่งตัวเลขเดี่ยวขึ้นมาเอง
```

### ต่างจากที่มีอย่างไร

บน npm มีไลบรารีแปลง **ตัวเลข → คำไทย** หลายตัว แต่ทางกลับ (คำไทย → ตัวเลข) เราหาใน JavaScript ไม่เจอ
(ค้นเมื่อ พ.ย. 2569) ฝั่ง Python มี `thaiword_to_num` / `words_to_num` ของ PyThaiNLP — thai2num ตั้งใจทำเวอร์ชันที่รอบคอบ:

- **แม่นยำทุกหลัก** — ค่าเป็นสตริงทศนิยมที่คำนวณด้วย BigInt บาทและสตางค์ไม่ปัดเศษ ล้านล้านล้านไม่หายสักหลัก ให้ `number` ของ JS เฉพาะตอนที่แม่นจริง
- **เงิน** — บาท สตางค์ ถ้วน/ตรง แยก `baht` กับ `satang` ให้
- **ภาษาพูด** — เข้าใจรูปลัดที่คนใช้ (`สองพันห้า`, `แสนห้า`, `ล้านสอง`, `2 แสน 5`, `ร้อยนึง`, `ครึ่งล้าน`, `ล้านครึ่ง`)
  และติดธง `reading: "spoken"` พร้อมบอกอีกความหมายใน `alternative` เพราะกำกวมจริง (`สองพันห้า` พูด = 2,500 เขียนตามหลัก = 2,005)
  — ข้อความเงินแบบทางการ (ลงท้าย ถ้วน/ตรง หรือมีสตางค์) อ่านตามหลักเสมอ
- **ตัวเลขคร่าว ๆ เป็นช่วง** — `ร้อยกว่า`, `หลายพัน`, `หลักล้าน`, `เกือบ`, `ประมาณ` ได้ `approx: true` ไม่มีค่าเดี่ยวปลอม ๆ
- **ข้อผิดพลาดชัดเจน** — ถ้าไม่ใช่ตัวเลขที่ถูกต้องหนึ่งจำนวน จะโยน `ThaiNumberError` บอกว่าผิดตรงไหน ไม่คืนเลขผิดเงียบ ๆ
- **หาตัวเลขในข้อความ** พร้อมตำแหน่ง ข้ามคำที่แค่ขึ้นต้นเหมือนตัวเลข (สามารถ ห้าม เก้าอี้ ล้านนา …) เบอร์โทร วันที่ เวอร์ชัน
- ไม่มี dependency, ESM + CJS + types, ใช้ในเบราว์เซอร์ได้ ขนาดราว 5 KB (gzip)

### ข้อจำกัด

- รูปลัดภาษาพูดคือการเดาเจตนา: `ปีสองพันห้า` (ค.ศ. 2005) จะได้ 2,500 — ดู `alternative` หรือใช้ `spoken: false` กับข้อความทางการ
- `สองสาม` (สองหรือสาม) ไม่แปลงเป็นช่วง: `parse` ปฏิเสธ `findAll` ข้าม
- `findAll` ไม่ได้ตัดคำภาษาไทยเต็มรูปแบบ ใช้รายการคำที่ขึ้นต้นเหมือนตัวเลข คำที่ไม่อยู่ในรายการอาจอ่านผิดได้
- ไม่รองรับลำดับที่ (ที่หนึ่ง), เศษส่วนอื่นนอกจากครึ่ง, เปอร์เซ็นต์ (`ร้อยละห้า` ได้ 5)

สัญญาอนุญาต MIT
