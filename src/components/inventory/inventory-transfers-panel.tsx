"use client";

import { ArrowRightLeft, Loader2, Package } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelInventoryWarehouseTransferAction,
  createInventoryWarehouseTransferAction,
  listInventoryWarehouseTransfersAction,
  receiveInventoryWarehouseTransferAction,
} from "@/app/actions/inventory-transfers";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  availableWarehouseTransferQty,
  inventoryWarehouseTransferDirection,
  inventoryWarehouseTransferStatusLabels,
  validateWarehouseTransferInput,
  type InventoryWarehouseTransfer,
} from "@/lib/inventory-warehouse-transfers";
import { inventoryItemFilterOptions } from "@/lib/inventory-stock";
import type { InventoryStockItem } from "@/lib/inventory-stock";

type WarehouseOption = {
  id: string;
  name: string;
};

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function InventoryTransfersPanel({
  warehouseId,
  warehouseName,
  warehouses,
  items,
  active,
  onTransfersChange,
  onInventoryRefresh,
}: {
  warehouseId: string;
  warehouseName?: string;
  warehouses: WarehouseOption[];
  items: InventoryStockItem[];
  active: boolean;
  onTransfersChange?: (next: InventoryWarehouseTransfer[]) => void;
  onInventoryRefresh?: () => Promise<void> | void;
}) {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState("");
  const [transfers, setTransfers] = useState<InventoryWarehouseTransfer[]>([]);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  const destinationWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.id !== warehouseId),
    [warehouseId, warehouses],
  );

  const itemOptions = useMemo(() => inventoryItemFilterOptions(items), [items]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === itemId) || null,
    [itemId, items],
  );

  const availableQty = selectedItem
    ? availableWarehouseTransferQty(selectedItem)
    : 0;

  const reload = useCallback(async () => {
    if (!warehouseId) {
      return;
    }

    setLoading(true);
    const result = await listInventoryWarehouseTransfersAction({ warehouseId });
    setLoading(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setTransfers(result.data);
    onTransfersChange?.(result.data);
  }, [notify, onTransfersChange, warehouseId]);

  useEffect(() => {
    if (!active || !warehouseId) {
      return;
    }

    queueMicrotask(() => {
      void reload();
    });
  }, [active, reload, warehouseId]);

  async function handleCreate() {
    const parsedQty = Number(qty || 0);
    const validation = validateWarehouseTransferInput({
      fromWarehouseId: warehouseId,
      toWarehouseId,
      itemId,
      qty: parsedQty,
      availableQty,
    });

    if (!validation.ok) {
      notify.error(validation.error);
      return;
    }

    setSubmitting(true);
    const result = await createInventoryWarehouseTransferAction({
      fromWarehouseId: warehouseId,
      toWarehouseId,
      itemId,
      qty: parsedQty,
      note,
    });
    setSubmitting(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Transferencia enviada");
    setQty("1");
    setNote("");
    await reload();
    await onInventoryRefresh?.();
  }

  async function handleReceive(transferId: string) {
    setActionId(transferId);
    const result = await receiveInventoryWarehouseTransferAction({
      transferId,
      warehouseId,
    });
    setActionId("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Transferencia recibida");
    await reload();
    await onInventoryRefresh?.();
  }

  async function handleCancel(transferId: string) {
    setActionId(transferId);
    const result = await cancelInventoryWarehouseTransferAction({
      transferId,
      warehouseId,
    });
    setActionId("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Transferencia cancelada");
    await reload();
    await onInventoryRefresh?.();
  }

  const incomingOpen = transfers.filter(
    (transfer) =>
      transfer.toWarehouseId === warehouseId && transfer.status === "in_transit",
  );
  const outgoingOpen = transfers.filter(
    (transfer) =>
      transfer.fromWarehouseId === warehouseId && transfer.status === "in_transit",
  );
  const recentClosed = transfers.filter((transfer) => transfer.status !== "in_transit").slice(0, 20);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-black/70 px-4 py-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-emerald-300" aria-hidden />
          <div>
            <p className="text-sm font-black text-[#f8fafc]">Transferencias entre bodegas</p>
            <p className="text-xs font-bold text-slate-500">
              {warehouseName || "Bodega activa"} envía, la otra bodega confirma recepción.
            </p>
          </div>
        </div>

        {destinationWarehouses.length ? (
          <div className="mt-4 grid gap-2">
            <select
              className={inputClass}
              value={toWarehouseId}
              onChange={(event) => setToWarehouseId(event.target.value)}
            >
              <option value="">Bodega destino...</option>
              {destinationWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <select
              className={inputClass}
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              <option value="">Producto...</option>
              {itemOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="number"
                min={1}
                step={1}
                className={`${inputClass} tabular-nums`}
                value={qty}
                onChange={(event) => setQty(event.target.value)}
                placeholder="Cantidad"
              />
              <button
                type="button"
                className={`${primaryButtonClass} shrink-0`}
                disabled={submitting || !toWarehouseId || !itemId}
                onClick={() => void handleCreate()}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
              </button>
            </div>
            {selectedItem ? (
              <p className="text-xs font-bold text-slate-500">
                Disponible en origen: {availableQty}
              </p>
            ) : null}
            <input
              className={inputClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Motivo opcional"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs font-bold text-slate-500">
            Necesitas al menos dos bodegas activas para transferir stock.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando transferencias...
          </div>
        ) : !transfers.length ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-[#111827] text-slate-500">
              <Package className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-4 text-base font-black text-[#f8fafc]">Sin transferencias</p>
            <p className="mt-1 max-w-xs text-sm font-bold text-slate-500">
              Cuando envíes stock a otra bodega, el movimiento quedará en tránsito hasta que la reciban.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {incomingOpen.length ? (
              <section className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wide text-emerald-300">
                  Por recibir ({incomingOpen.length})
                </h3>
                <ul className="space-y-2">
                  {incomingOpen.map((transfer) => (
                    <TransferCard
                      key={transfer.id}
                      transfer={transfer}
                      warehouseId={warehouseId}
                      actionId={actionId}
                      onReceive={() => void handleReceive(transfer.id)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {outgoingOpen.length ? (
              <section className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wide text-sky-300">
                  Enviadas en tránsito ({outgoingOpen.length})
                </h3>
                <ul className="space-y-2">
                  {outgoingOpen.map((transfer) => (
                    <TransferCard
                      key={transfer.id}
                      transfer={transfer}
                      warehouseId={warehouseId}
                      actionId={actionId}
                      onCancel={() => void handleCancel(transfer.id)}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {recentClosed.length ? (
              <section className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Cerradas recientemente
                </h3>
                <ul className="space-y-2">
                  {recentClosed.map((transfer) => (
                    <TransferCard
                      key={transfer.id}
                      transfer={transfer}
                      warehouseId={warehouseId}
                      actionId={actionId}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferCard({
  transfer,
  warehouseId,
  actionId,
  onReceive,
  onCancel,
}: {
  transfer: InventoryWarehouseTransfer;
  warehouseId: string;
  actionId: string;
  onReceive?: () => void;
  onCancel?: () => void;
}) {
  const direction = inventoryWarehouseTransferDirection(transfer, warehouseId);
  const busy = actionId === transfer.id;

  return (
    <li className="rounded-xl border border-black bg-[#111827] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-[#f8fafc]">{transfer.itemName}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {transfer.fromWarehouseName} → {transfer.toWarehouseName}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {formatWhen(transfer.createdAt)}
            {transfer.createdByName ? ` · ${transfer.createdByName}` : ""}
          </p>
          {transfer.note ? (
            <p className="mt-1 text-xs font-bold text-slate-500">{transfer.note}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-black tabular-nums text-[#f8fafc]">{transfer.qty}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
            {inventoryWarehouseTransferStatusLabels[transfer.status]}
          </p>
        </div>
      </div>

      {transfer.status === "in_transit" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {direction === "incoming" && onReceive ? (
            <button
              type="button"
              className={`${primaryButtonClass} h-8 px-3 text-xs`}
              disabled={busy}
              onClick={onReceive}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar recepción"}
            </button>
          ) : null}
          {direction === "outgoing" && onCancel ? (
            <button
              type="button"
              className={`${secondaryButtonClass} h-8 px-3 text-xs`}
              disabled={busy}
              onClick={onCancel}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancelar envío"}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
