import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  latestShipmentContactLog,
  latestShipmentContactReminderStatus,
  shipmentContactChannelLabel,
  shipmentContactLogAuditDescription,
  shipmentContactLogPreview,
  shipmentContactOutcomeLabel,
  shipmentContactReminderLabel,
  shipmentContactReminderStatus,
  summarizeShipmentContactChannelOthers,
  validateShipmentContactLogInput,
  type ShipmentContactLogRow,
} from "@/lib/shipment-contact-log";

describe("shipment contact log", () => {
  it("requires a shipment and client note", () => {
    assert.deepEqual(validateShipmentContactLogInput({ shipmentId: "", note: "Listo" }), {
      ok: false,
      error: "Falta invoice",
    });
    assert.deepEqual(validateShipmentContactLogInput({ shipmentId: "s-1", note: " " }), {
      ok: false,
      error: "Escribe que dijo el cliente",
    });
    assert.deepEqual(
      validateShipmentContactLogInput({ shipmentId: "s-1", channel: "other", note: "Listo" }),
      { ok: false, error: "Escribe que medio usaste" },
    );
  });

  it("normalizes valid call follow-up input", () => {
    const result = validateShipmentContactLogInput({
      shipmentId: " s-1 ",
      channel: "call",
      outcome: "call_back",
      note: "  Cliente dice que manana esta lista.  ",
      nextStep: "Llamar antes de mandar chofer",
      followUpAt: "2026-07-07T10:30:00.000Z",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.shipmentId, "s-1");
    assert.equal(result.data.channel, "call");
    assert.equal(result.data.outcome, "call_back");
    assert.equal(result.data.note, "Cliente dice que manana esta lista.");
    assert.equal(result.data.nextStep, "Llamar antes de mandar chofer");
    assert.equal(result.data.followUpAt, "2026-07-07T10:30:00.000Z");
  });

  it("falls back unknown channel and outcome to call answered", () => {
    const result = validateShipmentContactLogInput({
      shipmentId: "s-1",
      channel: "fax",
      outcome: "maybe",
      note: "Contesto la hija.",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }

    assert.equal(result.data.channel, "call");
    assert.equal(result.data.outcome, "answered");
  });

  it("rejects invalid follow-up date", () => {
    assert.deepEqual(
      validateShipmentContactLogInput({
        shipmentId: "s-1",
        note: "Pidio llamar despues.",
        followUpAt: "ayer",
      }),
      { ok: false, error: "Fecha de seguimiento invalida" },
    );
  });

  it("builds readable labels and audit copy", () => {
    const result = validateShipmentContactLogInput({
      shipmentId: "s-1",
      channel: "whatsapp",
      outcome: "left_message",
      note: "Se mando mensaje.",
      nextStep: "Esperar respuesta",
    });
    const otherResult = validateShipmentContactLogInput({
      shipmentId: "s-1",
      channel: "other",
      channelOther: " Facebook ",
      outcome: "answered",
      note: "Contesto por Messenger.",
    });

    assert.equal(shipmentContactChannelLabel("whatsapp"), "WhatsApp");
    assert.equal(shipmentContactChannelLabel("other", "Facebook"), "Facebook");
    assert.equal(shipmentContactOutcomeLabel("left_message"), "Mensaje dejado");
    assert.equal(result.ok, true);
    assert.equal(otherResult.ok, true);
    if (!result.ok || !otherResult.ok) {
      return;
    }

    assert.equal(
      shipmentContactLogAuditDescription(result.data),
      "WhatsApp: Mensaje dejado · Se mando mensaje. · Sigue: Esperar respuesta",
    );
    assert.equal(otherResult.data.channelOther, "Facebook");
    assert.equal(
      shipmentContactLogAuditDescription(otherResult.data),
      "Facebook: Contesto · Contesto por Messenger.",
    );
    assert.equal(
      shipmentContactLogPreview({
        channel: "whatsapp",
        channelOther: "",
        note: "Se mando mensaje.\nSegunda linea",
      }),
      "WhatsApp · Se mando mensaje.",
    );
    assert.equal(
      shipmentContactLogPreview({
        channel: "other",
        channelOther: "Visita en tienda",
        note: "Paso a pagar.",
      }),
      "Visita en tienda · Paso a pagar.",
    );
  });

  it("summarizes custom contact channels by usage", () => {
    assert.deepEqual(
      summarizeShipmentContactChannelOthers([
        contactLog({ channel: "other", channelOther: "Facebook" }),
        contactLog({ channel: "other", channelOther: "Facebook" }),
        contactLog({ channel: "other", channelOther: "Visita en tienda" }),
        contactLog({ channel: "whatsapp", channelOther: "" }),
      ]),
      [
        { label: "Facebook", count: 2 },
        { label: "Visita en tienda", count: 1 },
      ],
    );
  });

  it("uses the latest contact log as the active reminder", () => {
    const older = contactLog({
      id: "old",
      followUpAt: "2026-07-06T18:00:00.000Z",
      createdAt: "2026-07-06T10:00:00.000Z",
    });
    const latest = contactLog({
      id: "new",
      followUpAt: null,
      createdAt: "2026-07-06T11:00:00.000Z",
    });

    assert.equal(latestShipmentContactLog([latest, older])?.id, "new");
    assert.equal(
      latestShipmentContactReminderStatus(
        [older, latest],
        new Date("2026-07-06T12:00:00.000Z"),
      ),
      "none",
    );
  });

  it("classifies due reminders as overdue or today", () => {
    const now = new Date("2026-07-06T12:00:00.000Z");

    assert.equal(
      shipmentContactReminderStatus(contactLog({ followUpAt: "2026-07-06T11:00:00.000Z" }), now),
      "overdue",
    );
    assert.equal(
      shipmentContactReminderStatus(contactLog({ followUpAt: "2026-07-06T18:00:00.000Z" }), now),
      "today",
    );
    assert.equal(
      shipmentContactReminderStatus(contactLog({ followUpAt: "2026-07-07T18:00:00.000Z" }), now),
      "none",
    );
    assert.equal(shipmentContactReminderLabel("overdue"), "Vencido");
    assert.equal(shipmentContactReminderLabel("today"), "Hoy");
  });
});

function contactLog(
  overrides: Partial<ShipmentContactLogRow> = {},
): ShipmentContactLogRow {
  return {
    id: "log-1",
    shipmentId: "s-1",
    channel: "call",
    channelOther: "",
    outcome: "answered",
    note: "Cliente contesto.",
    nextStep: "",
    followUpAt: null,
    createdBy: "u-1",
    createdByName: "Vendedor",
    createdAt: "2026-07-06T10:00:00.000Z",
    ...overrides,
  };
}
