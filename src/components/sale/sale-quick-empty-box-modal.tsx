"use client";

import { CalendarDays, Clock, Package, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  personFullName,
  SaleBoxCartQtyBadge,
  type Sender,
} from "@/components/sale/venta-parts";
import { nextQuickBoxSelection } from "@/lib/sale-quick-box-selection";
import { SaleDepositChargeField } from "@/components/sale/sale-payment-method-field";
import { parseMoneyValue } from "@/lib/logistics-fees";
import {
  defaultSaleDepositDraft,
  saleDepositChargeAmountDigits,
  type SaleDepositChargeMode,
} from "@/lib/sale-deposit-charge";

export type QuickEmptyBoxDraft = {
  sender: Sender;
  country: string;
  box: string[];
  boxCount: number;
  depositPaid: boolean;
  paymentMode: SaleDepositChargeMode;
  payNowAmount: string;
  emptyBoxMode: string;
  emptyBoxScheduleMode: string;
  emptyBoxScheduleAt: string;
  deliverySummary: string;
  routeDecision: SaleRouteDecision | null;
};

type SaleQuickEmptyBoxModalProps = {
  sender: Sender;
  country: string;
  boxes: string[][];
  promotions?: PricingPromotionConfig[];
  minimumDeposit: string;
  routeDecision: SaleRouteDecision | null;
  onClose: () => void;
  onClearRoute: () => void;
  onRequestRoute: () => void;
  onProceed: (draft: QuickEmptyBoxDraft) => void;
};

export function SaleQuickEmptyBoxModal({
  sender,
  country,
  boxes,
  promotions = [],
  minimumDeposit,
  routeDecision,
  onClose,
  onClearRoute,
  onRequestRoute,
  onProceed,
}: SaleQuickEmptyBoxModalProps) {
  const [selectedBoxKey, setSelectedBoxKey] = useState("");
  const [emptyBoxMode, setEmptyBoxMode] = useState("");
  const [boxCount, setBoxCount] = useState(0);
  const [depositPaid, setDepositPaid] = useState(true);
  const [paymentMode, setPaymentMode] = useState<SaleDepositChargeMode>("deposit");
  const [depositDraft, setDepositDraft] = useState("");
  const [depositDraftTouched, setDepositDraftTouched] = useState(false);

  const selectedBox = useMemo(
    () => boxes.find((box) => box[0] === selectedBoxKey) || null,
    [boxes, selectedBoxKey],
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
  const quotedTotal = automaticPromotion
    ? parseMoneyValue(automaticPromotion.subtotalAfterDiscount)
    : boxSubtotal;

  useEffect(() => {
    if (depositDraftTouched) {
      return;
    }

    queueMicrotask(() => {
      setDepositDraft(defaultSaleDepositDraft(minimumDeposit, quotedTotal));
    });
  }, [depositDraftTouched, minimumDeposit, quotedTotal]);

  function updateBoxSelection(boxKey: string, action: "add" | "remove") {
    const next = nextQuickBoxSelection(
      { boxKey: selectedBoxKey, quantity: boxCount },
      boxKey,
      action,
    );
    setSelectedBoxKey(next.boxKey);
    setBoxCount(next.quantity);
  }

  return (
    <div className="app-modal-overlay fixed inset-0 z-[120] flex justify-center bg-black/60 p-3 sm:p-4">
      <div className="app-modal-content w-full max-w-lg rounded-xl border border-black bg-surface-panel p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-black pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-500">Venta rápida</p>
            <h3 className="text-2xl font-black text-[#f8fafc]">Venta de caja vacía</h3>
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

          <fieldset className="grid gap-2">
            <legend className="text-sm font-black text-slate-300">
              Caja{country ? ` · ${country}` : ""}
            </legend>
            {boxes.length ? (
              <>
                <div
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                  role="group"
                  aria-label={`Cajas para ${country || "venta rápida"}`}
                >
                  {boxes.map((box) => {
                  const selected = box[0] === selectedBoxKey;

                  return (
                    <button
                      key={box[0]}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${box[0]}, ${box[1]}${selected ? `, ${boxCount} en carrito` : ""}. Clic agrega; clic derecho resta`}
                      title={`${box[0]}: clic izquierdo agrega, clic derecho resta`}
                      onClick={() => updateBoxSelection(box[0], "add")}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        updateBoxSelection(box[0], "remove");
                      }}
                      onMouseUp={(event) => {
                        if (event.button === 2) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      className={`group relative flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center shadow-[0_6px_16px_rgba(0,0,0,0.22)] transition focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
                        selected
                          ? "border-emerald-400 bg-emerald-400/10 shadow-[0_8px_20px_rgba(16,185,129,0.14)]"
                          : "border-black bg-[#3f4b46] hover:-translate-y-0.5 hover:bg-[#46544e]"
                      }`}
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-slate-950 transition ${
                          selected
                            ? "bg-emerald-300 shadow-[0_8px_16px_rgba(16,185,129,0.2)]"
                            : "bg-emerald-400"
                        }`}
                      >
                        <Package className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 max-w-full">
                        <span className="block truncate text-sm font-black leading-tight text-[#f8fafc]">
                          {box[0]}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] font-bold text-slate-400">
                          {box[4] || "Caja vacía"}
                        </span>
                      </span>
                      <span className="mt-auto w-full rounded-lg border border-black/70 bg-[#202926] px-2 py-1.5">
                        <span className="block text-[9px] font-black uppercase text-slate-400">
                          Cobra
                        </span>
                        <span className="block text-base font-black tabular-nums text-[#f8fafc]">
                          {box[1]}
                        </span>
                        <span className="flex h-10 items-start justify-center">
                          {selected && boxCount > 0 ? (
                            <SaleBoxCartQtyBadge quantity={boxCount} />
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                  })}
                </div>
                <span className="text-center text-[11px] font-bold text-slate-500">
                  Clic agrega · clic derecho resta
                </span>
              </>
            ) : (
              <span className="rounded-lg border border-amber-900/60 bg-amber-950/25 px-3 py-2 text-xs font-bold text-amber-100">
                <strong className="block font-black">No hay cajas con precio.</strong>
                Configura al menos una para usar la venta rápida.
              </span>
            )}
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-black text-slate-300">
              ¿Cómo se entrega la caja vacía?
            </legend>
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
              <p className="mt-2 text-sm font-black">Entregar ahora</p>
              <p className="mt-1 text-xs font-bold text-slate-400">Entregarla en mostrador</p>
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
              <p className="mt-2 text-sm font-black">Programar ruta</p>
              <p className="mt-1 line-clamp-2 min-h-8 text-xs font-bold text-slate-400">
                {routeSummary || "Elegir día y ruta"}
              </p>
            </button>
            </div>
          </fieldset>

          <SaleDepositChargeField
            mode={paymentMode}
            depositDraft={depositDraft}
            minimumDeposit={minimumDeposit}
            quotedTotal={quotedTotal}
            paid={depositPaid}
            boxDetail={selectedBox ? `${selectedBox[1]} x ${boxCount}` : ""}
            promotionLabel={
              automaticPromotion
                ? `${automaticPromotion.name} -${automaticPromotion.discountTotal}`
                : promotionQuotes.length > 1
                  ? "Elige promoción al crear invoice"
                  : ""
            }
            deliveryLabel={summary === "Pendiente" ? "" : summary}
            onModeChange={setPaymentMode}
            onDepositDraftChange={(value) => {
              setDepositDraftTouched(true);
              setDepositDraft(value);
            }}
            onPaidChange={setDepositPaid}
          />
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
                country,
                box: selectedBox,
                boxCount,
                depositPaid,
                paymentMode,
                payNowAmount: saleDepositChargeAmountDigits({
                  mode: paymentMode,
                  depositDraft,
                  minimumDeposit,
                  quotedTotal,
                }),
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
