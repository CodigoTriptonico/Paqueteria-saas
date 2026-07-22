"use client";

import { Loader2, MapPin, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deactivateWarehouseBinAction,
  listWarehouseBinsAction,
  saveWarehouseBinAction,
} from "@/app/actions/inventory-bins";
import { CreateWarehouseBinModal } from "@/components/config/create-warehouse-bin-modal";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import type { WarehouseBin } from "@/lib/inventory-bins";
import {
  settingsIconBoxClass as iconBoxClass,
  settingsSectionClass as sectionClass,
  settingsSectionHeaderClass as sectionHeaderClass,
  settingsSectionTitleClass as sectionTitleClass,
} from "@/components/config/settings-panel-styles";

export function WarehouseBinsPanel({
  warehouses,
  canManage,
}: {
  warehouses: Array<{ id: string; name: string; is_active: boolean }>;
  canManage: boolean;
}) {
  const notify = useNotify();
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.is_active),
    [warehouses],
  );
  const [warehouseId, setWarehouseId] = useState(activeWarehouses[0]?.id || "");
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [zone, setZone] = useState("");
  const [aisle, setAisle] = useState("");
  const [shelf, setShelf] = useState("");
  const [label, setLabel] = useState("");
  const selectedWarehouseId = warehouseId || activeWarehouses[0]?.id || "";
  const selectedWarehouseName =
    activeWarehouses.find((warehouse) => warehouse.id === selectedWarehouseId)?.name || "";

  const reload = useCallback(
    async (nextWarehouseId = selectedWarehouseId) => {
      if (!nextWarehouseId) {
        setBins([]);
        return;
      }

      setLoading(true);
      const result = await listWarehouseBinsAction({
        warehouseId: nextWarehouseId,
        includeInactive: false,
      });
      setLoading(false);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setBins(result.data);
    },
    [notify, selectedWarehouseId],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  function resetDraft() {
    setZone("");
    setAisle("");
    setShelf("");
    setLabel("");
  }

  async function handleCreate() {
    if (!selectedWarehouseId) {
      return;
    }

    setSaving(true);
    const result = await saveWarehouseBinAction({
      warehouseId: selectedWarehouseId,
      zone,
      aisle,
      shelf,
      label,
    });
    setSaving(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Estante creado");
    resetDraft();
    setShowCreateModal(false);
    await reload();
  }

  return (
    <>
      <section className={sectionClass}>
        <div className={sectionHeaderClass}>
          <div className={sectionTitleClass}>
            <span className={iconBoxClass}>
              <MapPin className="h-4 w-4" />
            </span>
            <span>
              Zonas y estantes
              {bins.length ? (
                <span className="ml-2 text-sm font-bold text-slate-400">
                  {bins.length} {bins.length === 1 ? "ubicación" : "ubicaciones"}
                </span>
              ) : null}
            </span>
          </div>

          {canManage && selectedWarehouseId ? (
            <button
              type="button"
              className={`${primaryButtonClass} h-10 shrink-0 gap-1.5 px-4`}
              onClick={() => {
                resetDraft();
                setShowCreateModal(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo estante
            </button>
          ) : null}
        </div>

        <div className="space-y-4 px-4 py-4">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Bodega
            </span>
            <InlineSearchPicker
              value={selectedWarehouseId}
              onChange={(next) => setWarehouseId(next)}
              options={activeWarehouses.map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
              placeholder="Elegir bodega"
              disabled={!activeWarehouses.length}
            />
          </label>

          <div className="overflow-hidden rounded-xl border border-black">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-bold text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando estantes...
              </div>
            ) : !bins.length ? (
              <div className="px-4 py-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-black bg-surface-inset text-emerald-300">
                  <MapPin className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-black text-[#f8fafc]">Sin estantes</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {canManage
                    ? "Usa Nuevo estante para definir la primera ubicación."
                    : "Aún no hay ubicaciones en esta bodega."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-black/80">
                {bins.map((bin) => (
                  <li key={bin.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                      <MapPin className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[#f8fafc]">{bin.label}</p>
                      <p className="font-mono text-xs font-bold tracking-wide text-slate-500">
                        {bin.code}
                      </p>
                    </div>
                    {canManage ? (
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                        onClick={async () => {
                          const result = await deactivateWarehouseBinAction({
                            warehouseId: selectedWarehouseId,
                            binId: bin.id,
                          });

                          if (!result.ok) {
                            notify.error(result.error);
                            return;
                          }

                          notify.success("Estante desactivado");
                          await reload();
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Quitar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <CreateWarehouseBinModal
        open={showCreateModal}
        warehouseName={selectedWarehouseName}
        busy={saving}
        zone={zone}
        aisle={aisle}
        shelf={shelf}
        label={label}
        onClose={() => {
          if (saving) {
            return;
          }
          setShowCreateModal(false);
          resetDraft();
        }}
        onZoneChange={setZone}
        onAisleChange={setAisle}
        onShelfChange={setShelf}
        onLabelChange={setLabel}
        onCreate={() => void handleCreate()}
      />
    </>
  );
}
