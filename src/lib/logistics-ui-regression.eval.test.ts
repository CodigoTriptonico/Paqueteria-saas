import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const componentSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica-client.tsx"),
  "utf8"
);

const fleetAdminSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../components/logistica/logistics-fleet-admin-client.tsx"),
  "utf8",
);

function invoiceCardSource() {
  const cardStart = componentSource.indexOf("function renderInvoiceCard");
  assert.notEqual(cardStart, -1);
  const cardEnd = componentSource.indexOf("function renderTaskCard", cardStart);
  assert.notEqual(cardEnd, -1);
  return componentSource.slice(cardStart, cardEnd);
}

function logisticsToolbarSource() {
  const toolbarStart = componentSource.indexOf('Panel title="Logistica"');
  const listStart = componentSource.indexOf("{advancedRoutesOpen && suggestions.length", toolbarStart);
  assert.notEqual(toolbarStart, -1);
  assert.notEqual(listStart, -1);
  return componentSource.slice(toolbarStart, listStart);
}

describe("logistica single-action invoice card eval", () => {
  it("does not bring back the delivery/pickup progress rail in the main card", () => {
    const bannedCardCopy = [
      'renderStepToken("1 Entrega"',
      'renderStepToken("2 Recoleccion"',
      "Despues: recoger caja llena",
      "Entregar caja vacia",
      "Recoger caja llena",
    ];

    for (const copy of bannedCardCopy) {
      assert.equal(componentSource.includes(copy), false, copy);
    }
  });

  it("uses Pablo's two logistics action words", () => {
    assert.equal(componentSource.includes('deliver_empty_box: "Dejar"'), true);
    assert.equal(componentSource.includes('pickup_full_box: "Recoger"'), true);
  });

  it("keeps invoice identity centered without duplicate action badges in the header", () => {
    const card = invoiceCardSource();
    const headerStart = card.indexOf("bg-surface-card-header");
    const bodyStart = card.indexOf('<div className="grid gap-3 p-3">');
    assert.notEqual(headerStart, -1);
    assert.notEqual(bodyStart, -1);

    const header = card.slice(headerStart, bodyStart);

    assert.equal(header.includes("text-center"), true);
    assert.equal(header.includes("invoiceActionLabel(item.step.stepType"), false);
    assert.equal(header.includes('"Con chofer" : "Sin chofer"'), false);
    assert.equal(header.includes("inline-flex max-w-full flex-wrap"), false);
    assert.equal(header.includes("formatLogisticsTaskStatusLabel"), false);
  });

  it("shows sender phone in the invoice card header", () => {
    const card = invoiceCardSource();
    const headerStart = card.indexOf("bg-surface-card-header");
    const bodyStart = card.indexOf('<div className="grid gap-3 p-3">');
    const header = card.slice(headerStart, bodyStart);

    assert.equal(header.includes("item.shipment.customerPhone"), true);
    assert.equal(header.includes("<Phone"), true);
  });

  it("moves action and driver into the bottom field grid without a date field", () => {
    const card = invoiceCardSource();
    const headerStart = card.indexOf("bg-surface-card-header");
    const bodyStart = card.indexOf('<div className="grid gap-3 p-3">');
    const header = card.slice(headerStart, bodyStart);
    const body = card.slice(bodyStart);
    const actionIndex = body.indexOf("invoiceActionLabel(item.step.stepType");
    const driverIndex = body.indexOf("Chofer");
    const dateIndex = body.indexOf(">Fecha<");

    assert.equal(componentSource.includes("function invoiceActionLabel"), true);
    assert.equal(componentSource.includes("return taskActionVerb[taskType];"), true);
    assert.equal(componentSource.includes("taskActionVerb"), true);
    assert.equal(componentSource.includes("Pendiente por"), false);
    assert.equal(componentSource.includes("Con fecha para"), false);
    assert.equal(componentSource.includes("Asignado para"), false);
    assert.equal(componentSource.includes("En ruta para"), false);
    assert.equal(body.includes("sm:grid-cols-2"), true);
    assert.equal(body.includes("sm:grid-cols-3"), false);
    assert.equal(body.includes("Accion"), true);
    assert.equal(body.includes("Estado"), false);
    assert.equal(componentSource.includes("function invoiceActionFieldClass"), true);
    assert.equal(componentSource.includes("function invoiceDriverFieldClass"), true);
    assert.equal(componentSource.includes("function invoiceDateFieldClass"), false);
    assert.equal(componentSource.includes("logistics-unassigned-alert"), true);
    assert.equal(componentSource.includes("from-red-500/40 via-orange-500/35"), false);
    assert.equal(componentSource.includes("border-indigo-500 bg-indigo-400/28"), false);
    assert.equal(componentSource.includes("border-red-500 bg-red-500/24"), false);
    assert.equal(componentSource.includes("border-emerald-500 bg-emerald-400/28"), false);
    assert.equal(componentSource.includes("LOGISTICS_FIELD_BASE"), true);
    assert.equal(componentSource.includes("logisticsActionIconWellClass"), true);
    assert.equal(body.includes("taskTypeIcon(item.step.stepType, \"h-5 w-5\")"), true);
    assert.equal(body.includes("invoiceActionFieldClass(item.step.stepType)"), true);
    assert.equal(body.includes("invoiceDriverFieldClass(task?.assignedTo, Boolean(task))"), true);
    assert.equal(dateIndex, -1);
    assert.ok(actionIndex >= 0);
    assert.ok(driverIndex > actionIndex);
    assert.equal(body.includes('placeholder="Sin chofer"'), true);
    assert.equal(body.includes("<InlineSearchPicker"), true);
    assert.equal(body.includes('searchPlaceholder="Buscar chofer…"'), true);
    assert.equal(body.includes('ariaLabel={`Chofer de ${item.shipment.code}`}'), true);
    assert.equal(header.includes("taskTypeLabel[item.step.stepType]"), false);
    assert.equal(header.includes("Bloqueado"), false);
  });

  it("uses quiet bottom fields instead of loud floating buttons", () => {
    const card = invoiceCardSource();
    const headerStart = card.indexOf("border-b border-black px-3 py-2.5");
    const bodyStart = card.indexOf('<div className="grid gap-3 p-3">');
    const header = card.slice(headerStart, bodyStart);
    const body = card.slice(bodyStart);
    const bottomFieldsStart = body.indexOf('<div className="grid gap-2 sm:grid-cols-2">');
    const bottomFieldsEnd = body.indexOf("</article>", bottomFieldsStart);
    const bottomFields = body.slice(bottomFieldsStart, bottomFieldsEnd);

    assert.equal(bottomFields.includes("rounded-md border border-black bg-[#26312c] px-2 py-2"), false);
    assert.equal(bottomFields.includes("relative grid gap-1 rounded-md border px-2 py-2"), true);
    assert.equal(header.includes('bg-[#1f2925] p-1'), false);
    assert.equal(header.includes("bg-amber-400 text-slate-950"), false);
    assert.equal(header.includes("bg-amber-300"), false);
    assert.equal(card.includes("bg-amber-950/45"), true);
  });

  it("does not show warehouse in the invoice card footer", () => {
    const card = invoiceCardSource();
    const footerStart = card.indexOf('className="flex flex-wrap items-center justify-end gap-2 border-t border-black pt-2"');
    const addressStart = card.indexOf("formattedAddress || displayTask?.notes");
    const driverGridStart = card.indexOf("invoiceDriverFieldClass");

    assert.equal(footerStart, -1);
    assert.equal(card.includes("item.quote?.label"), true);
    assert.ok(card.indexOf("item.quote?.label") > addressStart);
    assert.ok(card.indexOf("item.quote?.label") > driverGridStart);
    assert.equal(card.includes("<Warehouse"), false);
    assert.equal(card.includes("warehouseLabel"), false);
  });

  it("shows all invoices in one friendly list without tabs or split sections", () => {
    const main = logisticsToolbarSource();

    assert.equal(componentSource.includes('type InvoiceAssignmentTab = "unassigned" | "assigned"'), false);
    assert.equal(main.includes('role="tablist"'), false);
    assert.equal(main.includes('role="tabpanel"'), false);
    assert.equal(main.includes("activeInvoiceItems.map((item) => renderInvoiceCard(item))"), false);
    assert.equal(main.includes("unassignedInvoiceItems.map((item) => renderInvoiceCard(item))"), false);
    assert.equal(main.includes("assignedInvoiceItems.map((item) => renderInvoiceCard(item))"), false);
    assert.equal(main.includes("filteredInvoiceItems.map((item) => renderInvoiceCard(item))"), true);
    assert.equal(
      main.includes(
        'className="grid max-h-[72vh] auto-rows-max gap-3 overflow-y-auto p-3 xl:grid-cols-2 2xl:grid-cols-3"',
      ),
      true,
    );
    assert.equal(main.includes("Pendientes de asignar"), false);
    assert.equal(main.includes("Ya asignados"), false);
    assert.equal(main.includes("unassignedCount"), false);
    assert.equal(main.includes("assignedCount"), false);
  });

  it("keeps the unrouted driver field stable after assignment", () => {
    assert.equal(componentSource.includes('const showChoferPicker = mode === "unrouted";'), true);
    assert.equal(componentSource.includes("const showChoferPicker = !task.assignedTo"), false);
  });

  it("colors unrouted cards without inline date fields", () => {
    assert.equal(componentSource.includes("function invoiceDateFieldClass"), false);
    assert.equal(componentSource.includes("LogisticsScheduleText"), false);
  });

  it("shows task waiting time since delivery or pickup was requested on logistics cards", () => {
    assert.equal(componentSource.includes("function LogisticsTaskWaitingBanner"), true);
    assert.equal(componentSource.includes("logisticsTaskWaitingParts"), true);
    assert.equal(componentSource.includes("task?.orderedAt"), true);
    assert.equal(componentSource.includes("timings.waitingText"), false);
    assert.equal(componentSource.includes("desde la venta"), false);
    assert.equal(componentSource.includes("Último tramo:"), false);
    assert.match(
      componentSource,
      /LogisticsTaskWaitingBanner[\s\S]*?logisticsWaitingToneClass\(waiting\.elapsedMs\)/,
    );
  });

  it("does not show the schedule proximity legend bar", () => {
    const main = logisticsToolbarSource();

    assert.equal(main.includes("Vencida/hoy"), false);
    assert.equal(main.includes("2-3 dias"), false);
    assert.equal(main.includes("4+ dias"), false);
  });

  it("keeps the main toolbar in one compact row", () => {
    const toolbar = logisticsToolbarSource();

    assert.equal(toolbar.includes("overflow-visible p-2"), true);
    assert.equal(toolbar.includes("flex flex-wrap items-center gap-2"), true);
    assert.equal(toolbar.includes("lg:grid-cols-[auto_minmax(18rem,1.4fr)"), false);
    assert.equal(toolbar.includes('className="grid gap-3"'), false);
    assert.equal(
      toolbar.includes("inline-flex h-11 items-center gap-2 rounded-md border border-black bg-surface-inset px-2"),
      false
    );
    assert.ok(toolbar.indexOf("<InlineSearchCombobox") < toolbar.indexOf("<LogisticsSectionNav"));
  });

  it("keeps section nav aligned to the right on fleet admin pages", () => {
    assert.equal(componentSource.includes('<LogisticsSectionNav\n                active="routes"'), true);
    assert.equal(componentSource.includes('className="ml-auto"'), true);
    assert.equal(fleetAdminSource.includes("<LogisticsSectionNav"), true);
    assert.equal(fleetAdminSource.includes('className="ml-auto"'), true);
    assert.equal(fleetAdminSource.includes('href="/logistica/conductores"'), false);
    assert.equal(fleetAdminSource.includes("Logistica"), false);
  });

  it("opens the native date picker from the toolbar date filter", () => {
    const toolbar = logisticsToolbarSource();

    assert.equal(toolbar.includes("<DateInput"), true);
    assert.equal(toolbar.includes("onClick={() => openDatePicker(inputRef.current)}"), false);
    assert.equal(toolbar.includes('ariaLabel="Fecha"'), true);
  });
});
