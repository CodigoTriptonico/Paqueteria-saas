"use client";

import { useEffect, useState } from "react";
import {
  copyWarehouseCatalogAction,
  createWarehouseAction,
  deactivateWarehouseAction,
  listWarehousesAction,
} from "@/app/actions/warehouses";
import { updateOrganizationSettingsAction } from "@/app/actions/organization";
import { getCurrentSessionAction } from "@/app/actions/session";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

export function WarehousesSettingsPanel() {
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; code: string | null; is_active: boolean; is_default: boolean }[]
  >([]);
  const [multiWarehouse, setMultiWarehouse] = useState(false);
  const [newName, setNewName] = useState("");
  const [copyFromId, setCopyFromId] = useState("");
  const [copyToId, setCopyToId] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    const [warehousesResult, sessionResult] = await Promise.all([
      listWarehousesAction(),
      getCurrentSessionAction(),
    ]);

    if (warehousesResult.ok) {
      setWarehouses(warehousesResult.data);
      setCopyFromId((current) => current || warehousesResult.data[0]?.id || "");
      setCopyToId((current) => current || warehousesResult.data[1]?.id || "");
    }

    if (sessionResult.ok && sessionResult.data) {
      setMultiWarehouse(sessionResult.data.multiWarehouseEnabled);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const result = await createWarehouseAction({ name: newName });

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setNewName("");
    setMessage("Bodega creada");
    await reload();
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-black bg-surface-card p-4">
        <label className="flex items-center justify-between gap-3 font-black">
          Modo multiples bodegas
          <input
            type="checkbox"
            checked={multiWarehouse}
            onChange={async (event) => {
              const enabled = event.target.checked;
              const result = await updateOrganizationSettingsAction({
                multiWarehouseEnabled: enabled,
              });

              if (!result.ok) {
                setMessage(result.error);
                return;
              }

              setMultiWarehouse(enabled);
            }}
          />
        </label>
        <p className="mt-2 text-sm text-slate-400">
          Si esta apagado, el inventario usa la bodega principal por defecto.
        </p>
      </div>

      <form className="grid gap-3 rounded-xl border border-black bg-surface-card p-4" onSubmit={handleCreate}>
        <p className="text-lg font-black">Crear bodega</p>
        <input
          className={inputClass}
          placeholder="Nombre de bodega"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          required
        />
        <button type="submit" className={primaryButtonClass}>
          Guardar bodega
        </button>
      </form>

      <div className="grid gap-3">
        <p className="text-lg font-black">Bodegas</p>
        {warehouses.map((warehouse) => (
          <div
            key={warehouse.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black bg-surface-card p-4"
          >
            <div>
              <p className="text-lg font-black">
                {warehouse.name}
                {warehouse.is_default ? " (principal)" : ""}
              </p>
              <p className="text-sm text-slate-400">
                {warehouse.is_active ? "Activa" : "Inactiva"}
                {warehouse.code ? ` · ${warehouse.code}` : ""}
              </p>
            </div>

            {!warehouse.is_default && warehouse.is_active ? (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={async () => {
                  const result = await deactivateWarehouseAction(warehouse.id);

                  if (!result.ok) {
                    setMessage(result.error);
                    return;
                  }

                  setMessage("Bodega desactivada");
                  await reload();
                }}
              >
                Desactivar
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-black bg-surface-card p-4">
        <p className="text-lg font-black">Copiar catalogo entre bodegas</p>
        <p className="text-sm text-slate-400">Copia items con stock 0 en la bodega destino.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className={inputClass}
            value={copyFromId}
            onChange={(event) => setCopyFromId(event.target.value)}
          >
            {warehouses
              .filter((warehouse) => warehouse.is_active)
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  Origen: {warehouse.name}
                </option>
              ))}
          </select>
          <select
            className={inputClass}
            value={copyToId}
            onChange={(event) => setCopyToId(event.target.value)}
          >
            {warehouses
              .filter((warehouse) => warehouse.is_active)
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  Destino: {warehouse.name}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={async () => {
            if (!copyFromId || !copyToId || copyFromId === copyToId) {
              setMessage("Selecciona bodegas distintas");
              return;
            }

            const result = await copyWarehouseCatalogAction(copyFromId, copyToId);

            if (!result.ok) {
              setMessage(result.error);
              return;
            }

            setMessage(`Copiados ${result.data.copied} items`);
          }}
        >
          Copiar items
        </button>
      </div>

      {message ? <p className="text-sm font-bold text-emerald-300">{message}</p> : null}
    </div>
  );
}
