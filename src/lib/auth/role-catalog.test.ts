import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASE_ROLE_SLUGS,
  findRoleCatalogEntry,
  isBaseRoleSlug,
  listBaseRoleCatalog,
  listSuggestedRoleCatalog,
} from "@/lib/auth/role-catalog";

describe("role catalog", () => {
  it("defaults to admin, seller, driver and logistics", () => {
    assert.deepEqual([...BASE_ROLE_SLUGS], [
      "administrador",
      "vendedor",
      "conductor",
      "logistica",
    ]);
    assert.deepEqual(
      listBaseRoleCatalog().map((entry) => entry.slug),
      [...BASE_ROLE_SLUGS],
    );
    assert.equal(isBaseRoleSlug("administrador"), true);
    assert.equal(isBaseRoleSlug("bodega"), false);
  });

  it("suggests previously optional roles only when missing", () => {
    const all = listSuggestedRoleCatalog({ agencyModuleEnabled: true });
    assert.ok(all.some((entry) => entry.slug === "bodega"));
    assert.ok(all.some((entry) => entry.slug === "finanzas"));
    assert.ok(all.some((entry) => entry.slug === "auditor"));
    assert.ok(all.some((entry) => entry.slug === "captador_distribuidores"));
    assert.ok(all.some((entry) => entry.slug === "captador_agencias"));
    assert.ok(all.some((entry) => entry.slug === "supervisor_agencias"));
    assert.ok(!all.some((entry) => entry.base));

    const filtered = listSuggestedRoleCatalog({
      existingSlugs: ["bodega", "auditor"],
      agencyModuleEnabled: false,
    });
    assert.ok(!filtered.some((entry) => entry.slug === "bodega"));
    assert.ok(!filtered.some((entry) => entry.slug === "auditor"));
    assert.ok(filtered.some((entry) => entry.slug === "finanzas"));
    assert.ok(!filtered.some((entry) => entry.agencyModule));
  });

  it("looks up catalog entries by slug", () => {
    assert.equal(findRoleCatalogEntry("Logística")?.slug, "logistica");
    assert.equal(findRoleCatalogEntry("no-existe"), null);
  });
});
