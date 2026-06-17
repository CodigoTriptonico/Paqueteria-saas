"use client";

import {
  CalendarDays,
  ChevronRight,
  Check,
  Clock,
  Copy,
  Edit3,
  Box,
  Package,
  Plus,
  Search,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { type MouseEvent, type RefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createCustomerAction,
  createRecipientAction,
  listCustomersWithRecipientsAction,
  updateCustomerAction,
  updateRecipientAction,
} from "@/app/actions/customers";
import { listActivityHistoryAction, type ActivityHistoryRow } from "@/app/actions/history";
import { deductStockForBoxSaleAction } from "@/app/actions/inventory";
import { allocateInvoiceNumberAction, loadSaleCountryBoxesAction } from "@/app/actions/pricing";
import { createShipmentAction } from "@/app/actions/shipments";
import { useContextNav } from "@/hooks/use-context-nav";
import { useSetShellConfig } from "@/components/app-frame";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import { iconWellEmerald, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { customerRowToSender } from "@/lib/customers/mappers";
import {
  flowCardGridClass,
  flowPageShellWideClass,
  flowPanelContentClass,
  flowPanelFlushClass,
  flowStepBodyClass,
  flowPersonStepBodyClass,
  flowPersonToolbarClass,
  flowPersonListShellClass,
  flowPersonListSectionClass,
  flowPagerClass,
  flowToolbarCreateButtonClass,
} from "@/components/flow-form-styles";
import { FlowPageHeader } from "@/components/flow-page-header";
import { InlineSearchCombobox } from "@/components/inline-search-picker";
import { SaleCheckoutModal } from "@/components/sale/sale-checkout-modal";
import { SaleClientForm } from "@/components/sale/sale-client-form";
import { SaleRecipientForm } from "@/components/sale/sale-recipient-form";
import { SalePersonPager } from "@/components/sale/sale-person-card";
import { SaleRecipientList } from "@/components/sale/sale-recipient-list";
import { SaleSenderList } from "@/components/sale/sale-sender-list";
import { configPricesCountryHref } from "@/lib/country-options";
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
  boxProfitDisplay,
  ContextMenuState,
  contextActiveClass,
  CountryBadge,
  deliveryModeCardClass,
  deliveryModeIconClass,
  deliverySegmentClass,
  formatDateInput,
  historyDateLabel,
  inputClass,
  normalizePhoneList,
  personFullName,
  RECIPIENTS_PER_PAGE,
  recipientCardClass,
  recipientIdentityKey,
  type Recipient,
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
  unselectedDimClass,
  applyAddressSuggestResult,
} from "@/components/sale/venta-parts";

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

export default function VentaPage() {
  const localIdPrefix = useId();
  const localIdCounterRef = useRef(0);
  const setShellConfig = useSetShellConfig();
  const [mode, setMode] = useState<"sale" | "clients" | "history" | "new-client" | "new-recipient">("sale");
  const [activeStep, setActiveStep] = useState<SaleStep>("client");
  const [senderList, setSenderList] = useState<Sender[]>([]);
  const [, setCustomersLoading] = useState(isSupabaseConfigured());
  const [customersError, setCustomersError] = useState("");
  const [, setCustomersSaving] = useState(false);
  const [historyRows, setHistoryRows] = useState<ActivityHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(isSupabaseConfigured());
  const [historyError, setHistoryError] = useState("");
  const [countryBoxes, setCountryBoxes] = useState<Record<string, string[][]>>({});
  const [selectedSender, setSelectedSender] = useState<Sender | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [selectedBox, setSelectedBox] = useState<string[] | null>(null);
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
  const [activeCopyGroup, setActiveCopyGroup] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceSequence, setInvoiceSequence] = useState(1);
  const [invoiceNumber, setInvoiceNumber] = useState("INV-000001");
  const countries = useMemo(() => Object.keys(countryBoxes), [countryBoxes]);
  const [stockMessage, setStockMessage] = useState("");
  const [emptyBoxMode, setEmptyBoxMode] = useState("");
  const [emptyBoxScheduleMode, setEmptyBoxScheduleMode] = useState("");
  const [emptyBoxScheduleAt, setEmptyBoxScheduleAt] = useState("");
  const clientRef = useRef<HTMLDivElement | null>(null);
  const recipientsRef = useRef<HTMLDivElement | null>(null);
  const boxesRef = useRef<HTMLDivElement | null>(null);
  const deliveryRef = useRef<HTMLDivElement | null>(null);
  const finishRef = useRef<HTMLDivElement | null>(null);
  const routeDateInputRef = useRef<HTMLInputElement | null>(null);
  const routeTimeInputRef = useRef<HTMLInputElement | null>(null);
  const routeScheduleRef = useRef<HTMLDivElement | null>(null);
  const nextInvoiceNumber = `INV-${String(invoiceSequence).padStart(6, "0")}`;
  const emptyBoxRouteDate = emptyBoxScheduleAt.split("T")[0] || "";
  const emptyBoxRouteTime = emptyBoxScheduleAt.split("T")[1] || "";
  const deliveryComplete =
    emptyBoxMode === "Cliente recoge caja vacia en oficina" ||
    (emptyBoxMode === "Programar entrega de caja vacia" &&
      (emptyBoxScheduleMode === "pending" ||
        (emptyBoxScheduleMode === "scheduled" && Boolean(emptyBoxRouteDate && emptyBoxRouteTime))));
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
    ) => {
      setActiveCopyGroup(null);
      const menuWidth = 288;
      const menuHeight = 260;
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

  const filteredSenders = useMemo(() => {
    const query = senderQuery.trim().toLowerCase();

    if (!query) {
      return senderList;
    }

    return senderList.filter((sender) =>
      [
        personFullName(sender),
        sender.firstName,
        sender.lastName,
        ...sender.phones,
        sender.email,
        sender.street,
        sender.houseNumber,
        sender.neighborhood,
        sender.city,
        sender.state,
        sender.postalCode,
        ...sender.recipients.flatMap((recipient) => [
          recipient.firstName,
          recipient.lastName,
          personFullName(recipient),
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [senderList, senderQuery]);

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
  const recipientPageCount = Math.max(
    1,
    Math.ceil(filteredRecipients.length / RECIPIENTS_PER_PAGE),
  );
  const safeRecipientPage = Math.min(recipientPage, recipientPageCount - 1);
  const visibleRecipients = filteredRecipients.slice(
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

  function scrollToRevealBottom(
    ...refs: RefObject<HTMLDivElement | null>[]
  ) {
    const bottomOffset = 32;

    afterLayoutPaint(() => {
      let maxOverflow = 0;

      for (const ref of refs) {
        const element = ref.current;
        if (!element) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const overflow = rect.bottom - (window.innerHeight - bottomOffset);

        if (overflow > maxOverflow) {
          maxOverflow = overflow;
        }
      }

      if (maxOverflow > 0) {
        smoothScrollToY(window.scrollY + maxOverflow);
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

  function chooseSender(sender: Sender) {
    const isSameSender =
      selectedSender !== null && senderPhoneKey(selectedSender) === senderPhoneKey(sender);

    if (isSameSender) {
      setSelectedSender(null);
      setSelectedRecipient(null);
      setSelectedBox(null);
      setEmptyBoxMode("");
      setEmptyBoxScheduleMode("");
      setEmptyBoxScheduleAt("");
      setRecipientPage(0);
      setActiveStep("client");
      return;
    }

    setSelectedSender(sender);
    setSelectedRecipient(null);
    setSelectedBox(null);
    setEmptyBoxMode("");
    setEmptyBoxScheduleMode("");
    setEmptyBoxScheduleAt("");
    setRecipientPage(0);
    setActiveStep("recipient");
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

  const reloadCustomers = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setCustomersLoading(false);
      return;
    }

    setCustomersLoading(true);
    setCustomersError("");

    const result = await listCustomersWithRecipientsAction();

    setCustomersLoading(false);
    if (!result.ok) {
      setCustomersError(result.error);
      return;
    }

    setSenderList(result.data.map(customerRowToSender));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void reloadCustomers();
    });
  }, [reloadCustomers]);

  useEffect(() => {
    queueMicrotask(() => {
      void reloadHistory();
    });
  }, [reloadHistory]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    queueMicrotask(() => {
      void (async () => {
        const boxesResult = await loadSaleCountryBoxesAction();

        if (boxesResult.ok) {
          setCountryBoxes(boxesResult.data);
        }
      })();
    });
  }, []);

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
      setSelectedBox(null);
      setActiveStep("client");
      setMode("sale");
      return;
    }

    const nextSender: Sender = {
      id: nextLocalId("local"),
      ...payload,
      referredByCustomerId: payload.referredByCustomerId,
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
    setSelectedBox(null);
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
      };
    } else {
      nextRecipient = {
        id: editingRecipientId || nextLocalId("local-r"),
        ...recipientPayload,
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
    setSelectedBox(null);
    setEmptyBoxMode("");
    setEmptyBoxScheduleMode("");
    setEmptyBoxScheduleAt("");
    setActiveStep("box");
  }

  function chooseBox(box: string[]) {
    setSelectedBox(box);
    setActiveStep("delivery");
  }

  function selectEmptyBoxMode(mode: string) {
    setEmptyBoxMode(mode);

    if (mode === "Cliente recoge caja vacia en oficina") {
      setEmptyBoxScheduleMode("");
      setEmptyBoxScheduleAt("");
      setActiveStep("finish");
      return;
    }

    setActiveStep("delivery");
  }

  function selectEmptyBoxScheduleMode(mode: "pending" | "scheduled") {
    setEmptyBoxScheduleMode(mode);

    if (mode === "pending") {
      setEmptyBoxScheduleAt("");
      setActiveStep("finish");
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

  async function openInvoice() {
    if (!deliveryComplete) {
      return;
    }

    if (isSupabaseConfigured()) {
      const result = await allocateInvoiceNumberAction();

      if (!result.ok) {
        setStockMessage(result.error);
        return;
      }

      setInvoiceNumber(result.data.invoiceNumber);
      const match = result.data.invoiceNumber.match(/(\d+)$/);

      if (match) {
        setInvoiceSequence(Number(match[1]));
      }
    } else {
      setInvoiceNumber(nextInvoiceNumber);
    }

    setShowInvoice(true);
  }

  async function confirmCharge() {
    if (!selectedBox?.[0]) {
      return;
    }

    setStockMessage("");

    const note = `Venta ${invoiceNumber}`;

    if (!isSupabaseConfigured()) {
      setStockMessage("Configura Supabase en .env.local para descontar stock en la base de datos.");
      return;
    }

    const stockResult = await deductStockForBoxSaleAction({
      boxLabel: selectedBox[0],
      note,
    });

    if (!stockResult.ok) {
      setStockMessage(stockResult.error);
      return;
    }

    if (selectedSender && selectedRecipient && isSupabaseConfigured()) {
      const shipmentResult = await createShipmentAction({
        invoiceNumber,
        customerId: selectedSender.id.startsWith("local-") ? undefined : selectedSender.id,
        recipientId: selectedRecipient.id.startsWith("local-r-") ? undefined : selectedRecipient.id,
        customerName: personFullName(selectedSender),
        country: selectedRecipient.country,
        carrier: selectedBox[3] || "Sin carrier",
        paid: selectedBox[1] || "0",
        cost: selectedBox[2] || "0",
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
        },
      });

      if (!shipmentResult.ok) {
        setStockMessage(`Stock descontado, pero el envio no se registro: ${shipmentResult.error}`);
        return;
      }

      void reloadHistory();
    }

    setShowInvoice(false);

    if (isSupabaseConfigured()) {
      const nextInvoice = await allocateInvoiceNumberAction();

      if (nextInvoice.ok) {
        setInvoiceNumber(nextInvoice.data.invoiceNumber);
        const match = nextInvoice.data.invoiceNumber.match(/(\d+)$/);

        if (match) {
          setInvoiceSequence(Number(match[1]));
        }
      }
    } else {
      setInvoiceSequence((current) => current + 1);
    }

    setStockMessage("Cobro confirmado, stock descontado y envio registrado.");
  }

  function deliverySummary(action: string, scheduleMode: string, scheduleAt: string) {
    if (!action) {
      return "Pendiente";
    }

    if (!action.includes("Programar")) {
      return action;
    }

    if (scheduleMode === "pending") {
      return `${action} - pendiente`;
    }

    if (scheduleMode !== "scheduled") {
      return `${action} - falta elegir`;
    }

    return scheduleAt ? `${action} - ${scheduleAt.replace("T", " ")}` : `${action} - falta fecha`;
  }

  const routeDate = emptyBoxRouteDate;
  const routeTime = emptyBoxRouteTime;

  function updateRouteSchedule(nextDate = routeDate, nextTime = routeTime) {
    if (!nextDate && !nextTime) {
      setEmptyBoxScheduleAt("");
      return;
    }

    const resolvedDate = nextDate || formatDateInput(new Date());
    const resolvedTime = nextTime || "10:00";

    setEmptyBoxScheduleAt(`${resolvedDate}T${resolvedTime}`);

    if (emptyBoxMode === "Programar entrega de caja vacia" && emptyBoxScheduleMode === "scheduled") {
      setActiveStep("finish");
    }
  }

  function setQuickRouteDate(daysFromToday: number) {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysFromToday);
    updateRouteSchedule(formatDateInput(nextDate), routeTime || "10:00");
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

  function openRouteTimePicker() {
    const input = routeTimeInputRef.current;

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
    if (!emptyBoxMode) {
      return;
    }

    scrollToRevealBottom(deliveryRef, finishRef);
  }, [emptyBoxMode, emptyBoxScheduleMode, deliveryComplete]);

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

  function copyValue(value?: string) {
    if (!value) {
      return;
    }

    void navigator.clipboard?.writeText(value);
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
      setClientAddressSearch(fullAddress());
      setClientAddressSuggestions([]);
      setClientAddressValidation({ status: "valid", message: "Direccion cargada" });
      setMode("new-client");
      setActiveStep("client");
      setContextMenu(null);
      setActiveCopyGroup(null);
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
      setRecipientAddressSearch(fullAddress());
      setRecipientAddressSuggestions([]);
      setRecipientAddressValidation({ status: "valid", message: "Direccion cargada" });
      setMode("new-recipient");
      setActiveStep("recipient");
      setContextMenu(null);
      setActiveCopyGroup(null);
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
              ? selectedBox
                ? `Caja ${selectedBox[0]}`
                : "Seleccionar"
              : step.id === "delivery"
                ? deliveryComplete
                  ? deliverySummary(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt)
                  : "Pendiente"
                : deliveryComplete
                  ? "Cobrar"
                  : "Pendiente";

      const detail =
        step.id === "client"
          ? selectedSender
            ? senderPhonesLabel(selectedSender)
            : ""
          : step.id === "recipient"
            ? ""
            : step.id === "box"
              ? selectedBox
                ? `${selectedBox[1]} - ${selectedBox[3]}`
                : ""
              : step.id === "delivery"
                ? deliveryComplete
                  ? "Entrega lista"
                  : "Ruta"
                : deliveryComplete
                  ? nextInvoiceNumber
                  : "";

      const country =
        step.id === "client" && selectedSender
          ? "USA"
          : step.id === "recipient" && selectedRecipient
            ? selectedRecipient.country
            : "";

      return {
        id: step.id,
        label: step.label,
        value,
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
    deliveryComplete,
    emptyBoxMode,
    emptyBoxScheduleMode,
    emptyBoxScheduleAt,
    nextInvoiceNumber,
  ]);

  return (
    <>
      <div
        className="pb-24 md:pb-6"
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
        <SaleStepBar steps={saleStepBarItems} onOpenStep={openStep} />
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
                <SaleSenderList
                  query={senderQuery}
                  matchingSenders={filteredSenders}
                  filteredCount={filteredSenders.length}
                  visibleSenders={visibleSenders}
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
                  onAddReferral={addReferralClient}
                  onChoose={chooseSender}
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
                    )
                  }
                />
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
                  filteredCount={filteredRecipients.length}
                  visibleRecipients={visibleRecipients}
                  emptySlots={emptyRecipientSlots}
                  safePage={safeRecipientPage}
                  onChoose={chooseRecipient}
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

          {selectedRecipient ? (
            !selectedBox || activeStep === "box" ? (
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
                      Aún no hay productos para {selectedRecipient.country}.
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
                  {boxesForCountry.map((box) => (
                    <button
                      key={box[0]}
                      data-sale-context-key={`box:${box[0]}`}
                      data-sale-context-type="caja"
                      data-sale-context-title={box[0]}
                      onClick={() => chooseBox(box)}
                      onContextMenu={(event) =>
                        openContextMenu(event, box[0], "caja", `box:${box[0]}`)
                      }
                      className={`group flex min-h-[12rem] w-full flex-col items-center justify-between rounded-xl border border-black bg-[#3f4b46] p-4 text-center shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition hover:-translate-y-0.5 hover:bg-[#46544e] ${
                        contextCardClass(
                          "caja",
                          `box:${box[0]}`,
                          selectedBox?.[0] === box[0],
                          boxCardClass,
                          selectedBox !== null,
                        )
                      }`}
                    >
                      <div className="flex min-w-0 flex-col items-center">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-slate-950 shadow-[0_8px_14px_rgba(16,185,129,0.2)]">
                          <Package className="h-5 w-5" />
                        </div>
                        <p className="text-lg font-black leading-tight text-[#f8fafc]">{box[0]}</p>
                        <div className="mt-2">
                          <CountryBadge country={selectedRecipient.country} />
                        </div>
                      </div>

                      <div className="my-2 grid w-full grid-cols-3 gap-1.5 border-y border-white/10 py-2 text-xs font-black text-slate-300">
                        <span className="truncate rounded-md bg-[#202926] px-2 py-1.5">
                          {box[3] ? `Carrier ${box[3]}` : "Carrier —"}
                        </span>
                        <span className="truncate rounded-md bg-[#202926] px-2 py-1.5">
                          {box[4] || "Tiempo —"}
                        </span>
                        <span className="truncate rounded-md bg-[#202926] px-2 py-1.5">Costo {box[2]}</span>
                      </div>

                      <div className="grid w-full grid-cols-2 gap-2">
                        <div className="rounded-lg border border-black/70 bg-[#202926] px-3 py-2">
                          <p className="text-[10px] font-black uppercase text-slate-400">Cobra</p>
                          <p className="text-lg font-black">{box[1]}</p>
                        </div>
                        <div className="rounded-lg border border-black/70 bg-emerald-400/12 px-3 py-2 text-emerald-200">
                          <p className="text-[10px] font-black uppercase">Gana</p>
                          <p className="text-lg font-black">{boxProfitDisplay(box)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              </div>
            </Panel>
            </div>
            ) : null
          ) : null}
        </div>
      ) : null}

      {selectedSender && selectedRecipient && selectedBox ? (
        <div
          className="mt-3 grid gap-3"
        >
          {!deliveryComplete || activeStep === "delivery" ? (
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
            <div className="w-full space-y-4">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                <span className={`h-10 w-10 ${iconWellEmerald}`}>
                  <Package className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-black uppercase text-emerald-300/80">Primer paso</p>
                  <p className="text-xl font-black text-[#f8fafc]">Entrega de caja vacia</p>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-400/10 text-xs font-black text-emerald-300">
                    1
                  </span>
                  <p className="text-sm font-black text-[#f8fafc]">Donde entregamos la caja</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => selectEmptyBoxMode("Cliente recoge caja vacia en oficina")}
                    className={`min-h-[8.5rem] rounded-xl border p-4 text-center shadow-[0_8px_18px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 ${deliveryModeCardClass(
                      emptyBoxMode === "Cliente recoge caja vacia en oficina",
                      Boolean(emptyBoxMode),
                    )}`}
                  >
                    <span className="flex flex-col items-center gap-2">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${deliveryModeIconClass(
                          emptyBoxMode === "Cliente recoge caja vacia en oficina",
                        )}`}
                      >
                        <Package className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-black leading-tight text-[#f8fafc]">
                          En oficina
                        </span>
                        <span className="mt-1 block text-xs font-bold text-slate-400">
                          Cliente recibe la caja aqui
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectEmptyBoxMode("Programar entrega de caja vacia")}
                    className={`min-h-[8.5rem] rounded-xl border p-4 text-center shadow-[0_8px_18px_rgba(0,0,0,0.24)] transition-all hover:-translate-y-0.5 ${deliveryModeCardClass(
                      emptyBoxMode === "Programar entrega de caja vacia",
                      Boolean(emptyBoxMode),
                    )}`}
                  >
                    <span className="flex flex-col items-center gap-2">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${deliveryModeIconClass(
                          emptyBoxMode === "Programar entrega de caja vacia",
                        )}`}
                      >
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-black leading-tight text-[#f8fafc]">
                          Entrega domicilio
                        </span>
                        <span className="mt-1 block text-xs font-bold text-slate-400">
                          Llevamos la caja al destino
                        </span>
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {(emptyBoxMode === "Programar entrega de caja vacia" ||
                emptyBoxMode === "Cliente recoge caja vacia en oficina") && (
                <div
                  className={`grid shrink-0 gap-3 border-l-2 pl-4 sm:pl-5 ${
                    emptyBoxMode === "Programar entrega de caja vacia" &&
                    emptyBoxScheduleMode === "scheduled"
                      ? "min-h-[12rem]"
                      : "h-[12rem] overflow-hidden"
                  } ${
                    emptyBoxMode === "Programar entrega de caja vacia"
                      ? "border-emerald-400/40"
                      : "border-black/40"
                  }`}
                >
                  {emptyBoxMode === "Cliente recoge caja vacia en oficina" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/60 bg-surface-inset text-xs font-black text-slate-500">
                          2
                        </span>
                        <p className="text-sm font-black text-slate-500">Cuando la entregamos</p>
                      </div>
                      <div className="flex h-full min-h-0 items-center rounded-xl border border-black bg-surface-inset px-4 py-3">
                        <p className="text-sm font-bold leading-snug text-slate-400">
                          No aplica entrega a domicilio. El cliente recoge la caja en oficina.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-400/10 text-xs font-black text-emerald-300">
                      2
                    </span>
                    <p className="text-sm font-black text-[#f8fafc]">Cuando la entregamos</p>
                  </div>

                  <div className="rounded-xl border border-black bg-surface-inset p-3">
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-panel p-1">
                      <button
                        type="button"
                        tabIndex={emptyBoxMode === "Programar entrega de caja vacia" ? 0 : -1}
                        onClick={() => selectEmptyBoxScheduleMode("pending")}
                        className={`rounded-md px-3 py-2.5 text-sm font-black transition ${deliverySegmentClass(
                          emptyBoxScheduleMode === "pending",
                        )}`}
                      >
                        Pendiente
                      </button>
                      <button
                        type="button"
                        tabIndex={emptyBoxMode === "Programar entrega de caja vacia" ? 0 : -1}
                        onClick={() => selectEmptyBoxScheduleMode("scheduled")}
                        className={`rounded-md px-3 py-2.5 text-sm font-black transition ${deliverySegmentClass(
                          emptyBoxScheduleMode === "scheduled",
                        )}`}
                      >
                        Programar ruta
                      </button>
                    </div>

                    {emptyBoxScheduleMode === "pending" ? (
                      <p className="mt-3 rounded-lg border border-black bg-surface-panel px-3 py-2.5 text-sm font-bold text-slate-300">
                        La entrega queda en cola sin fecha fija.
                      </p>
                    ) : null}

                    {emptyBoxScheduleMode === "scheduled" ? (
                      <div ref={routeScheduleRef} className="mt-3 grid gap-3 rounded-lg border border-black bg-surface-panel p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-black uppercase text-slate-400">Fecha y hora</p>
                          <div className="flex gap-1.5">
                            {[
                              ["Hoy", 0],
                              ["Manana", 1],
                            ].map(([label, days]) => (
                              <button
                                key={label}
                                type="button"
                                tabIndex={emptyBoxMode === "Programar entrega de caja vacia" ? 0 : -1}
                                onClick={() => setQuickRouteDate(Number(days))}
                                className="h-8 rounded-md border border-black bg-surface-card px-3 text-xs font-black text-[#f8fafc] hover:bg-surface-card-hover"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-black uppercase text-slate-500">Fecha</span>
                            <span className="relative block">
                              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                ref={routeDateInputRef}
                                className={`${inputClass} w-full pl-10`}
                                type="date"
                                value={routeDate}
                                tabIndex={emptyBoxMode === "Programar entrega de caja vacia" ? 0 : -1}
                                onClick={openRouteDatePicker}
                                onChange={(event) => updateRouteSchedule(event.target.value, routeTime)}
                              />
                            </span>
                          </label>

                          <label className="grid gap-1.5">
                            <span className="text-[11px] font-black uppercase text-slate-500">Hora</span>
                            <span className="relative block">
                              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                              <input
                                ref={routeTimeInputRef}
                                className={`${inputClass} w-full pl-10`}
                                type="time"
                                value={routeTime}
                                tabIndex={emptyBoxMode === "Programar entrega de caja vacia" ? 0 : -1}
                                onClick={openRouteTimePicker}
                                onChange={(event) => updateRouteSchedule(routeDate, event.target.value)}
                              />
                            </span>
                          </label>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ["10 AM", "10:00"],
                            ["2 PM", "14:00"],
                            ["5 PM", "17:00"],
                          ].map(([label, time]) => (
                            <button
                              key={label}
                              type="button"
                              tabIndex={emptyBoxMode === "Programar entrega de caja vacia" ? 0 : -1}
                              onClick={() => updateRouteSchedule(routeDate || formatDateInput(new Date()), time)}
                              className={`h-8 rounded-md border px-3 text-xs font-black transition ${
                                routeTime === time
                                  ? "border-emerald-600 bg-emerald-400 text-slate-950"
                                  : "border-black bg-surface-card text-slate-300 hover:bg-surface-card-hover"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                    </>
                  )}
                </div>
              )}

              {emptyBoxMode ? (
                <div className="flex h-[2.75rem] shrink-0 flex-wrap items-center gap-2 overflow-hidden rounded-lg border border-black bg-surface-inset px-3 py-2.5">
                  <span className="text-[11px] font-black uppercase text-slate-500">Resumen</span>
                  <span className="min-w-0 truncate text-sm font-black text-[#f8fafc]">
                    {deliverySummary(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt)}
                  </span>
                </div>
              ) : null}

              <label className="grid gap-2 border-t border-black/60 pt-4">
                <span className="text-sm font-black uppercase text-slate-400">Notas</span>
                <input className={inputClass} placeholder="Instrucciones adicionales (opcional)" />
              </label>
            </div>
            </div>
          </Panel>
          </div>
          ) : null}

          <div
            ref={finishRef}
            className={`min-w-0 ${deliveryComplete ? stepShellClass("finish") : "rounded-xl"}`}
          >
          <Panel
            className={flowPanelFlushClass}
            contentClassName={flowPanelContentClass}
            hideHeader
            title="Finalizar"
          >
            <div className={flowStepBodyClass}>
            {deliveryComplete ? (
              <div className="w-full space-y-3">
            <SaleInvoicePaper
              invoiceNumber={nextInvoiceNumber}
              sender={selectedSender}
              recipient={selectedRecipient}
              box={selectedBox}
              deliveryLine={deliverySummary(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt)}
            />
            <button
              onClick={openInvoice}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-black text-slate-950"
            >
              <Check className="h-6 w-6" />
              Cobrar venta
            </button>
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
        </div>
      ) : null}
      </div>
      </div>

      {contextMenu ? (
        <div
          className="fixed z-50 w-72 overflow-visible rounded-xl border border-black bg-surface-panel p-2 shadow-2xl border-black bg-surface-panel"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-black px-3 py-2 border-black">
            <p className="text-xs font-black uppercase text-slate-500">
              {contextMenu.type}
            </p>
            <p className="truncate text-base font-black">{contextMenu.title}</p>
          </div>

          {contextMenu.type !== "caja" ? (
            <div className="group relative mt-1">
              <button
                type="button"
                onMouseEnter={() => setActiveCopyGroup(null)}
                className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-black hover:bg-surface-card"
              >
                <Edit3 className="h-5 w-5" />
                <span className="flex-1">Editar info</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>

              <div className="invisible absolute left-[calc(100%-1px)] top-0 z-50 w-64 rounded-xl border border-black bg-surface-panel p-2 opacity-0 shadow-2xl delay-300 duration-150 group-hover:visible group-hover:opacity-100 group-hover:delay-0 border-black bg-surface-panel">
                <p className="px-3 pb-2 text-xs font-black uppercase text-slate-500">
                  Editar
                </p>
                {editGroups.map((group) => (
                  <button
                    key={group.label}
                    type="button"
                    className="grid w-full gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left hover:bg-surface-card hover:border-black"
                    onClick={editContextTarget}
                  >
                    <span className="text-sm font-black text-[#f8fafc]">{group.label}</span>
                    <span className="text-[11px] font-bold text-slate-500">{group.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="group relative mt-1">
            <button className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-black hover:bg-surface-card hover:bg-surface-card">
              <Copy className="h-5 w-5" />
              <span className="flex-1">Copiar</span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>

            <div className="invisible absolute left-[calc(100%-1px)] top-0 z-50 w-60 rounded-xl border border-black bg-surface-panel p-2 opacity-0 shadow-2xl delay-300 duration-150 group-hover:visible group-hover:opacity-100 group-hover:delay-0 border-black bg-surface-panel">
              <p className="px-3 pb-2 text-xs font-black uppercase text-slate-500">
                Copiar
              </p>
              {copyGroups.map((group) => (
                <div key={group.label} className="relative">
                  <button
                    className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-black hover:bg-surface-card hover:bg-surface-card"
                    onMouseEnter={() =>
                      setActiveCopyGroup(group.items.length ? group.label : null)
                    }
                    onClick={() => {
                      if (group.items.length === 0) {
                        copyValue(
                          [
                            contextMenu?.title,
                            ...(contextMenu?.phones || []),
                            fullAddress(),
                          ]
                            .filter(Boolean)
                            .join("\n"),
                        );
                      }
                    }}
                  >
                    <span className="flex-1">{group.label}</span>
                    {group.items.length > 0 ? (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    ) : null}
                  </button>

                  {group.items.length > 0 && activeCopyGroup === group.label ? (
                    <div className="absolute left-[calc(100%-1px)] top-0 z-50 w-80 rounded-xl border border-black bg-surface-panel p-2 opacity-100 shadow-2xl border-black bg-surface-panel">
                      <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
                        {group.label}
                      </p>
                      {group.items.map((item) => (
                        <button
                          key={item.label}
                          className="grid w-full gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left hover:bg-surface-card hover:border-black hover:bg-surface-card"
                          onClick={() => {
                            copyValue(item.value);
                          }}
                        >
                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                            {item.label}
                          </span>
                          {item.value ? (
                            <span className="whitespace-normal text-[15px] font-semibold leading-snug text-[#f8fafc] text-[#f8fafc]">
                              {item.value}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

        </div>
      ) : null}

      {showInvoice && selectedSender && selectedRecipient && selectedBox && deliveryComplete ? (
        <SaleCheckoutModal
          invoiceNumber={invoiceNumber}
          sender={selectedSender}
          recipient={selectedRecipient}
          box={selectedBox}
          deliverySummary={deliverySummary(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt)}
          stockMessage={stockMessage}
          onClose={() => setShowInvoice(false)}
          onPrint={() => window.print()}
          onConfirmCharge={() => void confirmCharge()}
        />
      ) : null}
    </>
  );
}
