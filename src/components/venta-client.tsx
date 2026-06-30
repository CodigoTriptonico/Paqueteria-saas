"use client";

import {
  Box,
  ChevronRight,
  Package,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import Link from "next/link";
import { type MouseEvent, type RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createCustomerAction,
  createRecipientAction,
  listCustomersWithRecipientsAction,
  updateCustomerAction,
  updateCustomerCardStyleAction,
  updateRecipientAction,
  updateRecipientCardStyleAction,
} from "@/app/actions/customers";
import { listActivityHistoryAction, type ActivityHistoryRow } from "@/app/actions/history";
import { allocateInvoiceNumberAction } from "@/app/actions/pricing";
import type { VentaBootstrapData } from "@/app/actions/sale-bootstrap";
import { listSaleShortcutsAction, type SaleShortcuts } from "@/app/actions/sale-shortcuts";
import { createShipmentAction } from "@/app/actions/shipments";
import { useContextNav } from "@/hooks/use-context-nav";
import { useNotify } from "@/hooks/use-notify";
import { useSetShellConfig } from "@/components/app-frame";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { customerRowToSender } from "@/lib/customers/mappers";
import {
  flowCardGridClass,
  flowPageShellWideClass,
  flowPanelContentClass,
  flowPanelFlushClass,
  flowStepBodyClass,
  flowPersonToolbarClass,
  flowPersonListShellClass,
  flowPersonListSectionClass,
  flowPagerClass,
  flowToolbarCreateButtonClass,
} from "@/components/flow-form-styles";
import { FlowPageHeader } from "@/components/flow-page-header";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import { SaleContextMenu } from "@/components/sale/sale-context-menu";
import { SaleCustomerHistoryDrawer } from "@/components/sale/sale-customer-history-drawer";
import {
  SaleQuickEmptyBoxModal,
  type QuickEmptyBoxDraft,
} from "@/components/sale/sale-quick-empty-box-modal";
import { SaleQuickCheckoutModal } from "@/components/sale/sale-quick-checkout-modal";
import { SaleInvoiceConfirmDialog } from "@/components/sale/sale-invoice-confirm-dialog";
import { PromotionSelector } from "@/components/sale/promotion-selector";
import { SaleClientForm } from "@/components/sale/sale-client-form";
import { SaleRecipientForm } from "@/components/sale/sale-recipient-form";
import { SaleLogisticsStep } from "@/components/sale/sale-logistics-step";
import { SalePersonPager } from "@/components/sale/sale-person-card";
import type { SalePersonCardVariantId } from "@/components/sale/sale-person-card-variants";
import { SalePersonStylePicker } from "@/components/sale/sale-person-style-picker";
import {
  SaleCartPanel,
  SaleStepCartTrigger,
} from "@/components/sale/sale-cart-panel";
import { SaleRecipientList } from "@/components/sale/sale-recipient-list";
import { SaleSenderList } from "@/components/sale/sale-sender-list";
import { configPricesCountryHref } from "@/lib/country-options";
import {
  computeInvoiceBilling,
  defaultInvoiceBillingConfig,
  resolvePayNowFromDraft,
  saleFinishActionLabel,
  type InvoiceBillingCartLine,
  type InvoiceBillingConfig,
  type InvoiceBillingSnapshot,
} from "@/lib/invoice-billing";
import { formatMoneyValue, parseMoneyValue } from "@/lib/logistics-fees";
import type { PricingPromotionConfig } from "@/lib/pricing-promotions";
import { promotionMatchesCartCatalog } from "@/lib/combo-rules";
import { CountryName } from "@/components/country-flag";
import {
  mergeSaleShortcuts,
  readRecentSaleShortcuts,
  recordRecentSale,
} from "@/lib/sale-recent-storage";
import { isSupabaseConfigured } from "@/lib/supabase/env";

let activeSaleScrollFrame: number | null = null;

function cancelSaleScroll() {
  if (activeSaleScrollFrame !== null) {
    cancelAnimationFrame(activeSaleScrollFrame);
    activeSaleScrollFrame = null;
  }
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function smoothScrollToY(targetY: number) {
  cancelSaleScroll();

  const startY = window.scrollY;
  const distance = targetY - startY;

  if (Math.abs(distance) < 2) {
    return;
  }

  const duration = Math.min(640, Math.max(420, Math.abs(distance) * 0.5));
  const startTime = performance.now();

  function tick(now: number) {
    const progress = Math.min((now - startTime) / duration, 1);

    window.scrollTo(0, startY + distance * easeInOutCubic(progress));

    if (progress < 1) {
      activeSaleScrollFrame = requestAnimationFrame(tick);
    } else {
      activeSaleScrollFrame = null;
    }
  }

  activeSaleScrollFrame = requestAnimationFrame(tick);
}

function afterLayoutPaint(callback: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}

function saleScrollTopOffset() {
  return window.matchMedia("(min-width: 768px)").matches ? 132 : 96;
}

import {
  type AddressFormKind,
  type AddressSuggestResponse,
  type AddressSuggestion,
  type AddressValidation,
  boxCardClass,
  ContextMenuState,
  contextActiveClass,
  EMPTY_BOX_DRIVER_MODE,
  EMPTY_BOX_OFFICE_MODE,
  formatDateInput,
  resolveScheduleDate,
  FULL_BOX_DRIVER_MODE,
  FULL_BOX_OFFICE_MODE,
  historyDateLabel,
  logisticsDriverTaskCount,
  logisticsLegComplete,
  logisticsSummary,
  normalizePhoneList,
  personFullName,
  RECIPIENTS_PER_PAGE,
  recipientCardClass,
  recipientIdentityKey,
  type Recipient,
  salePersonAddressSummary,
  SaleStepBar,
  type SaleStepBarItem,
  saleSteps,
  type SaleStep,
  selectedCardClass,
  type Sender,
  senderCardClass,
  senderHasPhone,
  senderPhoneKey,
  senderPhonesLabel,
  SENDERS_PER_PAGE,
  samePersonName,
  SaleInvoicePaper,
  SaleBoxCartQtyBadge,
  unselectedDimClass,
  applyAddressSuggestResult,
} from "@/components/sale/venta-parts";
import { scheduleAtToTimestamp } from "@/components/sale/schedule-time";

type CreatedInvoiceSnapshot = {
  invoiceNumber: string;
  sender: Sender;
  recipient: Recipient;
  box: string[];
  deliveryLine: string;
  billing: InvoiceBillingSnapshot;
};

function buildAddressSuggestQuery(parts: string[]) {
  const cleanParts = parts.map((part) => part.trim()).filter(Boolean);

  if (!cleanParts.length) {
    return "";
  }

  return cleanParts.join(" ");
}

function formatValidatedAddress(
  address: {
    street?: string;
    houseNumber?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    formattedAddress?: string;
  },
  typedUnit: string,
) {
  const unit = typedUnit.trim() || address.houseNumber?.trim() || "";

  if (!unit) {
    return address.formattedAddress;
  }

  const streetLine = [address.street, unit].filter(Boolean).join(" ");
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(" ");
  return [streetLine, cityLine, address.country].filter(Boolean).join(", ");
}

function normalizeCountryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function resolveCountryBoxes(
  countryBoxes: Record<string, string[][]>,
  country: string,
) {
  const direct = countryBoxes[country];

  if (direct?.length) {
    return direct;
  }

  const match = Object.entries(countryBoxes).find(
    ([name]) => normalizeCountryKey(name) === normalizeCountryKey(country),
  );

  return match?.[1] || [];
}

function saleBoxCatalogKey(box: string[] | null) {
  return box?.[5] || box?.[0] || "";
}

type SaleBoxCartLine = {
  id: string;
  box: string[];
  quantity: number;
};

function saleCartLineId(box: string[]) {
  return saleBoxCatalogKey(box) || box[0] || `box-${Date.now()}`;
}

function saleCartLineLabel(line: SaleBoxCartLine) {
  return `${line.box[0]} x${line.quantity}`;
}

function saleCartSummary(lines: SaleBoxCartLine[]) {
  return lines.length ? lines.map(saleCartLineLabel).join(" + ") : "";
}

function saleCartToBillingLines(lines: SaleBoxCartLine[]): InvoiceBillingCartLine[] {
  return lines.map((line) => ({
    label: line.box[0] || "Caja",
    catalogKey: saleBoxCatalogKey(line.box),
    quantity: line.quantity,
    unitPrice: line.box[1] || "$0",
    unitCost: line.box[2] || "$0",
    carrier: line.box[3] || "",
    time: line.box[4] || "",
  }));
}

function saleCartTotalCost(lines: SaleBoxCartLine[]) {
  return formatMoneyValue(
    lines.reduce(
      (sum, line) => sum + parseMoneyValue(line.box[2] || "$0") * line.quantity,
      0,
    ),
  );
}

function resolveCountryPromotions(
  promotions: PricingPromotionConfig[],
  country: string,
  box?: string[] | null,
) {
  return resolveCountryPromotionsForCatalogKeys(
    promotions,
    country,
    box ? [saleBoxCatalogKey(box)] : [],
  );
}

function resolveCountryPromotionsForCatalogKeys(
  promotions: PricingPromotionConfig[],
  country: string,
  catalogKeys: string[],
) {
  const countryKey = normalizeCountryKey(country);
  const keys = catalogKeys.map((key) => key.trim()).filter(Boolean);

  return promotions.filter((promotion) => {
    if (normalizeCountryKey(promotion.countryName) !== countryKey) {
      return false;
    }

    if (!keys.length) {
      return true;
    }

    return promotionMatchesCartCatalog(promotion, keys);
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

export function VentaClient({ initialData }: { initialData?: VentaBootstrapData }) {
  const localIdPrefix = useId();
  const localIdCounterRef = useRef(0);
  const setShellConfig = useSetShellConfig();
  const notify = useNotify();
  const [mode, setMode] = useState<"sale" | "clients" | "history" | "new-client" | "new-recipient">("sale");
  const [activeStep, setActiveStep] = useState<SaleStep>("client");
  const [senderList, setSenderList] = useState<Sender[]>(initialData?.senders ?? []);
  const [saleShortcuts, setSaleShortcuts] = useState<SaleShortcuts>(
    initialData?.shortcuts ?? {
      recentCustomerIds: [],
      lastRecipientByCustomerId: {},
    },
  );
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [, setCustomersSaving] = useState(false);
  const [historyRows, setHistoryRows] = useState<ActivityHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [countryBoxes] = useState<Record<string, string[][]>>(
    initialData?.countryBoxes ?? {},
  );
  const [countryPromotions] = useState<PricingPromotionConfig[]>(
    initialData?.countryPromotions ?? [],
  );
  const [logisticsFees] = useState<InvoiceBillingConfig>(
    initialData?.logisticsFees ?? defaultInvoiceBillingConfig,
  );
  const [payNowDraft, setPayNowDraft] = useState("");
  const [payNowDraftTouched, setPayNowDraftTouched] = useState(false);
  const [quickPayNowDraft, setQuickPayNowDraft] = useState("");
  const [quickPayNowDraftTouched, setQuickPayNowDraftTouched] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoiceSnapshot | null>(null);
  const [quickCheckoutCompleted, setQuickCheckoutCompleted] = useState(false);
  const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false);
  const [selectedPromotionId, setSelectedPromotionId] = useState("");
  const [boxCartOpen, setBoxCartOpen] = useState(false);
  const [quickSelectedPromotionId, setQuickSelectedPromotionId] = useState("");
  const [selectedSender, setSelectedSender] = useState<Sender | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [selectedBoxLines, setSelectedBoxLines] = useState<SaleBoxCartLine[]>([]);
  const selectedBox = selectedBoxLines[0]?.box ?? null;
  const selectedBoxCount = selectedBoxLines.reduce((sum, line) => sum + line.quantity, 0);
  const selectedCartBillingLines = useMemo(
    () => saleCartToBillingLines(selectedBoxLines),
    [selectedBoxLines],
  );
  const selectedCartSummary = useMemo(
    () => saleCartSummary(selectedBoxLines),
    [selectedBoxLines],
  );
  const cartPanelLines = useMemo(
    () =>
      selectedBoxLines.map((line) => ({
        id: line.id,
        label: line.box[0] || "Producto",
        unitPrice: line.box[1] || "$0",
        quantity: line.quantity,
      })),
    [selectedBoxLines],
  );
  const [senderQuery, setSenderQuery] = useState("");
  const [senderPage, setSenderPage] = useState(0);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientPage, setRecipientPage] = useState(0);
  const [newClientFirstName, setNewClientFirstName] = useState("");
  const [newClientLastName, setNewClientLastName] = useState("");
  const [newClientPhones, setNewClientPhones] = useState<string[]>([""]);
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientStreet, setNewClientStreet] = useState("");
  const [newClientHouse, setNewClientHouse] = useState("");
  const [newClientNeighborhood, setNewClientNeighborhood] = useState("");
  const [newClientCity, setNewClientCity] = useState("");
  const [newClientState, setNewClientState] = useState("");
  const [newClientPostalCode, setNewClientPostalCode] = useState("");
  const [newClientReferredByCustomerId, setNewClientReferredByCustomerId] = useState("");
  const [clientAddressSearch, setClientAddressSearch] = useState("");
  const [clientAddressSuggestions, setClientAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [newRecipientFirstName, setNewRecipientFirstName] = useState("");
  const [newRecipientLastName, setNewRecipientLastName] = useState("");
  const [newRecipientPhone, setNewRecipientPhone] = useState("");
  const [newRecipientCountry, setNewRecipientCountry] = useState("");
  const [newRecipientStreet, setNewRecipientStreet] = useState("");
  const [newRecipientHouse, setNewRecipientHouse] = useState("");
  const [newRecipientNeighborhood, setNewRecipientNeighborhood] = useState("");
  const [newRecipientCity, setNewRecipientCity] = useState("");
  const [newRecipientState, setNewRecipientState] = useState("");
  const [newRecipientPostalCode, setNewRecipientPostalCode] = useState("");
  const [recipientAddressSearch, setRecipientAddressSearch] = useState("");
  const [recipientAddressSuggestions, setRecipientAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [clientAddressValidation, setClientAddressValidation] = useState<AddressValidation>({
    status: "idle",
    message: "",
  });
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingRecipientId, setEditingRecipientId] = useState<string | null>(null);
  const [recipientAddressValidation, setRecipientAddressValidation] = useState<AddressValidation>({
    status: "idle",
    message: "",
  });
  const clientAddressQuery = useMemo(
    () =>
      buildAddressSuggestQuery(
        [
          newClientStreet,
          newClientHouse,
          newClientNeighborhood,
          newClientCity,
          newClientState,
          newClientPostalCode,
        ],
      ),
    [
      newClientStreet,
      newClientHouse,
      newClientNeighborhood,
      newClientCity,
      newClientState,
      newClientPostalCode,
    ],
  );
  const recipientAddressQuery = useMemo(
    () =>
      buildAddressSuggestQuery(
        [
          newRecipientStreet,
          newRecipientHouse,
          newRecipientNeighborhood,
          newRecipientCity,
          newRecipientState,
          newRecipientPostalCode,
        ],
      ),
    [
      newRecipientStreet,
      newRecipientHouse,
      newRecipientNeighborhood,
      newRecipientCity,
      newRecipientState,
      newRecipientPostalCode,
    ],
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{
    sender: Sender | null;
    recipientId?: string;
    recipientName?: string;
  } | null>(null);
  const [quickSaleSender, setQuickSaleSender] = useState<Sender | null>(null);
  const [cardStylePicker, setCardStylePicker] = useState<{
    kind: "sender" | "recipient";
    cardStyle: string;
    x: number;
    y: number;
    sender?: Sender;
    recipient?: Recipient;
  } | null>(null);
  const [quickSaleDraft, setQuickSaleDraft] = useState<QuickEmptyBoxDraft | null>(null);
  const [showQuickCheckout, setShowQuickCheckout] = useState(false);
  const [quickInvoiceNumber, setQuickInvoiceNumber] = useState("");
  const [activeCopyGroup, setActiveCopyGroup] = useState<string | null>(null);
  const [creatingOpenInvoice, setCreatingOpenInvoice] = useState(false);
  const [creatingQuickInvoice, setCreatingQuickInvoice] = useState(false);
  const [invoiceSequence, setInvoiceSequence] = useState(1);
  const countries = useMemo(() => Object.keys(countryBoxes), [countryBoxes]);
  const [stockMessage, setStockMessage] = useState("");
  const [emptyBoxMode, setEmptyBoxMode] = useState("");
  const [emptyBoxHandingNow, setEmptyBoxHandingNow] = useState(true);
  const [emptyBoxScheduleMode, setEmptyBoxScheduleMode] = useState("");
  const [emptyBoxScheduleAt, setEmptyBoxScheduleAt] = useState("");
  const [fullBoxMode, setFullBoxMode] = useState("");
  const [fullBoxScheduleMode, setFullBoxScheduleMode] = useState("");
  const [fullBoxScheduleAt, setFullBoxScheduleAt] = useState("");
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [deliveryStepConfirmed, setDeliveryStepConfirmed] = useState(false);
  const clientRef = useRef<HTMLDivElement | null>(null);
  const recipientsRef = useRef<HTMLDivElement | null>(null);
  const boxesRef = useRef<HTMLDivElement | null>(null);
  const deliveryRef = useRef<HTMLDivElement | null>(null);
  const finishRef = useRef<HTMLDivElement | null>(null);
  const routeDateInputRef = useRef<HTMLInputElement | null>(null);
  const fullBoxDateInputRef = useRef<HTMLInputElement | null>(null);
  const nextInvoiceNumber = `INV-${String(invoiceSequence).padStart(6, "0")}`;
  const emptyBoxRouteDate = emptyBoxScheduleAt.split("T")[0] || "";
  const emptyBoxRouteTime = emptyBoxScheduleAt.split("T")[1] || "";
  const fullBoxRouteDate = fullBoxScheduleAt.split("T")[0] || "";
  const fullBoxRouteTime = fullBoxScheduleAt.split("T")[1] || "";
  const emptyBoxComplete = logisticsLegComplete(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt);
  const fullBoxComplete = logisticsLegComplete(fullBoxMode, fullBoxScheduleMode, fullBoxScheduleAt);
  const logisticsPlanReady = emptyBoxComplete && fullBoxComplete;
  const deliveryComplete = deliveryStepConfirmed && logisticsPlanReady;
  const currentLogisticsSummary = logisticsSummary(
    emptyBoxMode,
    emptyBoxScheduleMode,
    emptyBoxScheduleAt,
    fullBoxMode,
    fullBoxScheduleMode,
    fullBoxScheduleAt,
    logisticsNotes,
    emptyBoxHandingNow,
  );
  const currentDriverTaskCount = logisticsDriverTaskCount(emptyBoxMode, fullBoxMode);
  const selectedBoxPromotions = useMemo(
    () =>
      selectedRecipient && selectedCartBillingLines.length
        ? resolveCountryPromotionsForCatalogKeys(
            countryPromotions,
            selectedRecipient.country,
            selectedCartBillingLines.map((line) => line.catalogKey),
          )
        : [],
    [countryPromotions, selectedRecipient, selectedCartBillingLines],
  );
  const quickBoxPromotions = useMemo(
    () =>
      quickSaleDraft
        ? resolveCountryPromotions(countryPromotions, "USA", quickSaleDraft.box)
        : [],
    [countryPromotions, quickSaleDraft],
  );
  const invoiceBilling = useMemo(() => {
    if (!selectedBox || !selectedCartBillingLines.length) {
      return null;
    }

    const payNow = resolvePayNowFromDraft(payNowDraft, payNowDraftTouched);

    return computeInvoiceBilling({
      boxCount: selectedBoxCount,
      boxUnitPrice: selectedBox[1] || "$0",
      cartLines: selectedCartBillingLines,
      emptyBoxDriver: emptyBoxMode === EMPTY_BOX_DRIVER_MODE,
      fullBoxDriver: fullBoxMode === FULL_BOX_DRIVER_MODE,
      fees: logisticsFees,
      payNow,
      catalogKey: saleBoxCatalogKey(selectedBox),
      promotions: selectedBoxPromotions,
      selectedPromotionId,
    });
  }, [
    selectedBox,
    selectedBoxCount,
    selectedCartBillingLines,
    emptyBoxMode,
    fullBoxMode,
    logisticsFees,
    payNowDraft,
    payNowDraftTouched,
    selectedBoxPromotions,
    selectedPromotionId,
  ]);

  const quickInvoiceBilling = useMemo(() => {
    if (!quickSaleDraft) {
      return null;
    }

    const payNow = resolvePayNowFromDraft(quickPayNowDraft, quickPayNowDraftTouched);

    return computeInvoiceBilling({
      boxCount: quickSaleDraft.boxCount,
      boxUnitPrice: quickSaleDraft.box[1] || "$0",
      emptyBoxDriver: quickSaleDraft.emptyBoxMode === EMPTY_BOX_DRIVER_MODE,
      fullBoxDriver: false,
      fees: logisticsFees,
      payNow,
      catalogKey: saleBoxCatalogKey(quickSaleDraft.box),
      promotions: quickBoxPromotions,
      selectedPromotionId: quickSelectedPromotionId,
    });
  }, [quickSaleDraft, logisticsFees, quickPayNowDraft, quickPayNowDraftTouched, quickBoxPromotions, quickSelectedPromotionId]);

  useEffect(() => {
    queueMicrotask(() => {
      setPayNowDraft("");
      setPayNowDraftTouched(false);
    });
  }, [selectedBox, selectedBoxCount, selectedCartBillingLines, emptyBoxMode, fullBoxMode, logisticsFees]);

  useEffect(() => {
    if (activeStep !== "box") {
      queueMicrotask(() => setBoxCartOpen(false));
    }
  }, [activeStep]);

  function continueFromCart() {
    setBoxCartOpen(false);
    if (activeStep === "box") {
      setActiveStep("delivery");
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      setQuickPayNowDraft("");
      setQuickPayNowDraftTouched(false);
    });
  }, [quickSaleDraft, logisticsFees]);

  const completedStep: SaleStep = deliveryComplete
    ? "finish"
    : selectedBox
      ? "delivery"
      : selectedRecipient
        ? "box"
        : selectedSender
          ? "recipient"
          : "client";
  const completedStepIndex = saleSteps.findIndex((step) => step.id === completedStep);
  const maxUnlockedStepIndex = completedStepIndex;

  const reloadHistory = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");

    const result = await listActivityHistoryAction();

    setHistoryLoading(false);

    if (!result.ok) {
      setHistoryError(result.error);
      return;
    }

    setHistoryRows(result.data);
  }, []);

  function canOpenStep(step: SaleStep) {
    return saleSteps.findIndex((currentStep) => currentStep.id === step) <= maxUnlockedStepIndex;
  }

  function openStep(step: SaleStep) {
    if (!canOpenStep(step)) {
      return;
    }

    if (mode === "new-client") {
      resetNewClientForm();
    } else if (mode === "new-recipient") {
      resetNewRecipientForm();
    }
    setMode("sale");
    setActiveStep(step);
    scrollToStep(step);
  }

  function stepShellClass(step: SaleStep) {
    if (activeStep === step) {
      return "rounded-xl";
    }

    return "rounded-xl";
  }

  const openContextMenuAt = useCallback(
    (
      clientX: number,
      clientY: number,
      title: string,
      type: ContextMenuState["type"],
      targetKey: string,
      phones: string[] = [],
      address: ContextMenuState["address"] = {},
      firstName = "",
      lastName = "",
      customerId?: string,
      recipientId?: string,
    ) => {
      setActiveCopyGroup(null);
      const menuWidth = 288;
      const menuHeight = 380;
      const gap = 10;
      const x = Math.min(clientX, window.innerWidth - menuWidth - gap);
      const y = Math.min(clientY, window.innerHeight - menuHeight - gap);

      setContextMenu({
        x: Math.max(gap, x),
        y: Math.max(gap, y),
        title,
        firstName,
        lastName,
        type,
        targetKey,
        customerId,
        recipientId,
        phones,
        address,
      });
    },
    [],
  );

  useEffect(() => {
    setShellConfig({ contentEdgeToEdge: true });
    return () => setShellConfig({ contentEdgeToEdge: undefined });
  }, [setShellConfig]);

  useEffect(() => {
    function openSaleCardMenu(event: globalThis.MouseEvent) {
      if (event.type !== "contextmenu" && event.button !== 2) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-sale-context-key]")
        : null;

      if (!target) {
        return;
      }

      const type = target.dataset.saleContextType as ContextMenuState["type"] | undefined;
      const title = target.dataset.saleContextTitle;
      const targetKey = target.dataset.saleContextKey;
      const firstName = target.dataset.saleContextFirstName || "";
      const lastName = target.dataset.saleContextLastName || "";

      if (!type || !title || !targetKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      openContextMenuAt(
        event.clientX,
        event.clientY,
        title,
        type,
        targetKey,
        target.dataset.saleContextPhones
          ? target.dataset.saleContextPhones.split("|").filter(Boolean)
          : [],
        {
          street: target.dataset.saleContextStreet,
          houseNumber: target.dataset.saleContextHouse,
          neighborhood: target.dataset.saleContextNeighborhood,
          city: target.dataset.saleContextCity,
          state: target.dataset.saleContextState,
          postalCode: target.dataset.saleContextPostalCode,
          country: target.dataset.saleContextCountry,
        },
        firstName,
        lastName,
        target.dataset.saleContextCustomerId,
        target.dataset.saleContextRecipientId,
      );
    }

    document.addEventListener("pointerup", openSaleCardMenu, true);
    document.addEventListener("mouseup", openSaleCardMenu, true);
    document.addEventListener("contextmenu", openSaleCardMenu, true);

    return () => {
      document.removeEventListener("pointerup", openSaleCardMenu, true);
      document.removeEventListener("mouseup", openSaleCardMenu, true);
      document.removeEventListener("contextmenu", openSaleCardMenu, true);
    };
  }, [openContextMenuAt]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const closeMenu = () => {
      setContextMenu(null);
      setActiveCopyGroup(null);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const newClientPhoneList = useMemo(
    () => normalizePhoneList(newClientPhones),
    [newClientPhones],
  );

  const duplicateClient = useMemo(() => {
    if (!newClientPhoneList.length) {
      return null;
    }

    return senderList.find((sender) => {
      if (editingCustomerId && sender.id === editingCustomerId) {
        return false;
      }

      return newClientPhoneList.some((phone) => senderHasPhone(sender, phone));
    });
  }, [editingCustomerId, newClientPhoneList, senderList]);

  const duplicateRecipient = useMemo(() => {
    if (
      !selectedSender ||
      !newRecipientFirstName.trim() ||
      !newRecipientLastName.trim() ||
      !newRecipientCountry
    ) {
      return null;
    }

    const candidate = {
      firstName: newRecipientFirstName.trim(),
      lastName: newRecipientLastName.trim(),
    };

    return selectedSender.recipients.find(
      (recipient) =>
        recipient.id !== editingRecipientId &&
        samePersonName(recipient, candidate) && recipient.country === newRecipientCountry,
    );
  }, [
    editingRecipientId,
    newRecipientCountry,
    newRecipientFirstName,
    newRecipientLastName,
    selectedSender,
  ]);

  const filteredSenders = senderList;

  const senderPageCount = Math.max(1, Math.ceil(filteredSenders.length / SENDERS_PER_PAGE));
  const safeSenderPage = Math.min(senderPage, senderPageCount - 1);
  const visibleSenders = filteredSenders.slice(
    safeSenderPage * SENDERS_PER_PAGE,
    safeSenderPage * SENDERS_PER_PAGE + SENDERS_PER_PAGE,
  );

  const filteredRecipients = useMemo(() => {
    if (!selectedSender) {
      return [];
    }

    const query = recipientQuery.trim().toLowerCase();

    if (!query) {
      return selectedSender.recipients;
    }

    return selectedSender.recipients.filter((recipient) =>
      [
        personFullName(recipient),
        recipient.firstName,
        recipient.lastName,
        recipient.phone,
        recipient.country,
        recipient.street,
        recipient.houseNumber,
        recipient.neighborhood,
        recipient.city,
        recipient.postalCode,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [recipientQuery, selectedSender]);

  const recipientSearchOptions = useMemo(() => {
    if (!selectedSender) {
      return [];
    }

    return selectedSender.recipients.map((recipient) => ({
      value: recipientIdentityKey(recipient),
      label: personFullName(recipient),
      searchText: [
        personFullName(recipient),
        recipient.firstName,
        recipient.lastName,
        recipient.phone,
        recipient.country,
        recipient.street,
        recipient.city,
        recipient.postalCode,
      ]
        .filter(Boolean)
        .join(" "),
    }));
  }, [selectedSender]);

  const boxesForCountry = useMemo(
    () =>
      selectedRecipient
        ? resolveCountryBoxes(countryBoxes, selectedRecipient.country)
        : [],
    [countryBoxes, selectedRecipient],
  );
  const recentSenders = useMemo(() => {
    return saleShortcuts.recentCustomerIds
      .map((customerId) => senderList.find((sender) => sender.id === customerId))
      .filter((sender): sender is Sender => Boolean(sender));
  }, [saleShortcuts.recentCustomerIds, senderList]);

  const suggestedRecipientId = useMemo(() => {
    if (!selectedSender?.id) {
      return undefined;
    }

    return saleShortcuts.lastRecipientByCustomerId[selectedSender.id];
  }, [saleShortcuts.lastRecipientByCustomerId, selectedSender]);

  const sortedFilteredRecipients = useMemo(() => {
    if (!suggestedRecipientId || filteredRecipients.length <= 1) {
      return filteredRecipients;
    }

    const suggested = filteredRecipients.find((recipient) => recipient.id === suggestedRecipientId);
    if (!suggested) {
      return filteredRecipients;
    }

    return [
      suggested,
      ...filteredRecipients.filter((recipient) => recipient.id !== suggestedRecipientId),
    ];
  }, [filteredRecipients, suggestedRecipientId]);

  const recipientPageCount = Math.max(
    1,
    Math.ceil(sortedFilteredRecipients.length / RECIPIENTS_PER_PAGE),
  );
  const safeRecipientPage = Math.min(recipientPage, recipientPageCount - 1);
  const visibleRecipients = sortedFilteredRecipients.slice(
    safeRecipientPage * RECIPIENTS_PER_PAGE,
    safeRecipientPage * RECIPIENTS_PER_PAGE + RECIPIENTS_PER_PAGE,
  );
  const emptyRecipientSlots = Math.max(0, RECIPIENTS_PER_PAGE - visibleRecipients.length);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sale-context-key]"),
    );

    function openElementMenu(event: globalThis.MouseEvent) {
      if (event.type !== "contextmenu" && event.button !== 2) {
        return;
      }

      const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;

      if (!target) {
        return;
      }

      const type = target.dataset.saleContextType as ContextMenuState["type"] | undefined;
      const title = target.dataset.saleContextTitle;
      const targetKey = target.dataset.saleContextKey;

      if (!type || !title || !targetKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const clientX = event.clientX;
      const clientY = event.clientY;
      const phones = target.dataset.saleContextPhones
        ? target.dataset.saleContextPhones.split("|").filter(Boolean)
        : [];
      const address = {
        street: target.dataset.saleContextStreet,
        houseNumber: target.dataset.saleContextHouse,
        neighborhood: target.dataset.saleContextNeighborhood,
        city: target.dataset.saleContextCity,
        state: target.dataset.saleContextState,
        postalCode: target.dataset.saleContextPostalCode,
        country: target.dataset.saleContextCountry,
      };

      window.setTimeout(() => {
        openContextMenuAt(
          clientX,
          clientY,
          title,
          type,
          targetKey,
          phones,
          address,
          target.dataset.saleContextFirstName || "",
          target.dataset.saleContextLastName || "",
          target.dataset.saleContextCustomerId,
          target.dataset.saleContextRecipientId,
        );
      }, 50);
    }

    elements.forEach((element) => {
      element.addEventListener("pointerup", openElementMenu, true);
      element.addEventListener("mouseup", openElementMenu, true);
      element.addEventListener("contextmenu", openElementMenu, true);
    });

    return () => {
      elements.forEach((element) => {
        element.removeEventListener("pointerup", openElementMenu, true);
        element.removeEventListener("mouseup", openElementMenu, true);
        element.removeEventListener("contextmenu", openElementMenu, true);
      });
    };
  }, [boxesForCountry, filteredSenders, openContextMenuAt, visibleRecipients]);

  const copyAddressItems = [
    {
      label: "Completa",
      value: fullAddress(),
    },
    { label: "Calle", value: contextMenu?.address.street },
    { label: "Casa", value: contextMenu?.address.houseNumber },
    { label: "Colonia", value: contextMenu?.address.neighborhood },
    { label: "Ciudad", value: contextMenu?.address.city },
    { label: "Estado", value: contextMenu?.address.state },
    { label: "CP", value: contextMenu?.address.postalCode },
    { label: "Pais", value: contextMenu?.address.country },
  ].filter((item) => item.label === "Completa" || item.value);
  const copyGroups = [
    { label: "Todo", items: [] },
    {
      label: "Nombre",
      items: [
        { label: "Nombre completo", value: contextMenu?.title },
        { label: "Nombre", value: contextMenu?.firstName },
        { label: "Apellido", value: contextMenu?.lastName },
      ].filter((item) => item.value),
    },
    {
      label: "Telefono",
      items: contextMenu?.phones.length
        ? [
            ...(contextMenu.phones.length > 1
              ? [
                  {
                    label: "Todos los celulares",
                    value: contextMenu.phones.join(", "),
                  },
                ]
              : []),
            ...contextMenu.phones.map((phone, index) => ({
              label: `Celular ${index + 1}`,
              value: phone,
            })),
          ]
        : [],
    },
    {
      label: "Direccion",
      items: copyAddressItems,
    },
  ];
  const editGroups = [
    { label: "Todo", text: "Editar ficha completa" },
    { label: "Nombre", text: "Editar nombre y apellido" },
    { label: "Telefono", text: "Editar celulares" },
    { label: "Direccion", text: "Editar direccion" },
  ];

  function scrollToNext(ref: RefObject<HTMLDivElement | null>, force = false) {
    afterLayoutPaint(() => {
      const element = ref.current;
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const topOffset = saleScrollTopOffset();
      const isVisible = rect.top >= topOffset && rect.bottom <= window.innerHeight - 24;

      if (force || !isVisible) {
        smoothScrollToY(window.scrollY + rect.top - topOffset);
      }
    });
  }

  function scrollToStep(step: SaleStep, force = false) {
    const refs: Record<SaleStep, RefObject<HTMLDivElement | null>> = {
      client: clientRef,
      recipient: recipientsRef,
      box: boxesRef,
      delivery: deliveryRef,
      finish: finishRef,
    };

    scrollToNext(refs[step], force);
  }

  function resetSaleLogistics() {
    setEmptyBoxMode("");
    setEmptyBoxHandingNow(true);
    setEmptyBoxScheduleMode("");
    setEmptyBoxScheduleAt("");
    setFullBoxMode("");
    setFullBoxScheduleMode("");
    setFullBoxScheduleAt("");
    setLogisticsNotes("");
    setDeliveryStepConfirmed(false);
  }

  function startNewSale() {
    setCreatedInvoice(null);
    setSelectedSender(null);
    setSelectedRecipient(null);
    setSelectedBoxLines([]);
    resetSaleLogistics();
    setActiveStep("client");
    setPayNowDraft("");
    setPayNowDraftTouched(false);
    setSelectedPromotionId("");
    setStockMessage("");
    setInvoiceSequence((current) => current + 1);
  }

  function closeQuickCheckout() {
    setShowQuickCheckout(false);
    setQuickSaleDraft(null);
    setQuickInvoiceNumber("");
    setQuickPayNowDraft("");
    setQuickPayNowDraftTouched(false);
    setQuickCheckoutCompleted(false);
    setQuickSelectedPromotionId("");
  }

  async function finishQuickCheckoutNewSale() {
    if (isSupabaseConfigured()) {
      const nextInvoice = await allocateInvoiceNumberAction();
      if (nextInvoice.ok) {
        const match = nextInvoice.data.invoiceNumber.match(/(\d+)$/);
        if (match) {
          setInvoiceSequence(Number(match[1]));
        }
      }
    } else {
      setInvoiceSequence((current) => current + 1);
    }

    closeQuickCheckout();
  }

  function confirmDeliveryStep() {
    if (!logisticsPlanReady) {
      return;
    }

    setDeliveryStepConfirmed(true);
    setMode("sale");
    setActiveStep("finish");
    scrollToStep("finish");
  }

  function chooseSender(sender: Sender) {
    const isSameSender =
      selectedSender !== null && senderPhoneKey(selectedSender) === senderPhoneKey(sender);

    if (isSameSender) {
      setSelectedSender(null);
      setSelectedRecipient(null);
      setSelectedBoxLines([]);
      resetSaleLogistics();
      setRecipientPage(0);
      setActiveStep("client");
      return;
    }

    setSelectedSender(sender);
    setSelectedRecipient(null);
    setSelectedBoxLines([]);
    resetSaleLogistics();
    setRecipientPage(0);
    setActiveStep("recipient");
  }

  function patchSenderCardStyle(senderId: string, cardStyle: string) {
    setSenderList((current) =>
      current.map((sender) =>
        sender.id === senderId ? { ...sender, cardStyle } : sender,
      ),
    );
    setSelectedSender((current) =>
      current?.id === senderId ? { ...current, cardStyle } : current,
    );
    setQuickSaleSender((current) =>
      current?.id === senderId ? { ...current, cardStyle } : current,
    );
  }

  function resetNewClientForm() {
    setNewClientFirstName("");
    setNewClientLastName("");
    setNewClientPhones([""]);
    setNewClientEmail("");
    setNewClientStreet("");
    setNewClientHouse("");
    setNewClientNeighborhood("");
    setNewClientCity("");
    setNewClientState("");
    setNewClientPostalCode("");
    setNewClientReferredByCustomerId("");
    setClientAddressSearch("");
    setClientAddressSuggestions([]);
    setClientAddressValidation({ status: "idle", message: "" });
    setEditingCustomerId(null);
  }

  const reloadCustomers = useCallback(async (query = "", options?: { showLoading?: boolean }) => {
    if (!isSupabaseConfigured()) {
      setCustomersLoading(false);
      return;
    }

    const trimmedQuery = query.trim();
    const showLoading = options?.showLoading ?? Boolean(trimmedQuery);

    if (showLoading) {
      setCustomersLoading(true);
    }
    setCustomersError("");

    const result = await listCustomersWithRecipientsAction({
      query: trimmedQuery || undefined,
    });

    if (showLoading) {
      setCustomersLoading(false);
    }
    if (!result.ok) {
      setCustomersError(result.error);
      return;
    }

    setSenderList(result.data.map(customerRowToSender));
  }, []);

  async function saveSenderCardStyle(sender: Sender, cardStyle: SalePersonCardVariantId) {
    patchSenderCardStyle(sender.id, cardStyle);

    if (!isSupabaseConfigured() || sender.id.startsWith("local-")) {
      return;
    }

    const result = await updateCustomerCardStyleAction({
      customerId: sender.id,
      cardStyle,
    });

    if (!result.ok) {
      notify.error(result.error);
      void reloadCustomers(senderQuery, { showLoading: false });
    }
  }

  function patchRecipientCardStyle(recipientId: string, cardStyle: string) {
    const patchRecipients = (recipients: Recipient[]) =>
      recipients.map((recipient) =>
        recipient.id === recipientId ? { ...recipient, cardStyle } : recipient,
      );

    setSenderList((current) =>
      current.map((sender) => ({
        ...sender,
        recipients: patchRecipients(sender.recipients),
      })),
    );
    setSelectedSender((current) =>
      current ? { ...current, recipients: patchRecipients(current.recipients) } : current,
    );
    setSelectedRecipient((current) =>
      current?.id === recipientId ? { ...current, cardStyle } : current,
    );
  }

  async function saveRecipientCardStyle(recipient: Recipient, cardStyle: SalePersonCardVariantId) {
    patchRecipientCardStyle(recipient.id, cardStyle);

    if (!isSupabaseConfigured() || recipient.id.startsWith("local-r-")) {
      return;
    }

    const result = await updateRecipientCardStyleAction({
      recipientId: recipient.id,
      cardStyle,
    });

    if (!result.ok) {
      notify.error(result.error);
      void reloadCustomers(senderQuery, { showLoading: false });
    }
  }

  const reloadSaleShortcuts = useCallback(async () => {
    let shortcuts = readRecentSaleShortcuts();

    if (isSupabaseConfigured()) {
      const result = await listSaleShortcutsAction();
      if (result.ok) {
        shortcuts = mergeSaleShortcuts(result.data, shortcuts);
      }
    }

    setSaleShortcuts(shortcuts);
  }, []);

  const prevSenderQueryRef = useRef("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const query = senderQuery.trim();
    const prevQuery = prevSenderQueryRef.current.trim();
    prevSenderQueryRef.current = senderQuery;

    if (!query && !prevQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      void reloadCustomers(query);
    }, query ? 250 : 0);

    return () => window.clearTimeout(timer);
  }, [reloadCustomers, senderQuery]);

  useEffect(() => {
    if (mode !== "history" || historyRows.length > 0 || historyLoading) {
      return;
    }

    queueMicrotask(() => {
      void reloadHistory();
    });
  }, [historyLoading, historyRows.length, mode, reloadHistory]);

  function resetNewRecipientForm() {
    setNewRecipientFirstName("");
    setNewRecipientLastName("");
    setNewRecipientPhone("");
    setNewRecipientCountry("");
    setNewRecipientStreet("");
    setNewRecipientHouse("");
    setNewRecipientNeighborhood("");
    setNewRecipientCity("");
    setNewRecipientState("");
    setNewRecipientPostalCode("");
    setRecipientAddressSearch("");
    setRecipientAddressSuggestions([]);
    setRecipientAddressValidation({ status: "idle", message: "" });
    setEditingRecipientId(null);
  }

  async function selectAddressSuggestion(kind: AddressFormKind, suggestion: AddressSuggestion) {
    const isClient = kind === "client";
    const setValidation = isClient ? setClientAddressValidation : setRecipientAddressValidation;
    const setSuggestions = isClient ? setClientAddressSuggestions : setRecipientAddressSuggestions;
    const setSearch = isClient ? setClientAddressSearch : setRecipientAddressSearch;

    setValidation({ status: "checking", message: "Separando direccion..." });
    setSearch(suggestion.description);
    setSuggestions([]);

    try {
      const response = await fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "details",
          placeId: suggestion.placeId,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        partial?: boolean;
        error?: string;
        address?: {
          street?: string;
          houseNumber?: string;
          neighborhood?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
          formattedAddress?: string;
          placeId?: string;
          lat?: number | null;
          lng?: number | null;
        };
      };

      if (!response.ok || !data.ok || !data.address) {
        setValidation({
          status: "invalid",
          message: data.error || "No se pudo separar direccion",
        });
        return;
      }

      if (isClient) {
        setNewClientStreet(data.address.street || newClientStreet);
        setNewClientHouse(data.address.houseNumber || newClientHouse);
        setNewClientNeighborhood(data.address.neighborhood || newClientNeighborhood);
        setNewClientCity(data.address.city || newClientCity);
        setNewClientState(data.address.state || newClientState);
        setNewClientPostalCode(data.address.postalCode || newClientPostalCode);
      } else {
        setNewRecipientStreet(data.address.street || newRecipientStreet);
        setNewRecipientHouse(data.address.houseNumber || newRecipientHouse);
        setNewRecipientNeighborhood(data.address.neighborhood || newRecipientNeighborhood);
        setNewRecipientCity(data.address.city || newRecipientCity);
        setNewRecipientState(data.address.state || newRecipientState);
        setNewRecipientPostalCode(data.address.postalCode || newRecipientPostalCode);
      }

      const needsUnit = !data.address.houseNumber?.trim();
      const typedUnit = isClient ? newClientHouse : newRecipientHouse;

      setValidation({
        status: "valid",
        message: needsUnit
          ? "Validada - agrega unidad o apt en Casa si aplica"
          : "Direccion valida",
        formattedAddress: formatValidatedAddress(data.address, typedUnit),
        placeId: data.address.placeId || suggestion.placeId,
        lat: data.address.lat ?? null,
        lng: data.address.lng ?? null,
      });
    } catch {
      setValidation({
        status: "invalid",
        message: "No se pudo conectar con Google",
      });
    }
  }

  function touchClientAddressField(update: () => void) {
    update();
    setClientAddressValidation({ status: "idle", message: "" });
  }

  function touchRecipientAddressField(update: () => void) {
    update();
    setRecipientAddressValidation({ status: "idle", message: "" });
  }

  useEffect(() => {
    const query = clientAddressQuery.trim();

    if (clientAddressValidation.status === "valid") {
      queueMicrotask(() => setClientAddressSuggestions([]));
      return;
    }

    if (query.length < 3) {
      queueMicrotask(() => setClientAddressSuggestions([]));
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "suggest", query, country: "USA" }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json()) as AddressSuggestResponse;
          if (controller.signal.aborted) {
            return;
          }
          applyAddressSuggestResult(
            data,
            response.ok,
            setClientAddressSuggestions,
            setClientAddressValidation,
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setClientAddressSuggestions([]);
            setClientAddressValidation({
              status: "invalid",
              message: "No se pudo conectar con el servicio de direcciones",
            });
          }
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [clientAddressQuery, clientAddressValidation.status]);

  useEffect(() => {
    const query = recipientAddressQuery.trim();

    if (recipientAddressValidation.status === "valid") {
      queueMicrotask(() => setRecipientAddressSuggestions([]));
      return;
    }

    if (query.length < 3 || !newRecipientCountry) {
      queueMicrotask(() => setRecipientAddressSuggestions([]));
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "suggest", query, country: newRecipientCountry }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json()) as AddressSuggestResponse;
          if (controller.signal.aborted) {
            return;
          }
          applyAddressSuggestResult(
            data,
            response.ok,
            setRecipientAddressSuggestions,
            setRecipientAddressValidation,
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setRecipientAddressSuggestions([]);
            setRecipientAddressValidation({
              status: "invalid",
              message: "No se pudo conectar con el servicio de direcciones",
            });
          }
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [newRecipientCountry, recipientAddressQuery, recipientAddressValidation.status]);

  function updateClientPhone(index: number, value: string) {
    setNewClientPhones((current) =>
      current.map((phone, phoneIndex) => (phoneIndex === index ? value : phone)),
    );
  }

  function addClientPhone() {
    setNewClientPhones((current) => [...current, ""]);
  }

  function removeClientPhone(index: number) {
    setNewClientPhones((current) => (current.length <= 1 ? [""] : current.filter((_, i) => i !== index)));
  }

  function addReferralClient(sender: Sender) {
    resetNewClientForm();
    setNewClientReferredByCustomerId(sender.id);
    setMode("new-client");
    setActiveStep("client");
  }

  async function createClient() {
    const phones = normalizePhoneList(newClientPhones);

    if (!phones.length) {
      return;
    }

    if (duplicateClient) {
      if (editingCustomerId) {
        return;
      }

      chooseSender(duplicateClient);
      setMode("sale");
      return;
    }

    if (
      !newClientFirstName.trim() ||
      !newClientLastName.trim() ||
      !newClientStreet.trim() ||
      !newClientCity.trim() ||
      !newClientState.trim() ||
      !newClientPostalCode.trim()
    ) {
      return;
    }

    if (clientAddressValidation.status !== "valid") {
      setClientAddressValidation({
        status: "invalid",
        message: "Primero valida direccion en Google",
      });
      return;
    }

    const payload = {
      firstName: newClientFirstName.trim(),
      lastName: newClientLastName.trim(),
      phones,
      email: newClientEmail.trim(),
      street: newClientStreet.trim(),
      houseNumber: newClientHouse.trim() || "-",
      neighborhood: newClientNeighborhood.trim() || "-",
      city: newClientCity.trim(),
      state: newClientState.trim(),
      postalCode: newClientPostalCode.trim(),
      country: "USA",
      referredByCustomerId: editingCustomerId ? "" : newClientReferredByCustomerId,
      placeId: clientAddressValidation.placeId || "",
      formattedAddress: clientAddressValidation.formattedAddress || "",
      lat: clientAddressValidation.lat ?? null,
      lng: clientAddressValidation.lng ?? null,
    };

    if (isSupabaseConfigured()) {
      setCustomersSaving(true);
      setCustomersError("");

      const result = editingCustomerId
        ? await updateCustomerAction({
            customerId: editingCustomerId,
            firstName: payload.firstName,
            lastName: payload.lastName,
            phones: payload.phones,
            email: payload.email,
            street: payload.street,
            houseNumber: payload.houseNumber,
            neighborhood: payload.neighborhood,
            city: payload.city,
            state: payload.state,
            postalCode: payload.postalCode,
            country: payload.country,
            placeId: payload.placeId,
            formattedAddress: payload.formattedAddress,
            lat: payload.lat,
            lng: payload.lng,
          })
        : await createCustomerAction(payload);

      setCustomersSaving(false);

      if (!result.ok) {
        setCustomersError(result.error);
        return;
      }

      const nextSender = customerRowToSender(result.data);
      setSenderList((current) =>
        editingCustomerId
          ? current.map((sender) => (sender.id === nextSender.id ? nextSender : sender))
          : [nextSender, ...current],
      );
      void reloadHistory();
      resetNewClientForm();
      setSelectedSender(null);
      setSelectedRecipient(null);
      setSelectedBoxLines([]);
      resetSaleLogistics();
      setActiveStep("client");
      setMode("sale");
      return;
    }

    const nextSender: Sender = {
      id: nextLocalId("local"),
      ...payload,
      referredByCustomerId: payload.referredByCustomerId,
      cardStyle:
        (editingCustomerId
          ? senderList.find((sender) => sender.id === editingCustomerId)?.cardStyle
          : undefined) || "amber-warm",
      recipients: editingCustomerId
        ? senderList.find((sender) => sender.id === editingCustomerId)?.recipients || []
        : [],
    };

    setSenderList((current) =>
      editingCustomerId
        ? current.map((sender) => (sender.id === editingCustomerId ? nextSender : sender))
        : [nextSender, ...current],
    );
    resetNewClientForm();
    setSelectedSender(null);
    setSelectedRecipient(null);
    setSelectedBoxLines([]);
    resetSaleLogistics();
    setActiveStep("client");
    setMode("sale");
  }

  async function createRecipient() {
    if (
      !selectedSender ||
      !newRecipientFirstName.trim() ||
      !newRecipientLastName.trim() ||
      !newRecipientPhone.trim() ||
      !newRecipientCountry
    ) {
      return;
    }

    if (duplicateRecipient && !editingRecipientId) {
      chooseRecipient(duplicateRecipient);
      setMode("sale");
      return;
    }

    if (recipientAddressValidation.status !== "valid") {
      setRecipientAddressValidation({
        status: "invalid",
        message: "Primero valida direccion en Google",
      });
      return;
    }

    const recipientPayload = {
      firstName: newRecipientFirstName.trim(),
      lastName: newRecipientLastName.trim(),
      phone: newRecipientPhone.trim(),
      country: newRecipientCountry,
      street: newRecipientStreet.trim(),
      houseNumber: newRecipientHouse.trim(),
      neighborhood: newRecipientNeighborhood.trim(),
      city: newRecipientCity.trim(),
      state: newRecipientState.trim(),
      postalCode: newRecipientPostalCode.trim(),
      placeId: recipientAddressValidation.placeId || "",
      formattedAddress: recipientAddressValidation.formattedAddress || "",
      lat: recipientAddressValidation.lat ?? null,
      lng: recipientAddressValidation.lng ?? null,
    };

    let nextRecipient: Recipient;

    if (
      isSupabaseConfigured() &&
      selectedSender.id &&
      !selectedSender.id.startsWith("local-")
    ) {
      setCustomersSaving(true);
      setCustomersError("");

      const result = editingRecipientId
        ? await updateRecipientAction({
            recipientId: editingRecipientId,
            ...recipientPayload,
          })
        : await createRecipientAction({
            customerId: selectedSender.id,
            ...recipientPayload,
          });

      setCustomersSaving(false);

      if (!result.ok) {
        setCustomersError(result.error);
        return;
      }

      nextRecipient = {
        id: result.data.id,
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        phone: result.data.phone,
        country: result.data.country,
        street: result.data.street,
        houseNumber: result.data.houseNumber,
        neighborhood: result.data.neighborhood,
        city: result.data.city,
        state: result.data.state,
        postalCode: result.data.postalCode,
        cardStyle: result.data.cardStyle,
        placeId: result.data.placeId,
        formattedAddress: result.data.formattedAddress,
        lat: result.data.lat,
        lng: result.data.lng,
      };
    } else {
      nextRecipient = {
        id: editingRecipientId || nextLocalId("local-r"),
        ...recipientPayload,
        cardStyle:
          (editingRecipientId
            ? selectedSender.recipients.find((recipient) => recipient.id === editingRecipientId)
                ?.cardStyle
            : undefined) || "amber-warm",
      };
    }

    const nextSender = {
      ...selectedSender,
      recipients: editingRecipientId
        ? selectedSender.recipients.map((recipient) =>
            recipient.id === editingRecipientId ? nextRecipient : recipient,
          )
        : [nextRecipient, ...selectedSender.recipients],
    };

    setSenderList((current) =>
      current.map((sender) => (sender.id === selectedSender.id ? nextSender : sender)),
    );
    setSelectedSender(nextSender);
    chooseRecipient(nextRecipient);
    void reloadHistory();
    resetNewRecipientForm();
    setMode("sale");
  }

  function nextLocalId(prefix: string) {
    localIdCounterRef.current += 1;
    return `${prefix}-${localIdPrefix}-${localIdCounterRef.current}`;
  }

  function chooseRecipient(recipient: Recipient) {
    setSelectedRecipient(recipient);
    setSelectedBoxLines([]);
    setSelectedPromotionId("");
    resetSaleLogistics();
    setActiveStep("box");
  }

  function chooseBox(box: string[]) {
    resetSaleLogistics();
    const lineId = saleCartLineId(box);
    setSelectedBoxLines((current) => {
      const existing = current.find((line) => line.id === lineId);

      if (existing) {
        return current.map((line) =>
          line.id === lineId ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      return [...current, { id: lineId, box, quantity: 1 }];
    });
    setSelectedPromotionId("");
  }

  function removeBoxFromCart(box: string[]) {
    const lineId = saleCartLineId(box);
    setSelectedBoxLines((current) => {
      const existing = current.find((line) => line.id === lineId);
      if (!existing) {
        return current;
      }

      if (existing.quantity <= 1) {
        return current.filter((line) => line.id !== lineId);
      }

      return current.map((line) =>
        line.id === lineId ? { ...line, quantity: line.quantity - 1 } : line,
      );
    });
    setSelectedPromotionId("");
  }

  function updateSelectedBoxCount(lineId: string, rawValue: string) {
    const nextCount = Math.max(Number.parseInt(rawValue, 10) || 1, 1);
    setSelectedBoxLines((current) =>
      current.map((line) => (line.id === lineId ? { ...line, quantity: nextCount } : line)),
    );
    setSelectedPromotionId("");
  }

  function adjustSelectedBoxCount(lineId: string, delta: number) {
    setSelectedBoxLines((current) =>
      current.map((line) =>
        line.id === lineId
          ? { ...line, quantity: Math.max(line.quantity + delta, 1) }
          : line,
      ),
    );
    setSelectedPromotionId("");
  }

  function removeSelectedBoxLine(lineId: string) {
    setSelectedBoxLines((current) => current.filter((line) => line.id !== lineId));
    setSelectedPromotionId("");
  }

  function selectedBoxTotalCost() {
    return saleCartTotalCost(selectedBoxLines);
  }

  function selectEmptyBoxMode(mode: string) {
    setEmptyBoxMode(mode);

    if (mode === EMPTY_BOX_OFFICE_MODE) {
      setEmptyBoxScheduleMode("");
      setEmptyBoxScheduleAt("");
      setEmptyBoxHandingNow(true);
      return;
    }

    setEmptyBoxHandingNow(false);

    setEmptyBoxScheduleMode("pending");
    setEmptyBoxScheduleAt("");
    setActiveStep("delivery");
  }

  function selectEmptyBoxScheduleMode(mode: "pending" | "scheduled") {
    setEmptyBoxScheduleMode(mode);

    if (mode === "pending") {
      setEmptyBoxScheduleAt("");
      return;
    }

    setActiveStep("delivery");
  }

  function selectFullBoxMode(mode: string) {
    setFullBoxMode(mode);

    if (mode === FULL_BOX_OFFICE_MODE) {
      setFullBoxScheduleMode("");
      setFullBoxScheduleAt("");
      return;
    }

    setFullBoxScheduleMode("pending");
    setFullBoxScheduleAt("");
    setActiveStep("delivery");
  }

  function selectFullBoxScheduleMode(mode: "pending" | "scheduled") {
    setFullBoxScheduleMode(mode);

    if (mode === "pending") {
      setFullBoxScheduleAt("");
      return;
    }

    setActiveStep("delivery");
  }

  function openContextMenu(
    event: MouseEvent,
    title: string,
    type: ContextMenuState["type"],
    targetKey: string,
    phones: string[] = [],
    address: ContextMenuState["address"] = {},
    firstName = "",
    lastName = "",
    customerId?: string,
    recipientId?: string,
  ) {
    event.preventDefault();
    openContextMenuAt(
      event.clientX,
      event.clientY,
      title,
      type,
      targetKey,
      phones,
      address,
      firstName,
      lastName,
      customerId,
      recipientId,
    );
  }

  function openSaleContextFromEvent(event: MouseEvent) {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-sale-context-key]")
      : null;

    if (!target) {
      return;
    }

    const type = target.dataset.saleContextType as ContextMenuState["type"] | undefined;
    const title = target.dataset.saleContextTitle;
    const targetKey = target.dataset.saleContextKey;

    if (!type || !title || !targetKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const clientX = event.clientX;
    const clientY = event.clientY;
    const phones = target.dataset.saleContextPhones
      ? target.dataset.saleContextPhones.split("|").filter(Boolean)
      : [];
    const address = {
      street: target.dataset.saleContextStreet,
      houseNumber: target.dataset.saleContextHouse,
      neighborhood: target.dataset.saleContextNeighborhood,
      city: target.dataset.saleContextCity,
      state: target.dataset.saleContextState,
      postalCode: target.dataset.saleContextPostalCode,
      country: target.dataset.saleContextCountry,
    };

    window.setTimeout(() => {
      openContextMenuAt(
        clientX,
        clientY,
        title,
        type,
        targetKey,
        phones,
        address,
        target.dataset.saleContextFirstName || "",
        target.dataset.saleContextLastName || "",
        target.dataset.saleContextCustomerId,
        target.dataset.saleContextRecipientId,
      );
    }, 50);
  }

  function contextCardClass(
    type: ContextMenuState["type"],
    targetKey: string,
    selected: boolean,
    defaultClass: string,
    groupHasSelection = false,
  ) {
    if (contextMenu?.type === type) {
      return contextMenu.targetKey === targetKey ? contextActiveClass : "opacity-35";
    }

    if (selected) {
      return selectedCardClass;
    }

    if (groupHasSelection) {
      return `${defaultClass} ${unselectedDimClass}`;
    }

    return defaultClass;
  }

  function buildLogisticsPlan() {
    const boxLines = selectedBoxLines.map((line) => ({
      label: line.box[0],
      paid: line.box[1] || "0",
      cost: line.box[2] || "0",
      carrier: line.box[3] || "",
      time: line.box[4] || "",
      catalogKey: saleBoxCatalogKey(line.box),
      quantity: line.quantity,
    }));

    return {
      box: selectedBox
        ? {
            label: selectedBox[0],
            paid: selectedBox[1] || "0",
            cost: selectedBox[2] || "0",
            carrier: selectedBox[3] || "",
            time: selectedBox[4] || "",
          }
        : null,
      boxLines,
      boxCount: selectedBoxCount,
      emptyBox: {
        label: "empty_box",
        mode: emptyBoxMode,
        handingNow: emptyBoxMode === EMPTY_BOX_OFFICE_MODE ? emptyBoxHandingNow : null,
        scheduleMode: emptyBoxScheduleMode || null,
        scheduleAt: emptyBoxScheduleAt || null,
        driverTaskNeeded: emptyBoxMode === EMPTY_BOX_DRIVER_MODE,
        driverTaskType: emptyBoxMode === EMPTY_BOX_DRIVER_MODE ? "deliver_empty_box" : null,
      },
      fullBox: {
        label: "full_box",
        mode: fullBoxMode,
        scheduleMode: fullBoxScheduleMode || null,
        scheduleAt: fullBoxScheduleAt || null,
        driverTaskNeeded: fullBoxMode === FULL_BOX_DRIVER_MODE,
        driverTaskType: fullBoxMode === FULL_BOX_DRIVER_MODE ? "pickup_full_box" : null,
      },
      driverTaskCount: currentDriverTaskCount,
      fees: invoiceBilling
        ? {
            emptyBoxDelivery: invoiceBilling.emptyBoxDelivery,
            fullBoxPickup: invoiceBilling.fullBoxPickup,
            total: invoiceBilling.logisticsSubtotal,
          }
        : {
            emptyBoxDelivery: "$0",
            fullBoxPickup: "$0",
            total: "$0",
          },
      billing: invoiceBilling,
      notes: logisticsNotes.trim(),
      summary: currentLogisticsSummary,
    };
  }

  function buildLogisticsTasks() {
    const tasks = [];

    if (emptyBoxMode === EMPTY_BOX_DRIVER_MODE) {
      tasks.push({
        taskType: "deliver_empty_box" as const,
        status: emptyBoxScheduleMode === "scheduled" ? ("scheduled" as const) : ("pending" as const),
        scheduledAt: scheduleAtToTimestamp(emptyBoxScheduleAt),
        notes: logisticsNotes.trim(),
      });
    }

    if (fullBoxMode === FULL_BOX_DRIVER_MODE) {
      tasks.push({
        taskType: "pickup_full_box" as const,
        status: fullBoxScheduleMode === "scheduled" ? ("scheduled" as const) : ("pending" as const),
        scheduledAt: scheduleAtToTimestamp(fullBoxScheduleAt),
        notes: logisticsNotes.trim(),
      });
    }

    return tasks;
  }

  async function createOpenInvoice() {
    if (
      !selectedSender ||
      !selectedRecipient ||
      !selectedBox ||
      !logisticsPlanReady ||
      !invoiceBilling ||
      invoiceBilling.promotionSelectionRequired ||
      creatingOpenInvoice
    ) {
      return;
    }

    setStockMessage("");

    if (!isSupabaseConfigured()) {
      setStockMessage("Configura Supabase en .env.local para crear invoices abiertos.");
      return;
    }

    setCreatingOpenInvoice(true);

    try {
      const invoiceResult = await allocateInvoiceNumberAction();

      if (!invoiceResult.ok) {
        setStockMessage(invoiceResult.error);
        return;
      }

      const invoice = invoiceResult.data.invoiceNumber;
      const match = invoice.match(/(\d+)$/);

      if (match) {
        setInvoiceSequence(Number(match[1]));
      }

      const shipmentResult = await createShipmentAction({
        invoiceNumber: invoice,
        customerId: selectedSender.id.startsWith("local-") ? undefined : selectedSender.id,
        recipientId: selectedRecipient.id.startsWith("local-r-") ? undefined : selectedRecipient.id,
        customerName: personFullName(selectedSender),
        country: selectedRecipient.country,
        carrier:
          selectedBoxLines.length > 1
            ? selectedCartSummary
            : selectedBox[3] || selectedCartSummary || "Sin carrier",
        paid: invoiceBilling.payNow,
        cost: selectedBoxTotalCost(),
        saleKind: "full",
        invoiceStatus: "open",
        accountingStatus: "not_exportable",
        deliveryNotes: currentLogisticsSummary,
        logisticsPlan: buildLogisticsPlan(),
        logisticsTasks: buildLogisticsTasks(),
        recipientSnapshot: {
          firstName: selectedRecipient.firstName,
          lastName: selectedRecipient.lastName,
          phone: selectedRecipient.phone,
          country: selectedRecipient.country,
          street: selectedRecipient.street,
          houseNumber: selectedRecipient.houseNumber,
          neighborhood: selectedRecipient.neighborhood,
          city: selectedRecipient.city,
          state: selectedRecipient.state,
          postalCode: selectedRecipient.postalCode,
          formattedAddress: selectedRecipient.formattedAddress,
          placeId: selectedRecipient.placeId,
          lat: selectedRecipient.lat,
          lng: selectedRecipient.lng,
        },
      });

      if (!shipmentResult.ok) {
        setStockMessage(shipmentResult.error);
        return;
      }

      recordRecentSale(selectedSender.id, selectedRecipient.id || undefined);
      void reloadHistory();
      void reloadSaleShortcuts();

      setCreatedInvoice({
        invoiceNumber: invoice,
        sender: selectedSender,
        recipient: selectedRecipient,
        box: selectedBox,
        deliveryLine: currentLogisticsSummary,
        billing: invoiceBilling,
      });
      setInvoiceConfirmOpen(false);
      notify.success(`Invoice ${invoice} creado.`);
    } finally {
      setCreatingOpenInvoice(false);
    }
  }

  async function proceedQuickEmptyBox(draft: QuickEmptyBoxDraft) {
    setQuickSaleDraft(draft);
    setQuickSelectedPromotionId("");
    setQuickSaleSender(null);
    setContextMenu(null);
    setActiveCopyGroup(null);
    setStockMessage("");

    if (isSupabaseConfigured()) {
      const result = await allocateInvoiceNumberAction();
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setQuickInvoiceNumber(result.data.invoiceNumber);
    } else {
      setQuickInvoiceNumber(nextInvoiceNumber);
    }

    setShowQuickCheckout(true);
  }

  async function confirmQuickEmptyBoxCharge(): Promise<boolean> {
    if (!quickSaleDraft || !quickInvoiceBilling || quickInvoiceBilling.promotionSelectionRequired) {
      return false;
    }

    setStockMessage("");
    const invoice = quickInvoiceNumber || nextInvoiceNumber;

    if (!isSupabaseConfigured()) {
      setStockMessage("Configura Supabase en .env.local para crear invoices abiertos.");
      return false;
    }

    setCreatingQuickInvoice(true);

    try {
    const shipmentResult = await createShipmentAction({
      invoiceNumber: invoice,
      customerId: quickSaleDraft.sender.id.startsWith("local-")
        ? undefined
        : quickSaleDraft.sender.id,
      customerName: personFullName(quickSaleDraft.sender),
      country: "USA",
      carrier: quickSaleDraft.box[3] || "Deposito caja vacia",
      paid: quickInvoiceBilling.payNow,
      cost: formatMoneyValue(
        parseMoneyValue(quickSaleDraft.box[2] || "$0") * quickSaleDraft.boxCount,
      ),
      saleKind: "empty_box_deposit",
      invoiceStatus: "open",
      accountingStatus: "not_exportable",
      deliveryNotes: quickSaleDraft.deliverySummary,
      logisticsPlan: {
        box: {
          label: quickSaleDraft.box[0],
          paid: quickSaleDraft.box[1] || "0",
          cost: quickSaleDraft.box[2] || "0",
          carrier: quickSaleDraft.box[3] || "",
          time: quickSaleDraft.box[4] || "",
        },
        boxCount: quickSaleDraft.boxCount,
        emptyBox: {
          label: "empty_box",
          mode: quickSaleDraft.emptyBoxMode,
          handingNow:
            quickSaleDraft.emptyBoxMode === EMPTY_BOX_OFFICE_MODE ? true : null,
          scheduleMode: quickSaleDraft.emptyBoxScheduleMode || null,
          scheduleAt: quickSaleDraft.emptyBoxScheduleAt || null,
          driverTaskNeeded: quickSaleDraft.emptyBoxMode === EMPTY_BOX_DRIVER_MODE,
          driverTaskType: quickSaleDraft.emptyBoxMode === EMPTY_BOX_DRIVER_MODE ? "deliver_empty_box" : null,
        },
        fullBox: null,
        driverTaskCount: quickSaleDraft.emptyBoxMode === EMPTY_BOX_DRIVER_MODE ? 1 : 0,
        fees: {
          emptyBoxDelivery: quickInvoiceBilling.emptyBoxDelivery,
          fullBoxPickup: quickInvoiceBilling.fullBoxPickup,
          total: quickInvoiceBilling.logisticsSubtotal,
        },
        billing: quickInvoiceBilling,
        notes: "",
        summary: quickSaleDraft.deliverySummary,
      },
      logisticsTasks:
        quickSaleDraft.emptyBoxMode === EMPTY_BOX_DRIVER_MODE
          ? [
              {
                taskType: "deliver_empty_box",
                status: quickSaleDraft.emptyBoxScheduleMode === "scheduled" ? "scheduled" : "pending",
                scheduledAt: scheduleAtToTimestamp(quickSaleDraft.emptyBoxScheduleAt),
              },
            ]
          : [],
    });

    if (!shipmentResult.ok) {
      setStockMessage(shipmentResult.error);
      return false;
    }

    if (quickSaleDraft.sender.id) {
      recordRecentSale(quickSaleDraft.sender.id);
    }

    void reloadHistory();
    void reloadSaleShortcuts();

    setQuickCheckoutCompleted(true);
    notify.success(`Invoice ${invoice} creado.`);
    return true;
    } finally {
      setCreatingQuickInvoice(false);
    }
  }

  const usaBoxes = useMemo(() => resolveCountryBoxes(countryBoxes, "USA"), [countryBoxes]);

  function resolveContextSender() {
    if (!contextMenu || contextMenu.type !== "remitente") {
      return null;
    }

    if (contextMenu.customerId) {
      return senderList.find((sender) => sender.id === contextMenu.customerId) || null;
    }

    const senderKey = contextMenu.targetKey.replace(/^sender:/, "");
    return senderList.find((item) => senderPhoneKey(item) === senderKey) || null;
  }

  function openCustomerHistoryFromMenu() {
    if (!contextMenu) {
      return;
    }

    if (contextMenu.type === "remitente") {
      const sender = resolveContextSender();
      if (!sender) {
        return;
      }

      setHistoryDrawer({ sender });
      setContextMenu(null);
      setActiveCopyGroup(null);
      return;
    }

    if (contextMenu.type === "destinatario" && contextMenu.recipientId) {
      setHistoryDrawer({
        sender: selectedSender,
        recipientId: contextMenu.recipientId,
        recipientName: contextMenu.title,
      });
      setContextMenu(null);
      setActiveCopyGroup(null);
    }
  }

  const routeDate = emptyBoxRouteDate;
  const routeTime = emptyBoxRouteTime;

  function updateRouteSchedule(nextDate = routeDate, nextTime = routeTime) {
    if (!nextDate && !nextTime) {
      setEmptyBoxScheduleAt("");
      return;
    }

    const resolvedDate = resolveScheduleDate(nextDate);
    const resolvedTime = nextTime || "10:00";

    setEmptyBoxScheduleAt(`${resolvedDate}T${resolvedTime}`);
  }

  function setQuickRouteDate(daysFromToday: number) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysFromToday);
    updateRouteSchedule(formatDateInput(nextDate), routeTime || "10:00");
  }

  function updateFullBoxSchedule(nextDate = fullBoxRouteDate, nextTime = fullBoxRouteTime) {
    if (!nextDate && !nextTime) {
      setFullBoxScheduleAt("");
      return;
    }

    const resolvedDate = resolveScheduleDate(nextDate);
    const resolvedTime = nextTime || "10:00";

    setFullBoxScheduleAt(`${resolvedDate}T${resolvedTime}`);
  }

  function setQuickFullBoxDate(daysFromToday: number) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysFromToday);
    updateFullBoxSchedule(formatDateInput(nextDate), fullBoxRouteTime || "10:00");
  }

  function openRouteDatePicker() {
    const input = routeDateInputRef.current;

    if (!input) {
      return;
    }

    try {
      input.showPicker?.();
    } catch {
      // Some browsers only allow showPicker directly from a click gesture.
    }
  }

  function openFullBoxDatePicker() {
    const input = fullBoxDateInputRef.current;

    if (!input) {
      return;
    }

    try {
      input.showPicker?.();
    } catch {
      // Some browsers only allow showPicker directly from a click gesture.
    }
  }

  useEffect(() => {
    queueMicrotask(() => setDeliveryStepConfirmed(false));
  }, [
    emptyBoxMode,
    emptyBoxScheduleMode,
    emptyBoxScheduleAt,
    fullBoxMode,
    fullBoxScheduleMode,
    fullBoxScheduleAt,
    emptyBoxHandingNow,
  ]);

  function fullAddress() {
    if (!contextMenu) {
      return "";
    }

    return [
      contextMenu.address.street,
      contextMenu.address.houseNumber,
      contextMenu.address.neighborhood,
      contextMenu.address.city,
      contextMenu.address.state,
      contextMenu.address.postalCode,
      contextMenu.address.country,
    ]
      .filter(Boolean)
      .join(", ");
  }

  function copyText(value?: string) {
    if (!value) {
      return;
    }

    void navigator.clipboard?.writeText(value);
    notify.success("Copiado");
    setContextMenu(null);
    setActiveCopyGroup(null);
  }

  function copyValue(value?: string) {
    copyText(value);
  }

  function senderAddressSummary(sender: Sender) {
    const summary = salePersonAddressSummary({
      street: sender.street,
      houseNumber: sender.houseNumber,
      neighborhood: sender.neighborhood,
      city: sender.city,
      state: sender.state,
      postalCode: sender.postalCode,
    });

    return summary ? `${summary}, USA` : "USA";
  }

  function recipientAddressSummary(recipient: Recipient) {
    const summary = salePersonAddressSummary({
      street: recipient.street,
      houseNumber: recipient.houseNumber,
      neighborhood: recipient.neighborhood,
      city: recipient.city,
      state: recipient.state,
      postalCode: recipient.postalCode,
    });

    return summary ? `${summary}, ${recipient.country}` : recipient.country;
  }

  function editSender(sender: Sender) {
    setEditingCustomerId(sender.id || null);
    setNewClientFirstName(sender.firstName);
    setNewClientLastName(sender.lastName);
    setNewClientPhones(sender.phones.length ? sender.phones : [""]);
    setNewClientEmail(sender.email || "");
    setNewClientStreet(sender.street || "");
    setNewClientHouse(sender.houseNumber || "");
    setNewClientNeighborhood(sender.neighborhood || "");
    setNewClientCity(sender.city || "");
    setNewClientState(sender.state || "");
    setNewClientPostalCode(sender.postalCode || "");
    setClientAddressSearch(senderAddressSummary(sender));
    setClientAddressSuggestions([]);
    setClientAddressValidation({
      status: "valid",
      message: "Direccion cargada",
      formattedAddress: sender.formattedAddress,
      placeId: sender.placeId,
      lat: sender.lat,
      lng: sender.lng,
    });
    setMode("new-client");
    setActiveStep("client");
    setContextMenu(null);
    setActiveCopyGroup(null);
  }

  function editRecipient(recipient: Recipient) {
    setEditingRecipientId(recipient.id || null);
    setNewRecipientFirstName(recipient.firstName);
    setNewRecipientLastName(recipient.lastName);
    setNewRecipientPhone(recipient.phone);
    setNewRecipientCountry(recipient.country);
    setNewRecipientStreet(recipient.street || "");
    setNewRecipientHouse(recipient.houseNumber || "");
    setNewRecipientNeighborhood(recipient.neighborhood || "");
    setNewRecipientCity(recipient.city || "");
    setNewRecipientState(recipient.state || "");
    setNewRecipientPostalCode(recipient.postalCode || "");
    setRecipientAddressSearch(recipientAddressSummary(recipient));
    setRecipientAddressSuggestions([]);
    setRecipientAddressValidation({
      status: "valid",
      message: "Direccion cargada",
      formattedAddress: recipient.formattedAddress,
      placeId: recipient.placeId,
      lat: recipient.lat,
      lng: recipient.lng,
    });
    setMode("new-recipient");
    setActiveStep("recipient");
    setContextMenu(null);
    setActiveCopyGroup(null);
  }

  function editContextTarget() {
    if (!contextMenu) {
      return;
    }

    if (contextMenu.type === "remitente") {
      const senderKey = contextMenu.targetKey.replace(/^sender:/, "");
      const sender = senderList.find((item) => senderPhoneKey(item) === senderKey);

      if (!sender) {
        return;
      }

      editSender(sender);
      return;
    }

    if (contextMenu.type === "destinatario" && selectedSender) {
      const recipientKey = contextMenu.targetKey.replace(/^recipient:/, "");
      const recipient = selectedSender.recipients.find(
        (item) => recipientIdentityKey(item) === recipientKey,
      );

      if (!recipient) {
        return;
      }

      editRecipient(recipient);
    }
  }

  const ventaNavTitle = useMemo(() => {
    if (mode === "new-client") {
      return editingCustomerId ? "Editar remitente" : "Nuevo remitente";
    }

    if (mode === "new-recipient") {
      return "Nuevo destinatario";
    }

    if (mode === "history") {
      return "Historial";
    }

    return null;
  }, [editingCustomerId, mode]);

  const handleVentaNavBack = useCallback(() => {
    if (mode === "new-client") {
      resetNewClientForm();
      setMode("sale");
      return;
    }

    if (mode === "new-recipient") {
      resetNewRecipientForm();
      setMode("sale");
      return;
    }

    if (mode === "history") {
      setMode("sale");
    }
  }, [mode]);

  useContextNav({
    title: ventaNavTitle ?? "Nueva venta",
    onBack: handleVentaNavBack,
    enabled: ventaNavTitle !== null,
  });

  const saleStepBarItems = useMemo((): SaleStepBarItem[] => {
    return saleSteps.map((step, index) => {
      const isActive = activeStep === step.id;
      const isDone = index < completedStepIndex;
      const isUnlocked = index <= maxUnlockedStepIndex;

      const value =
        step.id === "client"
          ? selectedSender
            ? personFullName(selectedSender)
            : "Seleccionar"
          : step.id === "recipient"
            ? selectedRecipient
              ? personFullName(selectedRecipient)
              : "Seleccionar"
            : step.id === "box"
              ? selectedBoxLines.length
                ? selectedCartSummary
                : "Seleccionar"
              : step.id === "delivery"
                ? deliveryComplete
                  ? currentDriverTaskCount
                    ? `${currentDriverTaskCount} tarea chofer`
                    : "Sin chofer"
                  : logisticsPlanReady
                    ? "Confirmar"
                    : "Pendiente"
                : deliveryComplete
                  ? saleFinishActionLabel(invoiceBilling)
                  : "Pendiente";

      const detail =
        step.id === "client"
          ? selectedSender
            ? senderPhonesLabel(selectedSender)
            : ""
          : step.id === "recipient"
            ? selectedRecipient
              ? selectedRecipient.phone.trim()
              : ""
            : step.id === "box"
              ? selectedBoxLines.length
                ? `${selectedBoxCount} producto${selectedBoxCount === 1 ? "" : "s"}`
                : ""
              : step.id === "delivery"
                ? deliveryComplete
                  ? currentLogisticsSummary
                  : "Logistica"
                : deliveryComplete
                  ? nextInvoiceNumber
                  : "";

      const country =
        step.id === "client" && selectedSender
          ? "USA"
          : step.id === "recipient" && selectedRecipient
            ? selectedRecipient.country
            : "";

      const subtitle =
        step.id === "box" && selectedBoxLines.length
          ? selectedBoxLines.length === 1
            ? selectedBox?.[4] || ""
            : "Carrito mixto"
          : "";

      return {
        id: step.id,
        label: step.label,
        value,
        subtitle: subtitle || undefined,
        detail: detail || undefined,
        country: country || undefined,
        isActive,
        isDone,
        isUnlocked,
        index,
      };
    });
  }, [
    activeStep,
    completedStepIndex,
    maxUnlockedStepIndex,
    selectedSender,
    selectedRecipient,
    selectedBox,
    selectedBoxLines,
    selectedBoxCount,
    selectedCartSummary,
    deliveryComplete,
    logisticsPlanReady,
    currentDriverTaskCount,
    currentLogisticsSummary,
    nextInvoiceNumber,
    invoiceBilling,
  ]);

  return (
    <>
      <div
        className="pb-6"
        onContextMenuCapture={openSaleContextFromEvent}
        onMouseUpCapture={(event) => {
          if (event.button === 2) {
            openSaleContextFromEvent(event);
          }
        }}
        onClick={() => {
          setContextMenu(null);
          setActiveCopyGroup(null);
        }}
      >
      <div className={`min-w-0 ${flowPageShellWideClass}`}>

      {mode === "clients" ||
      mode === "sale" ||
      mode === "new-client" ||
      mode === "new-recipient" ? (
        <>
        <SaleStepBar
          steps={saleStepBarItems}
          onOpenStep={openStep}
          stepPopovers={
            activeStep === "box" && selectedRecipient
              ? {
                  box: {
                    open: boxCartOpen,
                    trigger: (
                      <SaleStepCartTrigger
                        itemCount={selectedBoxCount}
                        total={invoiceBilling?.quotedTotal ?? null}
                        open={boxCartOpen}
                        onClick={() => setBoxCartOpen((open) => !open)}
                      />
                    ),
                    content: (
                      <SaleCartPanel
                        embedded
                        className="w-full shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                        lines={cartPanelLines}
                        billing={invoiceBilling}
                        selectedPromotionId={selectedPromotionId}
                        onPromotionChange={setSelectedPromotionId}
                        onAdjustQuantity={adjustSelectedBoxCount}
                        onUpdateQuantity={updateSelectedBoxCount}
                        onRemoveLine={removeSelectedBoxLine}
                        emptyHint="Clic izquierdo agrega · clic derecho quita."
                      />
                    ),
                  },
                }
              : undefined
          }
        />
        {mode === "new-client" || !selectedSender || activeStep === "client" ? (
        <div ref={clientRef} className={flowPersonListShellClass}>
              {!isSupabaseConfigured() ? (
                <div className="mb-3">
                  <SupabaseRequiredBanner detail="Los remitentes no se guardaran hasta configurar Supabase." />
                </div>
              ) : null}
              {customersError ? (
                <p className="mb-3 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
                  {customersError}
                </p>
              ) : null}
              {mode === "new-client" ? (
                <SaleClientForm
                  form={{
                    firstName: newClientFirstName,
                    lastName: newClientLastName,
                    phones: newClientPhones,
                    phoneList: newClientPhoneList,
                    email: newClientEmail,
                    street: newClientStreet,
                    house: newClientHouse,
                    neighborhood: newClientNeighborhood,
                    city: newClientCity,
                    state: newClientState,
                    postalCode: newClientPostalCode,
                    setFirstName: setNewClientFirstName,
                    setLastName: setNewClientLastName,
                    setEmail: setNewClientEmail,
                    setStreet: setNewClientStreet,
                    setHouse: setNewClientHouse,
                    setNeighborhood: setNewClientNeighborhood,
                    setCity: setNewClientCity,
                    setState: setNewClientState,
                    setPostalCode: setNewClientPostalCode,
                  }}
                  address={{
                    search: clientAddressSearch,
                    suggestions: clientAddressSuggestions,
                    validation: clientAddressValidation,
                    setSearch: setClientAddressSearch,
                    setSuggestions: setClientAddressSuggestions,
                    setValidation: setClientAddressValidation,
                    onSelectSuggestion: (suggestion) => selectAddressSuggestion("client", suggestion),
                    touchField: touchClientAddressField,
                  }}
                  actions={{
                    onCancel: () => {
                      resetNewClientForm();
                      setMode("sale");
                    },
                    onSubmit: createClient,
                    onAddPhone: addClientPhone,
                    onUpdatePhone: updateClientPhone,
                    onRemovePhone: removeClientPhone,
                  }}
                  meta={{
                    editingCustomerId,
                    duplicateClient: duplicateClient ?? null,
                  }}
                />
              ) : (
                <div
                  className={customersLoading ? "pointer-events-none opacity-60 transition-opacity" : undefined}
                  aria-busy={customersLoading}
                >
                <SaleSenderList
                  query={senderQuery}
                  matchingSenders={filteredSenders}
                  filteredCount={filteredSenders.length}
                  visibleSenders={visibleSenders}
                  recentSenders={recentSenders}
                  safePage={safeSenderPage}
                  pageCount={senderPageCount}
                  onQueryChange={(value) => {
                    setSenderQuery(value);
                    setSenderPage(0);
                  }}
                  onPageChange={setSenderPage}
                  onNewClient={() => {
                    resetNewClientForm();
                    setMode("new-client");
                    setActiveStep("client");
                  }}
                  onChoose={chooseSender}
                  onQuickEmptyBox={(sender) => setQuickSaleSender(sender)}
                  onIconClick={(event, sender) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setCardStylePicker({
                      kind: "sender",
                      cardStyle: sender.cardStyle,
                      sender,
                      x: rect.left,
                      y: rect.bottom + 8,
                    });
                  }}
                  getReferralCount={(sender) =>
                    senderList.filter((item) => item.referredByCustomerId === sender.id).length
                  }
                  getCardClass={(sender) =>
                    contextCardClass(
                      "remitente",
                      `sender:${senderPhoneKey(sender)}`,
                      false,
                      senderCardClass,
                      false,
                    )
                  }
                  onOpenContextMenu={(event, sender) =>
                    openContextMenu(
                      event,
                      personFullName(sender),
                      "remitente",
                      `sender:${senderPhoneKey(sender)}`,
                      sender.phones,
                      {
                        street: sender.street,
                        houseNumber: sender.houseNumber,
                        neighborhood: sender.neighborhood,
                        city: sender.city,
                        state: sender.state,
                        postalCode: sender.postalCode,
                        country: "USA",
                      },
                      sender.firstName,
                      sender.lastName,
                      sender.id.startsWith("local-") ? undefined : sender.id,
                    )
                  }
                />
                </div>
              )}
        </div>
        ) : null}
        </>
      ) : null}

      {mode === "history" ? (
        <>
          <FlowPageHeader
            title="Historial"
            description="Ventas, remitentes y destinatarios registrados."
          />
          <Panel
            hideHeader
            className={flowPanelFlushClass}
            title="Historial"
            contentClassName={flowPanelContentClass}
          >
            <div className={flowStepBodyClass}>
              {!isSupabaseConfigured() ? (
                <SupabaseRequiredBanner detail="El historial se guarda en Supabase." />
              ) : null}
              {historyError ? (
                <p className="rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
                  {historyError}
                </p>
              ) : null}
              {!historyLoading && !historyRows.length ? (
                <div className="rounded-xl border border-black bg-surface-card p-4 text-xl font-black">
                  Sin movimientos
                </div>
              ) : null}
              <div className="grid gap-3">
                {historyRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-black bg-surface-card p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-lg font-black text-[#f8fafc]">{row.title}</p>
                        {row.description ? (
                          <p className="mt-1 text-sm font-bold text-slate-400">{row.description}</p>
                        ) : null}
                      </div>
                      <span className="rounded-lg border border-black bg-surface-inset px-3 py-1 text-xs font-black text-slate-300">
                        {historyDateLabel(row.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase text-slate-500">
                      {row.actorName} - {row.entityType}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </>
      ) : null}

      {selectedSender &&
      (mode === "clients" || mode === "sale" || mode === "new-recipient") &&
      (activeStep !== "client" || mode === "new-recipient") ? (
        <div
          ref={recipientsRef}
          className={
            activeStep === "recipient" || mode === "new-recipient"
              ? flowPersonListShellClass
              : `${flowPersonListShellClass} border-t border-black/80`
          }
        >
          {activeStep === "recipient" || mode === "new-recipient" ? (
          <div className={flowPersonListSectionClass}>
            {mode !== "new-recipient" ? (
            <div className={flowPersonToolbarClass}>
            <InlineSearchCombobox
                value={recipientQuery}
                onChange={(value) => {
                  setRecipientQuery(value);
                  setRecipientPage(0);
                }}
                options={recipientSearchOptions}
                placeholder="Buscar destinatario, telefono o pais"
                emptyLabel="Sin destinatarios"
                ariaLabel="Buscar destinatarios"
                leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                className="min-w-0 w-full"
                minWidthClass="w-full min-w-0"
                onSelectOption={(option) => {
                  if (!selectedSender) {
                    return;
                  }

                  const recipient = selectedSender.recipients.find(
                    (entry) => recipientIdentityKey(entry) === option.value,
                  );

                  if (recipient) {
                    setRecipientQuery(personFullName(recipient));
                    setRecipientPage(0);
                    chooseRecipient(recipient);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  resetNewRecipientForm();
                  setMode("new-recipient");
                  setActiveStep("recipient");
                }}
                className={`${flowToolbarCreateButtonClass} justify-self-end`}
              >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Nuevo destinatario</span>
                  <span className="sm:hidden">Nuevo</span>
              </button>
            </div>
            ) : null}

            {mode === "new-recipient" ? (
              <SaleRecipientForm
                form={{
                  firstName: newRecipientFirstName,
                  lastName: newRecipientLastName,
                  phone: newRecipientPhone,
                  country: newRecipientCountry,
                  street: newRecipientStreet,
                  house: newRecipientHouse,
                  neighborhood: newRecipientNeighborhood,
                  city: newRecipientCity,
                  state: newRecipientState,
                  postalCode: newRecipientPostalCode,
                  setFirstName: setNewRecipientFirstName,
                  setLastName: setNewRecipientLastName,
                  setPhone: setNewRecipientPhone,
                  setCountry: setNewRecipientCountry,
                  setStreet: setNewRecipientStreet,
                  setHouse: setNewRecipientHouse,
                  setNeighborhood: setNewRecipientNeighborhood,
                  setCity: setNewRecipientCity,
                  setState: setNewRecipientState,
                  setPostalCode: setNewRecipientPostalCode,
                }}
                address={{
                  search: recipientAddressSearch,
                  suggestions: recipientAddressSuggestions,
                  validation: recipientAddressValidation,
                  setSearch: setRecipientAddressSearch,
                  setSuggestions: setRecipientAddressSuggestions,
                  setValidation: setRecipientAddressValidation,
                  onSelectSuggestion: (suggestion) => selectAddressSuggestion("recipient", suggestion),
                  touchField: touchRecipientAddressField,
                }}
                actions={{
                  onCancel: () => {
                    resetNewRecipientForm();
                    setMode("sale");
                  },
                  onSubmit: createRecipient,
                }}
                meta={{
                  countries,
                  duplicateRecipient: duplicateRecipient ?? null,
                }}
              />
            ) : (
              <>
                <SaleRecipientList
                  filteredCount={sortedFilteredRecipients.length}
                  visibleRecipients={visibleRecipients}
                  suggestedRecipientId={suggestedRecipientId}
                  emptySlots={emptyRecipientSlots}
                  safePage={safeRecipientPage}
                  onChoose={chooseRecipient}
                  onIconClick={(event, recipient) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    setCardStylePicker({
                      kind: "recipient",
                      cardStyle: recipient.cardStyle,
                      recipient,
                      x: rect.left,
                      y: rect.bottom + 8,
                    });
                  }}
                  onNewRecipient={() => {
                    resetNewRecipientForm();
                    setMode("new-recipient");
                    setActiveStep("recipient");
                  }}
                  getCardClass={(recipient) =>
                    contextCardClass(
                      "destinatario",
                      `recipient:${recipientIdentityKey(recipient)}`,
                      Boolean(
                        selectedRecipient &&
                          recipientIdentityKey(selectedRecipient) === recipientIdentityKey(recipient),
                      ),
                      recipientCardClass,
                      selectedRecipient !== null,
                    )
                  }
                  onOpenContextMenu={(event, recipient) =>
                    openContextMenu(
                      event,
                      personFullName(recipient),
                      "destinatario",
                      `recipient:${recipientIdentityKey(recipient)}`,
                      [recipient.phone],
                      {
                        street: recipient.street,
                        houseNumber: recipient.houseNumber,
                        neighborhood: recipient.neighborhood,
                        city: recipient.city,
                        state: recipient.state,
                        postalCode: recipient.postalCode,
                        country: recipient.country,
                      },
                      recipient.firstName,
                      recipient.lastName,
                      undefined,
                      recipient.id.startsWith("local-r-") ? undefined : recipient.id,
                    )
                  }
                />
                <div className={flowPagerClass}>
                  <SalePersonPager
                    page={safeRecipientPage}
                    pageCount={recipientPageCount}
                    onPrev={() => setRecipientPage((current) => Math.max(0, current - 1))}
                    onNext={() =>
                      setRecipientPage((current) =>
                        Math.min(recipientPageCount - 1, current + 1),
                      )
                    }
                    prevLabel="Destinatarios anteriores"
                    nextLabel="Destinatarios siguientes"
                  />
                </div>
              </>
            )}
            </div>
          ) : null}

          {selectedRecipient && activeStep === "box" ? (
            <div
              ref={boxesRef}
              className={stepShellClass("box")}
            >
            <Panel
              className={flowPanelFlushClass}
              contentClassName={flowPanelContentClass}
              hideHeader
              title="Cajas"
            >
              <div className={flowStepBodyClass}>
              {!selectedRecipient ? (
                <p className="text-center text-xl font-black text-slate-400">
                  Selecciona un destinatario.
                </p>
              ) : boxesForCountry.length === 0 ? (
                <section className="rounded-xl border border-dashed border-slate-600/60 p-5">
                  <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400">
                      <Box className="h-7 w-7" />
                    </span>
                    <h3 className="mt-4 text-xl font-black text-[#f8fafc]">
                      Aún no hay productos para{" "}
                      <CountryName
                        name={selectedRecipient.country}
                        size="sm"
                        labelClassName="font-black"
                      />
                      .
                    </h3>
                    <p className="mt-2 text-sm font-bold text-slate-400">
                      Asigna productos del catálogo a este destino en Configuración.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      <Link
                        href={configPricesCountryHref(selectedRecipient.country)}
                        className={primaryButtonClass}
                      >
                        <Plus className="h-4 w-4" />
                        Configurar productos
                      </Link>
                      <Link href="/inventario" className={secondaryButtonClass}>
                        Ir a Inventario
                      </Link>
                    </div>
                  </div>
                </section>
              ) : (
                <div className={flowCardGridClass}>
                  {boxesForCountry.map((box) => {
                    const cartLine = selectedBoxLines.find(
                      (line) => line.id === saleCartLineId(box),
                    );
                    const promoCount = selectedRecipient
                      ? resolveCountryPromotions(
                          countryPromotions,
                          selectedRecipient.country,
                          box,
                        ).length
                      : 0;

                    return (
                    <button
                      key={box[0]}
                      type="button"
                      onClick={() => chooseBox(box)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeBoxFromCart(box);
                      }}
                      onMouseUp={(event) => {
                        if (event.button === 2) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      title={`${box[0]}: clic izquierdo agrega, clic derecho quita`}
                      className={`group flex min-h-[12rem] w-full flex-col items-center justify-between rounded-xl border border-black bg-[#3f4b46] p-4 text-center shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-[#46544e] ${
                        contextCardClass(
                          "caja",
                          `box:${box[0]}`,
                          Boolean(cartLine),
                          boxCardClass,
                          selectedBoxLines.length > 0,
                        )
                      }`}
                    >
                      <div className="flex min-w-0 flex-col items-center">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 shadow-[0_8px_14px_rgba(16,185,129,0.2)]">
                          <Package className="h-5 w-5" />
                        </div>
                        <p className="text-lg font-black leading-tight text-[#f8fafc]">{box[0]}</p>
                      </div>

                      <div className="my-2 w-full border-y border-white/10 py-2 text-xs font-black text-slate-300">
                        <span className="block truncate rounded-md bg-[#202926] px-2 py-1.5">
                          {box[4] || "Tiempo —"}
                        </span>
                      </div>

                      <div className="w-full rounded-lg border border-black/70 bg-[#202926] px-3 py-2">
                        <p className="text-[10px] font-black uppercase text-slate-400">Cobra</p>
                        <p className="text-lg font-black">{box[1]}</p>
                        {promoCount > 0 ? (
                          <p className="mt-1 text-[10px] font-black uppercase text-emerald-300">
                            {promoCount} promo
                          </p>
                        ) : null}
                        {cartLine ? (
                          <div className="mt-1 flex justify-center">
                            <SaleBoxCartQtyBadge quantity={cartLine.quantity} />
                          </div>
                        ) : null}
                      </div>
                    </button>
                    );
                  })}
                </div>
              )}
              {selectedRecipient && boxesForCountry.length > 0 ? (
                <div className="flex justify-center border-t border-black/80 pt-4">
                  <div className="flex w-full max-w-md flex-col items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedBoxCount < 1}
                      onClick={continueFromCart}
                      className={`${primaryButtonClass} flex h-12 w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-35`}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                    {selectedBoxCount < 1 ? (
                      <p className="text-center text-xs font-bold text-slate-500">
                        Clic izquierdo en una caja para agregar · clic derecho para quitar.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              </div>
            </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedSender && selectedRecipient && selectedBox ? (
        <div
          className="mt-3 grid gap-3"
        >
          {activeStep === "delivery" ? (
          <div
            ref={deliveryRef}
            className={`min-w-0 flex-1 ${stepShellClass("delivery")}`}
          >
          <Panel
            className={flowPanelFlushClass}
            contentClassName={flowPanelContentClass}
            hideHeader
            title="Opciones del envio"
          >
            <div className={flowStepBodyClass}>
              <SaleLogisticsStep
                emptyBoxHandingNow={emptyBoxHandingNow}
                onEmptyBoxHandingNowChange={setEmptyBoxHandingNow}
                emptyBoxMode={emptyBoxMode}
                emptyBoxScheduleMode={emptyBoxScheduleMode}
                emptyBoxScheduleAt={emptyBoxScheduleAt}
                fullBoxMode={fullBoxMode}
                fullBoxScheduleMode={fullBoxScheduleMode}
                fullBoxScheduleAt={fullBoxScheduleAt}
                emptyBoxRouteDate={routeDate}
                emptyBoxRouteTime={routeTime}
                fullBoxRouteDate={fullBoxRouteDate}
                fullBoxRouteTime={fullBoxRouteTime}
                emptyDateInputRef={routeDateInputRef}
                fullDateInputRef={fullBoxDateInputRef}
                onSelectEmptyBoxMode={selectEmptyBoxMode}
                onSelectEmptyBoxScheduleMode={selectEmptyBoxScheduleMode}
                onUpdateEmptyBoxSchedule={updateRouteSchedule}
                onQuickEmptyBoxDate={setQuickRouteDate}
                onOpenEmptyBoxDatePicker={openRouteDatePicker}
                onSelectFullBoxMode={selectFullBoxMode}
                onSelectFullBoxScheduleMode={selectFullBoxScheduleMode}
                onUpdateFullBoxSchedule={updateFullBoxSchedule}
                onQuickFullBoxDate={setQuickFullBoxDate}
                onOpenFullBoxDatePicker={openFullBoxDatePicker}
                canContinue={logisticsPlanReady}
                onContinue={confirmDeliveryStep}
              />
            </div>
          </Panel>
          </div>
          ) : null}

          {activeStep === "finish" ? (
          <div
            ref={finishRef}
            className={`min-w-0 ${createdInvoice || logisticsPlanReady ? stepShellClass("finish") : "rounded-xl"}`}
          >
          <Panel
            className={flowPanelFlushClass}
            contentClassName={flowPanelContentClass}
            hideHeader
            title="Finalizar"
          >
            <div className={flowStepBodyClass}>
            {createdInvoice ? (
              <div className="flex w-full flex-col items-center gap-3">
                <div className="no-print w-full max-w-[210mm] rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-center">
                  <p className="text-sm font-black text-emerald-300">
                    Invoice {createdInvoice.invoiceNumber} creado
                  </p>
                </div>
                <SaleInvoicePaper
                  invoiceNumber={createdInvoice.invoiceNumber}
                  sender={createdInvoice.sender}
                  recipient={createdInvoice.recipient}
                  box={createdInvoice.box}
                  deliveryLine={createdInvoice.deliveryLine}
                  billing={createdInvoice.billing}
                />
                <div className="no-print grid w-full max-w-[210mm] gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className={`${secondaryButtonClass} flex h-11 items-center justify-center gap-2 text-sm font-black`}
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir
                  </button>
                  <Link
                    href="/envios"
                    className={`${secondaryButtonClass} flex h-11 items-center justify-center text-sm font-black`}
                  >
                    Ver en Envíos
                  </Link>
                  <button
                    type="button"
                    onClick={startNewSale}
                    className={`${primaryButtonClass} h-11 text-sm font-black`}
                  >
                    Nueva venta
                  </button>
                </div>
              </div>
            ) : logisticsPlanReady ? (
              <div className="flex w-full flex-col items-center gap-3">
            <SaleInvoicePaper
              invoiceNumber={nextInvoiceNumber}
              sender={selectedSender}
              recipient={selectedRecipient}
              box={selectedBox}
              deliveryLine={currentLogisticsSummary}
              billing={invoiceBilling}
              payNowDraft={payNowDraft}
              payNowDraftTouched={payNowDraftTouched}
              onPayNowDraftChange={(value) => {
                setPayNowDraftTouched(true);
                setPayNowDraft(value.replace(/[^\d]/g, ""));
              }}
            />
            {invoiceBilling && invoiceBilling.promotionCandidates.length > 1 ? (
              <div className="no-print w-full max-w-[210mm]">
                <PromotionSelector
                  candidates={invoiceBilling.promotionCandidates}
                  selectedPromotionId={selectedPromotionId}
                  onChange={setSelectedPromotionId}
                />
              </div>
            ) : null}
            <div className="no-print w-full max-w-[210mm]">
            <button
              type="button"
              onClick={() => setInvoiceConfirmOpen(true)}
              disabled={creatingOpenInvoice || !invoiceBilling || invoiceBilling.promotionSelectionRequired}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-black text-slate-950 disabled:opacity-40"
            >
              {creatingOpenInvoice
                ? saleFinishActionLabel(invoiceBilling, { creating: true })
                : invoiceBilling?.promotionSelectionRequired
                  ? "Elige promocion"
                  : saleFinishActionLabel(invoiceBilling)}
            </button>
            </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black bg-surface-card p-5 text-center">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">
                    Pendiente
                  </p>
                  <p className="mt-2 text-xl font-black">
                    Completa opciones del envio
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-300">
                    La factura aparece aqui cuando termines este paso.
                  </p>
                </div>
              </div>
            )}
            </div>
          </Panel>
          </div>
          ) : null}
        </div>
      ) : null}
      </div>
      </div>

      {contextMenu ? (
        <SaleContextMenu
          menu={contextMenu}
          activeCopyGroup={activeCopyGroup}
          copyGroups={copyGroups}
          editGroups={editGroups}
          onActiveCopyGroupChange={setActiveCopyGroup}
          onEdit={editContextTarget}
          onCopyValue={(value) => {
            if (value !== undefined) {
              copyValue(value);
              return;
            }

            copyValue(
              [contextMenu.title, ...contextMenu.phones, fullAddress()].filter(Boolean).join("\n"),
            );
          }}
          onAddReferral={
            contextMenu.type === "remitente"
              ? () => {
                  const sender = resolveContextSender();
                  if (!sender) {
                    return;
                  }

                  addReferralClient(sender);
                  setContextMenu(null);
                  setActiveCopyGroup(null);
                }
              : undefined
          }
          onViewHistory={openCustomerHistoryFromMenu}
          onQuickEmptyBox={
            contextMenu.type === "remitente"
              ? () => {
                  const sender = resolveContextSender();
                  if (!sender) {
                    return;
                  }

                  setQuickSaleSender(sender);
                  setContextMenu(null);
                  setActiveCopyGroup(null);
                }
              : undefined
          }
        />
      ) : null}

      {historyDrawer ? (
        <SaleCustomerHistoryDrawer
          open
          sender={historyDrawer.sender}
          recipientId={historyDrawer.recipientId}
          recipientName={historyDrawer.recipientName}
          onClose={() => setHistoryDrawer(null)}
        />
      ) : null}

      {quickSaleSender ? (
        <SaleQuickEmptyBoxModal
          sender={quickSaleSender}
          boxes={usaBoxes}
          promotions={resolveCountryPromotions(countryPromotions, "USA")}
          onClose={() => setQuickSaleSender(null)}
          onProceed={(draft) => void proceedQuickEmptyBox(draft)}
        />
      ) : null}

      {showQuickCheckout && quickSaleDraft ? (
        <SaleQuickCheckoutModal
          invoiceNumber={quickInvoiceNumber}
          draft={quickSaleDraft}
          billing={quickInvoiceBilling}
          selectedPromotionId={quickSelectedPromotionId}
          onPromotionChange={setQuickSelectedPromotionId}
          payNowDraft={quickPayNowDraft}
          payNowDraftTouched={quickPayNowDraftTouched}
          onPayNowDraftChange={(value) => {
            setQuickPayNowDraftTouched(true);
            setQuickPayNowDraft(value.replace(/[^\d]/g, ""));
          }}
          completed={quickCheckoutCompleted}
          stockMessage={stockMessage}
          onClose={closeQuickCheckout}
          onPrint={() => window.print()}
          onConfirmCharge={() => confirmQuickEmptyBoxCharge()}
          onStartNewSale={() => void finishQuickCheckoutNewSale()}
          confirming={creatingQuickInvoice}
        />
      ) : null}

      <SaleInvoiceConfirmDialog
        open={invoiceConfirmOpen}
        title="¿Crear este invoice?"
        invoiceLabel={`Factura ${nextInvoiceNumber}`}
        lines={
          invoiceBilling && selectedSender && selectedRecipient
            ? [
                { label: "Remitente", value: personFullName(selectedSender) },
                { label: "Destinatario", value: personFullName(selectedRecipient) },
                { label: "Total", value: invoiceBilling.quotedTotal },
                { label: "Depósito", value: invoiceBilling.payNow },
                { label: "Pendiente", value: invoiceBilling.balanceDue },
              ]
            : []
        }
        confirmLabel={saleFinishActionLabel(invoiceBilling)}
        confirming={creatingOpenInvoice}
        onCancel={() => {
          if (!creatingOpenInvoice) {
            setInvoiceConfirmOpen(false);
          }
        }}
        onConfirm={() => void createOpenInvoice()}
      />

      {cardStylePicker ? (
        <SalePersonStylePicker
          x={cardStylePicker.x}
          y={cardStylePicker.y}
          currentStyle={
            (cardStylePicker.cardStyle as SalePersonCardVariantId) || "amber-warm"
          }
          onSelect={(styleId) => {
            if (cardStylePicker.kind === "sender" && cardStylePicker.sender) {
              void saveSenderCardStyle(cardStylePicker.sender, styleId);
              return;
            }

            if (cardStylePicker.kind === "recipient" && cardStylePicker.recipient) {
              void saveRecipientCardStyle(cardStylePicker.recipient, styleId);
            }
          }}
          onClose={() => setCardStylePicker(null)}
        />
      ) : null}
    </>
  );
}
