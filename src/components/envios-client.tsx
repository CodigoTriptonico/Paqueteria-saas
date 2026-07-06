"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, PhoneCall, Search, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import {
  listLogisticsRoutesAction,
} from "@/app/actions/logistics-routes";
import {
  finalizeShipmentInvoiceAction,
  listRouteMembersAction,
  listSalesOwnersAction,
  listShipmentsAction,
  updateShipmentInvoicePriorityAction,
  updateShipmentLogisticsPlanAction,
  updateShipmentSalesOwnerAction,
  updateShipmentStatusAction,
  type RouteMemberRow,
  type SalesOwnerRow,
  type ShipmentRow,
  type ShipmentStatus,
} from "@/app/actions/shipments";
import { CountryName } from "@/components/country-flag";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { ShipmentCollectDialog } from "@/components/shipment-collect-dialog";
import {
  ShipmentContactLogDialog,
  ShipmentContactLogLine,
} from "@/components/shipment-contact-log-dialog";
import { EnviosShipmentContextMenu, type EnviosShipmentMenuState } from "@/components/envios-shipment-context-menu";
import { ShipmentLogisticsAssignmentBadges } from "@/components/shipment-logistics-assignment-badges";
import { ShipmentPaymentProgress } from "@/components/shipment-payment-progress";
import { ShipmentProgressSteps } from "@/components/shipment-progress-steps";
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
import {
  DEFAULT_PAYMENT_METHOD,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";
import {
  collectShipmentInvoiceCopy,
} from "@/lib/shipment-invoice-copy";
import {
  latestShipmentContactReminderStatus,
} from "@/lib/shipment-contact-log";
import {
  resolveShipmentCollectAmount,
  shipmentCollectSuccessMessage,
  type ShipmentCollectMode,
} from "@/lib/shipment-collect";
import { buildShipmentTimings } from "@/lib/shipment-timing";
import type { ShipmentAuditContext } from "@/lib/shipment-audit";
import {
  balanceDueFromShipment,
  depositFromShipment,
  quoteFromShipment,
  ENVIOS_STATUS_FILTER_OPTIONS,
  matchesEnviosStatusFilter,
  shipmentLogisticsSteps,
  shipmentLogisticsBridgeLabel,
  shipmentOperationalAssignment,
  shipmentPaymentProgress,
  orderShipmentsByStableIds,
  totalFromShipment,
} from "@/lib/shipment-display";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";
import {
  editorStateToUpdateInput,
  shipmentLogisticsEditorState,
  type ShipmentLogisticsEditorState,
} from "@/lib/shipment-logistics-edit";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  enviosDisplayOrderStorageKey,
  readEnviosDisplayOrder,
  resolveEnviosDisplayOrderIds,
  shipmentDisplayOrderFilterSignature,
  shipmentVisibleIdSetKey,
  writeEnviosDisplayOrder,
} from "@/lib/envios-display-order";

type EnviosClientProps = {
  initialShipments?: ShipmentRow[];
  initialRouteMembers?: RouteMemberRow[];
  initialSalesOwners?: SalesOwnerRow[];
  initialRoutes?: LogisticsRouteRow[];
  initialRoleSlug?: string;
  canManageSales?: boolean;
  canUpdateShipmentStatus?: boolean;
  canManageShipmentOwners?: boolean;
  canAccessEstadisticas?: boolean;
};

export function EnviosClient({
  initialShipments,
  initialRouteMembers,
  initialSalesOwners,
  initialRoutes,
  initialRoleSlug = "administrador",
  canManageSales = false,
  canUpdateShipmentStatus = false,
  canManageShipmentOwners = false,
  canAccessEstadisticas = false,
}: EnviosClientProps) {
  const notify = useNotify();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedQueryFromUrlRef = useRef(false);
  const supabaseReady = isSupabaseConfigured();
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments || []);
  const [routeMembers, setRouteMembers] = useState<RouteMemberRow[]>(initialRouteMembers || []);
  const [salesOwners, setSalesOwners] = useState<SalesOwnerRow[]>(initialSalesOwners || []);
  const [routes, setRoutes] = useState<LogisticsRouteRow[]>(initialRoutes || []);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [salesOwnerFilter, setSalesOwnerFilter] = useState("");
  const [loaded, setLoaded] = useState(!supabaseReady || Boolean(initialShipments && initialRoutes));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progressBusyId, setProgressBusyId] = useState<string | null>(null);
  const [priorityBusyId, setPriorityBusyId] = useState<string | null>(null);
  const [ownerBusyId, setOwnerBusyId] = useState<string | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<ShipmentRow | null>(null);
  const [finalizeCollectMode, setFinalizeCollectMode] = useState<ShipmentCollectMode>("choose");
  const [finalizePartialAmount, setFinalizePartialAmount] = useState("");
  const [finalizePaymentMethod, setFinalizePaymentMethod] =
    useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [finalizePaymentNote, setFinalizePaymentNote] = useState("");
  const [contactReminderFilter, setContactReminderFilter] = useState(false);
  const [contactLogShipmentId, setContactLogShipmentId] = useState<string | null>(null);
  const [shipmentMenu, setShipmentMenu] = useState<EnviosShipmentMenuState>(null);

  const isConductor = initialRoleSlug === "conductor";

  useEffect(() => {
    if (appliedQueryFromUrlRef.current) {
      return;
    }

    const initialQuery = searchParams.get("q")?.trim();
    if (!initialQuery) {
      return;
    }

    appliedQueryFromUrlRef.current = true;
    queueMicrotask(() => {
      setQuery(initialQuery);
    });
  }, [searchParams]);

  useEffect(() => {
    if (!supabaseReady || (initialShipments && initialRouteMembers && initialSalesOwners && initialRoutes)) {
      return;
    }

    queueMicrotask(() => {
      void (async () => {
        const [shipmentsResult, membersResult, ownersResult, routesResult] = await Promise.all([
          initialShipments ? Promise.resolve({ ok: true as const, data: initialShipments }) : listShipmentsAction(),
          initialRouteMembers
            ? Promise.resolve({ ok: true as const, data: initialRouteMembers })
            : listRouteMembersAction(),
          initialSalesOwners
            ? Promise.resolve({ ok: true as const, data: initialSalesOwners })
            : canManageShipmentOwners
              ? listSalesOwnersAction()
              : Promise.resolve({ ok: true as const, data: [] }),
          initialRoutes
            ? Promise.resolve({ ok: true as const, data: initialRoutes })
            : listLogisticsRoutesAction(),
        ]);

        if (shipmentsResult.ok) {
          setShipments(shipmentsResult.data);
        } else {
          notify.error(shipmentsResult.error);
        }

        if (membersResult.ok) {
          setRouteMembers(membersResult.data);
        } else {
          notify.error(membersResult.error);
        }

        if (ownersResult.ok) {
          setSalesOwners(ownersResult.data);
        } else {
          notify.error(ownersResult.error);
        }

        if (routesResult.ok) {
          setRoutes(routesResult.data);
        }

        setLoaded(true);
      })();
    });
  }, [
    canManageShipmentOwners,
    initialRouteMembers,
    initialRoutes,
    initialSalesOwners,
    initialShipments,
    notify,
    supabaseReady,
  ]);

  const countryFilterKey = useMemo(
    () =>
      [...new Set(shipments.map((row) => row.country).filter(Boolean))]
        .sort()
        .join("\0"),
    [shipments],
  );

  const countryFilterOptions = useMemo(
    () => countryNamesPickerOptions(countryFilterKey.split("\0").filter(Boolean)),
    [countryFilterKey],
  );

  const statusFilterOptions = useMemo(
    () =>
      ENVIOS_STATUS_FILTER_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );
  const routeMemberLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const member of routeMembers) {
      labels.set(member.id, member.label);
    }
    return (memberId: string) => labels.get(memberId);
  }, [routeMembers]);
  const routeByTaskId = useMemo(() => {
    const map = new Map<string, { routeName: string; assignedTo: string | null }>();

    for (const route of routes) {
      if (route.status === "cancelled") {
        continue;
      }

      for (const stop of route.stops) {
        map.set(stop.taskId, {
          routeName: route.name,
          assignedTo: route.assignedTo,
        });
      }
    }

    return (taskId: string) => map.get(taskId);
  }, [routes]);

  const reminderNow = useMemo(() => new Date(), []);

  const baseFilteredShipments = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanCountry = country.trim().toLowerCase();

    return shipments.filter((row) => {
      const haystack = [
        row.code,
        row.customer_name,
        row.carrier,
        row.country,
        row.delivery_notes,
        row.salesOwnerName,
        (row.contactLogs || []).map((log) => `${log.note} ${log.nextStep}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !cleanQuery || haystack.includes(cleanQuery);
      const matchesCountry = !cleanCountry || row.country.toLowerCase().includes(cleanCountry);
      const matchesStatus = matchesEnviosStatusFilter(row, statusFilter);
      const matchesSalesOwner =
        !salesOwnerFilter || row.salesOwnerId === salesOwnerFilter;

      return matchesQuery && matchesCountry && matchesStatus && matchesSalesOwner;
    });
  }, [country, query, salesOwnerFilter, shipments, statusFilter]);

  const contactReminderCount = useMemo(
    () =>
      baseFilteredShipments.filter(
        (row) => latestShipmentContactReminderStatus(row.contactLogs, reminderNow) !== "none",
      ).length,
    [baseFilteredShipments, reminderNow],
  );

  const filteredShipments = useMemo(() => {
    if (!contactReminderFilter) {
      return baseFilteredShipments;
    }

    return baseFilteredShipments.filter(
      (row) => latestShipmentContactReminderStatus(row.contactLogs, reminderNow) !== "none",
    );
  }, [baseFilteredShipments, contactReminderFilter, reminderNow]);
  const filteredShipmentsRef = useRef<ShipmentRow[]>(filteredShipments);

  useEffect(() => {
    filteredShipmentsRef.current = filteredShipments;
  }, [filteredShipments]);

  const filterSignature = useMemo(
    () =>
      `${shipmentDisplayOrderFilterSignature({
        query,
        country,
        statusFilter,
        salesOwnerFilter,
      })}${contactReminderFilter ? "\0contact-reminders" : ""}`,
    [contactReminderFilter, country, query, salesOwnerFilter, statusFilter],
  );

  const orderStorageKey = useMemo(
    () => enviosDisplayOrderStorageKey(filterSignature),
    [filterSignature],
  );

  const visibleShipmentIdKey = useMemo(
    () => shipmentVisibleIdSetKey(filteredShipments),
    [filteredShipments],
  );

  const [displayOrderIds, setDisplayOrderIds] = useState<string[]>(() =>
    resolveEnviosDisplayOrderIds(filteredShipments, {
      storedOrderIds: readEnviosDisplayOrder(
        enviosDisplayOrderStorageKey(
          shipmentDisplayOrderFilterSignature({
            query: "",
            country: "",
            statusFilter: "",
            salesOwnerFilter: "",
          }),
        ),
      ),
    }),
  );

  const previousFilterSignatureRef = useRef(filterSignature);

  useEffect(() => {
    let cancelled = false;
    const filterChanged = previousFilterSignatureRef.current !== filterSignature;
    previousFilterSignatureRef.current = filterSignature;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setDisplayOrderIds((current) =>
        resolveEnviosDisplayOrderIds(filteredShipmentsRef.current, {
          previousOrderIds: current,
          filterChanged,
          storedOrderIds: filterChanged ? null : readEnviosDisplayOrder(orderStorageKey),
        }),
      );
    });

    // Re-sort only when filters or the visible shipment set changes, not on priority toggle.
    return () => {
      cancelled = true;
    };
  }, [filterSignature, orderStorageKey, visibleShipmentIdKey]);

  useEffect(() => {
    writeEnviosDisplayOrder(orderStorageKey, displayOrderIds);
  }, [displayOrderIds, orderStorageKey]);

  const displayShipments = useMemo(
    () => orderShipmentsByStableIds(filteredShipments, displayOrderIds),
    [displayOrderIds, filteredShipments],
  );

  const contactLogTarget = useMemo(
    () => shipments.find((row) => row.id === contactLogShipmentId) || null,
    [contactLogShipmentId, shipments],
  );

  const summary = useMemo(() => {
    let openCount = 0;
    let balanceTotal = 0;

    for (const row of filteredShipments) {
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
  }, [filteredShipments]);

  function openShipmentAudit(shipmentId: string) {
    router.push(`/estadisticas?view=auditoria&shipment=${shipmentId}`);
  }

  function handleShipmentContextMenu(event: React.MouseEvent, row: ShipmentRow) {
    if (!canAccessEstadisticas) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setShipmentMenu({
      shipmentId: row.id,
      shipmentCode: row.code,
      x: event.clientX,
      y: event.clientY,
    });
  }

  async function finalizeInvoice(row: ShipmentRow) {
    const quote = quoteFromShipment(row);
    const balanceDue = balanceDueFromShipment(row, quote);
    const amountInput =
      finalizeCollectMode === "partial" ? finalizePartialAmount : undefined;
    const resolved = resolveShipmentCollectAmount(amountInput, balanceDue);

    if (!resolved.ok) {
      notify.error(resolved.error);
      return;
    }

    setBusyId(row.id);

    try {
      const result = await finalizeShipmentInvoiceAction({
        shipmentId: row.id,
        amount:
          finalizeCollectMode === "partial"
            ? finalizePartialAmount
            : undefined,
        cost: quote?.cost,
        paymentMethod: finalizePaymentMethod,
        paymentNote: finalizePaymentNote,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      setFinalizeTarget(null);
      setFinalizeCollectMode("choose");
      setFinalizePartialAmount("");
      notify.success(
        shipmentCollectSuccessMessage(row.code, resolved.amount, resolved.isFullPayment),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function updateSalesOwner(row: ShipmentRow, salesOwnerId: string) {
    if (!canManageShipmentOwners) {
      return;
    }

    if (!salesOwnerId || salesOwnerId === row.salesOwnerId) {
      return;
    }

    setOwnerBusyId(row.id);

    try {
      const result = await updateShipmentSalesOwnerAction({
        shipmentId: row.id,
        salesOwnerId,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      notify.success("Vendedor actualizado");
    } finally {
      setOwnerBusyId(null);
    }
  }

  async function toggleInvoicePriority(row: ShipmentRow) {
    if (!canManageSales) {
      return;
    }

    const nextPriority = !row.invoice_priority;
    setPriorityBusyId(row.id);

    try {
      const result = await updateShipmentInvoicePriorityAction({
        shipmentId: row.id,
        priority: nextPriority,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      notify.success(nextPriority ? "Invoice en prioridad" : "Prioridad quitada");
    } finally {
      setPriorityBusyId(null);
    }
  }

  async function applyLogisticsPatch(
    row: ShipmentRow,
    patch: Partial<ShipmentLogisticsEditorState>,
    audit: ShipmentAuditContext,
  ) {
    if (!canManageSales) {
      return;
    }

    setProgressBusyId(row.id);

    try {
      const nextState = {
        ...shipmentLogisticsEditorState(row),
        ...patch,
      };
      const result = await updateShipmentLogisticsPlanAction({
        shipmentId: row.id,
        ...editorStateToUpdateInput(nextState),
        audit,
      });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      notify.success("Logística actualizada");
    } finally {
      setProgressBusyId(null);
    }
  }

  async function applyShipmentStatus(
    row: ShipmentRow,
    status: ShipmentStatus,
    audit: ShipmentAuditContext,
  ) {
    if (!canUpdateShipmentStatus) {
      return;
    }

    setProgressBusyId(row.id);

    try {
      const result = await updateShipmentStatusAction(row.id, status, audit);

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      notify.success("Estado actualizado");
    } finally {
      setProgressBusyId(null);
    }
  }

  const canEditProgress = canManageSales || canUpdateShipmentStatus;

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
  const finalizeCopy = collectShipmentInvoiceCopy(finalizeBalance);

  if (!loaded) {
    return (
      <Panel
        title="Envíos"
        hideHeader
        className="flex min-h-0 flex-col lg:flex-1 lg:overflow-hidden"
        contentClassName="flex min-h-0 flex-1 flex-col p-3 sm:p-4"
      >
        <PageLoading inline />
      </Panel>
    );
  }

  return (
    <Panel
      title="Envíos"
      hideHeader
      className="flex min-h-0 flex-col lg:flex-1 lg:overflow-hidden"
      contentClassName="flex min-h-0 flex-1 flex-col p-3 sm:p-4"
    >
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
          <EnviosFiltersToolbar
            openCount={summary.openCount}
            balanceTotal={summary.balanceTotal}
            visibleCount={summary.visibleCount}
            contactReminderCount={contactReminderCount}
            contactReminderFilter={contactReminderFilter}
            onContactReminderFilterChange={setContactReminderFilter}
            query={query}
            onQueryChange={setQuery}
            canManageShipmentOwners={canManageShipmentOwners}
            salesOwnerFilter={salesOwnerFilter}
            onSalesOwnerFilterChange={setSalesOwnerFilter}
            salesOwners={salesOwners}
            country={country}
            onCountryChange={setCountry}
            countryFilterOptions={countryFilterOptions}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusFilterOptions={statusFilterOptions}
            canManageSales={canManageSales}
            isConductor={isConductor}
          />

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {displayShipments.length ? (
              displayShipments.map((row) => {
                const quote = quoteFromShipment(row);
                const balanceDue = balanceDueFromShipment(row, quote);
                const canFinalize =
                  canManageSales && row.invoice_status === "open" && balanceDue > 0;
                const progressSteps = shipmentLogisticsSteps(row);
                const paymentProgress = shipmentPaymentProgress(row, quote);
                const activeStep = progressSteps.find((step) => step.state === "active");
                const logisticsAssignment = shipmentOperationalAssignment(
                  row,
                  activeStep,
                  routeMemberLabelById,
                  routeByTaskId,
                );
                const logisticsBridgeLabel = shipmentLogisticsBridgeLabel(
                  logisticsAssignment,
                  activeStep,
                );
                const timings = buildShipmentTimings(row, progressSteps);
                const latestPayment = row.payments[row.payments.length - 1] || null;

                return (
                  <article
                    key={row.id}
                    className={`${cardClass} flex flex-col p-2.5`}
                    onContextMenu={(event) => handleShipmentContextMenu(event, row)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#f8fafc]">
                        <span>{row.code}</span>
                        <span className="text-slate-500"> · </span>
                        <span>{row.customer_name}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <CountryName
                          name={row.country}
                          size="xs"
                          labelClassName="text-[10px] font-bold text-slate-500"
                        />
                        {canManageShipmentOwners ? (
                          <label className="flex min-w-0 flex-1 items-center gap-1 sm:min-w-[9rem]">
                            <span className="shrink-0 text-[9px] font-black uppercase text-slate-500">
                              Vendedor
                            </span>
                            <select
                              className="h-6 min-w-0 flex-1 rounded-md border border-black bg-surface-inset px-1.5 text-[10px] font-black text-slate-200 outline-none disabled:opacity-50"
                              value={row.salesOwnerId || ""}
                              disabled={ownerBusyId === row.id}
                              onChange={(event) => void updateSalesOwner(row, event.target.value)}
                              aria-label={`Vendedor de ${row.code}`}
                            >
                              {salesOwners.map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <p className="truncate text-[10px] font-bold text-slate-500">
                            Vendedor: {row.salesOwnerName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <ShipmentProgressSteps
                        steps={progressSteps}
                        timings={timings}
                        row={row}
                        compact
                        canEdit={canEditProgress}
                        canEditLogistics={canManageSales}
                        canEditStatus={canUpdateShipmentStatus}
                        saving={progressBusyId === row.id}
                        onLogisticsPatch={(patch, audit) =>
                          void applyLogisticsPatch(row, patch, audit)
                        }
                        onStatusChange={(status, audit) =>
                          void applyShipmentStatus(row, status, audit)
                        }
                        onLockedLeg={(message) => notify.error(message)}
                      />
                    </div>

                    <div className="mt-2">
                      <ShipmentPaymentProgress compact progress={paymentProgress} />
                      {latestPayment ? (
                        <p className="mt-1.5 rounded-md border border-black bg-surface-inset px-2 py-1 text-[10px] font-black text-slate-300">
                          Pago: {formatMoneyValue(latestPayment.amount)} ·{" "}
                          {paymentMethodLabel(latestPayment.method)}
                          {latestPayment.note ? ` · ${latestPayment.note}` : ""}
                        </p>
                      ) : null}
                      <ShipmentContactLogLine shipment={row} />
                    </div>

                    <div className="mt-2 border-t border-black pt-2">
                      {logisticsBridgeLabel ? (
                        <p className="mb-1.5 text-[10px] font-bold leading-snug text-amber-200/90">
                          {logisticsBridgeLabel}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                        {canManageSales ? (
                          <button
                            type="button"
                            onClick={() => setContactLogShipmentId(row.id)}
                            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-emerald-300 hover:bg-surface-card"
                            title="Registrar seguimiento"
                            aria-label={`Registrar seguimiento de ${row.code}`}
                          >
                            <PhoneCall className="h-4 w-4" aria-hidden />
                            {row.contactLogs?.length ? (
                              <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-black bg-emerald-400 px-1 text-[9px] font-black leading-4 text-slate-950">
                                {row.contactLogs.length}
                              </span>
                            ) : null}
                          </button>
                        ) : null}
                        {canManageSales ? (
                          <button
                            type="button"
                            disabled={priorityBusyId === row.id}
                            onClick={() => void toggleInvoicePriority(row)}
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset hover:bg-surface-card disabled:opacity-50 ${
                              row.invoice_priority ? "text-amber-300" : "text-slate-400"
                            }`}
                            title={row.invoice_priority ? "Quitar prioridad" : "Marcar prioridad"}
                            aria-label={
                              row.invoice_priority
                                ? `Quitar prioridad de ${row.code}`
                                : `Marcar prioridad de ${row.code}`
                            }
                          >
                            <Star
                              className={`h-4 w-4 ${row.invoice_priority ? "fill-amber-300" : ""}`}
                              aria-hidden
                            />
                          </button>
                        ) : null}
                        <ShipmentLogisticsAssignmentBadges assignment={logisticsAssignment} />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                      {canFinalize ? (
                        <button
                          type="button"
                          disabled={busyId === row.id || progressBusyId === row.id || priorityBusyId === row.id}
                          onClick={() => {
                            setFinalizePaymentMethod(DEFAULT_PAYMENT_METHOD);
                            setFinalizePaymentNote("");
                            setFinalizeCollectMode("choose");
                            setFinalizePartialAmount("");
                            setFinalizeTarget(row);
                          }}
                          className="inline-flex h-8 items-center rounded-lg border border-black bg-surface-inset px-3 text-[11px] font-black text-emerald-300 hover:bg-surface-card"
                          title={finalizeCopy.actionTitle}
                        >
                          {finalizeCopy.actionLabel}
                        </button>
                      ) : null}
                      </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-lg border border-black bg-surface-card px-4 py-8 text-center sm:col-span-2 xl:col-span-3">
                <Package className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 text-xl font-black text-[#f8fafc]">Sin envíos</p>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  No hay envíos que coincidan con estos filtros.
                </p>
                {canManageSales ? (
                  <Link href="/venta" className={`${primaryButtonClass} mt-4 inline-flex h-11 items-center px-4`}>
                    Crear venta
                  </Link>
                ) : null}
              </div>
            )}
            </div>
          </div>
        </>
      ) : null}

      <ShipmentCollectDialog
        open={Boolean(finalizeTarget)}
        invoiceCode={finalizeTarget?.code || ""}
        customerName={finalizeTarget?.customer_name || ""}
        total={finalizeTotal}
        deposit={finalizeDeposit}
        balanceDue={finalizeBalance}
        mode={finalizeCollectMode}
        partialAmount={finalizePartialAmount}
        paymentMethod={finalizePaymentMethod}
        paymentNote={finalizePaymentNote}
        confirming={busyId === finalizeTarget?.id}
        onModeChange={setFinalizeCollectMode}
        onPartialAmountChange={setFinalizePartialAmount}
        onPaymentMethodChange={(method) => {
          if (method !== "pending") {
            setFinalizePaymentMethod(method);
          }
        }}
        onPaymentNoteChange={setFinalizePaymentNote}
        onCancel={() => {
          if (busyId !== finalizeTarget?.id) {
            setFinalizeTarget(null);
            setFinalizeCollectMode("choose");
            setFinalizePartialAmount("");
          }
        }}
        onConfirm={() => {
          if (finalizeTarget) {
            void finalizeInvoice(finalizeTarget);
          }
        }}
      />

      {contactLogTarget ? (
        <ShipmentContactLogDialog
          key={contactLogTarget.id}
          open
          shipment={contactLogTarget}
          onClose={() => setContactLogShipmentId(null)}
          onError={(message) => notify.error(message)}
          onSaved={(updated) => {
            setShipments((current) =>
              current.map((entry) => (entry.id === updated.id ? updated : entry)),
            );
            notify.success("Seguimiento guardado");
          }}
        />
      ) : null}

      <EnviosShipmentContextMenu
        menu={shipmentMenu}
        onClose={() => setShipmentMenu(null)}
        onOpenAudit={openShipmentAudit}
      />
    </Panel>
  );
}

type EnviosFiltersToolbarProps = {
  openCount: number;
  balanceTotal: string;
  visibleCount: number;
  contactReminderCount: number;
  contactReminderFilter: boolean;
  onContactReminderFilterChange: (value: boolean) => void;
  query: string;
  onQueryChange: (value: string) => void;
  canManageShipmentOwners: boolean;
  salesOwnerFilter: string;
  onSalesOwnerFilterChange: (value: string) => void;
  salesOwners: SalesOwnerRow[];
  country: string;
  onCountryChange: (value: string) => void;
  countryFilterOptions: ReturnType<typeof countryNamesPickerOptions>;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  statusFilterOptions: { value: string; label: string }[];
  canManageSales: boolean;
  isConductor: boolean;
};

const EnviosFiltersToolbar = memo(function EnviosFiltersToolbar({
  openCount,
  balanceTotal,
  visibleCount,
  contactReminderCount,
  contactReminderFilter,
  onContactReminderFilterChange,
  query,
  onQueryChange,
  canManageShipmentOwners,
  salesOwnerFilter,
  onSalesOwnerFilterChange,
  salesOwners,
  country,
  onCountryChange,
  countryFilterOptions,
  statusFilter,
  onStatusFilterChange,
  statusFilterOptions,
  canManageSales,
  isConductor,
}: EnviosFiltersToolbarProps) {
  return (
    <div className="mb-3 shrink-0 rounded-xl border border-black bg-surface-card-header p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 shrink-0 divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset">
          <div className="flex min-w-[4.5rem] items-center gap-1.5 px-2">
            <span className="text-[9px] font-black uppercase leading-none text-slate-500">Abiertos</span>
            <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">{openCount}</span>
          </div>
          <div className="flex min-w-[5.25rem] items-center gap-1.5 px-2">
            <span className="text-[9px] font-black uppercase leading-none text-slate-500">Debe</span>
            <span className="text-sm font-black tabular-nums leading-none text-amber-300">{balanceTotal}</span>
          </div>
          <div className="flex min-w-[4.75rem] items-center gap-1.5 px-2">
            <span className="text-[9px] font-black uppercase leading-none text-slate-500">Vista</span>
            <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">{visibleCount}</span>
          </div>
          <button
            type="button"
            aria-pressed={contactReminderFilter}
            onClick={() => onContactReminderFilterChange(!contactReminderFilter)}
            className={`flex min-w-[4.5rem] items-center gap-1.5 px-2 transition ${
              contactReminderFilter
                ? "bg-emerald-400/15 text-emerald-200"
                : "text-slate-500 hover:bg-surface-card hover:text-slate-300"
            }`}
            title="Ver seguimientos vencidos o de hoy"
          >
            <span className="text-[9px] font-black uppercase leading-none">Hoy</span>
            <span className="text-sm font-black tabular-nums leading-none">
              {contactReminderCount}
            </span>
          </button>
        </div>

        <label className="min-w-[14rem] flex-[1_1_18rem]">
          <span className="sr-only">Buscar envíos</span>
          <span className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-black bg-surface-inset px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <input
              className="w-full bg-transparent text-sm font-bold text-[#f8fafc] outline-none placeholder:text-slate-500"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Código, cliente, país..."
              aria-label="Buscar envíos"
            />
          </span>
        </label>

        {canManageShipmentOwners ? (
          <label className="w-[10rem] shrink-0">
            <span className="sr-only">Filtrar por vendedor</span>
            <select
              className="h-9 w-full rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-black text-[#f8fafc] outline-none"
              value={salesOwnerFilter}
              onChange={(event) => onSalesOwnerFilterChange(event.target.value)}
              aria-label="Filtrar por vendedor"
            >
              <option value="">Todos vendedores</option>
              {salesOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <InlineSearchPicker
          className="w-[8rem]"
          minWidthClass="w-full min-w-0"
          value={country}
          onChange={onCountryChange}
          options={countryFilterOptions}
          placeholder="País"
          searchPlaceholder="Buscar país..."
          emptyLabel="Sin países"
          ariaLabel="Filtrar por país"
        />

        <InlineSearchPicker
          className="min-w-[13rem] sm:min-w-[15rem]"
          minWidthClass="w-full min-w-0"
          value={statusFilter}
          onChange={onStatusFilterChange}
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
  );
});
