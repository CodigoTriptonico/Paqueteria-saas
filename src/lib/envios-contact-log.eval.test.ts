import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const enviosSource = readFileSync(join(root, "src/components/envios-client.tsx"), "utf8");
const dialogSource = readFileSync(
  join(root, "src/components/shipment-contact-log-dialog.tsx"),
  "utf8",
);
const contactLogSource = readFileSync(join(root, "src/lib/shipment-contact-log.ts"), "utf8");
const actionsSource = readFileSync(join(root, "src/app/actions/shipments.ts"), "utf8");
const migrationSource = readFileSync(
  join(root, "supabase/migrations/042_shipment_contact_logs.sql"),
  "utf8",
);
const channelOtherMigrationSource = readFileSync(
  join(root, "supabase/migrations/044_shipment_contact_channel_other.sql"),
  "utf8",
);

describe("envios contact log eval", () => {
  it("adds a compact seller follow-up action to shipment cards", () => {
    assert.equal(enviosSource.includes("ShipmentContactLogDialog"), true);
    assert.equal(enviosSource.includes("ShipmentContactLogLine"), true);
    assert.equal(enviosSource.includes("onContactLogOpen(row.id)"), true);
    assert.equal(enviosSource.includes("Registrar seguimiento"), true);
    assert.equal(enviosSource.includes("<PhoneCall"), true);
    assert.equal(enviosSource.includes("contactReminderFilter"), true);
    assert.equal(enviosSource.includes("Hoy"), true);
  });

  it("keeps the dialog simple for non-technical sellers", () => {
    assert.equal(dialogSource.includes("Qué pasó"), true);
    assert.equal(dialogSource.includes("Qué dijo"), true);
    assert.equal(dialogSource.includes("Qué sigue"), true);
    assert.equal(dialogSource.includes("Recordarme"), true);
    assert.equal(dialogSource.includes("Contestó"), true);
    assert.equal(dialogSource.includes("No contestó"), true);
    assert.equal(dialogSource.includes("Mensaje"), true);
    assert.equal(dialogSource.includes("Llamar después"), true);
    assert.equal(dialogSource.includes("Número mal"), true);
    assert.equal(dialogSource.includes("Hoy 5 PM"), true);
    assert.equal(dialogSource.includes("Mañana 9 AM"), true);
    assert.equal(dialogSource.includes("En 2 días"), true);
    assert.equal(dialogSource.includes("createShipmentContactLogAction"), true);
    assert.equal(dialogSource.includes("Guardar seguimiento"), true);
    assert.equal(dialogSource.includes('channel === "other"'), true);
    assert.equal(dialogSource.includes("¿Cuál?"), true);
    assert.equal(dialogSource.includes("channelOther"), true);
  });

  it("keeps reminders driven by the latest log only", () => {
    assert.equal(contactLogSource.includes("latestShipmentContactLog"), true);
    assert.equal(contactLogSource.includes("latestShipmentContactReminderStatus"), true);
    assert.equal(dialogSource.includes("latestShipmentContactLog(shipment.contactLogs)"), true);
    assert.equal(dialogSource.includes("shipmentContactReminderLabel"), true);
    assert.equal(dialogSource.includes("Prioridad"), false);
    assert.equal(dialogSource.includes("Motivo"), false);
  });

  it("persists contact logs with auth, organization scope, audit, and mapped reload", () => {
    assert.equal(actionsSource.includes("export async function createShipmentContactLogAction"), true);
    assert.equal(actionsSource.includes('sessionHasPermission(session, "sales.manage")'), true);
    assert.equal(actionsSource.includes("canWriteShipmentContactLog"), true);
    assert.equal(actionsSource.includes("shipment_contact_logs"), true);
    assert.equal(actionsSource.includes("channel_other"), true);
    assert.equal(actionsSource.includes("listShipmentContactChannelOthersAction"), true);
    assert.equal(actionsSource.includes("shipment.contact_log_created"), true);
    assert.equal(actionsSource.includes("contactLogs"), true);
  });

  it("stores custom channel labels for later review", () => {
    assert.equal(contactLogSource.includes("channelOther"), true);
    assert.equal(contactLogSource.includes("summarizeShipmentContactChannelOthers"), true);
    assert.equal(channelOtherMigrationSource.includes("channel_other"), true);
    assert.equal(
      channelOtherMigrationSource.includes("idx_shipment_contact_logs_channel_other"),
      true,
    );
  });

  it("adds RLS so sellers only touch contact logs for their shipments", () => {
    assert.equal(migrationSource.includes("create table if not exists public.shipment_contact_logs"), true);
    assert.equal(migrationSource.includes("alter table public.shipment_contact_logs enable row level security"), true);
    assert.equal(migrationSource.includes("s.sales_owner_id = auth.uid()"), true);
    assert.equal(migrationSource.includes("public.current_role_slug() = 'administrador'"), true);
  });
});
