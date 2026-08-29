import { describe, expect, test } from "bun:test";
import { serializeJsonLd } from "./json-ld.ts";

describe("serializeJsonLd", () => {
  test("keeps script terminators inert without changing JSON values", () => {
    const value = {
      description: "</script></SCRIPT></ScRiPt ></script/><script>alert(1)</script>",
      legitimateText: "git commit --fixup <ref> & continue > output",
      separators: "line one\u2028line two\u2029line three",
      nested: ['quotes: "', "slash: /", "backslash: \\"],
    };

    const serialized = serializeJsonLd(value);

    expect(serialized).not.toMatch(/[<>&\u2028\u2029]/);
    expect(serialized).not.toMatch(/<\/script[\s/>]/i);
    expect(JSON.parse(serialized)).toEqual(value);
  });

  test("preserves the formula and cask JSON-LD shape", () => {
    const value = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "example & companion",
      description: "Provides result<T, E> values",
      softwareVersion: "1.2.3",
      url: "https://example.com/?left=1&right=2",
      applicationCategory: "DeveloperApplication",
    };

    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });
});
