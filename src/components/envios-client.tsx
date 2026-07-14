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
  markFullBoxReceivedAtOfficeAction,
  updateShipmentInvoicePriorityAction,
  updateShipmentLogisticsPlanAction,
  updateShipmentSalesOwnerAction,
  updateShipmentStatusAction,
  type RouteMemberRow,
  type SalesOwnerRow,
  type ShipmentRow,
  type ShipmentStatus,
} from "@/app/actions/shipments";
import { CountryFlag, CountryName } from "@/components/country-flag";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { ShipmentCollectDialog } from "@/components/shipment-collect-dialog";
import {
  ShipmentContactLogDialog,
  ShipmentContactLogLine,
} from "@/components/shipment-contact-log-dialog";
import { EnviosShipmentContextMenu, type EnviosShipmentMenuState } from "@/components/envios-shipment-context-menu";
import { ShipmentLogisticsAssignmentBadges } from "@/components/shipment-logistics-assignment-badges";
import { ShipmentMilestoneAgeTrigger } from "@/components/shipment-milestone-age-strip";
import { ShipmentPaymentProgress } from "@/components/shipment-payment-progress";
import { ShipmentProgressSteps } from "@/components/shipment-progress-steps";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  cardClass,
  insetShellClass,
  listRowBaseClass,
  listRowHoverClass,
  listCardShellClass,
  Panel,
  primaryButtonClass,
} from "@/components/ui-blocks";
import { usePageViewLayout } from "@/components/ui/ui-surface-preferences-provider";
import { useNotify } from "@/hooks/use-notify";
import { useEnviosShipmentSelection } from "@/hooks/use-envios-shipment-selection";
import { countryNamesPickerOptions } from "@/lib/country-picker-options";
import {
  canApplyEnviosBulkReadiness,
  resolveEnviosBulkReadinessPatch,
  type EnviosBulkReadinessAction,
} from "@/lib/envios-bulk-readiness";
import { formatMoneyValue } from "@/lib/logistics-fees";
import { readBillingFromPlan } from "@/lib/invoice-billing";
import {
  DEFAULT_PAYMENT_METHOD,
  isPaymentMethod,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/payment-methods";
import {
  collectShipmentInvoiceCopy,
} from "@/lib/shipment-invoice-copy";
import {
  resolveShipmentCollectAmount,
  shipmentCollectSuccessMessage,
  type ShipmentCollectMode,
} from "@/lib/shipment-collect";
import { buildShipmentMilestoneAges, buildShipmentTimingInsightPanel, buildShipmentTimings } from "@/lib/shipment-timing";
import type { ShipmentAuditContext } from "@/lib/shipment-audit";
import {
  classifyEnviosReadinessBucket,
  balanceDueFromShipment,
  depositFromShipment,
  ENVIOS_STATUS_FILTER_OPTIONS,
  filterShipmentsForEnviosMode,
  matchesEnviosReadinessFilter,
  matchesEnviosSearchQuery,
  matchesEnviosStatusFilter,
  quoteFromShipment,
  shipmentLogisticsSteps,
  shipmentLogisticsBridgeLabel,
  shipmentOperationalAssignment,
  shipmentPaymentProgress,
  sortShipmentsByArrivalOrder,
  totalFromShipment,
  type EnviosClientMode,
  type EnviosReadinessFilter,
} from "@/lib/shipment-display";
import type { LogisticsRouteRow } from "@/lib/logistics-routing";
import { buildLogisticaShipmentDeepLink } from "@/lib/logistics-view";
import {
  editorStateToUpdateInput,
  shipmentLogisticsEditorState,
  type ShipmentLogisticsEditorState,
} from "@/lib/shipment-logistics-edit";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type EnviosClientProps = {
  mode?: EnviosClientMode;
  initialShipments?: ShipmentRow[];
  initialRouteMembers?: RouteMemberRow[];
  initialSalesOwners?: SalesOwnerRow[];
  initialRoutes?: LogisticsRouteRow[];
  initialRoleSlug?: string;
  canManageSales?: boolean;
  canUpdateShipmentStatus?: boolean;
  canManageShipmentOwners?: boolean;
  canAccessAuditoria?: boolean;
};

function driverCollectionLabel(row: ShipmentRow) {
  const collection = readBillingFromPlan(row.logistics_plan)?.lastDriverCollection;

  if (!collection) {
    return "";
  }

  if (collection.outcome === "not_collected") {
    return `Conductor no recibió dinero · esperado ${formatMoneyValue(collection.expectedAmount)}`;
  }

  return `Conductor recibió ${formatMoneyValue(collection.receivedAmount)} · esperado ${formatMoneyValue(collection.expectedAmount)}`;
}

export function EnviosClient({
  mode = "tracking",
  initialShipments,
  initialRouteMembers,
  initialSalesOwners,
  initialRoutes,
  initialRoleSlug = "administrador",
  canManageSales = false,
  canUpdateShipmentStatus = false,
  canManageShipmentOwners = false,
  canAccessAuditoria = false,
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
  const { layout: viewLayout } = usePageViewLayout("shipments.tracking");
  const [finalizeTarget, setFinalizeTarget] = useState<ShipmentRow | null>(null);
  const [finalizeCollectMode, setFinalizeCollectMode] = useState<ShipmentCollectMode>("choose");
  const [finalizePartialAmount, setFinalizePartialAmount] = useState("");
  const [finalizePaymentMethod, setFinalizePaymentMethod] =
    useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);
  const [finalizePaymentNote, setFinalizePaymentNote] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<EnviosReadinessFilter>("all");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [contactLogShipmentId, setContactLogShipmentId] = useState<string | null>(null);
  const [shipmentMenu, setShipmentMenu] = useState<EnviosShipmentMenuState>(null);
  const [expandedShipmentIds, setExpandedShipmentIds] = useState<Set<string>>(() => new Set());

  const isConductor = initialRoleSlug === "conductor";
  const isHistoryMode = mode === "history";
  const panelTitle = isHistoryMode ? "Historial de envíos" : "Seguimiento";

  const modeShipments = useMemo(
    () => filterShipmentsForEnviosMode(shipments, mode),
    [mode, shipments],
  );

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
      [...new Set(modeShipments.map((row) => row.country).filter(Boolean))]
        .sort()
        .join("\0"),
    [modeShipments],
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

  const baseFilteredShipments = useMemo(() => {
    const cleanCountry = country.trim().toLowerCase();

    return modeShipments.filter((row) => {
      const matchesQuery = matchesEnviosSearchQuery(row, query);
      const matchesCountry = !cleanCountry || row.country.toLowerCase().includes(cleanCountry);
      const matchesStatus =
        isHistoryMode || matchesEnviosStatusFilter(row, statusFilter);
      const matchesSalesOwner =
        !salesOwnerFilter || row.salesOwnerId === salesOwnerFilter;

      return matchesQuery && matchesCountry && matchesStatus && matchesSalesOwner;
    });
  }, [country, isHistoryMode, modeShipments, query, salesOwnerFilter, statusFilter]);

  const readinessSummary = useMemo(() => {
    let listosCount = 0;
    let pendientesCount = 0;

    for (const row of baseFilteredShipments) {
      const bucket = classifyEnviosReadinessBucket(row);

      if (bucket === "listos") {
        listosCount += 1;
      } else if (bucket === "pendientes") {
        pendientesCount += 1;
      }
    }

    return {
      totalCount: baseFilteredShipments.length,
      listosCount,
      pendientesCount,
    };
  }, [baseFilteredShipments]);

  const filteredShipments = useMemo(
    () =>
      baseFilteredShipments.filter((row) => matchesEnviosReadinessFilter(row, readinessFilter)),
    [baseFilteredShipments, readinessFilter],
  );

  const displayShipments = useMemo(
    () => sortShipmentsByArrivalOrder(filteredShipments),
    [filteredShipments],
  );

  const selectionEnabled = !isHistoryMode && canManageSales;
  const {
    selectedIds: selectedShipmentIds,
    selectedCount: selectedShipmentCount,
    handleRowSelectClick,
    selectAll: selectAllShipments,
    clearSelection: clearShipmentSelection,
    isSelected: isShipmentSelected,
  } = useEnviosShipmentSelection(displayShipments);

  const selectedShipments = useMemo(
    () => displayShipments.filter((row) => selectedShipmentIds.has(row.id)),
    [displayShipments, selectedShipmentIds],
  );

  const bulkMarkableCount = useMemo(
    () => selectedShipments.filter((row) => canApplyEnviosBulkReadiness(row, "mark")).length,
    [selectedShipments],
  );

  const bulkUnmarkableCount = useMemo(
    () => selectedShipments.filter((row) => canApplyEnviosBulkReadiness(row, "unmark")).length,
    [selectedShipments],
  );

  const contactLogTarget = useMemo(
    () => shipments.find((row) => row.id === contactLogShipmentId) || null,
    [contactLogShipmentId, shipments],
  );


  function openShipmentAudit(shipmentId: string) {
    router.push(`/auditoria?shipment=${shipmentId}`);
  }

  function handleShipmentContextMenu(event: React.MouseEvent, row: ShipmentRow) {
    if (!canAccessAuditoria) {
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

  function toggleShipmentExpanded(shipmentId: string) {
    setExpandedShipmentIds((current) => {
      const next = new Set(current);
      if (next.has(shipmentId)) {
        next.delete(shipmentId);
      } else {
        next.add(shipmentId);
      }
      return next;
    });
  }

  function handleShipmentRowActivate(
    event: React.MouseEvent,
    row: ShipmentRow,
    index: number,
  ) {
    if (selectionEnabled && handleRowSelectClick(event, index, row.id)) {
      return;
    }

    if (viewLayout === "rows") {
      toggleShipmentExpanded(row.id);
    }
  }

  async function applyBulkReadiness(action: EnviosBulkReadinessAction) {
    if (!selectionEnabled || bulkBusy) {
      return;
    }

    const targets = selectedShipments.filter((row) =>
      canApplyEnviosBulkReadiness(row, action),
    );

    if (!targets.length) {
      notify.error(
        action === "mark"
          ? "Ningún envío seleccionado se puede marcar como listo"
          : "Ningún envío seleccionado se puede desmarcar",
      );
      return;
    }

    setBulkBusy(true);

    let updatedCount = 0;
    let failedCount = 0;

    try {
      for (const row of targets) {
        const patch = resolveEnviosBulkReadinessPatch(row, action);

        if (!patch) {
          continue;
        }

        const nextState = {
          ...shipmentLogisticsEditorState(row),
          ...patch,
        };
        const result = await updateShipmentLogisticsPlanAction({
          shipmentId: row.id,
          ...editorStateToUpdateInput(nextState),
          audit: {
            interaction: "bulk_action",
            source: "envios.bulk",
            stepTitle: action === "mark" ? "Marcar listos" : "Desmarcar listos",
          },
        });

        if (!result.ok) {
          failedCount += 1;
          notify.error(`${row.code}: ${result.error}`);
          continue;
        }

        updatedCount += 1;
        setShipments((current) =>
          current.map((entry) => (entry.id === row.id ? result.data : entry)),
        );
      }

      if (updatedCount > 0) {
        notify.success(
          action === "mark"
            ? `${updatedCount} envío${updatedCount === 1 ? "" : "s"} marcado${updatedCount === 1 ? "" : "s"} como listo${updatedCount === 1 ? "" : "s"}`
            : `${updatedCount} envío${updatedCount === 1 ? "" : "s"} desmarcado${updatedCount === 1 ? "" : "s"}`,
        );
      }

      if (failedCount > 0 && updatedCount === 0) {
        notify.error("No se pudo actualizar la selección");
      }
    } finally {
      setBulkBusy(false);
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

  async function receiveFullBoxAtOffice(row: ShipmentRow, audit: ShipmentAuditContext) {
    if (!canManageSales) {
      return;
    }

    setProgressBusyId(row.id);

    try {
      const result = await markFullBoxReceivedAtOfficeAction({ shipmentId: row.id, audit });

      if (!result.ok) {
        notify.error(result.error);
        return;
      }

      setShipments((current) =>
        current.map((entry) => (entry.id === row.id ? result.data : entry)),
      );
      notify.success("Caja llena recibida en oficina");
    } finally {
      setProgressBusyId(null);
    }
  }

  const canEditProgress = !isHistoryMode && (canManageSales || canUpdateShipmentStatus);

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
        title={panelTitle}
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
      title={panelTitle}
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
            mode={mode}
            readinessFilter={readinessFilter}
            onReadinessFilterChange={setReadinessFilter}
            totalCount={readinessSummary.totalCount}
            listosCount={readinessSummary.listosCount}
            pendientesCount={readinessSummary.pendientesCount}
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

          {selectionEnabled && selectedShipmentCount > 0 ? (
            <EnviosBulkSelectionBar
              selectedCount={selectedShipmentCount}
              visibleCount={displayShipments.length}
              markableCount={bulkMarkableCount}
              unmarkableCount={bulkUnmarkableCount}
              busy={bulkBusy}
              onSelectAll={selectAllShipments}
              onClearSelection={clearShipmentSelection}
              onMarkReady={() => void applyBulkReadiness("mark")}
              onUnmarkReady={() => void applyBulkReadiness("unmark")}
            />
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {displayShipments.length ? (
              viewLayout === "rows" ? (
                <EnviosShipmentRowsList
                  displayShipments={displayShipments}
                  cardClass={cardClass}
                  canManageSales={canManageSales}
                  canManageShipmentOwners={canManageShipmentOwners}
                  canEditProgress={canEditProgress}
                  canUpdateShipmentStatus={canUpdateShipmentStatus}
                  isHistoryMode={isHistoryMode}
                  salesOwners={salesOwners}
                  routeMemberLabelById={routeMemberLabelById}
                  routeByTaskId={routeByTaskId}
                  expandedShipmentIds={expandedShipmentIds}
                  busyId={busyId}
                  progressBusyId={progressBusyId}
                  priorityBusyId={priorityBusyId}
                  finalizeCopy={finalizeCopy}
                  onShipmentContextMenu={handleShipmentContextMenu}
                  onContactLogOpen={setContactLogShipmentId}
                  onTogglePriority={toggleInvoicePriority}
                  onFinalizeOpen={(row) => {
                    setFinalizePaymentMethod(DEFAULT_PAYMENT_METHOD);
                    setFinalizePaymentNote("");
                    setFinalizeCollectMode("choose");
                    setFinalizePartialAmount("");
                    setFinalizeTarget(row);
                  }}
                  onLogisticsPatch={applyLogisticsPatch}
                  onStatusChange={applyShipmentStatus}
                  onFullBoxReceivedAtOffice={receiveFullBoxAtOffice}
                  onLockedLeg={(message) => notify.error(message)}
                  selectionEnabled={selectionEnabled}
                  isShipmentSelected={isShipmentSelected}
                  onShipmentRowActivate={handleShipmentRowActivate}
                />
              ) : (
                <EnviosShipmentCardsGrid
                  displayShipments={displayShipments}
                  canManageSales={canManageSales}
                  canManageShipmentOwners={canManageShipmentOwners}
                  canEditProgress={canEditProgress}
                  canUpdateShipmentStatus={canUpdateShipmentStatus}
                  isHistoryMode={isHistoryMode}
                  salesOwners={salesOwners}
                  routeMemberLabelById={routeMemberLabelById}
                  routeByTaskId={routeByTaskId}
                  busyId={busyId}
                  progressBusyId={progressBusyId}
                  priorityBusyId={priorityBusyId}
                  ownerBusyId={ownerBusyId}
                  finalizeCopy={finalizeCopy}
                  onShipmentContextMenu={handleShipmentContextMenu}
                  onContactLogOpen={setContactLogShipmentId}
                  onTogglePriority={toggleInvoicePriority}
                  onUpdateSalesOwner={updateSalesOwner}
                  onFinalizeOpen={(row) => {
                    setFinalizePaymentMethod(DEFAULT_PAYMENT_METHOD);
                    setFinalizePaymentNote("");
                    setFinalizeCollectMode("choose");
                    setFinalizePartialAmount("");
                    setFinalizeTarget(row);
                  }}
                  onLogisticsPatch={applyLogisticsPatch}
                  onStatusChange={applyShipmentStatus}
                  onFullBoxReceivedAtOffice={receiveFullBoxAtOffice}
                  onLockedLeg={(message) => notify.error(message)}
                  selectionEnabled={selectionEnabled}
                  isShipmentSelected={isShipmentSelected}
                  onShipmentRowActivate={handleShipmentRowActivate}
                />
              )
            ) : viewLayout === "cards" ? (
              <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-lg border border-black bg-surface-card px-4 py-8 text-center sm:col-span-2 xl:col-span-3">
                  <Package className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="mt-3 text-xl font-black text-[#f8fafc]">
                    {isHistoryMode ? "Sin envíos entregados" : "Sin envíos"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-400">
                    {isHistoryMode
                      ? "No hay entregas que coincidan con estos filtros."
                      : "No hay envíos que coincidan con estos filtros."}
                  </p>
                  {canManageSales && !isHistoryMode ? (
                    <Link href="/venta" className={`${primaryButtonClass} mt-4 inline-flex h-11 items-center px-4`}>
                      Crear venta
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-black bg-surface-card px-4 py-8 text-center">
                <Package className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 text-xl font-black text-[#f8fafc]">
                  {isHistoryMode ? "Sin envíos entregados" : "Sin envíos"}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  {isHistoryMode
                    ? "No hay entregas que coincidan con estos filtros."
                    : "No hay envíos que coincidan con estos filtros."}
                </p>
                {canManageSales && !isHistoryMode ? (
                  <Link href="/venta" className={`${primaryButtonClass} mt-4 inline-flex h-11 items-center px-4`}>
                    Crear venta
                  </Link>
                ) : null}
              </div>
            )}
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
          if (isPaymentMethod(method)) {
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
  mode: EnviosClientMode;
  readinessFilter: EnviosReadinessFilter;
  onReadinessFilterChange: (value: EnviosReadinessFilter) => void;
  totalCount: number;
  listosCount: number;
  pendientesCount: number;
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
  mode,
  readinessFilter,
  onReadinessFilterChange,
  totalCount,
  listosCount,
  pendientesCount,
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
  const isHistoryMode = mode === "history";

  return (
    <div className="mb-3 shrink-0 rounded-xl border border-black bg-surface-card-header p-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="min-w-0 w-full basis-full sm:w-auto sm:min-w-[14rem] sm:max-w-[20rem] sm:flex-[1_1_16rem]">
          <span className="sr-only">Buscar envíos</span>
          <span className={`${insetShellClass} flex h-9 min-w-0 items-center gap-2 rounded-lg border border-black bg-surface-inset px-3`}>
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <input
              className="w-full bg-transparent text-sm font-bold text-[#f8fafc] outline-none placeholder:text-slate-500"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Nombre, teléfono, CP, invoice..."
              aria-label="Buscar envíos"
            />
          </span>
        </label>

        {canManageShipmentOwners ? (
          <label className="w-full shrink-0 sm:w-[12rem]">
            <span className="sr-only">Filtrar por vendedor</span>
            <select
              className="h-9 w-full rounded-lg border border-black bg-surface-inset px-2.5 pr-8 text-sm font-black text-[#f8fafc] outline-none"
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
          className="w-full sm:w-[8rem]"
          minWidthClass="w-full min-w-0"
          value={country}
          onChange={onCountryChange}
          options={countryFilterOptions}
          placeholder="País"
          searchPlaceholder="Buscar país..."
          emptyLabel="Sin países"
          ariaLabel="Filtrar por país"
        />

        {!isHistoryMode ? (
        <InlineSearchPicker
          className="w-full min-w-0 sm:min-w-[11rem] sm:w-[13rem]"
          minWidthClass="w-full min-w-0"
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={statusFilterOptions}
          placeholder="Estado"
          searchPlaceholder="Buscar estado..."
          emptyLabel="Sin estados"
          ariaLabel="Filtrar por estado de envío"
        />
        ) : null}

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="flex h-9 shrink-0 divide-x divide-black overflow-hidden rounded-lg border border-black bg-surface-inset">
            <button
              type="button"
              aria-pressed={readinessFilter === "all"}
              onClick={() => onReadinessFilterChange("all")}
              className={`flex min-w-[4.5rem] items-center gap-1.5 px-2 transition ${
                readinessFilter === "all"
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "text-slate-500 hover:bg-surface-card hover:text-slate-300"
              }`}
              title={isHistoryMode ? "Ver todos los entregados" : "Ver todos los envíos"}
            >
              <span className="text-[9px] font-black uppercase leading-none">
                {isHistoryMode ? "entregados" : "total"}
              </span>
              <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">
                {totalCount}
              </span>
            </button>
            {!isHistoryMode ? (
              <>
                <button
                  type="button"
                  aria-pressed={readinessFilter === "listos"}
                  onClick={() => onReadinessFilterChange("listos")}
                  className={`flex min-w-[4.75rem] items-center gap-1.5 px-2 transition ${
                    readinessFilter === "listos"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : "text-slate-500 hover:bg-surface-card hover:text-slate-300"
                  }`}
                  title="Ver envíos ya marcados para dejar o recoger"
                >
                  <span className="text-[9px] font-black uppercase leading-none">Listos</span>
                  <span className="text-sm font-black tabular-nums leading-none text-[#f8fafc]">
                    {listosCount}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={readinessFilter === "pendientes"}
                  onClick={() => onReadinessFilterChange("pendientes")}
                  className={`flex min-w-[5.5rem] items-center gap-1.5 px-2 transition ${
                    readinessFilter === "pendientes"
                      ? "bg-amber-400/15 text-amber-200"
                      : "text-slate-500 hover:bg-surface-card hover:text-slate-300"
                  }`}
                  title="Ver envíos pendientes de marcar para dejar o recoger"
                >
                  <span className="text-[9px] font-black uppercase leading-none">Pendientes</span>
                  <span className="text-sm font-black tabular-nums leading-none text-amber-300">
                    {pendientesCount}
                  </span>
                </button>
              </>
            ) : null}
          </div>


          {canManageSales && !isConductor && !isHistoryMode ? (
            <Link href="/venta" className={`${primaryButtonClass} h-9 shrink-0 px-4`}>
              Nuevo envío
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
});

type EnviosBulkSelectionBarProps = {
  selectedCount: number;
  visibleCount: number;
  markableCount: number;
  unmarkableCount: number;
  busy: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onMarkReady: () => void;
  onUnmarkReady: () => void;
};

const EnviosBulkSelectionBar = memo(function EnviosBulkSelectionBar({
  selectedCount,
  visibleCount,
  markableCount,
  unmarkableCount,
  busy,
  onSelectAll,
  onClearSelection,
  onMarkReady,
  onUnmarkReady,
}: EnviosBulkSelectionBarProps) {
  return (
    <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-emerald-700/50 bg-emerald-950/25 px-2.5 py-2">
      <p className="shrink-0 text-[11px] font-black uppercase tracking-wide text-emerald-200">
        {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy || visibleCount === 0}
          onClick={onSelectAll}
          className="h-8 rounded-lg border border-black bg-surface-inset px-3 text-[11px] font-black uppercase text-slate-200 transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-50"
        >
          Marcar todo
        </button>
        <button
          type="button"
          disabled={busy || markableCount === 0}
          onClick={onMarkReady}
          className="h-8 rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 text-[11px] font-black uppercase text-emerald-200 transition hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            markableCount > 0
              ? `Marcar ${markableCount} envío${markableCount === 1 ? "" : "s"} como listo${markableCount === 1 ? "" : "s"}`
              : "Ningún envío seleccionado se puede marcar"
          }
        >
          Marcar como listos
        </button>
        <button
          type="button"
          disabled={busy || unmarkableCount === 0}
          onClick={onUnmarkReady}
          className="h-8 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 text-[11px] font-black uppercase text-amber-200 transition hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            unmarkableCount > 0
              ? `Desmarcar ${unmarkableCount} envío${unmarkableCount === 1 ? "" : "s"}`
              : "Ningún envío seleccionado se puede desmarcar"
          }
        >
          Desmarcar como listos
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClearSelection}
          className="h-8 rounded-lg border border-black bg-surface-inset px-3 text-[11px] font-black uppercase text-slate-400 transition hover:bg-surface-card hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
});

type EnviosShipmentListsSharedProps = {
  displayShipments: ShipmentRow[];
  cardClass: string;
  canManageSales: boolean;
  canManageShipmentOwners: boolean;
  canEditProgress: boolean;
  canUpdateShipmentStatus: boolean;
  isHistoryMode: boolean;
  salesOwners: SalesOwnerRow[];
  routeMemberLabelById: (memberId: string) => string | undefined;
  routeByTaskId: (taskId: string) => { routeName: string; assignedTo: string | null } | undefined;
  busyId: string | null;
  progressBusyId: string | null;
  priorityBusyId: string | null;
  finalizeCopy: ReturnType<typeof collectShipmentInvoiceCopy>;
  onShipmentContextMenu: (event: React.MouseEvent, row: ShipmentRow) => void;
  onContactLogOpen: (shipmentId: string) => void;
  onTogglePriority: (row: ShipmentRow) => Promise<void>;
  onFinalizeOpen: (row: ShipmentRow) => void;
  onLogisticsPatch: (
    row: ShipmentRow,
    patch: Partial<ShipmentLogisticsEditorState>,
    audit: ShipmentAuditContext,
  ) => Promise<void>;
  onStatusChange: (
    row: ShipmentRow,
    status: ShipmentStatus,
    audit: ShipmentAuditContext,
  ) => Promise<void>;
  onFullBoxReceivedAtOffice: (row: ShipmentRow, audit: ShipmentAuditContext) => Promise<void>;
  onLockedLeg: (message: string) => void;
  selectionEnabled: boolean;
  isShipmentSelected: (shipmentId: string) => boolean;
  onShipmentRowActivate: (
    event: React.MouseEvent,
    row: ShipmentRow,
    index: number,
  ) => void;
};

type EnviosShipmentRowsListProps = EnviosShipmentListsSharedProps & {
  expandedShipmentIds: Set<string>;
};

const EnviosShipmentRowsList = memo(function EnviosShipmentRowsList({
  displayShipments,
  cardClass,
  canManageSales,
  canEditProgress,
  canUpdateShipmentStatus,
  isHistoryMode,
  routeMemberLabelById,
  routeByTaskId,
  expandedShipmentIds,
  busyId,
  progressBusyId,
  priorityBusyId,
  finalizeCopy,
  onShipmentContextMenu,
  onContactLogOpen,
  onTogglePriority,
  onFinalizeOpen,
  onLogisticsPatch,
  onStatusChange,
  onFullBoxReceivedAtOffice,
  onLockedLeg,
  selectionEnabled,
  isShipmentSelected,
  onShipmentRowActivate,
}: EnviosShipmentRowsListProps) {
  return (
    <div className={`${cardClass} overflow-hidden p-2`}>
      <div className="flex flex-col gap-2">
        {displayShipments.map((row, index) => {
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
          const milestoneAges = buildShipmentMilestoneAges(row, progressSteps);
          const timingInsights = buildShipmentTimingInsightPanel(row, progressSteps);
          const latestPayment = row.payments[row.payments.length - 1] || null;
          const isExpanded = expandedShipmentIds.has(row.id);
          const isSelected = selectionEnabled && isShipmentSelected(row.id);

          return (
            <article
              key={row.id}
              className={`${listRowBaseClass} px-3 py-1.5 sm:px-4 ${
                row.invoice_priority ? "bg-amber-950/15" : ""
              } ${isSelected ? "bg-emerald-950/25 ring-1 ring-inset ring-emerald-500/60" : ""} ${
                isExpanded ? "bg-surface-list-row-hover/80" : listRowHoverClass
              }`}
              onContextMenu={(event) => onShipmentContextMenu(event, row)}
            >
              <div
                className="grid w-full min-w-0 cursor-pointer grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-2 overflow-hidden sm:gap-x-3"
                onClick={(event) => onShipmentRowActivate(event, row, index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onShipmentRowActivate(event as unknown as React.MouseEvent, row, index);
                  }
                }}
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={`envios-detail-${row.id}`}
                aria-label={
                  isExpanded
                    ? `Ocultar detalle de ${row.code}`
                    : `Ver detalle de ${row.code}`
                }
              >
                <div className="flex min-w-0 items-center gap-x-2 sm:gap-x-3">
                  <ShipmentMilestoneAgeTrigger
                    ages={milestoneAges}
                    insights={timingInsights}
                    className="shrink-0 self-center"
                  />

                  <div className="min-w-0 max-w-[20rem] py-0.5">
                    <p className="truncate text-sm leading-snug">
                      <span className="font-black tracking-tight text-[#f8fafc]">
                        <Link
                          href={buildLogisticaShipmentDeepLink(row.code)}
                          className="hover:text-emerald-300"
                          onClick={(event) => {
                            if (event.ctrlKey || event.metaKey || event.shiftKey) {
                              event.preventDefault();
                            }
                          }}
                        >
                          {row.code}
                        </Link>
                      </span>
                      <span className="px-1.5 text-[10px] font-bold text-slate-600">
                        ·
                      </span>
                      <span className="font-bold text-slate-200">
                        {row.customer_name}
                      </span>
                    </p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] font-bold leading-none">
                      <span className="inline-flex min-w-0 shrink items-center gap-1 text-slate-300">
                        <CountryFlag
                          name={row.country}
                          size="xs"
                          className="!h-3 !w-[18px] !rounded-sm"
                        />
                        <span className="truncate">{row.country}</span>
                      </span>
                      {row.carrier ? (
                        <>
                          <span className="shrink-0 text-slate-600" aria-hidden>
                            ·
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 truncate text-slate-400">
                            <Package
                              className="h-3 w-3 shrink-0 opacity-60"
                              aria-hidden
                            />
                            <span className="truncate tabular-nums">
                              {row.carrier}
                            </span>
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="w-[9.25rem] shrink-0">
                    <ShipmentPaymentProgress
                      compact
                      summaryRow
                      progress={paymentProgress}
                    />
                  </div>
                </div>

                <div
                  className="min-w-0"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <ShipmentProgressSteps
                    steps={progressSteps}
                    timings={timings}
                    row={row}
                    compact
                    singleLine
                    canEdit={canEditProgress}
                    canEditLogistics={!isHistoryMode && canManageSales}
                    canEditStatus={!isHistoryMode && canUpdateShipmentStatus}
                    saving={progressBusyId === row.id}
                    onLogisticsPatch={(patch, audit) =>
                      void onLogisticsPatch(row, patch, audit)
                    }
                    onStatusChange={(status, audit) =>
                      void onStatusChange(row, status, audit)
                    }
                    onFullBoxReceivedAtOffice={
                      !isHistoryMode && canManageSales
                        ? (audit) => void onFullBoxReceivedAtOffice(row, audit)
                        : undefined
                    }
                    onLockedLeg={onLockedLeg}
                  />
                </div>
              </div>

              {isExpanded ? (
                <div
                  id={`envios-detail-${row.id}`}
                  className="mt-2.5 border-t border-black/70 pt-2.5"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {logisticsBridgeLabel ? (
                    <p className="mb-2 text-[10px] font-bold leading-snug text-amber-200/90">
                      {logisticsBridgeLabel}
                    </p>
                  ) : null}
                  <div className="mb-2.5 flex flex-wrap items-center gap-1">
                    <ShipmentLogisticsAssignmentBadges assignment={logisticsAssignment} />
                  </div>
                  <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:gap-4">
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {canManageSales ? (
                        <button
                          type="button"
                          onClick={() => onContactLogOpen(row.id)}
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
                      {canManageSales && !isHistoryMode ? (
                        <button
                          type="button"
                          disabled={priorityBusyId === row.id}
                          onClick={() => void onTogglePriority(row)}
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
                      {canFinalize ? (
                        <button
                          type="button"
                          disabled={busyId === row.id || progressBusyId === row.id || priorityBusyId === row.id}
                          onClick={() => onFinalizeOpen(row)}
                          className="inline-flex h-8 items-center rounded-lg border border-black bg-surface-inset px-3 text-[11px] font-black text-emerald-300 hover:bg-surface-card"
                          title={finalizeCopy.actionTitle}
                        >
                          {finalizeCopy.actionLabel}
                        </button>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      {latestPayment ? (
                        <p className="rounded-md border border-black bg-surface-inset px-2 py-1 text-[10px] font-black text-slate-300">
                          Pago: {formatMoneyValue(latestPayment.amount)} ·{" "}
                          {paymentMethodLabel(latestPayment.method)}
                          {latestPayment.note ? ` · ${latestPayment.note}` : ""}
                        </p>
                      ) : null}
                      {driverCollectionLabel(row) ? (
                        <p className="mt-1 rounded-md border border-sky-900/70 bg-sky-950/20 px-2 py-1 text-[10px] font-black text-sky-100">
                          {driverCollectionLabel(row)}
                        </p>
                      ) : null}
                      <ShipmentContactLogLine shipment={row} />
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
});

type EnviosShipmentCardsGridProps = Omit<EnviosShipmentListsSharedProps, "cardClass"> & {
  ownerBusyId: string | null;
  onUpdateSalesOwner: (row: ShipmentRow, salesOwnerId: string) => Promise<void>;
};

const EnviosShipmentCardsGrid = memo(function EnviosShipmentCardsGrid({
  displayShipments,
  canManageSales,
  canManageShipmentOwners,
  canEditProgress,
  canUpdateShipmentStatus,
  isHistoryMode,
  salesOwners,
  routeMemberLabelById,
  routeByTaskId,
  busyId,
  progressBusyId,
  priorityBusyId,
  ownerBusyId,
  finalizeCopy,
  onShipmentContextMenu,
  onContactLogOpen,
  onTogglePriority,
  onUpdateSalesOwner,
  onFinalizeOpen,
  onLogisticsPatch,
  onStatusChange,
  onFullBoxReceivedAtOffice,
  onLockedLeg,
  selectionEnabled,
  isShipmentSelected,
  onShipmentRowActivate,
}: EnviosShipmentCardsGridProps) {
  return (
    <div className="grid items-start gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {displayShipments.map((row, index) => {
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
        const isSelected = selectionEnabled && isShipmentSelected(row.id);

        return (
          <article
            key={row.id}
            role={selectionEnabled ? "checkbox" : undefined}
            className={`${listCardShellClass} flex cursor-pointer flex-col p-2.5${
              row.invoice_priority ? " bg-amber-950/15" : ""
            }${isSelected ? " ring-2 ring-emerald-500/70" : ""}`}
            onClick={(event) => onShipmentRowActivate(event, row, index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onShipmentRowActivate(event as unknown as React.MouseEvent, row, index);
              }
            }}
            tabIndex={selectionEnabled ? 0 : undefined}
            aria-checked={selectionEnabled ? isSelected : undefined}
            onContextMenu={(event) => onShipmentContextMenu(event, row)}
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
                  <label
                    className="flex min-w-0 flex-1 items-center gap-1 sm:min-w-[9rem]"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <span className="shrink-0 text-[9px] font-black uppercase text-slate-500">
                      Vendedor
                    </span>
                    <select
                      className="h-6 min-w-0 flex-1 rounded-md border border-black bg-surface-inset px-1.5 text-[10px] font-black text-slate-200 outline-none disabled:opacity-50"
                      value={row.salesOwnerId || ""}
                      disabled={ownerBusyId === row.id}
                      onChange={(event) => void onUpdateSalesOwner(row, event.target.value)}
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

            <div
              className="mt-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <ShipmentProgressSteps
                steps={progressSteps}
                timings={timings}
                row={row}
                compact
                canEdit={canEditProgress}
                canEditLogistics={!isHistoryMode && canManageSales}
                canEditStatus={!isHistoryMode && canUpdateShipmentStatus}
                saving={progressBusyId === row.id}
                onLogisticsPatch={(patch, audit) =>
                  void onLogisticsPatch(row, patch, audit)
                }
                onStatusChange={(status, audit) =>
                  void onStatusChange(row, status, audit)
                }
                onFullBoxReceivedAtOffice={
                  !isHistoryMode && canManageSales
                    ? (audit) => void onFullBoxReceivedAtOffice(row, audit)
                    : undefined
                }
                onLockedLeg={onLockedLeg}
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
              {driverCollectionLabel(row) ? (
                <p className="mt-1 rounded-md border border-sky-900/70 bg-sky-950/20 px-2 py-1 text-[10px] font-black text-sky-100">
                  {driverCollectionLabel(row)}
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
                      onClick={() => onContactLogOpen(row.id)}
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
                  {canManageSales && !isHistoryMode ? (
                    <button
                      type="button"
                      disabled={priorityBusyId === row.id}
                      onClick={() => void onTogglePriority(row)}
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
                      onClick={() => onFinalizeOpen(row)}
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
      })}
    </div>
  );
});
