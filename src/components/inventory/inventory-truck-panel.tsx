"use client";

import Link from "next/link";
import { ArrowRight, Package, RefreshCw, Truck } from "lucide-react";
import { useState, useTransition } from "react";
import { listConductorTruckBalancesAction } from "@/app/actions/conductor-tasks";
import { secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import type { ConductorTruckBalance } from "@/lib/conductor-truck-inventory";

function truckBalanceTitle(balance: ConductorTruckBalance) {
  if (balance.vehicleName) {
    return balance.vehiclePlate
      ? `${balance.vehicleName} · ${balance.vehiclePlate}`
      : balance.vehicleName;
  }

  return "Vehículo";
}

export function InventoryTruckPanel({
  initialBalances,
  onBalancesChange,
}: {
  initialBalances: ConductorTruckBalance[];
  onBalancesChange?: (balances: ConductorTruckBalance[]) => void;
}) {
  const notify = useNotify();
  const [balances, setBalances] = useState(initialBalances);
  const [refreshing, startRefresh] = useTransition();
  const balancesWithStock = balances.filter((balance) => balance.totalQty > 0);
  const totalQty = balances.reduce((total, balance) => total + balance.totalQty, 0);
  const trucksWithStock = balancesWithStock.length;

  function refresh() {
    startRefresh(() => {
      void listConductorTruckBalancesAction().then((result) => {
        if (!result.ok) {
          notify.error(result.error);
          return;
        }

        setBalances(result.data);
        onBalancesChange?.(result.data);
        notify.success("Inventario de camiones actualizado");
      });
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#17201d] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-sky-300">
            Inventario físico
          </p>
          <h2 className="mt-1 text-xl font-black text-[#f8fafc]">Cajas en camiones</h2>
          <p className="mt-1 max-w-2xl text-sm font-bold text-slate-400">
            Saldo por vehículo. Las cajas siguen en el camión aunque cambie el conductor asignado;
            bajan cuando se entregan, vuelven a bodega o se transfieren a otro camión.
          </p>
        </div>
        <button
          type="button"
          className={`${secondaryButtonClass} h-10 shrink-0 px-3 text-xs disabled:opacity-50`}
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-black bg-surface-card px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Cajas en camiones
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-sky-300">{totalQty}</p>
        </div>
        <div className="rounded-xl border border-black bg-surface-card px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Camiones con cajas
          </p>
          <p className="mt-1 text-2xl font-black tabular-nums text-emerald-300">
            {trucksWithStock}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {balancesWithStock.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {balancesWithStock.map((balance) => (
              <article
                key={balance.vehicleId}
                className="rounded-xl border border-black bg-surface-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-sky-400 text-slate-950">
                      <Truck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-[#f8fafc]">
                        {truckBalanceTitle(balance)}
                      </h3>
                      <p className="truncate text-xs font-bold text-slate-500">
                        {balance.assignedDriverName
                          ? `Conductor: ${balance.assignedDriverName} · ${balance.totalQty} ${balance.totalQty === 1 ? "caja" : "cajas"}`
                          : `Sin conductor asignado · ${balance.totalQty} ${balance.totalQty === 1 ? "caja" : "cajas"}`}
                      </p>
                    </div>
                  </div>
                  {balance.assignedDriverId ? (
                    <Link
                      href={`/conductor/inventario-camion?conductor=${encodeURIComponent(balance.assignedDriverId)}`}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-black bg-surface-inset px-2 text-[10px] font-black text-sky-200 hover:text-white"
                    >
                      Ver
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2">
                  {balance.lines.filter((line) => line.currentQty > 0).length ? (
                    balance.lines
                      .filter((line) => line.currentQty > 0)
                      .map((line) => (
                      <div
                        key={line.key}
                        className="flex items-center justify-between gap-3 rounded-lg border border-black/70 bg-surface-inset px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Package className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate text-xs font-black text-slate-200">
                            {line.label}
                          </span>
                        </div>
                        <span className="text-sm font-black tabular-nums text-sky-300">
                          {line.currentQty}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-black/70 px-3 py-3 text-xs font-bold text-slate-500">
                      Sin cajas en camión
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-xl border border-dashed border-black/70 bg-surface-card/40 px-6 py-10 text-center">
            <Truck className="h-8 w-8 text-slate-500" />
            <p className="mt-3 text-base font-black text-[#f8fafc]">Ningún camión con cajas cargadas</p>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Cuando un conductor suba cajas al camión, aparecerán aquí agrupadas por vehículo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
