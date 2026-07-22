import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const panelSource = readFileSync(
  join(root, "src/components/config/roles-permissions-panel.tsx"),
  "utf8",
);
const modalSource = readFileSync(
  join(root, "src/components/config/add-role-modal.tsx"),
  "utf8",
);
const actionsSource = readFileSync(join(root, "src/app/actions/roles.ts"), "utf8");
const catalogSource = readFileSync(join(root, "src/lib/auth/role-catalog.ts"), "utf8");
const migrationSource = readFileSync(
  join(root, "supabase/migrations/124_base_roles_and_suggested_catalog.sql"),
  "utf8",
);

describe("suggested roles catalog contract", () => {
  it("keeps four base roles and offers the former extras as suggestions", () => {
    assert.match(catalogSource, /BASE_ROLE_SLUGS/);
    assert.match(catalogSource, /"administrador"/);
    assert.match(catalogSource, /"vendedor"/);
    assert.match(catalogSource, /"conductor"/);
    assert.match(catalogSource, /"logistica"/);
    assert.match(catalogSource, /slug: "bodega"/);
    assert.match(catalogSource, /slug: "finanzas"/);
    assert.match(catalogSource, /slug: "auditor"/);
    assert.match(catalogSource, /listSuggestedRoleCatalog/);
  });

  it("opens suggested and custom roles in a dedicated modal", () => {
    assert.match(panelSource, /AddRoleModal/);
    assert.match(panelSource, /Agregar rol/);
    assert.match(panelSource, /addSuggestedRole/);
    assert.match(panelSource, /showAddRoleModal/);
    assert.doesNotMatch(panelSource, /roleOptionsRef/);
    assert.match(modalSource, /Roles sugeridos/);
    assert.match(modalSource, /Rol personalizado/);
    assert.match(modalSource, /app-modal-overlay/);
    assert.match(modalSource, /createPortal/);
    assert.match(actionsSource, /export async function addSuggestedRoleAction/);
    assert.match(actionsSource, /suggestedRoles: listSuggestedRoleCatalog/);
  });

  it("bootstraps only base roles for new organizations", () => {
    assert.match(migrationSource, /'logistica', 'Logística'/);
    assert.doesNotMatch(
      migrationSource,
      /insert into public\.roles[\s\S]{0,400}'auditor'/,
    );
    assert.doesNotMatch(
      migrationSource,
      /bootstrap_organization[\s\S]{0,1200}captador_distribuidores/,
    );
  });
});
