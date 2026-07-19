"use client";

import {
  Box,
  Building2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Gauge,
  Globe2,
  Package2,
  Palette,
  Plus,
  Route,
  Search,
  Tags,
  Trash2,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { CompanySettingsPanel } from "@/components/config/company-settings-panel";
import { CountryCommercialServiceCosts } from "@/components/config/country-commercial-service-costs";
import { AppearanceSettingsPanel } from "@/components/config/appearance-settings-panel";
import { PlanSettingsPanel } from "@/components/config/plan-settings-panel";
import { PageLoading } from "@/components/page-loading";
import { useSetShellConfig } from "@/components/app-frame";
import { useContextNav } from "@/hooks/use-context-nav";
import { useNotify } from "@/hooks/use-notify";
import { usePricingBackend } from "@/hooks/use-pricing-backend";
import { inputClass, iconWellEmerald, Panel, primaryButtonClass } from "@/components/ui-blocks";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import { flowToolbarCreateButtonClass } from "@/components/flow-form-styles";
import { InlineSearchCombobox, InlineSearchPicker } from "@/components/inline-search-picker";
import { TimePickerInput } from "@/components/time-picker-input";
import { CountryFlag, CountryName } from "@/components/country-flag";
import {
  COUNTRY_OPTIONS,
  compareCountriesByCatalogOrder,
  configPricesCountryHref,
  findCountryByNormalizedName,
  isCountryAlreadyConfigured,
  resolveCountryCode,
  type CountryOption,
} from "@/lib/country-options";
import { inventarioHrefWithReturn } from "@/lib/inventario-return";
import { ONBOARDING_TARGETS } from "@/lib/onboarding/coach-targets";
import { countryCatalogPickerOptions } from "@/lib/country-picker-options";
import {
  addProductToCountry,
  removeProductFromCountry,
  type InventoryCatalogProduct,
} from "@/lib/pricing-catalog";
import type { PricingConfigPayload } from "@/lib/pricing/types";
import type { ComboBuilderProduct } from "@/components/config/combo-builder";
import { CountryCatalogAddPanel } from "@/components/config/country-catalog-add-panel";
import { PromotionSortableList } from "@/components/config/promotion-sortable-list";
import {
  createBlankPromotion,
  isPromotionRuleValid,
  normalizeComboRule,
  primaryCatalogKey,
  type PricingPromotionConfig,
} from "@/lib/pricing-promotions";
import { moneyInputDisplayValue, parseMoneyValue } from "@/lib/logistics-fees";
import { CONFIG_MENU_GROUPS } from "@/lib/config-menu-groups";
import type { TimeClockDashboardSnapshot } from "@/lib/time-clock-data";

const ComboBuilder = dynamic(
  () => import("@/components/config/combo-builder").then((mod) => mod.ComboBuilder),
  { loading: () => <PageLoading inline /> },
);

const UsersSettingsPanel = dynamic(
  () => import("@/components/config/users-settings-panel").then((mod) => mod.UsersSettingsPanel),
  { loading: () => <PageLoading inline /> },
);

const TimeClockAdminClient = dynamic(
  () =>
    import("@/components/time-clock/time-clock-admin-client").then((mod) => mod.TimeClockAdminClient),
  { loading: () => <PageLoading inline /> },
);

const ROUTE_LEAD_TIME_OPTIONS = [
  { value: "1 dia", label: "1 dia" },
  { value: "2 dias", label: "2 dias" },
  { value: "3 dias", label: "3 dias" },
  { value: "1 semana", label: "1 semana" },
];

type Section = "menu" | "plan" | "prices" | "distributors" | "deliveries" | "appearance" | "company" | "users" | "timeclock";

const sections = [
  {
    id: "plan" as Section,
    title: "Plan",
    text: "Límites de bodegas y usuarios del plan.",
    icon: Gauge,
  },
  {
    id: "prices" as Section,
    title: "Países y precios",
    text: "Destinos, tiempos de entrega y productos.",
    icon: Globe2,
  },
  {
    id: "distributors" as Section,
    title: "Distribuidores",
    text: "Proveedores y costos por país.",
    icon: Truck,
  },
  {
    id: "deliveries" as Section,
    title: "Logística",
    text: "Horarios y tarifas de entrega y recolección.",
    icon: Route,
  },
  {
    id: "appearance" as Section,
    title: "Apariencia",
    text: "Tema visual del sistema.",
    icon: Palette,
  },
  {
    id: "company" as Section,
    title: "Empresa",
    text: "Nombre, teléfono y dirección.",
    icon: Building2,
  },
  {
    id: "users" as Section,
    title: "Usuarios",
    text: "Dueño, equipo y permisos.",
    icon: Users,
  },
  {
    id: "timeclock" as Section,
    title: "Control de horario",
    text: "Empleados, marcaciones y reportes.",
    icon: Clock,
  },
];

const configSectionById = new Map(sections.map((section) => [section.id, section]));

const configNavCardClass =
  "group flex min-h-[9.5rem] min-w-0 flex-col rounded-xl border border-black bg-surface-card p-4 text-left shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:border-emerald-700/35 hover:bg-surface-card-hover sm:p-5";

function ConfigNavGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-black bg-[#171d1b] shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
      <header className="border-b border-black bg-surface-card-header px-4 py-3 sm:px-5">
        <h2 className="text-sm font-black text-[#f8fafc]">{title}</h2>
        <p className="mt-1 text-sm font-bold text-slate-400">{description}</p>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4 sm:gap-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function ConfigNavCard({
  href,
  title,
  text,
  icon: Icon,
  badge,
  onboardingTarget,
}: {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
  badge?: string;
  onboardingTarget?: string;
}) {
  return (
    <Link
      href={href}
      className={configNavCardClass}
      data-onboarding-target={onboardingTarget}
    >
      <span className={`h-11 w-11 shrink-0 ${iconWellEmerald}`}>
        <Icon className="h-6 w-6" />
      </span>
      <span className="mt-4 block break-words text-xl font-black leading-snug text-[#f8fafc] sm:text-2xl">
        {title}
      </span>
      <span className="mt-2 block flex-1 break-words text-sm font-bold leading-snug text-slate-300 sm:text-base">
        {text}
      </span>
      {badge ? (
        <span className="mt-4 inline-flex w-fit rounded-lg border border-black bg-surface-panel px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-400">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

const emptyDistributor = {
  name: "",
  contact: "",
  phone: "",
};


const configSections: Section[] = [
  "menu",
  "plan",
  "prices",
  "distributors",
  "deliveries",
  "appearance",
  "company",
  "users",
  "timeclock",
];

function countryOptionKey(country: Pick<CountryOption, "code" | "name">) {
  return country.code || country.name;
}

function parseConfigUrl(params: URLSearchParams) {
  const view = params.get("view");

  return {
    section: configSections.includes(view as Section) ? (view as Section) : ("menu" as Section),
  };
}

const dayOptions = Array.from({ length: 31 }, (_, index) => index + 1);
const weekOptions = Array.from({ length: 12 }, (_, index) => index + 1);
type TimeUnit = "dias" | "semanas";

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

function parseDeliveryTime(value: string) {
  const match = value.match(/^(\d+)(?:-(\d+))?\s+(dia|dias|semana|semanas)$/);
  const unit: TimeUnit = match?.[3]?.startsWith("semana") ? "semanas" : "dias";
  const start = Number(match?.[1] || 1);
  const end = Number(match?.[2] || match?.[1] || 1);

  return { start, end, unit };
}

function formatDeliveryTime(start: number, end: number, unit: TimeUnit) {
  if (start === end) {
    return `${start} ${unit === "dias" ? "dia" : "semana"}`;
  }

  return `${start}-${end} ${unit}`;
}

function formatTime12Hour(value: string) {
  const [hourValue, minuteValue = "00"] = value.split(":");
  const hour = Number(hourValue);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minuteValue} ${period}`;
}

function formatRouteRange(range: string) {
  const [start, end] = range.split("-");

  if (!start || !end) {
    return range;
  }

  return `${formatTime12Hour(start)} - ${formatTime12Hour(end)}`;
}

function parseMoney(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

function productKeyFromBox(box: { size: string; catalogKey?: string }) {
  return box.catalogKey || box.size;
}

function localPromotionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TimeRangeSelect({
  value,
  onChange,
  large = false,
}: {
  value: string;
  onChange: (value: string) => void;
  large?: boolean;
}) {
  const [openPicker, setOpenPicker] = useState<"start" | "end" | "unit" | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  const unitRef = useRef<HTMLButtonElement>(null);
  const isConfigured = Boolean(value.trim());
  const range = parseDeliveryTime(isConfigured ? value : "1 dia");
  const numbers = range.unit === "dias" ? dayOptions : weekOptions;
  const controlSize = large ? "h-12 text-xl" : "h-11 text-lg";
  const numberWidth = large ? "w-14" : "w-12";

  function updateRange(nextRange: Partial<typeof range>) {
    const next = { ...range, ...nextRange };
    const max = next.unit === "dias" ? 31 : 12;
    next.start = Math.min(next.start, max);
    next.end = Math.min(next.end, max);

    if (next.start > next.end) {
      if (nextRange.start) {
        next.end = next.start;
      } else {
        next.start = next.end;
      }
    }

    onChange(formatDeliveryTime(next.start, next.end, next.unit));
  }

  function pickNumber(key: "start" | "end", number: number) {
    updateRange({ [key]: number });
    setOpenPicker(null);
    setPanelPosition(null);
  }

  function pickUnit(unit: TimeUnit) {
    updateRange({ unit });
    setOpenPicker(null);
    setPanelPosition(null);
  }

  const openPickerAt = useCallback(
    (key: "start" | "end" | "unit") => {
      const trigger =
        key === "start" ? startRef.current : key === "end" ? endRef.current : unitRef.current;

      if (!trigger) {
        return;
      }

      if (openPicker === key) {
        setOpenPicker(null);
        setPanelPosition(null);
        return;
      }

      const rect = trigger.getBoundingClientRect();

      setPanelPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: key === "unit" ? 132 : 196,
      });
      setOpenPicker(key);
    },
    [openPicker],
  );

  useEffect(() => {
    if (isConfigured) {
      queueMicrotask(() => setDrafting(false));
    }
  }, [isConfigured]);

  useEffect(() => {
    if (!openPicker) {
      return;
    }

    const updatePosition = () => {
      const trigger =
        openPicker === "start"
          ? startRef.current
          : openPicker === "end"
            ? endRef.current
            : unitRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();

      setPanelPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: openPicker === "unit" ? 132 : 196,
      });
    };

    const close = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Element && target.closest("[data-time-range-panel]")) {
        return;
      }

      setOpenPicker(null);
      setPanelPosition(null);
    };

    updatePosition();
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [openPicker]);

  if (!isConfigured && !drafting) {
    return (
      <button
        type="button"
        onClick={() => setDrafting(true)}
        className={`inline-flex items-center gap-2 rounded-xl border border-dashed border-black bg-surface-panel px-4 font-black text-slate-400 transition hover:border-emerald-600/50 hover:bg-surface-card-hover hover:text-emerald-300 ${large ? "h-12 text-base" : "h-11 text-sm"}`}
      >
        <Clock className="h-4 w-4" />
        Definir tiempo de entrega
      </button>
    );
  }

  const triggerClass = `flex ${controlSize} items-center justify-center gap-1 rounded-lg border border-black bg-surface-panel px-2 font-black text-[#f8fafc] transition hover:bg-surface-card-hover`;

  return (
    <>
      <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-black bg-[#1a221f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <button
          ref={startRef}
          type="button"
          onClick={() => openPickerAt("start")}
          className={`${triggerClass} ${numberWidth}`}
          aria-expanded={openPicker === "start"}
        >
          {range.start}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition ${openPicker === "start" ? "rotate-180" : ""}`}
          />
        </button>
        <span className="px-0.5 text-sm font-black text-slate-500">a</span>
        <button
          ref={endRef}
          type="button"
          onClick={() => openPickerAt("end")}
          className={`${triggerClass} ${numberWidth}`}
          aria-expanded={openPicker === "end"}
        >
          {range.end}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition ${openPicker === "end" ? "rotate-180" : ""}`}
          />
        </button>
        <button
          ref={unitRef}
          type="button"
          onClick={() => openPickerAt("unit")}
          className={`${triggerClass} min-w-[5.5rem] px-3`}
          aria-expanded={openPicker === "unit"}
        >
          {range.unit}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition ${openPicker === "unit" ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {openPicker && panelPosition ? (
        <div
          data-time-range-panel
          className="fixed z-[120] overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{
            top: panelPosition.top,
            left: panelPosition.left,
            width: panelPosition.width,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {openPicker === "unit" ? (
            <div className="grid gap-1 p-2">
              {(["dias", "semanas"] as TimeUnit[]).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => pickUnit(unit)}
                  className={`h-10 rounded-md px-3 text-left text-sm font-black transition ${
                    unit === range.unit
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid max-h-52 grid-cols-4 gap-1 overflow-y-auto p-2">
              {numbers.map((number) => {
                const currentValue = openPicker === "start" ? range.start : range.end;

                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => pickNumber(openPicker, number)}
                    className={`h-9 rounded-md text-sm font-black transition ${
                      number === currentValue
                        ? "bg-emerald-400 text-slate-950"
                        : "bg-surface-panel text-[#f8fafc] hover:bg-surface-card-hover"
                    }`}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

type CountryContextMenu = {
  name: string;
  x: number;
  y: number;
};

type CountryProductContextMenu = {
  catalogKey: string;
  label: string;
  x: number;
  y: number;
};

type PromotionEditorState = {
  mode: "new" | "edit";
  draft: PricingPromotionConfig;
};

type CountryPriceTab = "items" | "promotions" | "delivery";

export function ConfiguracionClient({
  initialPricing,
  timeClockInitialSnapshot,
  canManageTimeClock = false,
}: {
  initialPricing?: PricingConfigPayload;
  timeClockInitialSnapshot?: TimeClockDashboardSnapshot;
  canManageTimeClock?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setShellConfig = useSetShellConfig();
  const notify = useNotify();
  const cleanedFromRef = useRef(false);
  const section = useMemo(() => parseConfigUrl(searchParams).section, [searchParams]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [pendingCountryToAdd, setPendingCountryToAdd] = useState<CountryOption | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countryContextMenu, setCountryContextMenu] = useState<CountryContextMenu | null>(null);
  const [countryProductContextMenu, setCountryProductContextMenu] =
    useState<CountryProductContextMenu | null>(null);
  const [countryProductQuery, setCountryProductQuery] = useState("");
  const [countryProductPickerOpen, setCountryProductPickerOpen] = useState(false);
  const countryProductAddRef = useRef<HTMLDivElement>(null);
  const {
    enabled: pricingBackendEnabled,
    error: pricingError,
    loaded: pricingLoaded,
    countries,
    setCountries,
    promotions,
    setPromotions,
    catalogProducts,
    distributors,
    setDistributors,
    distributorPrices,
    setDistributorPrices,
    routeConfig,
    setRouteConfig,
    flushPendingSave,
  } = usePricingBackend(initialPricing);
  const countryFromUrl = searchParams.get("country");
  const appliedCountryFromUrlRef = useRef<string | null>(null);
  const impliedCountryFromUrl = useMemo(() => {
    if (!countryFromUrl?.trim() || !pricingLoaded) {
      return null;
    }

    const requestedCountry = countryFromUrl.trim();
    const configured = findCountryByNormalizedName(requestedCountry, countries);
    if (configured) {
      return configured.name;
    }

    const option = findCountryByNormalizedName(requestedCountry, COUNTRY_OPTIONS);
    return option?.name ?? null;
  }, [countryFromUrl, countries, pricingLoaded]);
  const activeCountry = selectedCountry ?? impliedCountryFromUrl;
  const inventarioReturnHref = useMemo(() => {
    const returnTo = activeCountry
      ? configPricesCountryHref(activeCountry)
      : "/configuracion?view=prices";

    return inventarioHrefWithReturn(returnTo);
  }, [activeCountry]);
  const pendingCountryFromUrl = Boolean(
    section === "prices" && countryFromUrl?.trim() && !pricingLoaded,
  );
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null);
  const [selectedDistributorCountry, setSelectedDistributorCountry] = useState<string | null>(null);
  const [showDistributorForm, setShowDistributorForm] = useState(false);
  const [newDistributor, setNewDistributor] = useState(emptyDistributor);
  const [promotionEditor, setPromotionEditor] = useState<PromotionEditorState | null>(null);
  const [countryPriceTab, setCountryPriceTab] = useState<CountryPriceTab>("items");
  const [newDeliveryRange, setNewDeliveryRange] = useState({ start: "", end: "" });
  const [newPickupRange, setNewPickupRange] = useState({ start: "", end: "" });
  const countryOptions = COUNTRY_OPTIONS;
  const sortedCountries = useMemo(
    () => [...countries].sort(compareCountriesByCatalogOrder),
    [countries],
  );
  const selectedCountryData = useMemo(
    () => countries.find((country) => country.name === activeCountry),
    [countries, activeCountry],
  );
  const assignedCountryCatalogKeys = useMemo(
    () =>
      new Set(
        (selectedCountryData?.boxes || [])
          .map((box) => box.catalogKey || box.size)
          .filter(Boolean),
      ),
    [selectedCountryData],
  );
  const hasAddableCatalogProducts = useMemo(
    () =>
      catalogProducts.some((product) => !assignedCountryCatalogKeys.has(product.catalogKey)),
    [catalogProducts, assignedCountryCatalogKeys],
  );
  const catalogProductsByKey = useMemo(
    () => new Map(catalogProducts.map((product) => [product.catalogKey, product])),
    [catalogProducts],
  );
  const selectedCountryPromotions = useMemo(
    () =>
      promotions
        .filter((promotion) => promotion.countryName === activeCountry)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [promotions, activeCountry],
  );
  const countryPriceTabs = useMemo<AppTabDefinition<CountryPriceTab>[]>(
    () => [
      { id: "items", label: "Items", icon: Package2 },
      {
        id: "promotions",
        label: "Promociones",
        icon: Tags,
        badge: selectedCountryPromotions.length || undefined,
      },
      { id: "delivery", label: "Entrega", icon: Clock },
    ],
    [selectedCountryPromotions.length],
  );
  const comboBuilderProducts = useMemo<ComboBuilderProduct[]>(() => {
    const all = (selectedCountryData?.boxes || []).map((box) => ({
      catalogKey: productKeyFromBox(box),
      label: box.size,
      price: box.price,
    }));

    const keepKeys = new Set<string>();

    if (promotionEditor) {
      for (const line of promotionEditor.draft.rule.buy) {
        if (line.catalogKey.trim()) {
          keepKeys.add(line.catalogKey.trim());
        }
      }

      for (const line of promotionEditor.draft.rule.get) {
        if (line.catalogKey.trim()) {
          keepKeys.add(line.catalogKey.trim());
        }
      }
    }

    return all.filter(
      (product) =>
        parseMoneyValue(product.price) > 0 || keepKeys.has(product.catalogKey),
    );
  }, [selectedCountryData, promotionEditor]);
  const comboProductLabels = useMemo(
    () =>
      Object.fromEntries(
        comboBuilderProducts.map((product) => [product.catalogKey, product.label]),
      ),
    [comboBuilderProducts],
  );
  const selectedDistributorData = useMemo(
    () => distributors.find((distributor) => distributor.name === selectedDistributor),
    [distributors, selectedDistributor],
  );
  const selectedDistributorCountryData = useMemo(
    () => countries.find((country) => country.name === selectedDistributorCountry),
    [countries, selectedDistributorCountry],
  );
  const selectedDistributorBoxes =
    selectedDistributor && selectedDistributorCountry
      ? distributorPrices[selectedDistributor]?.[selectedDistributorCountry] ||
        selectedDistributorCountryData?.boxes ||
        []
      : [];
  const filteredCountryOptions = useMemo(() => {
    const query = normalizeText(countryQuery.trim());

    return countryOptions
      .filter((country) => !isCountryAlreadyConfigured(country, countries))
      .filter((country) => normalizeText(country.name).includes(query));
  }, [countries, countryOptions, countryQuery]);

  const countryPickerSearchOptions = useMemo(() => {
    return countryCatalogPickerOptions(
      countryOptions.filter((country) => !isCountryAlreadyConfigured(country, countries)),
    );
  }, [countries, countryOptions]);

  useEffect(() => {
    appliedCountryFromUrlRef.current = null;
  }, [countryFromUrl]);

  useLayoutEffect(() => {
    if (section !== "prices" || !countryFromUrl?.trim() || !pricingLoaded) {
      return;
    }

    const requestedCountry = countryFromUrl.trim();
    if (appliedCountryFromUrlRef.current === requestedCountry) {
      return;
    }

    const configured = findCountryByNormalizedName(requestedCountry, countries);
    if (configured) {
      appliedCountryFromUrlRef.current = requestedCountry;
      queueMicrotask(() => {
        setSelectedCountry(configured.name);
        setShowCountryPicker(false);
      });
      return;
    }

    const option = findCountryByNormalizedName(requestedCountry, COUNTRY_OPTIONS);
    if (option) {
      appliedCountryFromUrlRef.current = requestedCountry;
      queueMicrotask(() => {
        setCountries((current) => {
          const existing = findCountryByNormalizedName(requestedCountry, current);
          if (existing) {
            return current;
          }

          return [
            ...current,
            {
              code: option.code,
              name: option.name,
              deliveryTime: "",
              boxes: [],
            },
          ].sort(compareCountriesByCatalogOrder);
        });
        setSelectedCountry(option.name);
        setShowCountryPicker(false);
        void flushPendingSave();
      });
      return;
    }

    appliedCountryFromUrlRef.current = requestedCountry;
    queueMicrotask(() => {
      setCountryQuery(requestedCountry);
      setShowCountryPicker(true);
    });
  }, [section, countryFromUrl, countries, pricingLoaded, setCountries, flushPendingSave]);

  useEffect(() => {
    if (!pricingError) {
      return;
    }

    notify.error(pricingError);
  }, [notify, pricingError]);

  useEffect(() => {
    if (
      section === "prices" &&
      !activeCountry &&
      countries.length === 0 &&
      !countryFromUrl?.trim()
    ) {
      queueMicrotask(() => setShowCountryPicker(true));
    }
  }, [section, activeCountry, countries.length, countryFromUrl]);

  useEffect(() => {
    if (section === "prices") {
      return;
    }

    queueMicrotask(() => {
      setSelectedCountry(null);
      setCountryQuery("");
      setShowCountryPicker(false);
      setCountryProductQuery("");
      setCountryContextMenu(null);
      setPromotionEditor(null);
      setCountryPriceTab("items");
    });
  }, [section]);

  useEffect(() => {
    queueMicrotask(() => {
      setCountryPriceTab("items");
      setCountryProductQuery("");
      setCountryProductPickerOpen(false);
      setPromotionEditor(null);
    });
  }, [activeCountry]);

  useEffect(() => {
    if (section !== "prices" || countryPriceTab === "items") {
      return;
    }

    queueMicrotask(() => setCountryProductPickerOpen(false));
  }, [section, countryPriceTab]);

  useEffect(() => {
    if (!countryProductPickerOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (countryProductAddRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest("[data-inline-search-picker-panel]")) {
        return;
      }

      setCountryProductPickerOpen(false);
      setCountryProductQuery("");
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [countryProductPickerOpen]);

  useEffect(() => {
    if (countryPriceTab !== "promotions") {
      queueMicrotask(() => {
        setPromotionEditor(null);
        void flushPendingSave();
      });
    }
  }, [countryPriceTab, flushPendingSave]);

  useEffect(() => {
    if (section !== "prices" || countryPriceTab !== "items" || !activeCountry) {
      return;
    }

    void flushPendingSave();
  }, [section, countryPriceTab, activeCountry, flushPendingSave]);

  useEffect(() => {
    if (section === "distributors") {
      return;
    }

    queueMicrotask(() => {
      setSelectedDistributor(null);
      setSelectedDistributorCountry(null);
      setShowDistributorForm(false);
    });
  }, [section]);

  useEffect(() => {
    if (!countryContextMenu && !countryProductContextMenu) {
      return;
    }

    const closeMenusOnPointerDown = (event: Event) => {
      if (event instanceof PointerEvent && event.button === 2) {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest("[data-country-context-menu]")) {
        return;
      }

      if (target instanceof Element && target.closest("[data-country-product-context-menu]")) {
        return;
      }

      setCountryContextMenu(null);
      setCountryProductContextMenu(null);
    };

    const closeMenusOnScroll = () => {
      setCountryContextMenu(null);
      setCountryProductContextMenu(null);
    };

    window.addEventListener("pointerdown", closeMenusOnPointerDown);
    window.addEventListener("scroll", closeMenusOnScroll, true);

    return () => {
      window.removeEventListener("pointerdown", closeMenusOnPointerDown);
      window.removeEventListener("scroll", closeMenusOnScroll, true);
    };
  }, [countryContextMenu, countryProductContextMenu]);

  const openConfigSection = useCallback((nextSection: Section) => {
    if (nextSection === "menu") {
      router.replace("/configuracion", { scroll: false });
      return;
    }

    router.replace(`/configuracion?view=${nextSection}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const view = searchParams.get("view");
    const open = searchParams.get("open");

    if (view !== "inventory" && open !== "inventory") {
      return;
    }

    const inventorySub = searchParams.get("inventory");

    router.replace(
      inventorySub === "warehouses" ? "/inventario?bodegas=1" : "/inventario",
    );
  }, [router, searchParams]);

  useEffect(() => {
    if (cleanedFromRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "inventario") {
      return;
    }

    cleanedFromRef.current = true;

    params.delete("from");
    const query = params.toString();
    router.replace(query ? `/configuracion?${query}` : "/configuracion", { scroll: false });
  }, [router]);

  function openCountryContextMenu(
    event: MouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>,
    countryName: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setCountryContextMenu({
      name: countryName,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function countryContextMenuProps(countryName: string) {
    return {
      onContextMenu: (event: MouseEvent<HTMLElement>) =>
        openCountryContextMenu(event, countryName),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 2) {
          return;
        }

        openCountryContextMenu(event, countryName);
      },
    };
  }

  function openCountryProductContextMenu(
    event: MouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>,
    catalogKey: string,
    label: string,
  ) {
    event.preventDefault();
    event.stopPropagation();
    setCountryProductContextMenu({
      catalogKey,
      label,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function countryProductContextMenuProps(catalogKey: string, label: string) {
    return {
      onContextMenu: (event: MouseEvent<HTMLElement>) =>
        openCountryProductContextMenu(event, catalogKey, label),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 2) {
          return;
        }

        openCountryProductContextMenu(event, catalogKey, label);
      },
    };
  }

  function removeCountry(countryName: string) {
    flushSync(() => {
      setCountries((current) => current.filter((country) => country.name !== countryName));
      setPromotions((current) =>
        current.filter((promotion) => promotion.countryName !== countryName),
      );
      setDistributorPrices((current) => {
        const next: typeof current = {};

        for (const [distributor, pricesByCountry] of Object.entries(current)) {
          next[distributor] = Object.fromEntries(
            Object.entries(pricesByCountry).filter(([country]) => country !== countryName),
          );
        }

        return next;
      });
    });

    if (selectedCountry === countryName) {
      setSelectedCountry(null);
    }

    if (selectedDistributorCountry === countryName) {
      setSelectedDistributorCountry(null);
    }

    setCountryContextMenu(null);
    void flushPendingSave();
    notify.success(`${countryName} quitado`);
  }

  function openConfiguredCountry(countryName: string) {
    setCountryQuery("");
    setShowCountryPicker(false);
    setSelectedCountry(countryName);
  }

  function addCountry(country: CountryOption) {
    flushSync(() => {
      setCountries((current) =>
        [
          ...current,
          {
            code: country.code,
            name: country.name,
            deliveryTime: "",
            boxes: [],
          },
        ].sort(compareCountriesByCatalogOrder),
      );
    });
    setCountryQuery("");
    setPendingCountryToAdd(null);
    setShowCountryPicker(false);
    setSelectedCountry(country.name);
    void flushPendingSave();
    notify.success(`${country.name} agregado`);
  }

  function closeCountryPicker() {
    setCountryQuery("");
    setPendingCountryToAdd(null);
    setShowCountryPicker(false);
  }

  function updateCountryTime(time: string) {
    if (!selectedCountry) {
      return;
    }

    setCountries((current) =>
      current.map((country) =>
        country.name === selectedCountry ? { ...country, deliveryTime: time } : country,
      ),
    );
  }

  function updateCountryBoxPrice(catalogKey: string, rawPrice: string) {
    if (!selectedCountry) {
      return;
    }

    const digits = rawPrice.replace(/[^\d.]/g, "");
    const price = digits ? `$${digits}` : "$0";

    setCountries((current) =>
      current.map((country) =>
        country.name === selectedCountry
          ? {
              ...country,
              boxes: country.boxes.map((box) =>
                (box.catalogKey || box.size) === catalogKey ? { ...box, price } : box,
              ),
            }
          : country,
      ),
    );
  }

  function updateCountryBoxCost(catalogKey: string, rawCost: string) {
    if (!selectedCountry) {
      return;
    }

    const digits = rawCost.replace(/[^\d.]/g, "");
    const cost = digits ? `$${digits}` : "$0";

    setCountries((current) =>
      current.map((country) =>
        country.name === selectedCountry
          ? {
              ...country,
              boxes: country.boxes.map((box) =>
                (box.catalogKey || box.size) === catalogKey ? { ...box, cost } : box,
              ),
            }
          : country,
      ),
    );
  }

  function addCountryProduct(product: InventoryCatalogProduct) {
    const countryName = selectedCountry ?? activeCountry;

    if (!countryName) {
      return;
    }

    flushSync(() => {
      setCountries((current) => addProductToCountry(current, countryName, product));
    });
    void flushPendingSave();
    setCountryProductPickerOpen(true);
    notify.success(`${product.label} agregado a ${countryName}`);
  }

  function removeCountryProduct(catalogKey: string) {
    const countryName = selectedCountry ?? activeCountry;

    if (!countryName) {
      return;
    }

    const label = catalogProductsByKey.get(catalogKey)?.label ?? catalogKey;

    setCountries((current) =>
      removeProductFromCountry(current, countryName, catalogKey),
    );
    setPromotions((current) =>
      current.filter((promotion) => {
        if (promotion.countryName !== countryName) {
          return true;
        }

        return ![...promotion.rule.buy, ...promotion.rule.get].some(
          (line) => line.catalogKey === catalogKey,
        );
      }),
    );
    setCountryProductContextMenu(null);
    void flushPendingSave();
    notify.success(`${label} quitado de ${countryName}`);
  }

  function openNewPromotion() {
    if (!activeCountry) {
      return;
    }

    setCountryPriceTab("promotions");
    setPromotionEditor({
      mode: "new",
      draft: createBlankPromotion({
        id: localPromotionId(),
        countryName: activeCountry,
        sortOrder:
          selectedCountryPromotions.reduce(
            (max, promotion) => Math.max(max, promotion.sortOrder),
            -1,
          ) + 1,
      }),
    });
  }

  function openEditPromotion(promotion: PricingPromotionConfig) {
    setCountryPriceTab("promotions");
    setPromotionEditor({
      mode: "edit",
      draft: {
        ...promotion,
        rule: normalizeComboRule(promotion.rule),
      },
    });
  }

  function patchPromotionDraft(patch: Partial<PricingPromotionConfig>) {
    setPromotionEditor((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              ...patch,
              catalogKey: patch.rule
                ? primaryCatalogKey(patch.rule)
                : current.draft.catalogKey,
            },
          }
        : current,
    );
  }

  function savePromotionDraft() {
    if (!promotionEditor || !isPromotionRuleValid(promotionEditor.draft.rule)) {
      return;
    }

    const draft = {
      ...promotionEditor.draft,
      name: promotionEditor.draft.name.trim() || "Combo",
      countryName: activeCountry || promotionEditor.draft.countryName,
      catalogKey: primaryCatalogKey(promotionEditor.draft.rule),
      active: promotionEditor.mode === "new" ? true : promotionEditor.draft.active,
    };

    setPromotions((current) => {
      if (promotionEditor.mode === "edit") {
        return current.map((promotion) =>
          promotion.id === draft.id ? draft : promotion,
        );
      }

      return [...current, draft];
    });
    setPromotionEditor(null);
  }

  function togglePromotionActive(promotionId: string) {
    setPromotions((current) =>
      current.map((promotion) =>
        promotion.id === promotionId
          ? { ...promotion, active: !promotion.active }
          : promotion,
      ),
    );
  }

  function reorderCountryPromotions(orderedIds: string[]) {
    if (!activeCountry) {
      return;
    }

    const orderById = new Map(orderedIds.map((id, index) => [id, index]));

    setPromotions((current) =>
      current.map((promotion) => {
        if (promotion.countryName !== activeCountry) {
          return promotion;
        }

        const nextOrder = orderById.get(promotion.id);

        if (nextOrder === undefined) {
          return promotion;
        }

        return { ...promotion, sortOrder: nextOrder };
      }),
    );
  }

  function removePromotion(promotionId: string) {
    const promotion = promotions.find((entry) => entry.id === promotionId);

    if (
      !window.confirm(
        `¿Eliminar la promoción "${promotion?.name.trim() || "sin nombre"}"?`,
      )
    ) {
      return;
    }

    setPromotions((current) =>
      current.filter((entry) => entry.id !== promotionId),
    );

    if (promotionEditor?.draft.id === promotionId) {
      setPromotionEditor(null);
    }
  }

  function addDistributor() {
    const name = newDistributor.name.trim();

    if (!name) {
      return;
    }

    setDistributors((current) => [
      ...current,
      {
        name,
        contact: newDistributor.contact.trim() || "Sin contacto",
        phone: newDistributor.phone.trim() || "Sin teléfono",
        active: true,
      },
    ]);
    setNewDistributor(emptyDistributor);
    setShowDistributorForm(false);
  }

  function toggleDistributor(name: string) {
    setDistributors((current) =>
      current.map((distributor) =>
        distributor.name === name
          ? { ...distributor, active: !distributor.active }
          : distributor,
      ),
    );
  }

  function updateDistributorPrice(size: string, price: string) {
    if (!selectedDistributor || !selectedDistributorCountry || !selectedDistributorCountryData) {
      return;
    }

    const cleanPrice = price.replace("$", "");

    setDistributorPrices((current) => {
      const currentDistributor = current[selectedDistributor] || {};
      const currentBoxes = currentDistributor[selectedDistributorCountry] ||
        selectedDistributorCountryData.boxes;

      return {
        ...current,
        [selectedDistributor]: {
          ...currentDistributor,
          [selectedDistributorCountry]: currentBoxes.map((box) =>
            box.size === size ? { ...box, price: `$${cleanPrice}` } : box,
          ),
        },
      };
    });
  }

  const goBack = useCallback(() => {
    if (selectedDistributorCountry) {
      setSelectedDistributorCountry(null);
      return;
    }

    if (selectedDistributor) {
      setSelectedDistributor(null);
      return;
    }

    if (activeCountry) {
      if (countryFromUrl?.trim()) {
        router.replace("/configuracion?view=prices", { scroll: false });
        appliedCountryFromUrlRef.current = null;
      }
      setSelectedCountry(null);
      return;
    }

    openConfigSection("menu");
  }, [
    activeCountry,
    countryFromUrl,
    openConfigSection,
    router,
    selectedDistributor,
    selectedDistributorCountry,
  ]);

  const configNavTitle = useMemo(() => {
    if (section === "menu") {
      return undefined;
    }

    if (section === "plan") {
      return "Plan";
    }

    if (section === "prices") {
      if (activeCountry) {
        return activeCountry;
      }

      return "Países y precios";
    }

    if (section === "distributors") {
      if (selectedDistributor && selectedDistributorCountry) {
        return `${selectedDistributor} · ${selectedDistributorCountry}`;
      }

      if (selectedDistributor) {
        return `Precios de ${selectedDistributorData?.name || selectedDistributor}`;
      }

      return "Distribuidores";
    }

    if (section === "deliveries") {
      return "Logística";
    }

    if (section === "appearance") {
      return "Apariencia";
    }

    if (section === "company") {
      return "Empresa";
    }

    if (section === "users") {
      return "Usuarios";
    }

    if (section === "timeclock") {
      return "Control de horario";
    }

    return "Configuración";
  }, [
    activeCountry,
    section,
    selectedDistributor,
    selectedDistributorCountry,
    selectedDistributorData?.name,
  ]);

  useContextNav({
    title: configNavTitle ?? "Configuración",
    onBack: goBack,
    enabled: Boolean(configNavTitle),
  });

  useEffect(() => {
    if (section === "timeclock") {
      setShellConfig({ surfaceContextId: "timeclock.admin" });
      return () => setShellConfig({ surfaceContextId: undefined });
    }
  }, [section, setShellConfig]);

  const showSidebarNav = section !== "menu";
  const nestedPanelShell = showSidebarNav
    ? { className: "border-0 bg-transparent shadow-none", contentClassName: "p-0" }
    : {};

  function syncLinkedRouteSchedules(config: typeof routeConfig) {
    if (!config.linkedRouteSchedules) {
      return config;
    }

    return {
      ...config,
      pickupDays: [...config.deliveryDays],
      pickupRanges: [...config.deliveryRanges],
    };
  }

  function updateMinimumDeposit(rawPrice: string) {
    const digits = rawPrice.replace(/[^\d.]/g, "");
    const price = digits ? `$${digits}` : "$0";

    setRouteConfig((current) => ({
      ...current,
      minimumDeposit: price,
    }));
  }

  function toggleLinkedRouteSchedules() {
    setRouteConfig((current) => {
      const linkedRouteSchedules = !current.linkedRouteSchedules;

      return syncLinkedRouteSchedules({
        ...current,
        linkedRouteSchedules,
      });
    });
  }

  function addRouteRange(key: "deliveryRanges" | "pickupRanges", start: string, end: string) {
    if (!start || !end) {
      return;
    }

    const value = `${start}-${end}`;

    setRouteConfig((current) => {
      if (current[key].includes(value)) {
        return current;
      }

      return syncLinkedRouteSchedules({
        ...current,
        [key]: [...current[key], value].sort(),
      });
    });
  }

  function removeRouteRange(key: "deliveryRanges" | "pickupRanges", value: string) {
    setRouteConfig((current) =>
      syncLinkedRouteSchedules({
        ...current,
        [key]: current[key].filter((currentTime) => currentTime !== value),
      }),
    );
  }

  return (
    <>
      {!pricingBackendEnabled && section === "prices" ? (
        <p className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm font-bold text-amber-200">
          Supabase no está configurado. Los países y precios no se guardan al recargar.
        </p>
      ) : null}

      {section === "menu" ? (
        <div className="flex flex-col gap-5">
          {CONFIG_MENU_GROUPS.map((group) => (
            <ConfigNavGroup key={group.id} title={group.title} description={group.description}>
              {group.sectionIds.map((sectionId) => {
                const item = configSectionById.get(sectionId);
                if (!item) {
                  return null;
                }

                return (
                  <ConfigNavCard
                    key={item.id}
                    href={`/configuracion?view=${item.id}`}
                    title={item.title}
                    text={item.text}
                    icon={item.icon}
                    onboardingTarget={
                      item.id === "prices"
                        ? ONBOARDING_TARGETS.CONFIG_PRICES_CARD
                        : undefined
                    }
                  />
                );
              })}
            </ConfigNavGroup>
          ))}
        </div>
      ) : null}

      {section === "plan" ? (
        <Panel title="Plan" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <PlanSettingsPanel />
        </Panel>
      ) : null}

      {section === "prices" && !activeCountry && !pendingCountryFromUrl ? (
        <Panel
          title="Países y precios"
          hideHeader={showSidebarNav}
          className={
            showCountryPicker || countries.length === 0
              ? `${nestedPanelShell.className ?? ""} flex min-h-[calc(100dvh-8.5rem)] flex-col`.trim()
              : nestedPanelShell.className
          }
          contentClassName={
            showCountryPicker || countries.length === 0
              ? "flex min-h-0 flex-1 flex-col p-0"
              : nestedPanelShell.contentClassName
          }
        >
          <div
            className={`flex min-h-0 flex-1 flex-col ${
              countries.length > 0 && !showCountryPicker ? "gap-4" : "gap-0"
            }`}
          >
            {countries.length > 0 && !showCountryPicker ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowCountryPicker(true)}
                  className={flowToolbarCreateButtonClass}
                  data-onboarding-target={ONBOARDING_TARGETS.CONFIG_ADD_COUNTRY}
                >
                  <Plus className="h-4 w-4" />
                  Agregar país
                </button>
              </div>
            ) : null}

            {showCountryPicker || countries.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black bg-[#1a221f] shadow-[0_8px_24px_rgba(0,0,0,0.22)]">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/80 bg-[#1c2622] px-3 py-2.5 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
                      <Globe2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-wide text-[#f8fafc]">
                        Elegir país
                      </p>
                      <p className="text-xs font-bold text-slate-400">
                        {filteredCountryOptions.length
                          ? `${filteredCountryOptions.length} disponibles`
                          : "Sin coincidencias"}
                      </p>
                    </div>
                  </div>
                  {countries.length > 0 ? (
                    <button
                      type="button"
                      onClick={closeCountryPicker}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300 transition hover:bg-surface-card hover:text-[#f8fafc]"
                      aria-label="Cerrar"
                      title="Cerrar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
                  {sortedCountries.length > 0 ? (
                    <div className="shrink-0">
                      <p className="mb-2 text-xs font-black uppercase text-slate-400">
                        Configurados
                      </p>
                      <div className="grid auto-rows-min grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {sortedCountries.map((country) => (
                          <button
                            key={country.name}
                            type="button"
                            onClick={() => openConfiguredCountry(country.name)}
                            {...countryContextMenuProps(country.name)}
                            className="flex h-full min-h-[6.5rem] w-full cursor-context-menu flex-col items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-950/25 px-3 py-4 text-center transition hover:bg-emerald-950/40"
                          >
                            <CountryFlag code={resolveCountryCode(country)} size="md" />
                            <span className="line-clamp-2 min-w-0 text-sm font-black leading-snug text-[#f8fafc]">
                              {country.name}
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wide text-emerald-300">
                              Configurado
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="shrink-0">
                    <InlineSearchCombobox
                      value={countryQuery}
                      onChange={setCountryQuery}
                      options={countryPickerSearchOptions}
                      placeholder="Buscar por nombre…"
                      emptyLabel="Sin países"
                      ariaLabel="Buscar país"
                      leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                      className="w-full"
                      minWidthClass="w-full min-w-0"
                      onSelectOption={(option) => {
                        const country = countryOptions.find(
                          (entry) => (entry.code || entry.name) === option.value,
                        );

                        if (country) {
                          setPendingCountryToAdd(country);
                          setCountryQuery("");
                        }
                      }}
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
                    {filteredCountryOptions.length > 0 ? (
                      <p className="text-xs font-black uppercase text-slate-400">Agregar país</p>
                    ) : null}
                    {filteredCountryOptions.length > 0 ? (
                      <div
                        className="grid auto-rows-min grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4"
                        data-onboarding-target={ONBOARDING_TARGETS.CONFIG_COUNTRY_PICKER}
                      >
                        {filteredCountryOptions.map((country) => {
                          const isPending =
                            pendingCountryToAdd !== null &&
                            countryOptionKey(pendingCountryToAdd) === countryOptionKey(country);

                          return (
                            <div
                              key={country.code || country.name}
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setPendingCountryToAdd((current) =>
                                  current &&
                                  countryOptionKey(current) === countryOptionKey(country)
                                    ? null
                                    : country,
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setPendingCountryToAdd((current) =>
                                    current &&
                                    countryOptionKey(current) === countryOptionKey(country)
                                      ? null
                                      : country,
                                  );
                                }
                              }}
                              className={`flex h-full min-h-[6.5rem] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center transition ${
                                isPending
                                  ? "border-emerald-500 bg-emerald-950/30 ring-1 ring-emerald-500/35"
                                  : "border-black bg-[#3a4842] hover:bg-[#425048]"
                              }`}
                            >
                              <CountryFlag code={resolveCountryCode(country)} size="md" />
                              <span className="line-clamp-2 min-w-0 text-sm font-black leading-snug text-[#f8fafc]">
                                {country.name}
                              </span>
                              {isPending ? (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    addCountry(country);
                                  }}
                                  className="mt-0.5 inline-flex h-8 items-center justify-center rounded-lg border border-emerald-600 bg-emerald-400 px-4 text-xs font-black text-slate-950 transition hover:bg-emerald-300"
                                >
                                  Agregar
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex min-h-[5rem] items-center justify-center rounded-xl border border-dashed border-white/12 bg-surface-inset/40 px-4 text-center text-sm font-bold text-slate-400">
                        {countryQuery.trim()
                          ? "No hay países con ese nombre"
                          : "Ya agregaste todos los países disponibles"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {!showCountryPicker && countries.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {sortedCountries.map((country) => (
                <button
                  key={country.name}
                  onClick={() => setSelectedCountry(country.name)}
                  {...countryContextMenuProps(country.name)}
                  className="group relative min-h-40 cursor-context-menu overflow-hidden rounded-xl border border-black bg-surface-card p-5 text-left shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:border-emerald-700/35 hover:bg-surface-card-hover"
                >
                  <div className="relative flex h-full items-center justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <CountryFlag code={resolveCountryCode(country)} size="lg" />
                      <span className="min-w-0">
                        <span className="block truncate text-3xl font-black leading-tight">
                          {country.name}
                        </span>
                        <span className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-black bg-surface-panel px-3 text-sm font-black text-slate-300">
                            <Box className="h-4 w-4 text-slate-400" />
                            {country.boxes.length}{" "}
                            {country.boxes.length === 1 ? "producto" : "productos"}
                          </span>
                          {country.deliveryTime ? (
                            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-400 px-3 text-sm font-black text-slate-950">
                              <Clock className="h-4 w-4" />
                              {country.deliveryTime}
                            </span>
                          ) : (
                            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-black bg-surface-panel px-3 text-sm font-black text-slate-400">
                              <Clock className="h-4 w-4" />
                              Sin definir
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-panel text-slate-300 transition group-hover:border-black group-hover:bg-emerald-400 group-hover:text-slate-950">
                      <ChevronRight className="h-6 w-6" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {section === "prices" && activeCountry ? (
        <Panel
          hideHeader={showSidebarNav}
          {...nestedPanelShell}
          clipContent={false}
          title={
            <span className="flex items-center gap-3">
              <CountryFlag code={resolveCountryCode(selectedCountryData || { code: "", name: activeCountry || "" })} />
              <span>{activeCountry}</span>
            </span>
          }
        >
          <AppTabs
            className="mb-6"
            tabs={countryPriceTabs}
            value={countryPriceTab}
            onChange={setCountryPriceTab}
            ariaLabel="Secciones del país"
          />

          {countryPriceTab === "delivery" ? (
            <div className="w-fit max-w-full rounded-xl border border-black bg-surface-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-black text-[#f8fafc]">Tiempo de entrega</p>
                  <p className="text-xs font-bold text-slate-400">
                    Rango estimado de llegada al destino en {activeCountry}.
                  </p>
                </div>
              </div>
              <TimeRangeSelect
                value={selectedCountryData?.deliveryTime || ""}
                onChange={updateCountryTime}
              />
              {selectedCountryData?.code ? (
                <CountryCommercialServiceCosts destinationCode={selectedCountryData.code} />
              ) : null}
            </div>
          ) : null}

          {countryPriceTab === "items" ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                {(selectedCountryData?.boxes || []).length > 0 ? (
                  <p className="max-w-xl text-xs font-bold leading-relaxed text-slate-400">
                    Precio de venta en {activeCountry} para cada ítem del catálogo.
                  </p>
                ) : catalogProducts.length === 0 ? (
                  <p className="text-sm font-bold text-slate-400">
                    No hay productos en el catálogo. Créalos en{" "}
                    <Link href={inventarioReturnHref} className="text-emerald-400 hover:underline">
                      Inventario
                    </Link>
                    .
                  </p>
                ) : (
                  <span />
                )}

                {catalogProducts.length > 0 ? (
                  <div ref={countryProductAddRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setCountryProductPickerOpen((open) => !open)}
                      disabled={!hasAddableCatalogProducts}
                      className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-40`}
                      aria-expanded={countryProductPickerOpen}
                      data-onboarding-target={ONBOARDING_TARGETS.CONFIG_ADD_COUNTRY_PRODUCTS}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar ítems a {activeCountry}
                    </button>

                    {countryProductPickerOpen ? (
                      <div
                        className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-black bg-surface-card p-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                            Catálogo
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setCountryProductPickerOpen(false);
                              setCountryProductQuery("");
                            }}
                            className="h-8 rounded-lg border border-black bg-surface-inset px-3 text-xs font-black text-slate-300 transition hover:bg-surface-card-hover hover:text-[#f8fafc]"
                          >
                            Listo
                          </button>
                        </div>
                        <CountryCatalogAddPanel
                          products={catalogProducts}
                          assignedCatalogKeys={assignedCountryCatalogKeys}
                          query={countryProductQuery}
                          onQueryChange={setCountryProductQuery}
                          onAdd={addCountryProduct}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

          {(selectedCountryData?.boxes || []).length > 0 ? (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
                {(selectedCountryData?.boxes || []).map((box, boxIndex) => {
                  const boxKey = box.catalogKey || box.size;
                  const catalogProduct = box.catalogKey
                    ? catalogProductsByKey.get(box.catalogKey)
                    : undefined;
                  const profit = Math.max(parseMoney(box.price) - parseMoney(box.cost || "$0"), 0);

                  return (
                    <article
                      key={boxKey}
                      className="cursor-context-menu rounded-xl border border-black bg-surface-card p-3.5 shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
                      {...countryProductContextMenuProps(boxKey, box.size)}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`h-10 w-10 shrink-0 ${iconWellEmerald}`}>
                          <Package2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black leading-snug text-[#f8fafc]">
                            {box.size}
                          </p>
                          {catalogProduct ? (
                            <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
                              {catalogProduct.path}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2">
                        <label className="flex items-center justify-between gap-3 rounded-lg border border-black bg-surface-inset px-3 py-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                            Precio público
                          </span>
                          <span className="flex items-center gap-1 tabular-nums text-[#f8fafc]">
                            <DollarSign className="h-4 w-4 shrink-0 text-slate-400" />
                            <input
                              className="h-8 w-[4.5rem] border-0 bg-transparent p-0 text-center text-lg font-black text-[#f8fafc] outline-none placeholder:text-slate-500 focus:ring-0"
                              value={moneyInputDisplayValue(box.price)}
                              onChange={(event) =>
                                updateCountryBoxPrice(boxKey, event.target.value)
                              }
                              inputMode="decimal"
                              placeholder="0"
                              aria-label={`Precio de ${box.size}`}
                              data-onboarding-target={
                                boxIndex === 0
                                  ? ONBOARDING_TARGETS.CONFIG_COUNTRY_PRICE
                                  : undefined
                              }
                            />
                          </span>
                        </label>

                        <label className="flex items-center justify-between gap-3 rounded-lg border border-black bg-surface-inset px-3 py-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                            Tarifa interna base
                          </span>
                          <span className="flex items-center gap-1 tabular-nums text-[#f8fafc]">
                            <DollarSign className="h-4 w-4 shrink-0 text-slate-400" />
                            <input
                              className="h-8 w-[4.5rem] border-0 bg-transparent p-0 text-center text-lg font-black text-[#f8fafc] outline-none placeholder:text-slate-500 focus:ring-0"
                              value={moneyInputDisplayValue(box.cost || "$0")}
                              onChange={(event) =>
                                updateCountryBoxCost(boxKey, event.target.value)
                              }
                              inputMode="decimal"
                              placeholder="0"
                              aria-label={`Costo de ${box.size}`}
                            />
                          </span>
                        </label>

                        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-700/40 bg-emerald-950/25 px-3 py-2">
                          <span className="text-[10px] font-black uppercase tracking-wide text-emerald-400/80">
                            Ganancia
                          </span>
                          <span className="flex items-center gap-1 tabular-nums text-emerald-300">
                            <DollarSign className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="text-lg font-black">{profit}</span>
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="mt-2 rounded-xl border border-dashed border-slate-600/60 p-8">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (catalogProducts.length === 0) {
                      router.push(inventarioReturnHref);
                      return;
                    }

                    setCountryProductPickerOpen(true);
                  }}
                  className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-emerald-400/70 bg-emerald-400/15 text-emerald-300 shadow-[0_12px_28px_rgba(16,185,129,0.18)] transition hover:scale-[1.02] hover:bg-emerald-400/25"
                  aria-label={
                    catalogProducts.length === 0
                      ? "Ir a Inventario"
                      : `Agregar ítems a ${activeCountry}`
                  }
                >
                  <Plus className="h-10 w-10" strokeWidth={2.5} />
                </button>
                <h3 className="mt-5 text-lg font-black text-[#f8fafc]">
                  Aún no hay items para{" "}
                  <CountryName name={activeCountry || ""} size="sm" labelClassName="font-black" />.
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-400">
                  {catalogProducts.length === 0
                    ? "Primero crea productos en Inventario y luego asígnalos a este país."
                    : `Selecciona productos del catálogo para vender envíos a ${activeCountry}.`}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {catalogProducts.length === 0 ? (
                    <Link
                      href={inventarioReturnHref}
                      className={primaryButtonClass}
                      data-onboarding-target={ONBOARDING_TARGETS.CONFIG_GO_INVENTARIO}
                    >
                      <Plus className="h-4 w-4" />
                      Ir a Inventario
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCountryProductPickerOpen(true)}
                      disabled={!hasAddableCatalogProducts}
                      className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar ítems a {activeCountry}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

            </>
          ) : null}

          {countryPriceTab === "promotions" ? (
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {!comboBuilderProducts.length && !promotionEditor ? (
                <p className="text-xs font-bold text-amber-300/90">
                  Agrega productos en Items primero.
                </p>
              ) : (
                <span />
              )}
              {!promotionEditor ? (
              <button
                type="button"
                onClick={openNewPromotion}
                disabled={!comboBuilderProducts.length}
                className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <Plus className="h-4 w-4" />
                Nueva promoción
              </button>
              ) : null}
            </div>

            {promotionEditor ? (
              <div className="mb-4 rounded-xl border border-black bg-surface-card p-4 lg:p-5">
                <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-300">
                      {promotionEditor.mode === "new" ? "Nueva promoción" : "Editar promoción"}
                    </span>
                    <input
                      className={`${inputClass} placeholder:text-slate-400`}
                      value={promotionEditor.draft.name}
                      placeholder="Ej: 2 grandes + chica mitad"
                      onChange={(event) =>
                        patchPromotionDraft({ name: event.target.value })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      patchPromotionDraft({ active: !promotionEditor.draft.active })
                    }
                    className={`h-10 shrink-0 self-start rounded-lg border px-4 text-xs font-black uppercase transition ${
                      promotionEditor.draft.active
                        ? "border-emerald-600 bg-emerald-400 text-slate-950"
                        : "border-black bg-surface-inset text-slate-400"
                    }`}
                  >
                    {promotionEditor.draft.active ? "Activa" : "Pausada"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromotionEditor(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-md text-slate-400 hover:bg-surface-card-hover hover:text-[#f8fafc] lg:justify-self-end"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <ComboBuilder
                  rule={promotionEditor.draft.rule}
                  onChange={(rule) => patchPromotionDraft({ rule })}
                  products={comboBuilderProducts}
                />

                <div className="mt-4 flex flex-wrap gap-2 border-t border-black pt-4">
                  <button
                    type="button"
                    onClick={savePromotionDraft}
                    disabled={!isPromotionRuleValid(promotionEditor.draft.rule)}
                    className={`${primaryButtonClass} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    Guardar promoción
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromotionEditor(null)}
                    className="h-11 rounded-lg border border-black px-5 font-black"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}

            {selectedCountryPromotions.length ? (
              <PromotionSortableList
                promotions={selectedCountryPromotions}
                productLabels={comboProductLabels}
                onReorder={reorderCountryPromotions}
                onEdit={openEditPromotion}
                onToggleActive={togglePromotionActive}
                onRemove={removePromotion}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-600/60 px-4 py-6 text-center">
                <Tags className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 text-sm font-bold text-slate-400">
                  Sin promociones para este país.
                </p>
              </div>
            )}
          </section>
          ) : null}
        </Panel>
      ) : null}

      {section === "distributors" && !selectedDistributor ? (
        <Panel title="Distribuidores" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <div className="mb-5 grid gap-3">
            <button
              onClick={() => setShowDistributorForm((current) => !current)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 text-sm font-black text-slate-950 sm:w-fit"
            >
              <Plus className="h-6 w-6" />
              Crear distribuidor
            </button>

            {showDistributorForm ? (
              <div className="rounded-xl border border-black bg-surface-card p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ["Nombre", "name", "Ej: MGS"],
                    ["Contacto", "contact", "Ej: Operaciones"],
                    ["Teléfono", "phone", "Ej: (305) 000-0000"],
                  ].map(([label, key, placeholder]) => (
                    <label key={key} className="grid gap-2">
                      <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                        {label}
                      </span>
                      <input
                        className={inputClass}
                        placeholder={placeholder}
                        value={newDistributor[key as keyof typeof newDistributor]}
                        onChange={(event) =>
                          setNewDistributor((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={addDistributor}
                    className={primaryButtonClass}
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setNewDistributor(emptyDistributor);
                      setShowDistributorForm(false);
                    }}
                    className="h-11 rounded-lg border border-black px-5 font-black border-black"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {distributors.map((distributor) => (
              <div
                key={distributor.name}
                onClick={() => setSelectedDistributor(distributor.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSelectedDistributor(distributor.name);
                  }
                }}
                className="relative overflow-hidden rounded-lg border border-black bg-surface-card p-5 shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition hover:bg-surface-card-hover"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-400 text-slate-950">
                    <Truck className="h-8 w-8" />
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleDistributor(distributor.name);
                    }}
                    className={`h-9 rounded-full px-4 text-sm font-black ${
                      distributor.active
                        ? "border border-emerald-600 bg-emerald-400 text-slate-950"
                        : "bg-surface-inset text-slate-300"
                    }`}
                  >
                    {distributor.active ? "Activo" : "Inactivo"}
                  </button>
                </div>
                <p className="mt-5 text-3xl font-black leading-tight">{distributor.name}</p>
                <p className="mt-2 text-base font-bold text-slate-300">
                  {distributor.contact} · {distributor.phone}
                </p>
                <div className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950 px-4 text-sm font-black">
                  Configurar precios
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {section === "distributors" && selectedDistributor && !selectedDistributorCountry ? (
        <Panel
          hideHeader={showSidebarNav}
          {...nestedPanelShell}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <Truck className="h-7 w-7 text-slate-400" />
              <span>Editando precios de {selectedDistributorData?.name}</span>
            </span>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {sortedCountries.map((country) => (
              <button
                key={country.name}
                onClick={() => setSelectedDistributorCountry(country.name)}
                className="group relative min-h-36 overflow-hidden rounded-lg border border-black bg-surface-card p-5 text-left shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition hover:bg-surface-card-hover"
              >
                <div className="relative flex h-full items-center justify-between gap-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <CountryFlag code={resolveCountryCode(country)} size="lg" />
                    <span className="min-w-0">
                      <span className="block truncate text-3xl font-black leading-tight">
                        {country.name}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-black bg-surface-panel px-3 text-sm font-black text-slate-300">
                          <Box className="h-4 w-4 text-slate-400" />
                          {country.boxes.length}{" "}
                          {country.boxes.length === 1 ? "producto" : "productos"}
                        </span>
                        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-400 text-slate-950 px-3 text-sm font-black">
                          Editar precios
                        </span>
                      </span>
                    </span>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-panel text-slate-300 transition group-hover:border-black group-hover:bg-emerald-400 group-hover:text-slate-950">
                    <ChevronRight className="h-6 w-6" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {section === "distributors" && selectedDistributor && selectedDistributorCountry ? (
        <Panel
          hideHeader={showSidebarNav}
          {...nestedPanelShell}
          title={
            <span className="flex flex-wrap items-center gap-3">
              <Truck className="h-7 w-7 text-slate-400" />
              <span>
                {selectedDistributor} · {selectedDistributorCountry}
              </span>
            </span>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
            {selectedDistributorBoxes.map((box) => {
              const publicPrice =
                selectedDistributorCountryData?.boxes.find(
                  (publicBox) => publicBox.size === box.size,
                )?.price || box.price;
              const profit = parseMoney(publicPrice) - parseMoney(box.price);

              return (
                <div
                  key={box.size}
                  className="relative overflow-hidden rounded-lg border border-black bg-surface-card p-5 shadow-[0_14px_34px_rgba(0,0,0,0.34)]"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-400 text-slate-950 text-slate-400">
                      <Box className="h-8 w-8" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black uppercase text-slate-400 text-slate-400">
                        Producto
                      </span>
                      <span className="block whitespace-nowrap text-2xl font-black leading-tight text-slate-300">
                        {box.size}
                      </span>
                    </span>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex h-14 items-center justify-between gap-4 rounded-xl border border-black bg-surface-panel px-4">
                      <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                        Público general
                      </span>
                      <span className="flex h-10 w-28 items-center justify-center gap-1 text-[#f8fafc]">
                        <DollarSign className="h-5 w-5 shrink-0" />
                        <span className="text-2xl font-black leading-10">
                          {publicPrice.replace("$", "")}
                        </span>
                      </span>
                    </div>

                    <label className="flex h-14 items-center justify-between gap-4 rounded-xl border border-emerald-600 bg-emerald-400 px-4 text-slate-950">
                      <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                        Precio distribuidor
                      </span>
                      <span className="flex h-10 w-28 items-center justify-center gap-1 text-slate-400">
                        <DollarSign className="h-5 w-5 shrink-0" />
                        <input
                          className="h-10 w-20 rounded-none border-0 bg-transparent px-0 text-center text-2xl font-black leading-10 text-[#f8fafc] outline-none focus:ring-0"
                          style={{ background: "transparent" }}
                          value={moneyInputDisplayValue(box.price)}
                          onChange={(event) =>
                            updateDistributorPrice(box.size, event.target.value)
                          }
                        />
                      </span>
                    </label>

                    <div className="flex h-14 items-center justify-between gap-4 rounded-xl border border-black bg-surface-panel px-4">
                      <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                        Ganancia
                      </span>
                      <span className="flex h-10 w-28 items-center justify-center gap-1 text-slate-400">
                        <DollarSign className="h-5 w-5 shrink-0" />
                        <span className="text-2xl font-black leading-10 text-[#f8fafc]">
                          {profit}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {section === "deliveries" ? (
        <Panel title="Logística" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-black bg-surface-card p-4 xl:col-span-2">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-panel text-slate-400">
                  <DollarSign className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-black">Cobro inicial</span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-400">
                    Monto mínimo para abrir invoice.
                  </span>
                </span>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-lg border border-black bg-[#1a2320] px-3 py-2.5 md:max-w-xl">
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#f8fafc]">
                      Depósito mínimo obligatorio
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold leading-snug text-slate-500">
                      Monto mínimo al abrir invoice. El cliente puede pagar más.
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 tabular-nums text-[#f8fafc]">
                    <DollarSign className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <input
                      className="h-8 w-[4rem] border-0 bg-transparent p-0 text-right text-lg font-black outline-none focus:ring-0"
                      value={routeConfig.minimumDeposit.replace("$", "")}
                      onChange={(event) => updateMinimumDeposit(event.target.value)}
                      inputMode="decimal"
                      placeholder="20"
                      aria-label="Depósito mínimo obligatorio"
                    />
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-black bg-surface-card p-3 xl:col-span-2">
              <button
                type="button"
                onClick={toggleLinkedRouteSchedules}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left ${
                  routeConfig.linkedRouteSchedules
                    ? "border-emerald-600 bg-emerald-400 text-slate-950"
                    : "border-black bg-[#1a2320] text-[#f8fafc]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-black">Mismos horarios para entrega y recolección</span>
                  <span
                    className={`mt-0.5 block text-xs font-bold leading-snug ${
                      routeConfig.linkedRouteSchedules ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    Un solo calendario para llevar la caja vacía y recoger la llena.
                  </span>
                </span>
                <span
                  className={`h-6 w-11 shrink-0 rounded-full p-1 transition ${
                    routeConfig.linkedRouteSchedules ? "bg-slate-950/20" : "bg-surface-card"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 rounded-full bg-slate-950 transition ${
                      routeConfig.linkedRouteSchedules ? "translate-x-5 bg-emerald-50" : "bg-slate-400"
                    }`}
                  />
                </span>
              </button>
            </div>

            {(routeConfig.linkedRouteSchedules
              ? [
                  {
                    title: "Entrega y recolección",
                    text: "Días y horarios compartidos para ambos servicios a domicilio.",
                    daysKey: "deliveryDays" as const,
                    rangesKey: "deliveryRanges" as const,
                    newRange: newDeliveryRange,
                    setNewRange: setNewDeliveryRange,
                  },
                ]
              : [
                  {
                    title: "Dejar",
                    text: "Horarios para llevar la caja al cliente.",
                    daysKey: "deliveryDays" as const,
                    rangesKey: "deliveryRanges" as const,
                    newRange: newDeliveryRange,
                    setNewRange: setNewDeliveryRange,
                  },
                  {
                    title: "Recoger",
                    text: "Horarios para recoger la caja en domicilio.",
                    daysKey: "pickupDays" as const,
                    rangesKey: "pickupRanges" as const,
                    newRange: newPickupRange,
                    setNewRange: setNewPickupRange,
                  },
                ]
            ).map((route) => (
              <div
                key={route.title}
                className={`rounded-xl border border-black bg-surface-card p-4 ${
                  routeConfig.linkedRouteSchedules ? "xl:col-span-2" : ""
                }`}
              >
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-panel text-slate-400">
                    <Truck className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl font-black leading-tight">
                      {route.title}
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-300">
                      {route.text}
                    </span>
                  </span>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-lg border border-black bg-surface-inset px-3 py-2.5">
                    <p className="text-sm font-black text-[#f8fafc]">Días de servicio</p>
                    <p className="mt-0.5 text-xs font-bold text-slate-500">
                      Se gestionan junto con las rutas semanales.
                    </p>
                    <Link
                      href="/logistica?view=rutas"
                      className="mt-2 inline-flex text-xs font-black text-emerald-300 underline underline-offset-4"
                    >
                      Gestionar rutas
                    </Link>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-black uppercase text-slate-400">
                      Rangos disponibles
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {routeConfig[route.rangesKey].map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => removeRouteRange(route.rangesKey, range)}
                          className="group inline-flex h-10 items-center gap-2 rounded-lg border border-black bg-surface-card-header px-3 text-sm font-black text-[#f8fafc]"
                          title="Quitar rango"
                        >
                          {formatRouteRange(range)}
                          <X className="h-4 w-4 opacity-60 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <TimePickerInput
                        value={route.newRange.start}
                        ariaLabel="Hora inicio de rango"
                        shellClassName="!h-11"
                        onChange={(start) =>
                          route.setNewRange((current) => ({
                            ...current,
                            start,
                          }))
                        }
                      />
                      <TimePickerInput
                        value={route.newRange.end}
                        ariaLabel="Hora fin de rango"
                        shellClassName="!h-11"
                        onChange={(end) =>
                          route.setNewRange((current) => ({
                            ...current,
                            end,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addRouteRange(route.rangesKey, route.newRange.start, route.newRange.end);
                          route.setNewRange({ start: "", end: "" });
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-400 text-slate-950"
                        title="Agregar rango"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-black bg-surface-card p-4 shadow-[0_14px_34px_rgba(0,0,0,0.34)] xl:col-span-2">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-panel text-slate-400">
                  <Clock className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-xl font-black">Reglas generales</span>
                  <span className="mt-1 block text-sm font-bold text-slate-300">
                    Opciones que aplican a entrega y recolección.
                  </span>
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-400">
                    Anticipación mínima
                  </span>
                  <InlineSearchPicker
                    compact={false}
                    className="w-full"
                    minWidthClass="w-full min-w-0"
                    value={routeConfig.routeLeadTime}
                    onChange={(value) =>
                      setRouteConfig((current) => ({
                        ...current,
                        routeLeadTime: value,
                      }))
                    }
                    options={ROUTE_LEAD_TIME_OPTIONS}
                    placeholder="Elegir anticipación"
                    searchPlaceholder="Buscar…"
                    ariaLabel="Anticipación mínima"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setRouteConfig((current) => ({
                      ...current,
                      pendingAllowed: !current.pendingAllowed,
                    }))
                  }
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left font-black ${
                    routeConfig.pendingAllowed
                      ? "border border-emerald-600 bg-emerald-400 text-slate-950"
                      : "border-black bg-surface-panel text-[#f8fafc]"
                  }`}
                >
                  Permitir dejar pendiente
                  <span
                    className={`h-6 w-11 rounded-full p-1 transition ${
                      routeConfig.pendingAllowed ? "bg-emerald-400" : "bg-surface-card"
                    }`}
                  >
                    <span
                      className={`block h-4 w-4 rounded-full bg-slate-950 transition ${
                        routeConfig.pendingAllowed ? "translate-x-5" : ""
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {section === "appearance" ? (
        <Panel title="Apariencia" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <AppearanceSettingsPanel />
        </Panel>
      ) : null}

      {section === "company" ? (
        <Panel title="Empresa" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <CompanySettingsPanel />
        </Panel>
      ) : null}

      {section === "users" ? <UsersSettingsPanel /> : null}

      {section === "timeclock" ? (
        <TimeClockAdminClient
          initialSnapshot={timeClockInitialSnapshot}
          canManage={canManageTimeClock}
        />
      ) : null}

      {countryProductContextMenu ? (
        <div
          role="menu"
          data-country-product-context-menu
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{
            left: countryProductContextMenu.x,
            top: countryProductContextMenu.y,
          }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-black px-3 py-2">
            <p className="truncate text-sm font-black text-[#f8fafc]">
              {countryProductContextMenu.label}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-rose-200 hover:bg-[#3A1818]"
            onClick={() => removeCountryProduct(countryProductContextMenu.catalogKey)}
          >
            <Trash2 className="h-4 w-4" />
            Quitar del país
          </button>
        </div>
      ) : null}

      {countryContextMenu ? (
        <div
          role="menu"
          data-country-context-menu
          className="fixed z-50 w-52 overflow-hidden rounded-lg border border-black bg-surface-card shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          style={{ left: countryContextMenu.x, top: countryContextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="border-b border-black px-3 py-2">
            <CountryName
              name={countryContextMenu.name}
              size="sm"
              labelClassName="text-sm font-black text-[#f8fafc]"
            />
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-black text-rose-200 hover:bg-[#3A1818]"
            onClick={() => removeCountry(countryContextMenu.name)}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar país
          </button>
        </div>
      ) : null}
    </>
  );
}
