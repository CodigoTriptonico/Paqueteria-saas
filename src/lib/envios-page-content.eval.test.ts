import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sharedPagePath = new URL("../components/envios-page-content.tsx", import.meta.url);
const trackingPagePath = new URL("../app/seguimiento/page.tsx", import.meta.url);
const historyPagePath = new URL("../app/seguimiento/historial/page.tsx", import.meta.url);

test("envios routes share one data-loading boundary and legacy history redirects", async () => {
  const [sharedPage, trackingPage, historyPage] = await Promise.all([
    readFile(sharedPagePath, "utf8"),
    readFile(trackingPagePath, "utf8"),
    readFile(historyPagePath, "utf8"),
  ]);

  assert.match(sharedPage, /Promise\.all\(\[/);
  assert.match(sharedPage, /<EnviosClient[\s\S]*mode=\{mode\}/);
  assert.match(trackingPage, /<EnviosPageContent mode="tracking" \/>/);
  assert.match(historyPage, /redirect\("\/seguimiento\?view=history"\)/);
  assert.doesNotMatch(trackingPage, /listShipmentsAction/);
  assert.doesNotMatch(historyPage, /listShipmentsAction/);
});
