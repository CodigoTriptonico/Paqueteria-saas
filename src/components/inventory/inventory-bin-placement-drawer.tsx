"use client";

import { ArrowRightLeft, Loader2, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  listInventoryBinPlacementsAction,
  listWarehouseBinsAction,
  setInventoryBinPlacementAction,
  transferInventoryBinStockAction,
} from "@/app/actions/inventory-bins";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  formatBinPlacementSummary,
  unplacedWarehouseQuantity,
  type InventoryBinPlacement,
  type WarehouseBin,
} from "@/lib/inventory-bins";
import { formatInventoryStockLabel } from "@/lib/inventory-units";
import type { InventoryStockItem } from "@/lib/inventory-stock";

type BinPlacementContext = {
  itemId: string;
  itemName: string;
  stockItem: InventoryStockItem;
};

export function InventoryBinPlacementDrawer({
  open,
  warehouseId,
  warehouseName,
  context,
  onClose,
}: {
  open: boolean;
  warehouseId?: string;
  warehouseName?: string;
  context: BinPlacementContext | null;
  onClose: () => void;
}) {
  const notify = useNotify();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingBinId, setSavingBinId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [placements, setPlacements] = useState<InventoryBinPlacement[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [transferFromId, setTransferFromId] = useState("");
  const [transferToId, setTransferToId] = useState("");
  const [transferQty, setTransferQty] = useState("");

  const reload = useCallback(async () => {
    if (!open || !warehouseId || !context?.itemId) {
      return;
    }

    setLoading(true);
    const [binsResult, placementsResult] = await Promise.all([
      listWarehouseBinsAction({ warehouseId }),
      listInventoryBinPlacementsAction({
        warehouseId,
        itemId: context.itemId,
      }),
    ]);
    setLoading(false);

    if (!binsResult.ok) {
      notify.error(binsResult.error);
      return;
    }

    if (!placementsResult.ok) {
      notify.error(placementsResult.error);
      return;
    }

    setBins(binsResult.data);
    setPlacements(placementsResult.data);
    setDrafts(
      Object.fromEntries(
        placementsResult.data.map((row) => [row.binId, String(row.quantity)]),
      ),
    );
  }, [context?.itemId, notify, open, warehouseId]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      void reload();
    });
  }, [open, reload]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const warehouseStock = context?.stockItem.stock || 0;
  const placedTotal = useMemo(
    () => placements.reduce((total, row) => total + row.quantity, 0),
    [placements],
  );
  const unplaced = unplacedWarehouseQuantity(warehouseStock, placements);
  const unitLabel = context
    ? formatInventoryStockLabel(context.stockItem, warehouseStock)
    : "";

  async function savePlacement(binId: string) {
    if (!warehouseId || !context?.itemId) {
      return;
    }

    const quantity = Number(drafts[binId] || 0);
    setSavingBinId(binId);
    const result = await setInventoryBinPlacementAction({
      warehouseId,
      itemId: context.itemId,
      binId,
      quantity: Number.isFinite(quantity) ? quantity : 0,
    });
    setSavingBinId("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setPlacements(result.data);
    setDrafts(
      Object.fromEntries(result.data.map((row) => [row.binId, String(row.quantity)])),
    );
    notify.success("Ubicación actualizada");
  }

  async function handleTransfer() {
    if (!warehouseId || !context?.itemId || !transferFromId || !transferToId) {
      return;
    }

    setTransferring(true);
    const result = await transferInventoryBinStockAction({
      warehouseId,
      itemId: context.itemId,
      fromBinId: transferFromId,
      toBinId: transferToId,
      quantity: Number(transferQty || 0),
    });
    setTransferring(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setPlacements(result.data);
    setDrafts(
      Object.fromEntries(result.data.map((row) => [row.binId, String(row.quantity)])),
    );
    setTransferQty("");
    notify.success("Stock movido entre estantes");
  }

  if (!mounted || !open || !context) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[150] flex justify-end bg-black/55">
      <button
        type="button"
        aria-label="Cerrar ubicación en bodega"
        className="absolute inset-0"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-black bg-[#141c19] shadow-[0_0_40px_rgba(0,0,0,0.45)]">
        <header className="flex items-start justify-between gap-3 border-b border-black px-4 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">
              Ubicación en bodega
            </p>
            <h2 className="truncate text-lg font-black text-[#f8fafc]">{context.itemName}</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {warehouseName || "Bodega"} · {warehouseStock} {unitLabel}
            </p>
            {placements.length ? (
              <p className="mt-1 text-xs font-bold text-slate-400">
                {formatBinPlacementSummary(placements, 3)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 border-b border-black px-4 py-3">
          <div className="rounded-lg border border-black bg-[#111827] px-2 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">En bodega</p>
            <p className="mt-1 text-sm font-black tabular-nums text-[#f8fafc]">{warehouseStock}</p>
          </div>
          <div className="rounded-lg border border-black bg-[#111827] px-2 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Ubicado</p>
            <p className="mt-1 text-sm font-black tabular-nums text-emerald-300">{placedTotal}</p>
          </div>
          <div className="rounded-lg border border-black bg-[#111827] px-2 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Sin ubicar</p>
            <p className="mt-1 text-sm font-black tabular-nums text-amber-300">{unplaced}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando estantes...
            </div>
          ) : !bins.length ? (
            <div className="rounded-xl border border-dashed border-slate-600/70 px-4 py-10 text-center">
              <p className="text-sm font-black text-slate-300">No hay estantes en esta bodega</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Créalos en Inventario → Bodegas → Zonas y estantes.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {bins.map((bin) => {
                const currentQty = placements.find((row) => row.binId === bin.id)?.quantity || 0;
                const draftValue = drafts[bin.id] ?? String(currentQty);

                return (
                  <li
                    key={bin.id}
                    className="rounded-xl border border-black bg-[#111827] px-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                        <MapPin className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-[#f8fafc]">{bin.label}</p>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {bin.code}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={`${inputClass} h-9 w-24 tabular-nums`}
                            value={draftValue}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [bin.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                            disabled={savingBinId === bin.id}
                            onClick={() => void savePlacement(bin.id)}
                          >
                            {savingBinId === bin.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Guardar"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {placements.length >= 2 ? (
          <footer className="border-t border-black px-4 py-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-slate-400" aria-hidden />
              <p className="text-sm font-black text-[#f8fafc]">Mover entre estantes</p>
            </div>
            <div className="mt-3 grid gap-2">
              <select
                className={inputClass}
                value={transferFromId}
                onChange={(event) => setTransferFromId(event.target.value)}
              >
                <option value="">Desde...</option>
                {placements.map((row) => (
                  <option key={row.binId} value={row.binId}>
                    {row.binCode} ({row.quantity})
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={transferToId}
                onChange={(event) => setTransferToId(event.target.value)}
              >
                <option value="">Hacia...</option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.code}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  className={`${inputClass} tabular-nums`}
                  value={transferQty}
                  onChange={(event) => setTransferQty(event.target.value)}
                  placeholder="Cantidad"
                />
                <button
                  type="button"
                  className={`${primaryButtonClass} shrink-0`}
                  disabled={transferring || !transferFromId || !transferToId || !transferQty}
                  onClick={() => void handleTransfer()}
                >
                  {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mover"}
                </button>
              </div>
            </div>
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
