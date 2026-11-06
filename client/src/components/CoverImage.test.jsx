// R89: built-in covers ship AVIF and WebP siblings; other URLs are not rewritten.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { coverSources } from "./CoverImage.jsx";

const dir = path.resolve(__dirname, "../../public/covers");

describe("cover images (R89)", () => {
  it("rewrites built-in covers to avif/webp siblings", () => {
    expect(coverSources("/covers/harrison.jpg")).toEqual({ avif: "/covers/harrison.avif", webp: "/covers/harrison.webp" });
  });
  it("leaves external or non-cover URLs alone", () => {
    expect(coverSources("https://example.com/a.jpg")).toBeNull();
    expect(coverSources("/uploads/x.jpg")).toBeNull();
    expect(coverSources("")).toBeNull();
    expect(coverSources(undefined)).toBeNull();
  });
  it("every built-in cover has both generated siblings", () => {
    const jpgs = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f));
    expect(jpgs.length).toBeGreaterThan(0);
    for (const f of jpgs) {
      const base = f.replace(/\.jpe?g$/i, "");
      expect(fs.existsSync(path.join(dir, `${base}.avif`)), `${base}.avif`).toBe(true);
      expect(fs.existsSync(path.join(dir, `${base}.webp`)), `${base}.webp`).toBe(true);
    }
  });
});
