import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const enviosSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/envios-client.tsx"),
  "utf8",
);

describe("envios page layout eval", () => {
  it("keeps envios inside the desktop shell instead of growing the page", () => {
    assert.equal(
      enviosSource.includes('className="flex min-h-0 flex-col lg:flex-1 lg:overflow-hidden"'),
      true,
    );
    assert.equal(
      enviosSource.includes('contentClassName="flex min-h-0 flex-1 flex-col p-3 sm:p-4"'),
      true,
    );
    assert.equal(
      enviosSource.includes('className="mb-3 shrink-0 rounded-xl border border-black bg-surface-card-header p-2"'),
      true,
    );
    assert.equal(
      enviosSource.includes('className="min-h-0 flex-1 overflow-y-auto pr-1"'),
      true,
    );
    assert.equal(enviosSource.includes("divide-y divide-black/70"), false);
    assert.equal(enviosSource.includes("listRowBaseClass"), true);
    assert.equal(enviosSource.includes("usePageListRowPalette"), false);
    assert.equal(enviosSource.includes("sm:grid-cols-2 xl:grid-cols-3"), true);
    assert.equal(enviosSource.includes('viewLayout === "rows"'), true);
    assert.equal(enviosSource.includes("EnviosShipmentRowsList"), true);
    assert.equal(enviosSource.includes("EnviosShipmentCardsGrid"), true);
    assert.equal(
      enviosSource.includes(
        'className="grid w-full min-w-0 cursor-pointer grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-2 overflow-hidden sm:gap-x-3"',
      ),
      true,
    );
    assert.equal(enviosSource.includes("max-w-[min(100%,17rem)]"), false);
    assert.equal(enviosSource.includes("w-[9.25rem] shrink-0"), true);
    assert.equal(enviosSource.includes("min-w-[18rem] flex-1 self-center"), false);
    assert.equal(enviosSource.includes("summaryRow"), true);
    assert.equal(enviosSource.includes("ShipmentPaymentProgress"), true);
    assert.equal(enviosSource.includes("mt-0.5 flex min-w-0 items-center gap-1.5"), true);
    assert.equal(enviosSource.includes("singleLine"), true);
    assert.equal(enviosSource.includes("expandedShipmentIds"), true);
    assert.equal(enviosSource.includes("toggleShipmentExpanded"), true);
    assert.equal(enviosSource.includes("sortShipmentsByArrivalOrder(filteredShipments)"), true);
    assert.equal(enviosSource.includes("buildShipmentMilestoneAges(row, progressSteps)"), true);
    assert.equal(enviosSource.includes("buildShipmentTimingInsightPanel(row, progressSteps)"), true);
    assert.equal(enviosSource.includes("ShipmentMilestoneAgeTrigger"), true);
    assert.equal(enviosSource.includes('id={`envios-detail-${row.id}`}'), true);
    assert.equal(enviosSource.includes("lg:flex-row lg:items-start lg:gap-4"), true);
    assert.equal(enviosSource.includes("flex shrink-0 flex-wrap items-center gap-1.5"), true);
    assert.equal(enviosSource.includes('sm:w-[12rem]'), true);
    assert.equal(enviosSource.includes('>Todos vendedores</option>'), true);
    assert.equal(enviosSource.includes("pr-8 text-sm font-black"), true);
    assert.equal(enviosSource.includes(">Vista</span>"), false);
    assert.equal(enviosSource.includes('isHistoryMode ? "entregados" : "total"'), true);
    const toolbarSearchIndex = enviosSource.indexOf('aria-label="Buscar envíos"');
    const toolbarTotalIndex = enviosSource.indexOf('isHistoryMode ? "entregados" : "total"', toolbarSearchIndex);
    const toolbarListosIndex = enviosSource.indexOf(">Listos</span>", toolbarSearchIndex);
    const toolbarPendientesIndex = enviosSource.indexOf(">Pendientes</span>", toolbarSearchIndex);
    assert.equal(toolbarSearchIndex > -1 && toolbarTotalIndex > toolbarSearchIndex, true);
    assert.equal(toolbarListosIndex > toolbarSearchIndex, true);
    assert.equal(toolbarPendientesIndex > toolbarSearchIndex, true);
    assert.equal(enviosSource.includes("readinessFilter"), true);
    assert.equal(enviosSource.includes("EnviosBulkSelectionBar"), true);
    assert.equal(enviosSource.includes("useEnviosShipmentSelection"), true);
    assert.equal(enviosSource.includes("Marcar como listos"), true);
    assert.doesNotMatch(
      enviosSource,
      /grid w-full min-w-0 cursor-pointer[\s\S]{0,1200}aria-label=\{`Vendedor de \$\{row\.code\}`\}/,
    );
  });
});
