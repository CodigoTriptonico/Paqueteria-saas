"use client";

import { CalendarDays, Clock, Minus, Plus, Route, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  quotePromotionsForBox,
  type PricingPromotionConfig,
} from "@/lib/pricing-promotions";
import {
  saleRouteDecisionSchedule,
  saleRouteDecisionSummary,
  type SaleRouteDecision,
} from "@/lib/sale-route-decision";
import {
  deliveryModeCardClass,
  deliveryModeIconClass,
  deliverySummary,
  inputClass,
  personFullName,
  type Sender,
} from "@/components/sale/venta-parts";

export type QuickEmptyBoxDraft = {
  sender: Sender;
  box: string[];
  boxCount: number;
  emptyBoxMode: string;
  emptyBoxScheduleMode: string;
  emptyBoxScheduleAt: string;
  deliverySummary: string;
  routeDecision: SaleRouteDecision | null;
};

type SaleQuickEmptyBoxModalProps = {
  sender: Sender;
  boxes: string[][];
  promotions?: PricingPromotionConfig[];
  routeDecision: SaleRouteDecision | null;
  onClose: () => void;
  onClearRoute: () => void;
  onRequestRoute: () => void;
  onProceed: (draft: QuickEmptyBoxDraft) => void;
};

export function SaleQuickEmptyBoxModal({
  sender,
  boxes,
  promotions = [],
  routeDecision,
  onClose,
  onClearRoute,
  onRequestRoute,
  onProceed,
}: SaleQuickEmptyBoxModalProps) {
  const [selectedBoxKey, setSelectedBoxKey] = useState("");
  const [emptyBoxMode, setEmptyBoxMode] = useState("");
  const [boxCount, setBoxCount] = useState(1);

  const effectiveSelectedBoxKey = selectedBoxKey || boxes[0]?.[0] || "";
  const selectedBox = useMemo(
    () => boxes.find((box) => box[0] === effectiveSelectedBoxKey) || boxes[0] || null,
    [boxes, effectiveSelectedBoxKey],
  );

  const routeSchedule = saleRouteDecisionSchedule(routeDecision);
  const routeSummary = saleRouteDecisionSummary(routeDecision);

  const deliveryComplete =
    emptyBoxMode === "Cliente recoge caja vacia en oficina" ||
    (emptyBoxMode === "Programar entrega de caja vacia" && Boolean(routeDecision));

  const summary = deliverySummary(
    emptyBoxMode,
    routeSchedule.scheduleMode,
    routeSchedule.scheduleAt,
  );

  function selectMode(mode: string) {
    setEmptyBoxMode(mode);
    if (mode === "Cliente recoge caja vacia en oficina") {
      onClearRoute();
      return;
    }

    onRequestRoute();
  }

  const canProceed = Boolean(selectedBox && deliveryComplete);
  const boxUnitPrice = selectedBox ? Number(selectedBox[1]?.replace(/[^\d.]/g, "")) || 0 : 0;
  const boxSubtotal = boxUnitPrice * boxCount;
  const promotionQuotes = selectedBox
    ? quotePromotionsForBox({
        boxCount,
        boxUnitPrice: selectedBox[1] || "$0",
        catalogKey: selectedBox[5] || selectedBox[0],
        promotions,
      })
    : [];
  const automaticPromotion = promotionQuotes.length === 1 ? promotionQuotes[0] : null;
  const boxSubtotalLabel = automaticPromotion
    ? automaticPromotion.subtotalAfterDiscount
    : boxSubtotal > 0
      ? `$${boxSubtotal}`
      : "$0";

  function updateBoxCount(rawValue: string) {
    setBoxCount(Math.max(Number.parseInt(rawValue, 10) || 1, 1));
  }

  return (
    <div className="app-modal-overlay fixed inset-0 z-[120] flex justify-center bg-black/60 p-3 sm:p-4">
      <div className="app-modal-content w-full max-w-lg rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-black pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-500">Venta rápida</p>
            <h3 className="text-2xl font-black text-[#f8fafc]">Caja vacía + depósito</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-black"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-black bg-surface-card p-4">
            <p className="text-xs font-black uppercase text-slate-500">Remitente</p>
            <p className="break-words text-lg font-black text-[#f8fafc]">{personFullName(sender)}</p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-300">Caja</span>
            <select
              className={inputClass}
              value={effectiveSelectedBoxKey}
              onChange={(event) => setSelectedBoxKey(event.target.value)}
            >
              {boxes.map((box) => (
                <option key={box[0]} value={box[0]}>
                  {box[0]} — {box[1]}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-xl border border-black bg-surface-card p-3">
            <p className="text-xs font-black uppercase text-slate-500">Cantidad</p>
            <div className="mt-2 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
              <button
                type="button"
                onClick={() => setBoxCount((current) => Math.max(current - 1, 1))}
                className="flex h-11 items-center justify-center rounded-lg border border-black bg-surface-panel text-slate-300"
                aria-label="Restar caja"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                className={`${inputClass} text-center text-xl font-black`}
                value={boxCount}
                onChange={(event) => updateBoxCount(event.target.value)}
                inputMode="numeric"
                aria-label="Cantidad de cajas"
              />
              <button
                type="button"
                onClick={() => setBoxCount((current) => current + 1)}
                className="flex h-11 items-center justify-center rounded-lg border border-black bg-surface-panel text-slate-300"
                aria-label="Agregar caja"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => selectMode("Cliente recoge caja vacia en oficina")}
              className={`min-h-[7rem] rounded-xl border p-3 text-center transition ${deliveryModeCardClass(
                emptyBoxMode === "Cliente recoge caja vacia en oficina",
              )}`}
            >
              <span
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg border ${deliveryModeIconClass(
                  emptyBoxMode === "Cliente recoge caja vacia en oficina",
                )}`}
              >
                <Clock className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm font-black">Recoge en oficina</p>
            </button>
            <button
              type="button"
              onClick={() => selectMode("Programar entrega de caja vacia")}
              className={`min-h-[7rem] rounded-xl border p-3 text-center transition ${deliveryModeCardClass(
                emptyBoxMode === "Programar entrega de caja vacia",
              )}`}
            >
              <span
                className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg border ${deliveryModeIconClass(
                  emptyBoxMode === "Programar entrega de caja vacia",
                )}`}
              >
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="mt-2 text-sm font-black">Programar entrega</p>
            </button>
          </div>

          {emptyBoxMode === "Programar entrega de caja vacia" ? (
            <button
              type="button"
              onClick={onRequestRoute}
              className="flex w-full items-center gap-3 rounded-xl border border-black bg-surface-card p-3 text-left"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                <Route className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black uppercase text-slate-500">Ruta de entrega</span>
                <span className="mt-0.5 block break-words text-sm font-black text-[#f8fafc]">
                  {routeSummary || "Elige un día y una ruta disponible"}
                </span>
                <span className="mt-0.5 block text-xs font-bold text-slate-400">
                  Usa los días y conductores configurados en Rutas.
                </span>
              </span>
            </button>
          ) : null}

          {selectedBox ? (
            <div className="rounded-xl border border-black bg-surface-inset px-4 py-3 text-center">
              <p className="text-xs font-black uppercase text-slate-500">Depósito requerido</p>
              <p className="text-3xl font-black text-emerald-300">{boxSubtotalLabel}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {selectedBox[1]} x {boxCount}
              </p>
              {automaticPromotion ? (
                <p className="mt-1 text-xs font-black text-emerald-300">
                  {automaticPromotion.name} -{automaticPromotion.discountTotal}
                </p>
              ) : promotionQuotes.length > 1 ? (
                <p className="mt-1 text-xs font-black text-emerald-300">
                  Elige promocion al crear invoice
                </p>
              ) : null}
              {summary ? (
                <p className="mt-1 text-xs font-bold text-slate-400">{summary}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-lg border border-black font-black"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canProceed || !selectedBox}
            onClick={() => {
              if (!selectedBox) {
                return;
              }

              onProceed({
                sender,
                box: selectedBox,
                boxCount,
                emptyBoxMode,
                emptyBoxScheduleMode: routeSchedule.scheduleMode,
                emptyBoxScheduleAt: routeSchedule.scheduleAt,
                deliverySummary: summary,
                routeDecision,
              });
            }}
            className="h-12 rounded-lg bg-emerald-400 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continuar a pago
          </button>
        </div>
      </div>
    </div>
  );
}
