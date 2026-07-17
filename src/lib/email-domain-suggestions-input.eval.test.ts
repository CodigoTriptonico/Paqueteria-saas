import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/email-domain-suggestions-input.tsx"),
  "utf8",
);

describe("email domain suggestion selection eval", () => {
  it("closes the list after choosing a domain, even when the completed address still matches", () => {
    const applySuggestion = source.match(/function applySuggestion\(next: string\) \{([\s\S]*?)\n  \}/)?.[1] || "";

    assert.match(applySuggestion, /onChange\(next\);/);
    assert.match(applySuggestion, /setOpen\(false\);/);
    assert.doesNotMatch(applySuggestion, /emailDomainSuggestionsShouldOpen\(next\)/);
    assert.match(source, /onClick=\{\(\) => applySuggestion\(suggestion\)\}/);
  });
});
