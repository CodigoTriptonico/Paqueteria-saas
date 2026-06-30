"use client";

import Link from "next/link";
import { ClipboardList, Package, Search, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  finalizeShipmentInvoiceAction,
  listShipmentsAction,
  updateShipmentLogisticsPlanAction,
  updateShipmentStatusAction,
  type ShipmentRow,
  type ShipmentStatus,
} from "@/app/actions/shipments";
import { CountryName } from "@/components/country-flag";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { ShipmentAuditPanel } from "@/components/shipment-audit-panel";
import { ShipmentPaymentProgress } from "@/components/shipment-payment-progress";
import { ShipmentProgressSteps } from "@/components/shipment-progress-steps";
import { SaleInvoiceConfirmDialog } from "@/components/sale/sale-invoice-confirm-dialog";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  cardClass,
  Panel,
  primaryButtonClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { countryNamesPickerOptions } from "@/lib/country-picker-options";
import { formatMoneyValue } from "@/lib/logistics-fees";
import { buildShipmentTimings } from "@/lib/shipment-timing";
import {
  editorStateToUpdateInput,
  shipmentLogisticsEditorState,
  type ShipmentLogisticsEditorState,
} from "@/lib/shipment-logistics-edit";
import type { ShipmentAuditContext } from "@/lib/shipment-audit";
import {
  balanceDueFromShipment,
  depositFromShipment,
  quoteFromShipment,
  shipmentLogisticsSteps,
  shipmentPaymentProgress,
  totalFromShipment,
} from "@/lib/shipment-display";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STATUS_OPTIONS: ShipmentStatus[] = [
  "Pendiente",
  "En oficina",
  "Pickup",
  "Enviado",
  "Entregado",
];

const INVOICE_FILTER_OPTIONS = [
  { value: "", label: "Todos los invoices" },
  { value: "open", label: "Abiertos" },
  { value: "paid", label: "Pagados" },
  { value: "void", label: "Anulados" },
];

function taskTypeLabel(taskType: string) {
  if (taskType === "deliver_empty_box") {
    return "Entregar caja vacía";
  }

  if (taskType === "pickup_full_box") {
    return "Recoger caja llena";
  }

  return taskType;
}

type EnviosClientProps = {
  initialShipments?: ShipmentRow[];
  initialRoleSlug?: string;
  canManageSales?: boolean;
  canUpdateShipmentStatus?: boolean;
};

export function EnviosClient({
  initialShipments,
  initialRoleSlug = "administrador",
  canManageSales = false,
  canUpdateShipmentStatus = false,
}: EnviosClientProps) {
  const notify = useNotify();
  const supabaseReady = isSupabaseConfigured();
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments || []);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("open");
  const [loaded, setLoaded] = useState(!supabaseReady || Boolean(initialShipments));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<ShipmentRow | null>(null);
  const [auditRefresh, setAuditRefresh] = useState<Record<string, number>>({});

  const isConductor = initialRoleSlug === "conductor";
  const canEditProgress = canManageSales || canUpdateShipmentStatus;

  useEffect(() => {
    if (!supabaseReady || initialShipments) {
      return;
    }

    queueMicrotask(() => {
      void (async () => {
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

  const countryFilterOptions = useMemo(() => {
    const values = [...new Set(shipments.map((row) => row.country).filter(Boolean))];
    return countryNamesPickerOptions(values);
  }, [shipments]);

  const statusFilterOptions = useMemo(
    () => STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
    [],
  );

  const filteredShipments = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanCountry = country.trim().toLowerCase();
    const cleanStatus = statusFilter.trim().toLowerCase();

    return shipments.filter((row) => {
      const haystack = [row.code, row.customer_name, row.carrier, row.country, row.delivery_notes]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !cleanQuery || haystack.includes(cleanQuery);
      const matchesCountry = !cleanCountry || row.country.toLowerCase().includes(cleanCountry);
      const matchesStatus = !cleanStatus || row.status.toLowerCase().includes(cleanStatus);
      const matchesInvoice = !invoiceFilter || row.invoice_status === invoiceFilter;

      return matchesQuery && matchesCountry && matchesStatus && matchesInvoice;
    });
  }, [country, invoiceFilter, query, shipments, statusFilter]);

  const summary = useMemo(() => {
    let openCount = 0;
    let balanceTotal = 0;

    for (const row of shipments) {
      if (row.invoice_status !== "open") {
        continue;
      }

      openCount += 1;
      balanceTotal += balanceDueFromShipment(row, quoteFromShipment(row));
    }

    return {
      openCount,
      balanceTotal: formatMoneyValue(balanceTotal),
      visibleCount: filteredShipments.length,
    };
  }, [filteredShipments.length, shipments]);

  function bumpAudit(shipmentId: string) {
    setAuditRefresh((current) => ({
      ...current,
      [shipmentId]: (current[shipmentId] || 0) + 1,
    }));
  }

  async function changeStatus(
    shipmentId: string,
    status: ShipmentStatus,
    audit?: ShipmentAuditContext,
  ) {
    setBusyId(shipmentId);
    const result = await updateShipmentStatusAction(shipmentId, status, audit);

    if (!result.ok) {
      notify.error(result.error);
      setBusyId(null);
      return;
    }

    setShipments((current) =>
      current.map((row) => (row.id === shipmentId ? result.data : row)),
    );
    setBusyId(null);
    bumpAudit(shipmentId);
    notify.success(`Estado actualizado a ${status}`);
  }

  async function saveLogisticsPlan(
    row: ShipmentRow,
    state: ShipmentLogisticsEditorState,
    audit: ShipmentAuditContext,
  ) {
    setBusyId(row.id);

    const result = await updateShipmentLogisticsPlanAction({
      shipmentId: row.id,
      ...editorStateToUpdateInput(state),
      audit,
    });

    if (!result.ok) {
      notify.error(result.error);
      setBusyId(null);
      return;
    }

    setShipments((current) => current.map((item) => (item.id === row.id ? result.data : item)));
    setBusyId(null);
    bumpAudit(row.id);
    notify.success("Logística actualizada");
  }

  async function applyLogisticsPatch(
    row: ShipmentRow,
    patch: Partial<ShipmentLogisticsEditorState>,
    audit: ShipmentAuditContext,
  ) {
    await saveLogisticsPlan(
      row,
      {
        ...shipmentLogisticsEditorState(row),
        ...patch,
      },
      audit,
    );
  }

  async function finalizeInvoice(row: ShipmentRow) {
    const quote = quoteFromShipment(row);
    const balanceDue = balanceDueFromShipment(row, quote);

    if (balanceDue <= 0) {
      notify.error("Este invoice no tiene pendiente");
      return;
    }

    setBusyId(row.id);

    try {
      const result = await finalizeShipmentInvoiceAction({
        shipmentId: row.id,
        cost: quote?.cost,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      setFinalizeTarget(null);
      bumpAudit(row.id);
      notify.success(`Invoice ${row.code} cerrado`);
    } finally {
      setBusyId(null);
    }
  }

  const finalizeQuote = finalizeTarget ? quoteFromShipment(finalizeTarget) : null;
  const finalizeBalance = finalizeTarget
    ? balanceDueFromShipment(finalizeTarget, finalizeQuote)
    : 0;
  const finalizeTotal = finalizeTarget
    ? totalFromShipment(finalizeTarget, finalizeQuote)
    : 0;
  const finalizeDeposit = finalizeTarget
    ? depositFromShipment(finalizeTarget)
    : 0;

  if (!loaded) {
    return (
      <Panel title="Envíos" hideHeader>
        <PageLoading inline />
      </Panel>
    );
  }

  return (
    <Panel title="Envíos" hideHeader>
      {!supabaseReady ? (
        <SupabaseRequiredBanner detail="Los envíos se listan desde Supabase. Sin credenciales no hay datos que mostrar." />
      ) : null}

      {isConductor ? (
        <p className="mb-4 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2 text-sm font-bold text-emerald-200">
          Vista de conductor: envíos asignados a ti. Puedes actualizar el estado del envío.
        </p>
      ) : null}

      {supabaseReady ? (
        <>
          <div className="mb-4 rounded-xl border border-black bg-surface-card-header p-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 shrink-0 divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset">
                <div className="flex min-w-[4.5rem] items-center gap-1.5 px-2">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">Abiertos</span>
                  <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">
                    {summary.openCount}
                  </span>
                </div>
                <div className="flex min-w-[5.25rem] items-center gap-1.5 px-2">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">Debe</span>
                  <span className="text-sm font-black tabular-nums leading-none text-amber-300">
                    {summary.balanceTotal}
                  </span>
                </div>
                <div className="flex min-w-[4.75rem] items-center gap-1.5 px-2">
                  <span className="text-[9px] font-black uppercase leading-none text-slate-500">Vista</span>
                  <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">
                    {summary.visibleCount}
                  </span>
                </div>
              </div>

              <label className="min-w-[14rem] flex-[1_1_18rem]">
                <span className="sr-only">Buscar envíos</span>
                <span className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-black bg-surface-inset px-3">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  <input
                    className="w-full bg-transparent text-sm font-bold text-[#f8fafc] outline-none placeholder:text-slate-500"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Invoice, cliente, país..."
                    aria-label="Buscar envíos"
                  />
                </span>
              </label>

              <label className="w-[8rem] shrink-0">
                <span className="sr-only">Filtrar por invoice</span>
                <select
                  className="h-9 w-full rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-black text-[#f8fafc] outline-none"
                  value={invoiceFilter}
                  onChange={(event) => setInvoiceFilter(event.target.value)}
                  aria-label="Filtrar por invoice"
                >
                  {INVOICE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <InlineSearchPicker
                className="w-[8rem]"
                minWidthClass="w-full min-w-0"
                value={country}
                onChange={setCountry}
                options={countryFilterOptions}
                placeholder="País"
                searchPlaceholder="Buscar país..."
                emptyLabel="Sin países"
                ariaLabel="Filtrar por país"
              />

              <InlineSearchPicker
                className="w-[8rem]"
                minWidthClass="w-full min-w-0"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                placeholder="Estado"
                searchPlaceholder="Buscar estado..."
                emptyLabel="Sin estados"
                ariaLabel="Filtrar por estado de envío"
              />

              {canManageSales && !isConductor ? (
                <Link href="/venta" className={`${primaryButtonClass} h-9 shrink-0 px-4`}>
                  Nuevo envío
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredShipments.length ? (
              filteredShipments.map((row) => {
                const quote = quoteFromShipment(row);
                const balanceDue = balanceDueFromShipment(row, quote);
                const canFinalize =
                  canManageSales && row.invoice_status === "open" && balanceDue > 0;
                const progressSteps = shipmentLogisticsSteps(row);
                const paymentProgress = shipmentPaymentProgress(row, quote);
                const timings = buildShipmentTimings(row, progressSteps);
                const openTasks = row.logisticsTasks.filter(
                  (task) => task.status !== "completed" && task.status !== "cancelled",
                );

                return (
                  <article key={row.id} className={`${cardClass} p-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#f8fafc]">{row.code}</p>
                        <p className="mt-0.5 truncate text-xs font-black text-[#f8fafc]">
                          {row.customer_name}
                        </p>
                        <p className="truncate text-[10px] font-bold text-slate-500">
                          <CountryName
                            name={row.country}
                            size="xs"
                            labelClassName="text-[10px] font-bold text-slate-500"
                          />
                          {quote ? ` · ${quote.label}` : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {canFinalize ? (
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => setFinalizeTarget(row)}
                            className="inline-flex h-7 items-center rounded-lg border border-black bg-surface-inset px-2 text-[10px] font-black text-emerald-300 hover:bg-surface-card"
                            title="Cerrar invoice"
                          >
                            Cerrar
                          </button>
                        ) : null}
                        <ShipmentAuditPanel
                          shipmentId={row.id}
                          refreshNonce={auditRefresh[row.id] || 0}
                          inline
                          compact
                        />
                        <Link
                          href="/logistica"
                          title="Gestionar en logística"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 hover:bg-surface-card"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          <span className="sr-only">Logística</span>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3">
                      <ShipmentPaymentProgress compact progress={paymentProgress} />
                    </div>

                    <div className="mt-2">
                      <ShipmentProgressSteps
                        compact
                        steps={progressSteps}
                        timings={timings}
                        row={row}
                        canEdit={canEditProgress}
                        saving={busyId === row.id}
                        onLogisticsPatch={(patch, audit) => void applyLogisticsPatch(row, patch, audit)}
                        onStatusChange={(status, audit) => void changeStatus(row.id, status, audit)}
                        onLockedLeg={(message) => notify.error(message)}
                      />
                    </div>

                    {openTasks.length ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-bold text-slate-500">
                        <Truck className="h-3 w-3 shrink-0" />
                        <span>
                          {openTasks.length} tarea{openTasks.length === 1 ? "" : "s"}
                        </span>
                        {openTasks.slice(0, 1).map((task) => (
                          <span
                            key={task.id}
                            className="rounded border border-black bg-surface-inset px-1.5 py-px font-black text-slate-400"
                          >
                            {taskTypeLabel(task.taskType)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-black bg-surface-card px-4 py-8 text-center">
                <Package className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 text-xl font-black text-[#f8fafc]">Sin envíos</p>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  {invoiceFilter === "open"
                    ? "No hay invoices abiertos con estos filtros."
                    : "No hay envíos que coincidan con estos filtros."}
                </p>
                {canManageSales ? (
                  <Link href="/venta" className={`${primaryButtonClass} mt-4 inline-flex h-11 items-center px-4`}>
                    Crear venta
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : null}

      <SaleInvoiceConfirmDialog
        open={Boolean(finalizeTarget)}
        title="¿Cerrar este invoice?"
        invoiceLabel={finalizeTarget ? `Factura ${finalizeTarget.code}` : ""}
        lines={
          finalizeTarget
            ? [
                { label: "Cliente", value: finalizeTarget.customer_name },
                { label: "Total", value: formatMoneyValue(finalizeTotal) },
                { label: "Depósito", value: formatMoneyValue(finalizeDeposit) },
                { label: "Pendiente por cobrar", value: formatMoneyValue(finalizeBalance) },
              ]
            : []
        }
        confirmLabel="Cerrar invoice"
        confirming={busyId === finalizeTarget?.id}
        onCancel={() => {
          if (busyId !== finalizeTarget?.id) {
            setFinalizeTarget(null);
          }
        }}
        onConfirm={() => {
          if (finalizeTarget) {
            void finalizeInvoice(finalizeTarget);
          }
        }}
      />
    </Panel>
  );
}
