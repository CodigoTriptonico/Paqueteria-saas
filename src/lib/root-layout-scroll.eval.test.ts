import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const rootLayoutSource = readFileSync(
  join(process.cwd(), "src", "app", "layout.tsx"),
  "utf8",
);

test("root layout locks desktop document scroll to the app shell", () => {
  assert.match(
    rootLayoutSource,
    /<body className="min-h-full flex flex-col lg:h-full lg:overflow-hidden">/,
  );
});
