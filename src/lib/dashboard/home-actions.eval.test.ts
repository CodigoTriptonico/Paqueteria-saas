import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const homePageSource = readFileSync(join(process.cwd(), "src", "app", "page.tsx"), "utf8");

describe("home shortcuts eval", () => {
  it("renders only shortcuts with distinct user-facing purposes", () => {
    assert.match(homePageSource, /HOME_ACTION_HREFS/);
    assert.match(homePageSource, /title: "Nueva venta"[\s\S]*href: HOME_ACTION_HREFS\.newSale/);
    assert.doesNotMatch(homePageSource, /title: "Clientes"/);
    assert.doesNotMatch(homePageSource, /href: "\/venta"/);
  });
});
