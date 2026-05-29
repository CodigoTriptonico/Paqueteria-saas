"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listShipmentsAction,
  updateShipmentStatusAction,
  type ShipmentRow,
  type ShipmentStatus,
} from "@/app/actions/shipments";
import { getCurrentSessionAction } from "@/app/actions/session";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  cardClass,
  inputClass,
  labelMutedClass,
  Panel,
  primaryButtonClass,
  StatCard,
  textMutedClass,
} from "@/components/ui-blocks";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Link from "next/link";

const STATUS_OPTIONS: ShipmentStatus[] = [
  "Pendiente",
  "En oficina",
  "Pickup",
  "Enviado",
  "Entregado",
];

export function EnviosClient() {
  const supabaseReady = isSupabaseConfigured();
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [roleSlug, setRoleSlug] = useState<string>("administrador");
  const [query, setQuery] = useState("");
  const [carrier, setCarrier] = useState("");
  const [country, setCountry] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(!supabaseReady);

  const isConductor = roleSlug === "conductor";

  useEffect(() => {
    if (!supabaseReady) {
      return;
    }

    queueMicrotask(() => {
      void (async () => {
        const sessionResult = await getCurrentSessionAction();
        const session = sessionResult.ok ? sessionResult.data : null;

        if (session) {
          setRoleSlug(session.roleSlug);
        }

        const result = await listShipmentsAction();

        if (result.ok) {
          setShipments(result.data);
        } else {
          setMessage(result.error);
        }

        setLoaded(true);
      })();
    });
  }, [supabaseReady]);

  const filteredShipments = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanCarrier = carrier.trim().toLowerCase();
    const cleanCountry = country.trim().toLowerCase();
    const cleanStatus = statusFilter.trim().toLowerCase();

    return shipments.filter((row) => {
      const matchesQuery = [row.code, row.customer_name, row.carrier]
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
      const matchesCarrier = row.carrier.toLowerCase().includes(cleanCarrier);
      const matchesCountry = row.country.toLowerCase().includes(cleanCountry);
      const matchesStatus = row.status.toLowerCase().includes(cleanStatus);

      return matchesQuery && matchesCarrier && matchesCountry && matchesStatus;
    });
  }, [carrier, country, query, shipments, statusFilter]);

  async function changeStatus(shipmentId: string, status: ShipmentStatus) {
    setMessage("");

    const result = await updateShipmentStatusAction(shipmentId, status);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setShipments((current) =>
      current.map((row) => (row.id === shipmentId ? result.data : row)),
    );
  }

  if (!loaded) {
    return null;
  }

  return (
    <Panel title="Envios" hideHeader>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={labelMutedClass}>
            {isConductor ? "Rutas asignadas" : "Gestion de envios"}
          </p>
          <h3 className="truncate text-2xl font-black text-[#f8fafc]">Envios</h3>
        </div>
        {!isConductor ? (
          <Link href="/venta" className={primaryButtonClass}>
            Nuevo envio
          </Link>
        ) : null}
      </div>

      {!supabaseReady ? (
        <SupabaseRequiredBanner detail="Los envios se listan desde la tabla shipments en Supabase. Sin credenciales no hay datos que mostrar." />
      ) : null}

      {isConductor && supabaseReady ? (
        <p className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-sm font-bold text-emerald-200">
          Vista de conductor: solo envios asignados a ti. Puedes cambiar el estado.
        </p>
      ) : null}

      {supabaseReady ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <StatCard label="Hoy" value={String(filteredShipments.length)} tone="text-slate-400" />
            <StatCard
              label="En transito"
              value={String(filteredShipments.filter((row) => row.status === "Enviado").length)}
              tone="text-slate-400"
            />
            <StatCard
              label="Pendientes"
              value={String(filteredShipments.filter((row) => row.status === "Pendiente").length)}
              tone="text-slate-400"
            />
            <StatCard
              label="Ganancia"
              value={`$${filteredShipments.reduce((sum, row) => sum + Number(row.profit), 0)}`}
              tone="text-slate-400"
            />
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <input
              className={inputClass}
              placeholder="Buscar cliente"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Carrier"
              value={carrier}
              onChange={(event) => setCarrier(event.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Pais"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {filteredShipments.length ? (
              filteredShipments.map((row) => (
                <div key={row.id} className={`${cardClass} overflow-hidden`}>
                  <div className="grid gap-3 border-b border-black bg-surface-card-header px-3 py-2 lg:grid-cols-[auto_1fr_1fr_auto]">
                    <p className="text-xl font-black text-[#f8fafc]">{row.code}</p>
                    <div>
                      <p className="text-lg font-black text-[#f8fafc]">{row.customer_name}</p>
                      <p className={textMutedClass}>{row.country}</p>
                    </div>
                    <p className="font-black text-slate-300">{row.carrier}</p>
                    <select
                      className={inputClass}
                      value={row.status}
                      onChange={(event) =>
                        void changeStatus(row.id, event.target.value as ShipmentStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 px-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <p className="text-xl font-black text-[#f8fafc]">Cobrado: ${row.paid}</p>
                    <p className="rounded-lg border border-black bg-surface-inset px-4 py-2 text-center text-xl font-black text-[#f8fafc]">
                      Ganancia ${row.profit}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-black bg-surface-card p-4 text-xl font-black">
                Sin envios en la base de datos
              </div>
            )}
          </div>
        </>
      ) : null}

      {message ? <p className="mt-3 text-sm font-bold text-rose-300">{message}</p> : null}
    </Panel>
  );
}
