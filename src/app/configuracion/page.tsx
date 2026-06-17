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
  Palette,
  Plus,
  Search,
  Trash2,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
} from "react";
import { CompanySettingsPanel } from "@/components/config/company-settings-panel";
import { PlanSettingsPanel } from "@/components/config/plan-settings-panel";
import { InventoryConfigSection as InventoryCategoriesPanel } from "@/components/config/inventory-config-section";
import { UsersSettingsPanel } from "@/components/config/users-settings-panel";
import { WarehousesSettingsPanel } from "@/components/config/warehouses-settings-panel";
import { useContextNav } from "@/hooks/use-context-nav";
import { usePricingBackend } from "@/hooks/use-pricing-backend";
import { inputClass, iconWellEmerald, Panel, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { flowToolbarCreateButtonClass } from "@/components/flow-form-styles";
import { InlineSearchCombobox, InlineSearchPicker } from "@/components/inline-search-picker";
import {
  COUNTRY_OPTIONS,
  compareCountriesByCatalogOrder,
  findCountryByNormalizedName,
  isCountryAlreadyConfigured,
  resolveCountryCode,
  type CountryOption,
} from "@/lib/country-options";
import {
  addProductToCountry,
  removeProductFromCountry,
  type InventoryCatalogProduct,
} from "@/lib/pricing-catalog";

const ROUTE_LEAD_TIME_OPTIONS = [
  { value: "1 dia", label: "1 dia" },
  { value: "2 dias", label: "2 dias" },
  { value: "3 dias", label: "3 dias" },
  { value: "1 semana", label: "1 semana" },
];

type Section = "menu" | "plan" | "prices" | "distributors" | "inventory" | "deliveries" | "appearance" | "company" | "users";
type InventoryConfigSection = "menu" | "categories" | "warehouses";

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
    id: "inventory" as Section,
    title: "Inventario",
    text: "Catálogo de categorías, ítems y bodegas.",
    icon: Box,
  },
  {
    id: "deliveries" as Section,
    title: "Rutas y horarios",
    text: "Horarios de entrega y recolección.",
    icon: Clock,
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
];

const configNavCardClass =
  "group flex min-h-[10.5rem] min-w-0 flex-col rounded-xl border border-black bg-surface-card p-5 text-left shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition hover:border-emerald-700/35 hover:bg-surface-card-hover";

function ConfigNavCard({
  href,
  title,
  text,
  icon: Icon,
  badge,
}: {
  href: string;
  title: string;
  text: string;
  icon: LucideIcon;
  badge?: string;
}) {
  return (
    <Link href={href} className={configNavCardClass}>
      <span className={`h-12 w-12 shrink-0 ${iconWellEmerald}`}>
        <Icon className="h-7 w-7" />
      </span>
      <span className="mt-5 block break-words text-2xl font-black leading-snug text-[#f8fafc]">
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

const weekDays = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const configSections: Section[] = [
  "menu",
  "plan",
  "prices",
  "distributors",
  "inventory",
  "deliveries",
  "appearance",
  "company",
  "users",
];

function parseConfigUrl(params: URLSearchParams) {
  const open = params.get("open");
  const view = params.get("view");

  if (open === "inventory") {
    const inventory = params.get("inventory");
    return {
      section: "inventory" as Section,
      inventorySection:
        inventory === "warehouses"
          ? ("warehouses" as InventoryConfigSection)
          : ("categories" as InventoryConfigSection),
    };
  }

  return {
    section: configSections.includes(view as Section) ? (view as Section) : ("menu" as Section),
    inventorySection:
      params.get("inventory") === "categories"
        ? ("categories" as InventoryConfigSection)
        : params.get("inventory") === "warehouses"
          ? ("warehouses" as InventoryConfigSection)
          : ("menu" as InventoryConfigSection),
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

function CountryFlag({
  code,
  size = "sm",
}: {
  code: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-12 w-16 text-sm" : size === "md" ? "h-10 w-14 text-xs" : "h-5 w-8 text-[10px]";

  if (!code) {
    return (
      <span
        className={`flex items-center justify-center rounded-md bg-surface-card font-black text-slate-300 ${sizeClass}`}
      >
        --
      </span>
    );
  }

  return (
    <span
      className={`block overflow-hidden rounded-md border border-black bg-cover bg-center shadow-sm ${sizeClass}`}
      style={{
        backgroundImage: `url(https://flagcdn.com/w80/${code.toLowerCase()}.png)`,
      }}
    />
  );
}

function parseDeliveryTime(value: string) {
  const match = value.match(/^(\d+)(?:-(\d+))?\s+(dia|dias|semana|semanas)$/);
  const unit: TimeUnit = match?.[3]?.startsWith("semana") ? "semanas" : "dias";
  const start = Number(match?.[1] || 5);
  const end = Number(match?.[2] || match?.[1] || 8);

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
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  const unitRef = useRef<HTMLButtonElement>(null);
  const range = parseDeliveryTime(value);
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

export default function ConfiguracionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cleanedFromRef = useRef(false);
  const openedInventoryHashRef = useRef(false);
  const { section, inventorySection: inventoryConfigSection } = useMemo(
    () => parseConfigUrl(searchParams),
    [searchParams],
  );
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countryContextMenu, setCountryContextMenu] = useState<CountryContextMenu | null>(null);
  const [showCountryProductPicker, setShowCountryProductPicker] = useState(false);
  const [countryProductQuery, setCountryProductQuery] = useState("");
  const {
    error: pricingError,
    loaded: pricingLoaded,
    countries,
    setCountries,
    catalogProducts,
    distributors,
    setDistributors,
    distributorPrices,
    setDistributorPrices,
    routeConfig,
    setRouteConfig,
    reload: reloadPricing,
  } = usePricingBackend();
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
  const pendingCountryFromUrl = Boolean(
    section === "prices" && countryFromUrl?.trim() && !pricingLoaded,
  );
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null);
  const [selectedDistributorCountry, setSelectedDistributorCountry] = useState<string | null>(null);
  const [showDistributorForm, setShowDistributorForm] = useState(false);
  const [newDistributor, setNewDistributor] = useState(emptyDistributor);
  const [returnToInventory, setReturnToInventory] = useState(false);
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
          .map((box) => box.catalogKey)
          .filter((key): key is string => Boolean(key)),
      ),
    [selectedCountryData],
  );
  const availableCountryProducts = useMemo(
    () =>
      catalogProducts.filter((product) => !assignedCountryCatalogKeys.has(product.catalogKey)),
    [assignedCountryCatalogKeys, catalogProducts],
  );
  const countryProductPickerOptions = useMemo(
    () =>
      availableCountryProducts.map((product) => ({
        value: product.catalogKey,
        label: product.label,
        searchText: product.path,
      })),
    [availableCountryProducts],
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
    return countryOptions
      .filter((country) => !isCountryAlreadyConfigured(country, countries))
      .map((country) => ({
        value: country.code || country.name,
        label: country.name,
      }));
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
      setSelectedCountry(configured.name);
      setShowCountryPicker(false);
      appliedCountryFromUrlRef.current = requestedCountry;
      return;
    }

    const option = findCountryByNormalizedName(requestedCountry, COUNTRY_OPTIONS);
    if (option) {
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
            deliveryTime: "5-8 dias",
            boxes: [],
          },
        ].sort(compareCountriesByCatalogOrder);
      });
      setSelectedCountry(option.name);
      setShowCountryPicker(false);
      appliedCountryFromUrlRef.current = requestedCountry;
      return;
    }

    setCountryQuery(requestedCountry);
    setShowCountryPicker(true);
    appliedCountryFromUrlRef.current = requestedCountry;
  }, [section, countryFromUrl, countries, pricingLoaded, setCountries]);

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

    setSelectedCountry(null);
    setCountryQuery("");
    setShowCountryPicker(false);
    setShowCountryProductPicker(false);
    setCountryProductQuery("");
    setCountryContextMenu(null);
  }, [section]);

  useEffect(() => {
    if (section === "distributors") {
      return;
    }

    setSelectedDistributor(null);
    setSelectedDistributorCountry(null);
    setShowDistributorForm(false);
  }, [section]);

  useEffect(() => {
    if (!countryContextMenu) {
      return;
    }

    const closeMenuOnPointerDown = (event: Event) => {
      if (event instanceof PointerEvent && event.button === 2) {
        return;
      }

      const target = event.target;

      if (target instanceof Element && target.closest("[data-country-context-menu]")) {
        return;
      }

      setCountryContextMenu(null);
    };

    const closeMenuOnScroll = () => {
      setCountryContextMenu(null);
    };

    window.addEventListener("pointerdown", closeMenuOnPointerDown);
    window.addEventListener("scroll", closeMenuOnScroll, true);

    return () => {
      window.removeEventListener("pointerdown", closeMenuOnPointerDown);
      window.removeEventListener("scroll", closeMenuOnScroll, true);
    };
  }, [countryContextMenu]);

  const openConfigSection = useCallback((nextSection: Section) => {
    if (nextSection === "menu") {
      router.replace("/configuracion", { scroll: false });
      return;
    }

    router.replace(`/configuracion?view=${nextSection}`, { scroll: false });
  }, [router]);

  const openInventoryConfigSection = useCallback((nextSection: InventoryConfigSection) => {
    router.replace(`/configuracion?view=inventory&inventory=${nextSection}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (cleanedFromRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "inventario") {
      return;
    }

    cleanedFromRef.current = true;
    queueMicrotask(() => {
      setReturnToInventory(true);
    });
    window.sessionStorage.setItem("return-to-inventory", "1");

    params.delete("from");
    const query = params.toString();
    router.replace(query ? `/configuracion?${query}` : "/configuracion", { scroll: false });
  }, [router]);

  useEffect(() => {
    if (openedInventoryHashRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const open = params.get("open");

    if (open === "inventory") {
      openedInventoryHashRef.current = true;
      queueMicrotask(() => {
        setReturnToInventory(window.sessionStorage.getItem("return-to-inventory") === "1");
      });
      router.replace("/configuracion?view=inventory&inventory=categories", { scroll: false });
      return;
    }

    if (window.location.hash !== "#inventory") {
      return;
    }

    openedInventoryHashRef.current = true;
    queueMicrotask(() => {
      setReturnToInventory(window.sessionStorage.getItem("return-to-inventory") === "1");
    });
    router.replace("/configuracion?view=inventory&inventory=categories", { scroll: false });
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

  function removeCountry(countryName: string) {
    setCountries((current) => current.filter((country) => country.name !== countryName));
    setDistributorPrices((current) => {
      const next: typeof current = {};

      for (const [distributor, pricesByCountry] of Object.entries(current)) {
        const { [countryName]: _removed, ...rest } = pricesByCountry;
        next[distributor] = rest;
      }

      return next;
    });

    if (selectedCountry === countryName) {
      setSelectedCountry(null);
    }

    if (selectedDistributorCountry === countryName) {
      setSelectedDistributorCountry(null);
    }

    setCountryContextMenu(null);
  }

  function openConfiguredCountry(countryName: string) {
    setCountryQuery("");
    setShowCountryPicker(false);
    setSelectedCountry(countryName);
  }

  function addCountry(country: CountryOption) {
    setCountries((current) =>
      [
        ...current,
        {
          code: country.code,
          name: country.name,
          deliveryTime: "5-8 dias",
          boxes: [],
        },
      ].sort(compareCountriesByCatalogOrder),
    );
    setCountryQuery("");
    setShowCountryPicker(false);
    setSelectedCountry(country.name);
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

  function addCountryProduct(product: InventoryCatalogProduct) {
    if (!selectedCountry) {
      return;
    }

    setCountries((current) => addProductToCountry(current, selectedCountry, product));
    setCountryProductQuery("");
    setShowCountryProductPicker(false);
  }

  function removeCountryProduct(catalogKey: string) {
    if (!selectedCountry) {
      return;
    }

    setCountries((current) =>
      removeProductFromCountry(current, selectedCountry, catalogKey),
    );
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
    if (returnToInventory && section === "inventory") {
      window.sessionStorage.removeItem("return-to-inventory");
      router.push("/inventario");
      return;
    }

    if (section === "inventory" && inventoryConfigSection !== "menu") {
      openInventoryConfigSection("menu");
      return;
    }

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
    inventoryConfigSection,
    openConfigSection,
    openInventoryConfigSection,
    returnToInventory,
    router,
    section,
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

    if (section === "inventory") {
      if (inventoryConfigSection === "warehouses") {
        return "Bodegas";
      }

      if (inventoryConfigSection === "categories") {
        return "Categorías e ítems";
      }

      return "Inventario";
    }

    if (section === "prices") {
      if (activeCountry) {
        return `${activeCountry} · tiempos y productos`;
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
      return "Rutas y horarios";
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

    return "Configuración";
  }, [
    activeCountry,
    inventoryConfigSection,
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

  const showSidebarNav = section !== "menu";
  const nestedPanelShell = showSidebarNav
    ? { className: "border-0 bg-transparent shadow-none", contentClassName: "p-0" }
    : {};

  function toggleRouteDay(key: "deliveryDays" | "pickupDays", day: string) {
    setRouteConfig((current) => {
      const active = current[key].includes(day);

      return {
        ...current,
        [key]: active
          ? current[key].filter((currentDay) => currentDay !== day)
          : [...current[key], day],
      };
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

      return {
        ...current,
        [key]: [...current[key], value].sort(),
      };
    });
  }

  function removeRouteRange(key: "deliveryRanges" | "pickupRanges", value: string) {
    setRouteConfig((current) => ({
      ...current,
      [key]: current[key].filter((currentTime) => currentTime !== value),
    }));
  }

  return (
    <>
      {pricingError && section !== "menu" ? (
        <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
          {pricingError}
        </p>
      ) : null}

      {section === "menu" ? (
        <>
          {pricingError ? (
            <p className="mb-4 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
              {pricingError}
            </p>
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {sections.map((item) => (
              <ConfigNavCard
                key={item.id}
                href={`/configuracion?view=${item.id}`}
                title={item.title}
                text={item.text}
                icon={item.icon}
              />
            ))}
          </div>
        </>
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
                      onClick={() => {
                        setCountryQuery("");
                        setShowCountryPicker(false);
                      }}
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
                          addCountry(country);
                        }
                      }}
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5">
                    {filteredCountryOptions.length > 0 ? (
                      <p className="text-xs font-black uppercase text-slate-400">Agregar país</p>
                    ) : null}
                    {filteredCountryOptions.length > 0 ? (
                      <div className="grid auto-rows-min grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredCountryOptions.map((country) => (
                          <button
                            key={country.code || country.name}
                            type="button"
                            onClick={() => addCountry(country)}
                            className="flex h-full min-h-[6.5rem] w-full flex-col items-center justify-center gap-2.5 rounded-xl border border-black bg-[#3a4842] px-3 py-4 text-center transition hover:bg-[#425048]"
                          >
                            <CountryFlag code={resolveCountryCode(country)} size="md" />
                            <span className="line-clamp-2 min-w-0 text-sm font-black leading-snug text-[#f8fafc]">
                              {country.name}
                            </span>
                          </button>
                        ))}
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
                          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-400 text-slate-950 px-3 text-sm font-black">
                            <Clock className="h-4 w-4" />
                            {country.deliveryTime || "5-8 dias"}
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
              <span>{activeCountry} · tiempos y productos</span>
            </span>
          }
        >
          <div className="mb-6 w-fit max-w-full rounded-xl border border-black bg-surface-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-9 w-9 shrink-0 ${iconWellEmerald}`}>
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-black text-[#f8fafc]">Tiempo de entrega</p>
                <p className="text-xs font-bold text-slate-400">Rango estimado al destino</p>
              </div>
            </div>
            <TimeRangeSelect
              value={selectedCountryData?.deliveryTime || "5-8 dias"}
              onChange={updateCountryTime}
            />
          </div>

          {(selectedCountryData?.boxes || []).length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-[#f8fafc]">Productos asignados</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Elige qué ítems del catálogo vendes a este destino. El precio es por
                    país.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void reloadPricing();
                    setShowCountryProductPicker(true);
                  }}
                  className={primaryButtonClass}
                >
                  <Plus className="h-4 w-4" />
                  Agregar producto
                </button>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
                {(selectedCountryData?.boxes || []).map((box) => {
                  const boxKey = box.catalogKey || box.size;

                  return (
                  <div
                    key={boxKey}
                    className="relative overflow-hidden rounded-lg border border-black bg-surface-card p-4 shadow-[0_14px_34px_rgba(0,0,0,0.34)]"
                  >
                    <button
                      type="button"
                      onClick={() => removeCountryProduct(boxKey)}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"
                      aria-label={`Quitar ${box.size}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card-header text-slate-400">
                        <Box className="h-7 w-7" />
                      </span>
                      <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                        Producto
                      </span>
                    </div>
                    <p className="mb-5 whitespace-nowrap text-center text-2xl font-black leading-tight text-slate-300">
                      {box.size}
                    </p>

                    <label className="flex h-14 items-center justify-between gap-2 rounded-xl border border-black bg-surface-panel px-3">
                      <span className="text-sm font-black uppercase text-slate-400">
                        Precio público
                      </span>
                      <span className="flex h-10 w-28 items-center justify-center gap-1 text-slate-400">
                        <DollarSign className="h-5 w-5 shrink-0" />
                        <input
                          className="h-10 w-20 rounded-none border-0 bg-transparent px-0 text-center text-2xl font-black leading-10 text-[#f8fafc] outline-none focus:ring-0"
                          style={{ background: "transparent" }}
                          value={box.price.replace("$", "")}
                          onChange={(event) =>
                            updateCountryBoxPrice(boxKey, event.target.value)
                          }
                        />
                      </span>
                    </label>
                  </div>
                  );
                })}
              </div>
            </>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-600/60 p-5">
              <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-400">
                  <Box className="h-7 w-7" />
                </span>
                <h3 className="mt-4 text-xl font-black text-[#f8fafc]">
                  Aún no hay productos para {activeCountry}.
                </h3>
                <p className="mt-2 text-sm font-bold text-slate-400">
                  Asigna productos del catálogo que quieras vender a este país.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void reloadPricing();
                      setShowCountryProductPicker(true);
                    }}
                    className={primaryButtonClass}
                  >
                    <Plus className="h-4 w-4" />
                    Agregar producto
                  </button>
                  <Link href="/inventario" className={secondaryButtonClass}>
                    Ir a Inventario
                  </Link>
                </div>
              </div>
            </section>
          )}

          {showCountryProductPicker ? (
            <div className="mt-5 rounded-xl border border-black bg-surface-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-[#f8fafc]">Agregar producto</h4>
                  <p className="text-xs font-bold text-slate-400">
                    Elige un ítem del catálogo de inventario.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCountryProductPicker(false);
                    setCountryProductQuery("");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-surface-card-hover hover:text-[#f8fafc]"
                  aria-label="Cerrar selector"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {countryProductPickerOptions.length ? (
                <InlineSearchPicker
                  options={countryProductPickerOptions}
                  value={countryProductQuery}
                  onChange={setCountryProductQuery}
                  placeholder="Buscar producto…"
                  searchPlaceholder="Buscar por nombre o categoría…"
                  emptyLabel="No hay más productos disponibles"
                  minWidthClass="w-full"
                  className="w-full"
                  onSelectOption={(option) => {
                    const product = availableCountryProducts.find(
                      (entry) => entry.catalogKey === option.value,
                    );

                    if (product) {
                      addCountryProduct(product);
                    }
                  }}
                  formatSelectedLabel={(option, placeholder) =>
                    option?.searchText ? `${option.label} · ${option.searchText}` : placeholder
                  }
                />
              ) : (
                <p className="text-sm font-bold text-slate-400">
                  No hay productos en el catálogo. Créalos en{" "}
                  <Link href="/inventario" className="text-emerald-400 hover:underline">
                    Inventario
                  </Link>{" "}
                  y vuelve aquí.
                </p>
              )}
            </div>
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
                          value={box.price.replace("$", "")}
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

      {section === "inventory" ? (
        <Panel
          hideHeader={showSidebarNav}
          {...nestedPanelShell}
          title={
            inventoryConfigSection === "menu"
              ? "Inventario"
              : inventoryConfigSection === "warehouses"
                ? "Bodegas"
                : "Categorías e ítems"
          }
        >
          {inventoryConfigSection === "menu" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              <ConfigNavCard
                href="/configuracion?view=inventory&inventory=categories"
                title="Categorías e ítems"
                text="Categorías, subcategorías e ítems del catálogo compartido."
                icon={Box}
                badge="Catálogo compartido"
              />
              <ConfigNavCard
                href="/configuracion?view=inventory&inventory=warehouses"
                title="Bodegas"
                text="Crear bodegas, copiar catálogo y desactivar sucursales."
                icon={Building2}
              />
            </div>
          ) : null}

          {inventoryConfigSection === "categories" ? <InventoryCategoriesPanel /> : null}

          {inventoryConfigSection === "warehouses" ? <WarehousesSettingsPanel /> : null}
        </Panel>
      ) : null}

      {section === "deliveries" ? (
        <Panel title="Rutas y horarios" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            {[
              {
                title: "Entrega de caja vacía",
                text: "Horarios para llevar la caja al cliente.",
                daysKey: "deliveryDays" as const,
                rangesKey: "deliveryRanges" as const,
                newRange: newDeliveryRange,
                setNewRange: setNewDeliveryRange,
              },
              {
                title: "Recolección de caja llena",
                text: "Horarios para recoger la caja en domicilio.",
                daysKey: "pickupDays" as const,
                rangesKey: "pickupRanges" as const,
                newRange: newPickupRange,
                setNewRange: setNewPickupRange,
              },
            ].map((route) => (
              <div
                key={route.title}
                className="rounded-xl border border-black bg-surface-card p-4"
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
                  <div>
                    <p className="mb-2 text-xs font-black uppercase text-slate-400">
                      Días de ruta
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {weekDays.map((day) => {
                        const active = routeConfig[route.daysKey].includes(day);

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleRouteDay(route.daysKey, day)}
                            className={`h-10 rounded-lg border text-sm font-black ${
                              active
                                ? "border-black bg-emerald-400 text-slate-950"
                                : "border-black bg-surface-panel text-[#f8fafc] hover:border-black"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
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
                      <input
                        className={inputClass}
                        type="time"
                        value={route.newRange.start}
                        onChange={(event) =>
                          route.setNewRange((current) => ({
                            ...current,
                            start: event.target.value,
                          }))
                        }
                      />
                      <input
                        className={inputClass}
                        type="time"
                        value={route.newRange.end}
                        onChange={(event) =>
                          route.setNewRange((current) => ({
                            ...current,
                            end: event.target.value,
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
          <div className="rounded-xl border border-black bg-surface-card p-5 shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
            <p className="text-xl font-black">Tema único</p>
            <p className="mt-2 font-bold text-slate-400">
              Una sola paleta activa para toda la aplicación.
            </p>
          </div>
        </Panel>
      ) : null}

      {section === "company" ? (
        <Panel title="Empresa" hideHeader={showSidebarNav} {...nestedPanelShell}>
          <CompanySettingsPanel />
        </Panel>
      ) : null}

      {section === "users" ? <UsersSettingsPanel /> : null}

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
            <p className="truncate text-sm font-black text-[#f8fafc]">{countryContextMenu.name}</p>
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
