"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listShipmentsAction,
  updateShipmentStatusAction,
  type ShipmentRow,
  type ShipmentStatus,
} from "@/app/actions/shipments";
import { getCurrentSessionAction } from "@/app/actions/session";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { useNotify } from "@/hooks/use-notify";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import {
  cardClass,
  Panel,
  primaryButtonClass,
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

export function EnviosClient({
  initialShipments,
  initialRoleSlug,
}: {
  initialShipments?: ShipmentRow[];
  initialRoleSlug?: string;
}) {
  const notify = useNotify();
  const supabaseReady = isSupabaseConfigured();
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments || []);
  const [roleSlug, setRoleSlug] = useState<string>(initialRoleSlug || "administrador");
  const [query, setQuery] = useState("");
  const [carrier, setCarrier] = useState("");
  const [country, setCountry] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loaded, setLoaded] = useState(!supabaseReady || Boolean(initialShipments));

  const isConductor = roleSlug === "conductor";

  useEffect(() => {
    if (!supabaseReady || initialShipments) {
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
          notify.error(result.error);
        }

        setLoaded(true);
      })();
    });
  }, [initialShipments, notify, supabaseReady]);

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

  const shipmentSearchOptions = useMemo(
    () =>
      shipments.map((row) => ({
        value: row.id,
        label: `${row.code} · ${row.customer_name}`,
        searchText: [row.code, row.customer_name, row.carrier, row.country].join(" "),
      })),
    [shipments],
  );

  const carrierFilterOptions = useMemo(() => {
    const values = [...new Set(shipments.map((row) => row.carrier).filter(Boolean))];

    return values.map((value) => ({ value, label: value }));
  }, [shipments]);

  const countryFilterOptions = useMemo(() => {
    const values = [...new Set(shipments.map((row) => row.country).filter(Boolean))];

    return values.map((value) => ({ value, label: value }));
  }, [shipments]);

  const statusFilterOptions = useMemo(
    () => STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
    [],
  );

  const statusPickerOptions = useMemo(
    () => STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
    [],
  );

  async function changeStatus(shipmentId: string, status: ShipmentStatus) {
    const result = await updateShipmentStatusAction(shipmentId, status);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setShipments((current) =>
      current.map((row) => (row.id === shipmentId ? result.data : row)),
    );
    notify.success(`Estado actualizado a ${status}`);
  }

  if (!loaded) {
    return (
      <Panel title="Envios" hideHeader>
        <PageLoading inline />
      </Panel>
    );
  }

  return (
    <Panel title="Envios" hideHeader>
      {!isConductor ? (
        <div className="mb-4 flex justify-end">
          <Link href="/venta" className={primaryButtonClass}>
            Nuevo envio
          </Link>
        </div>
      ) : null}

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
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <InlineSearchCombobox
              value={query}
              onChange={setQuery}
              options={shipmentSearchOptions}
              placeholder="Buscar cliente"
              emptyLabel="Sin envíos"
              ariaLabel="Buscar envíos"
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => {
                const row = shipments.find((entry) => entry.id === option.value);
                if (row) {
                  setQuery(row.customer_name);
                }
              }}
            />
            <InlineSearchCombobox
              value={carrier}
              onChange={setCarrier}
              options={carrierFilterOptions}
              placeholder="Carrier"
              emptyLabel="Sin carriers"
              ariaLabel="Filtrar carrier"
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => setCarrier(option.label)}
            />
            <InlineSearchCombobox
              value={country}
              onChange={setCountry}
              options={countryFilterOptions}
              placeholder="País"
              emptyLabel="Sin países"
              ariaLabel="Filtrar país"
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => setCountry(option.label)}
            />
            <InlineSearchCombobox
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusFilterOptions}
              placeholder="Estado"
              emptyLabel="Sin estados"
              ariaLabel="Filtrar estado"
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => setStatusFilter(option.label)}
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
                    <InlineSearchPicker
                      compact={false}
                      className="w-full min-w-[10rem]"
                      minWidthClass="w-full min-w-0"
                      value={row.status}
                      onChange={(status) =>
                        void changeStatus(row.id, status as ShipmentStatus)
                      }
                      options={statusPickerOptions}
                      placeholder="Estado"
                      searchPlaceholder="Buscar estado…"
                      ariaLabel={`Estado de ${row.code}`}
                    />
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

    </Panel>
  );
}
