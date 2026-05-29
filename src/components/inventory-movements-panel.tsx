"use client";

import type { InventoryMovement } from "@/lib/inventory-types";

type InventoryMovementsPanelProps = {
  movements: InventoryMovement[];
  warehouseName?: string;
};

const typeLabels: Record<InventoryMovement["type"], string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

const typeTone: Record<InventoryMovement["type"], string> = {
  entrada: "text-emerald-300",
  salida: "text-rose-300",
  ajuste: "text-amber-300",
};

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function InventoryMovementsPanel({
  movements,
  warehouseName,
}: InventoryMovementsPanelProps) {
  return (
    <section className="mt-6 rounded-xl border border-black bg-surface-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Historial</p>
          <h3 className="text-xl font-black text-[#f8fafc]">Movimientos de inventario</h3>
        </div>
        {warehouseName ? (
          <span className="rounded-lg border border-black bg-surface-panel px-3 py-1 text-sm font-bold text-slate-300">
            {warehouseName}
          </span>
        ) : null}
      </div>

      {!movements.length ? (
        <p className="rounded-lg border border-dashed border-black bg-surface-panel px-4 py-6 text-center text-sm font-bold text-slate-400">
          Sin movimientos en esta bodega.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-black text-xs font-black uppercase text-slate-400">
                <th className="px-2 py-2">Fecha</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Cant.</th>
                <th className="px-2 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id} className="border-b border-black/60">
                  <td className="px-2 py-2 font-bold text-slate-300">
                    {formatWhen(movement.createdAt)}
                  </td>
                  <td className="px-2 py-2 font-black text-[#f8fafc]">{movement.itemName}</td>
                  <td className={`px-2 py-2 font-black ${typeTone[movement.type]}`}>
                    {typeLabels[movement.type]}
                  </td>
                  <td className="px-2 py-2 font-black tabular-nums">{movement.qty}</td>
                  <td className="px-2 py-2 text-slate-400">{movement.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
