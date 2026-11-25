import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the core runs in browsers", () => {
  const files = readdirSync("src", { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".ts"));

  it("uses no Node-only API", () => {
    for (const f of files) {
      const src = readFileSync(`src/${f}`, "utf8");
      expect(src, f).not.toMatch(/from "node:|require\(|\bprocess\.|\bBuffer\b|__dirname/);
    }
  });

  it("has no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: object };
    expect(pkg.dependencies ?? {}).toEqual({});
  });
});
