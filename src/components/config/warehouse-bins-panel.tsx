"use client";

import { Loader2, MapPin, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  deactivateWarehouseBinAction,
  listWarehouseBinsAction,
  saveWarehouseBinAction,
} from "@/app/actions/inventory-bins";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import {
  buildWarehouseBinCode,
  buildWarehouseBinLabel,
  type WarehouseBin,
} from "@/lib/inventory-bins";
import {
  settingsSectionClass as sectionClass,
  settingsSectionHeaderClass as sectionHeaderClass,
  settingsSectionTitleClass as sectionTitleClass,
} from "@/components/config/settings-panel-styles";

const compactInputClass = `${inputClass} h-10`;

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
  const [zone, setZone] = useState("");
  const [aisle, setAisle] = useState("");
  const [shelf, setShelf] = useState("");
  const [label, setLabel] = useState("");

  const previewCode = buildWarehouseBinCode({ zone, aisle, shelf });
  const previewLabel = previewCode
    ? buildWarehouseBinLabel({ zone, aisle, shelf, label, code: previewCode })
    : "";

  useEffect(() => {
    if (!warehouseId && activeWarehouses[0]?.id) {
      setWarehouseId(activeWarehouses[0].id);
    }
  }, [activeWarehouses, warehouseId]);

  async function reload(nextWarehouseId = warehouseId) {
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
  }

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [warehouseId]);

  async function handleCreate() {
    if (!warehouseId) {
      return;
    }

    setSaving(true);
    const result = await saveWarehouseBinAction({
      warehouseId,
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
    setZone("");
    setAisle("");
    setShelf("");
    setLabel("");
    await reload();
  }

  return (
    <section className={sectionClass}>
      <div className={sectionHeaderClass}>
        <div>
          <p className={settingsSectionTitleClass}>Zonas y estantes</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Define ubicaciones internas para saber dónde está el stock dentro de cada bodega.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <label className="grid gap-1 text-xs font-black text-slate-300">
          Bodega
          <InlineSearchPicker
            value={warehouseId}
            onChange={(next) => setWarehouseId(next)}
            options={activeWarehouses.map((warehouse) => ({
              value: warehouse.id,
              label: warehouse.name,
            }))}
            placeholder="Elegir bodega"
            disabled={!activeWarehouses.length}
          />
        </label>

        {canManage ? (
          <div className="rounded-xl border border-black bg-surface-inset/40 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-black bg-surface-card text-emerald-300">
                <Plus className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-black text-[#f8fafc]">Nuevo estante</p>
                <p className="text-[11px] font-bold text-slate-500">
                  Código automático: {previewCode || "—"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                Zona
                <input
                  className={compactInputClass}
                  value={zone}
                  onChange={(event) => setZone(event.target.value)}
                  placeholder="A"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                Pasillo
                <input
                  className={compactInputClass}
                  value={aisle}
                  onChange={(event) => setAisle(event.target.value)}
                  placeholder="2"
                />
              </label>
              <label className="grid gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                Estante
                <input
                  className={compactInputClass}
                  value={shelf}
                  onChange={(event) => setShelf(event.target.value)}
                  placeholder="3"
                />
              </label>
            </div>

            <label className="mt-2 grid gap-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
              Etiqueta opcional
              <input
                className={compactInputClass}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={previewLabel || "Zona A · Pasillo 2 · Estante 3"}
              />
            </label>

            <button
              type="button"
              className={`${primaryButtonClass} mt-3`}
              disabled={saving || !previewCode}
              onClick={() => void handleCreate()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear estante
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-black">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm font-bold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando estantes...
            </div>
          ) : !bins.length ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-black text-slate-300">Sin estantes definidos</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Crea la primera zona para empezar a ubicar productos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-black/80">
              {bins.map((bin) => (
                <li key={bin.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300">
                    <MapPin className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[#f8fafc]">{bin.label}</p>
                    <p className="text-xs font-bold text-slate-500">{bin.code}</p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      className={`${secondaryButtonClass} h-9 px-3 text-xs`}
                      onClick={async () => {
                        const result = await deactivateWarehouseBinAction({
                          warehouseId,
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
  );
}
