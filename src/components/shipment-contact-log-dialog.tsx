"use client";

import { useMemo, useState } from "react";
import {
  AlarmClock,
  BadgeX,
  CalendarClock,
  MessageSquare,
  PhoneCall,
  PhoneOff,
} from "lucide-react";
import {
  createShipmentContactLogAction,
  type ShipmentRow,
} from "@/app/actions/shipments";
import {
  SHIPMENT_CONTACT_CHANNELS,
  latestShipmentContactLog,
  shipmentContactChannelLabel,
  shipmentContactLogPreview,
  shipmentContactOutcomeLabel,
  shipmentContactReminderLabel,
  shipmentContactReminderStatus,
  type ShipmentContactChannel,
  type ShipmentContactOutcome,
} from "@/lib/shipment-contact-log";
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { DateTimeInput } from "@/components/date-time-input";
import { formatDateTimeInputValue } from "@/lib/date-picker";

type ShipmentContactLogDialogProps = {
  open: boolean;
  shipment: ShipmentRow | null;
  onClose: () => void;
  onSaved: (shipment: ShipmentRow) => void;
  onError: (message: string) => void;
};

const outcomeButtons: {
  value: ShipmentContactOutcome;
  label: string;
  icon: typeof PhoneCall;
}[] = [
  { value: "answered", label: "Contestó", icon: PhoneCall },
  { value: "no_answer", label: "No contestó", icon: PhoneOff },
  { value: "left_message", label: "Mensaje", icon: MessageSquare },
  { value: "call_back", label: "Llamar después", icon: AlarmClock },
  { value: "wrong_number", label: "Número mal", icon: BadgeX },
];

const reminderShortcuts = [
  { label: "Hoy 5 PM", dayOffset: 0, hour: 17 },
  { label: "Mañana 9 AM", dayOffset: 1, hour: 9 },
  { label: "En 2 días", dayOffset: 2, hour: 9 },
];

export function ShipmentContactLogDialog({
  open,
  shipment,
  onClose,
  onSaved,
  onError,
}: ShipmentContactLogDialogProps) {
  const [channel, setChannel] = useState<ShipmentContactChannel>("call");
  const [channelOther, setChannelOther] = useState("");
  const [outcome, setOutcome] = useState<ShipmentContactOutcome>("answered");
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [saving, setSaving] = useState(false);

  const logs = useMemo(
    () => [...(shipment?.contactLogs || [])].reverse(),
    [shipment?.contactLogs],
  );

  if (!open || !shipment) {
    return null;
  }

  async function saveContactLog() {
    if (!shipment) {
      return;
    }

    setSaving(true);

    try {
      const result = await createShipmentContactLogAction({
        shipmentId: shipment.id,
        channel,
        channelOther,
        outcome,
        note,
        nextStep,
        followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
      });

      if (!result.ok) {
        onError(result.error);
        return;
      }

      onSaved(result.data);
      setNote("");
      setNextStep("");
      setFollowUpAt("");
      setOutcome("answered");
      setChannel("call");
      setChannelOther("");
    } finally {
      setSaving(false);
    }
  }

  const needsChannelOther = channel === "other";
  const canSave = Boolean(note.trim()) && (!needsChannelOther || Boolean(channelOther.trim()));

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 sm:p-4">
      <button
        type="button"
        aria-label="Cerrar seguimiento"
        className="absolute inset-0"
        onClick={onClose}
        disabled={saving}
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-black bg-surface-panel shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shipment-contact-log-title"
      >
        <div className="border-b border-black bg-surface-card-header px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-emerald-400 text-slate-950">
              <PhoneCall className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p id="shipment-contact-log-title" className="text-lg font-black text-[#f8fafc]">
                Seguimiento
              </p>
              <p className="mt-0.5 truncate text-xs font-black text-slate-400">
                {shipment.code} · {shipment.customer_name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:grid-cols-[1fr_0.92fr] sm:p-4">
          <section className="rounded-lg border border-black bg-surface-card p-3">
            <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Medio
              <select
                className={`${inputClass} h-10 text-xs`}
                value={channel}
                disabled={saving}
                onChange={(event) => {
                  const nextChannel = event.target.value as ShipmentContactChannel;
                  setChannel(nextChannel);

                  if (nextChannel !== "other") {
                    setChannelOther("");
                  }
                }}
              >
                {SHIPMENT_CONTACT_CHANNELS.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>

            {needsChannelOther ? (
              <label className="mt-2 grid gap-1 text-[10px] font-black uppercase text-slate-500">
                ¿Cuál?
                <input
                  className={`${inputClass} h-10 text-xs`}
                  maxLength={80}
                  value={channelOther}
                  disabled={saving}
                  placeholder="Ej. Facebook, visita en tienda..."
                  onChange={(event) => setChannelOther(event.target.value)}
                  autoFocus
                />
              </label>
            ) : null}

            <div className="mt-3">
              <p className="mb-1 text-[10px] font-black uppercase text-slate-500">
                Qué pasó
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {outcomeButtons.map((entry) => {
                  const Icon = entry.icon;
                  const active = outcome === entry.value;

                  return (
                    <button
                      key={entry.value}
                      type="button"
                      disabled={saving}
                      onClick={() => setOutcome(entry.value)}
                      className={`flex min-h-14 items-center gap-2 rounded-lg border px-2.5 text-left text-xs font-black transition disabled:opacity-50 ${
                        active
                          ? "border-emerald-600/50 bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-400/20"
                          : "border-black bg-surface-inset text-slate-300 hover:bg-surface-card"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 leading-tight">{entry.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-3 grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Qué dijo
              <textarea
                className="min-h-28 rounded-lg border border-black bg-surface-inset px-3 py-2 text-sm font-bold leading-snug text-[#f8fafc] outline-none placeholder:text-slate-500 disabled:opacity-50"
                maxLength={2000}
                value={note}
                disabled={saving}
                placeholder="Ej. Dice que la caja queda lista hoy a las 5."
                onChange={(event) => setNote(event.target.value)}
                autoFocus
              />
            </label>

            <label className="mt-3 grid gap-1 text-[10px] font-black uppercase text-slate-500">
              Qué sigue
              <input
                className={`${inputClass} h-10 text-xs`}
                maxLength={240}
                value={nextStep}
                disabled={saving}
                placeholder="Ej. Llamar antes de mandar chofer"
                onChange={(event) => setNextStep(event.target.value)}
              />
            </label>

            <div className="mt-3">
              <label className="grid gap-1 text-[10px] font-black uppercase text-slate-500">
                Recordarme
                <DateTimeInput
                  value={followUpAt}
                  disabled={saving}
                  ariaLabel="recordatorio de seguimiento"
                  onChange={setFollowUpAt}
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {reminderShortcuts.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    disabled={saving}
                    className="h-8 rounded-lg border border-black bg-surface-inset px-2.5 text-[10px] font-black text-slate-300 hover:bg-surface-card disabled:opacity-50"
                    onClick={() =>
                      setFollowUpAt(reminderInputValue(entry.dayOffset, entry.hour))
                    }
                  >
                    {entry.label}
                  </button>
                ))}
                {followUpAt ? (
                  <button
                    type="button"
                    disabled={saving}
                    className="h-8 rounded-lg border border-black bg-surface-inset px-2.5 text-[10px] font-black text-rose-200 hover:bg-surface-card disabled:opacity-50"
                    onClick={() => setFollowUpAt("")}
                  >
                    Sin recordar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={`${secondaryButtonClass} h-10 text-xs disabled:opacity-40`}
                onClick={onClose}
                disabled={saving}
              >
                Cerrar
              </button>
              <button
                type="button"
                className={`${primaryButtonClass} h-10 text-xs disabled:opacity-40`}
                onClick={() => void saveContactLog()}
                disabled={saving || !canSave}
              >
                {saving ? "Guardando..." : "Guardar seguimiento"}
              </button>
            </div>
          </section>

          <section className="min-h-0 rounded-lg border border-black bg-surface-card p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase text-slate-400">Historial</p>
              <span className="rounded-full border border-black bg-surface-inset px-2 py-0.5 text-[10px] font-black text-slate-300">
                {logs.length}
              </span>
            </div>

            {logs.length ? (
              <div className="grid max-h-[54vh] gap-2 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <article key={log.id} className="rounded-lg border border-black bg-surface-inset p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-black text-[#f8fafc]">
                        {shipmentContactChannelLabel(log.channel, log.channelOther)} ·{" "}
                        {shipmentContactOutcomeLabel(log.outcome)}
                      </p>
                      <time className="shrink-0 text-[10px] font-black text-slate-500">
                        {formatContactDate(log.createdAt)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-snug text-slate-300">
                      {log.note}
                    </p>
                    {log.nextStep || log.followUpAt ? (
                      <p className="mt-2 flex items-center gap-1 rounded-md border border-black bg-surface-card px-2 py-1 text-[10px] font-black text-amber-200">
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        <span className="min-w-0">
                          {log.nextStep || "Dar seguimiento"}
                          {log.followUpAt ? ` · ${formatContactDate(log.followUpAt)}` : ""}
                        </span>
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                      {log.createdByName}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-black bg-surface-inset px-3 py-6 text-center">
                <PhoneCall className="mx-auto h-6 w-6 text-slate-500" aria-hidden />
                <p className="mt-2 text-sm font-black text-[#f8fafc]">
                  Sin seguimiento
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Guarda el primer contacto.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function ShipmentContactLogLine({ shipment }: { shipment: ShipmentRow }) {
  const latest = latestShipmentContactLog(shipment.contactLogs);

  if (!latest) {
    return null;
  }

  const reminderStatus = shipmentContactReminderStatus(latest);
  const reminderLabel = shipmentContactReminderLabel(reminderStatus);

  return (
    <p className="mt-1.5 flex min-w-0 items-center gap-1.5 rounded-md border border-black bg-surface-inset px-2 py-1 text-[10px] font-black text-slate-300">
      <span className="min-w-0 flex-1 truncate">
        Seguimiento: {shipmentContactLogPreview(latest)}
        {latest.followUpAt ? ` · ${formatContactDate(latest.followUpAt)}` : ""}
      </span>
      {reminderLabel ? (
        <span
          className={`shrink-0 rounded-md border border-black px-1.5 py-0.5 text-[9px] font-black ${
            reminderStatus === "overdue"
              ? "bg-rose-400/15 text-rose-200"
              : "bg-amber-400/15 text-amber-200"
          }`}
        >
          {reminderLabel}
        </span>
      ) : null}
    </p>
  );
}

function reminderInputValue(dayOffset: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return formatDateTimeInputValue(date);
}

function formatContactDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
