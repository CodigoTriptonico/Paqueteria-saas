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
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CompanySettingsPanel } from "@/components/config/company-settings-panel";
import { PlanSettingsPanel } from "@/components/config/plan-settings-panel";
import { InventoryConfigSection as InventoryCategoriesPanel } from "@/components/config/inventory-config-section";
import { UsersSettingsPanel } from "@/components/config/users-settings-panel";
import { WarehousesSettingsPanel } from "@/components/config/warehouses-settings-panel";
import { useContextNav } from "@/hooks/use-context-nav";
import { usePricingBackend } from "@/hooks/use-pricing-backend";
import { inputClass, Panel } from "@/components/ui-blocks";
import { InlineSearchCombobox, InlineSearchPicker } from "@/components/inline-search-picker";

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
    text: "Limites de bodegas y usuarios.",
    icon: Gauge,
    color: "bg-amber-400",
  },
  {
    id: "prices" as Section,
    title: "Paises y precios",
    text: "Paises, tiempos y productos.",
    icon: Globe2,
    color: "bg-[#34D399]",
  },
  {
    id: "distributors" as Section,
    title: "Distribuidores",
    text: "Base global de proveedores.",
    icon: Truck,
    color: "bg-emerald-500",
  },
  {
    id: "inventory" as Section,
    title: "Inventario",
    text: "Categorias e items.",
    icon: Box,
    color: "bg-emerald-300",
  },
  {
    id: "deliveries" as Section,
    title: "Rutas y horarios",
    text: "Entregas, recolecciones y dias.",
    icon: Clock,
    color: "bg-emerald-400",
  },
  {
    id: "appearance" as Section,
    title: "Apariencia",
    text: "Visual del sistema.",
    icon: Palette,
    color: "bg-emerald-400",
  },
  {
    id: "company" as Section,
    title: "Empresa",
    text: "Nombre, telefono y direccion.",
    icon: Building2,
    color: "bg-emerald-400",
  },
  {
    id: "users" as Section,
    title: "Usuarios",
    text: "Dueno y empleados.",
    icon: Users,
    color: "bg-emerald-400",
  },
];

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

const countryFallbacks = [
  "Mexico",
  "Guatemala",
  "Colombia",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Costa Rica",
  "Panama",
  "Republica Dominicana",
  "Ecuador",
  "Peru",
  "Chile",
  "Argentina",
  "Brasil",
  "Uruguay",
  "Paraguay",
  "Bolivia",
  "Venezuela",
  "Estados Unidos",
  "Canada",
  "Espana",
];

const latinAmericaCodes = [
  "MX", "GT", "HN", "SV", "NI", "CR", "PA", "DO", "CU", "PR", "CO", "VE",
  "EC", "PE", "BO", "CL", "AR", "PY", "UY", "BR", "GF", "GY", "SR", "BZ",
];

const countryCodes = [
  "AF", "AL", "DE", "AD", "AO", "AI", "AQ", "AG", "SA", "DZ", "AR", "AM",
  "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BE", "BZ", "BJ", "BM",
  "BY", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "BT", "CV", "KH",
  "CM", "CA", "BQ", "QA", "TD", "CL", "CN", "CY", "CO", "KM", "CG", "CD",
  "KP", "KR", "CI", "CR", "HR", "CU", "CW", "DK", "DM", "EC", "EG", "SV",
  "AE", "ER", "SK", "SI", "ES", "US", "EE", "SZ", "ET", "PH", "FI", "FJ",
  "FR", "GA", "GM", "GE", "GH", "GI", "GD", "GR", "GL", "GP", "GU", "GT",
  "GF", "GG", "GN", "GQ", "GW", "GY", "HT", "HN", "HK", "HU", "IN", "ID",
  "IQ", "IR", "IE", "IM", "IS", "KY", "CK", "FO", "FK", "MP", "MH", "SB",
  "TC", "VG", "VI", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KG",
  "KI", "KW", "LA", "LS", "LV", "LB", "LR", "LY", "LI", "LT", "LU", "MO",
  "MG", "MY", "MW", "MV", "ML", "MT", "MA", "MQ", "MU", "MR", "YT", "MX",
  "FM", "MD", "MC", "MN", "ME", "MS", "MZ", "MM", "NA", "NR", "NP", "NI",
  "NE", "NG", "NU", "NO", "NC", "NZ", "OM", "NL", "PK", "PW", "PS", "PA",
  "PG", "PY", "PE", "PF", "PL", "PT", "PR", "GB", "CF", "CZ", "DO", "RE",
  "RW", "RO", "RU", "EH", "WS", "AS", "BL", "KN", "SM", "MF", "PM", "VC",
  "SH", "LC", "ST", "SN", "RS", "SC", "SL", "SG", "SX", "SY", "SO", "LK",
  "ZA", "SD", "SS", "SE", "CH", "SR", "SJ", "TH", "TW", "TZ", "TJ", "IO",
  "TF", "TL", "TG", "TK", "TO", "TT", "TN", "TM", "TR", "TV", "UA", "UG",
  "UY", "UZ", "VU", "VA", "VE", "VN", "WF", "YE", "DJ", "ZM", "ZW",
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

type CountryOption = {
  code: string;
  name: string;
};

function CountryFlag({ code, large = false }: { code: string; large?: boolean }) {
  if (!code) {
    return (
      <span
        className={`flex items-center justify-center rounded-md bg-surface-card font-black text-slate-300 ${
          large ? "h-12 w-16 text-sm" : "h-5 w-8 text-[10px]"
        }`}
      >
        --
      </span>
    );
  }

  return (
    <span
      className={`block overflow-hidden rounded-md border border-black bg-cover bg-center shadow-sm ${
        large ? "h-12 w-16" : "h-5 w-8"
      }`}
      style={{
        backgroundImage: `url(https://flagcdn.com/w80/${code.toLowerCase()}.png)`,
      }}
    />
  );
}

function getCountryOptions() {
  try {
    const displayNames = new Intl.DisplayNames(["es"], { type: "region" });
    const countryByCode = new Map<string, CountryOption>(
      countryCodes
        .map((code) => [code, { code, name: displayNames.of(code) || code }] as const)
        .filter((entry) => Boolean(entry[1].name)),
    );
    const latinCountries = latinAmericaCodes
      .map((code) => countryByCode.get(code))
      .filter((country): country is CountryOption => Boolean(country));
    const otherCountries = countryCodes
      .filter((code) => !latinAmericaCodes.includes(code))
      .map((code) => countryByCode.get(code))
      .filter((country): country is CountryOption => Boolean(country))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return [...latinCountries, ...otherCountries];
  } catch {
    return countryFallbacks.map((name) => ({ code: "", name }));
  }
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
  const range = parseDeliveryTime(value);
  const numbers = range.unit === "dias" ? dayOptions : weekOptions;
  const controlSize = large ? "h-12 text-xl" : "h-10 text-base";
  const numberWidth = large ? "w-14" : "w-12";
  const unitWidth = large ? "w-28" : "w-24";

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
  }

  function pickUnit(unit: TimeUnit) {
    updateRange({ unit });
    setOpenPicker(null);
  }

  return (
    <div className={`relative flex ${controlSize} w-fit max-w-full items-center gap-2`}>
      {[
        ["start", range.start],
        ["end", range.end],
      ].map(([key, currentValue], index) => (
        <div key={index} className="flex items-center gap-1">
          {index === 1 ? (
            <span className="text-base font-black text-slate-400 text-slate-400">a</span>
          ) : null}
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenPicker(openPicker === key ? null : (key as "start" | "end"))}
              className={`flex h-full ${numberWidth} items-center justify-center gap-1 rounded-lg border border-black bg-surface-panel px-2 font-black text-[#f8fafc] hover:border-black`}
            >
              {currentValue as number}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {openPicker === key ? (
              <div className="absolute left-0 top-full z-50 mt-2 grid w-48 grid-cols-4 gap-1 rounded-lg border border-black bg-surface-card p-2 shadow-xl">
                {numbers.map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => pickNumber(key as "start" | "end", number)}
                    className={`h-9 rounded-md text-sm font-black hover:bg-[#34D399] hover:text-[#f8fafc] ${
                      number === currentValue
                        ? "bg-[#34D399] text-[#f8fafc]"
                        : "bg-surface-panel text-[#f8fafc]"
                    }`}
                  >
                    {number}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <div className={`relative flex ${unitWidth} items-center`}>
        <button
          type="button"
          onClick={() => setOpenPicker(openPicker === "unit" ? null : "unit")}
          className="flex h-full w-full items-center justify-center gap-2 rounded-lg border border-black bg-surface-panel px-3 font-black text-[#f8fafc] hover:border-black"
        >
          {range.unit}
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        {openPicker === "unit" ? (
          <div className="absolute left-3 top-full z-50 mt-2 grid w-32 gap-1 rounded-lg border border-black bg-surface-card p-2 shadow-xl">
            {(["dias", "semanas"] as TimeUnit[]).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => pickUnit(unit)}
                className={`h-9 rounded-md px-3 text-left text-sm font-black hover:bg-[#34D399] hover:text-[#f8fafc] ${
                  unit === range.unit
                    ? "bg-[#34D399] text-[#f8fafc]"
                    : "bg-surface-panel text-[#f8fafc]"
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
  const {
    error: pricingError,
    countries,
    setCountries,
    distributors,
    setDistributors,
    distributorPrices,
    setDistributorPrices,
    routeConfig,
    setRouteConfig,
  } = usePricingBackend();
  const [selectedDistributor, setSelectedDistributor] = useState<string | null>(null);
  const [selectedDistributorCountry, setSelectedDistributorCountry] = useState<string | null>(null);
  const [showDistributorForm, setShowDistributorForm] = useState(false);
  const [newDistributor, setNewDistributor] = useState(emptyDistributor);
  const [returnToInventory, setReturnToInventory] = useState(false);
  const [newDeliveryRange, setNewDeliveryRange] = useState({ start: "", end: "" });
  const [newPickupRange, setNewPickupRange] = useState({ start: "", end: "" });
  const countryOptions = useMemo(() => getCountryOptions(), []);
  const selectedCountryData = useMemo(
    () => countries.find((country) => country.name === selectedCountry),
    [countries, selectedCountry],
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
    const existing = new Set(countries.map((country) => normalizeText(country.name)));
    const query = normalizeText(countryQuery.trim());

    return countryOptions
      .filter((country) => !existing.has(normalizeText(country.name)))
      .filter((country) => normalizeText(country.name).includes(query));
  }, [countries, countryOptions, countryQuery]);

  const countryPickerSearchOptions = useMemo(() => {
    const existing = new Set(countries.map((country) => normalizeText(country.name)));

    return countryOptions
      .filter((country) => !existing.has(normalizeText(country.name)))
      .map((country) => ({
        value: country.code || country.name,
        label: country.name,
      }));
  }, [countries, countryOptions]);

  function openConfigSection(nextSection: Section) {
    if (nextSection === "menu") {
      router.replace("/configuracion", { scroll: false });
      return;
    }

    router.replace(`/configuracion?view=${nextSection}`, { scroll: false });
  }

  function openInventoryConfigSection(nextSection: InventoryConfigSection) {
    router.replace(`/configuracion?view=inventory&inventory=${nextSection}`, { scroll: false });
  }

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

  function addCountry(country: CountryOption) {
    setCountries((current) => [
      ...current,
      {
        code: country.code,
        name: country.name,
        deliveryTime: "",
        boxes: [],
      },
    ]);
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

  function updateCountryBoxPrice(size: string, rawPrice: string) {
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
                box.size === size ? { ...box, price } : box,
              ),
            }
          : country,
      ),
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
        phone: newDistributor.phone.trim() || "Sin telefono",
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

  function goBack() {
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

    if (selectedCountry) {
      setSelectedCountry(null);
      return;
    }

    openConfigSection("menu");
  }

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
        return "Categorias e items";
      }

      return "Inventario";
    }

    if (section === "prices") {
      if (selectedCountry) {
        return `${selectedCountry} - tiempos y cajas`;
      }

      return "Paises y precios";
    }

    if (section === "distributors") {
      if (selectedDistributor && selectedDistributorCountry) {
        return `${selectedDistributor} · ${selectedDistributorCountry}`;
      }

      if (selectedDistributor) {
        return `Editando precios para ${selectedDistributorData?.name || selectedDistributor}`;
      }

      return "Distribuidores globales";
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

    return "Configuracion";
  }, [
    inventoryConfigSection,
    section,
    selectedCountry,
    selectedDistributor,
    selectedDistributorCountry,
    selectedDistributorData?.name,
  ]);

  const handleConfigNavBack = useCallback(() => {
    goBack();
  }, [
    inventoryConfigSection,
    returnToInventory,
    section,
    selectedCountry,
    selectedDistributor,
    selectedDistributorCountry,
  ]);

  useContextNav({
    title: configNavTitle ?? "Configuracion",
    onBack: handleConfigNavBack,
    enabled: Boolean(configNavTitle),
  });

  const showSidebarNav = section !== "menu";

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
      {section === "menu" ? (
        <Panel title="Configuracion" hideHeader>
          <div className="mb-4 min-w-0">
            <p className="text-xs font-black uppercase text-slate-400">Sistema</p>
            <h3 className="truncate text-2xl font-black">Configuracion</h3>
            {pricingError ? (
              <p className="mt-2 rounded-lg border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm font-bold text-rose-200">
                {pricingError}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            {sections.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.id}
                  href={`/configuracion?view=${item.id}`}
                  className="flex min-w-0 items-center gap-3 rounded-lg border border-black bg-surface-card p-4 text-left shadow-sm transition hover:border-black"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-950 ${item.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block break-words text-xl font-black leading-tight">
                      {item.title}
                    </span>
                    <span className="mt-1 block break-words text-sm font-bold leading-snug text-slate-300">
                      {item.text}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {section === "plan" ? (
        <Panel title="Plan" hideHeader={showSidebarNav}>
          <PlanSettingsPanel />
        </Panel>
      ) : null}

      {section === "prices" && !selectedCountry ? (
        <Panel title="Paises y precios" hideHeader={showSidebarNav}>
          <div className="mb-5 grid gap-3">
            <button
              onClick={() => setShowCountryPicker((current) => !current)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#34D399] px-6 text-lg font-black text-[#f8fafc] sm:w-fit"
            >
              <Plus className="h-6 w-6" />
              Crear pais
            </button>
            {showCountryPicker ? (
              <div className="rounded-xl border border-black bg-surface-card p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xl font-black">Elegir pais</p>
                  <button
                    onClick={() => {
                      setCountryQuery("");
                      setShowCountryPicker(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-black border-black"
                    aria-label="Cerrar"
                    title="Cerrar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <InlineSearchCombobox
                  value={countryQuery}
                  onChange={setCountryQuery}
                  options={countryPickerSearchOptions}
                  placeholder="Buscar pais"
                  emptyLabel="Sin países"
                  ariaLabel="Buscar país"
                  leadingIcon={<Search className="h-4 w-4" aria-hidden />}
                  className="mb-4 w-full"
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
                <div className="grid max-h-96 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredCountryOptions.map((country) => (
                    <button
                      key={country.code || country.name}
                      onClick={() => addCountry(country)}
                      className="flex items-center gap-3 rounded-lg border border-black bg-surface-panel px-4 py-3 text-left text-lg font-black hover:border-black hover:bg-surface-card"
                    >
                      <CountryFlag code={country.code} />
                      <span>{country.name}</span>
                    </button>
                  ))}
                  {!filteredCountryOptions.length ? (
                    <div className="rounded-lg border border-black bg-surface-panel px-4 py-3 text-lg font-black border-black bg-surface-panel">
                      Sin resultados
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {!showCountryPicker ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {countries.map((country) => (
                <button
                  key={country.name}
                  onClick={() => setSelectedCountry(country.name)}
                  className="group relative min-h-40 overflow-hidden rounded-xl border border-black bg-surface-panel p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:shadow-lg border-black bg-surface-card hover:border-black"
                >
                  <div className="relative flex h-full items-center justify-between gap-5">
                    <div className="flex min-w-0 items-center gap-4">
                      <CountryFlag code={country.code} large />
                      <span className="min-w-0">
                        <span className="block truncate text-3xl font-black leading-tight">
                          {country.name}
                        </span>
                        <span className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-black bg-surface-panel px-3 text-sm font-black text-slate-300">
                            <Box className="h-4 w-4 text-slate-400" />
                            {country.boxes.length} productos
                          </span>
                          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-600 bg-emerald-400 text-slate-950 px-3 text-sm font-black">
                            <Clock className="h-4 w-4" />
                            {country.deliveryTime}
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
        </Panel>
      ) : null}

      {section === "prices" && selectedCountry ? (
        <Panel
          hideHeader={showSidebarNav}
          title={
            <span className="flex items-center gap-3">
              <CountryFlag code={selectedCountryData?.code || ""} />
              <span>{selectedCountry} - tiempos y cajas</span>
            </span>
          }
        >
          <div className="mb-5 flex w-fit max-w-full flex-wrap items-center gap-3">
            <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-400 text-slate-950 px-3 text-sm font-black uppercase">
              <Clock className="h-4 w-4" />
              Tiempo
            </span>
            <TimeRangeSelect
              value={selectedCountryData?.deliveryTime || "5-8 dias"}
              onChange={updateCountryTime}
            />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            {(selectedCountryData?.boxes || []).map((box) => (
              <div
                key={box.size}
                className="relative overflow-hidden rounded-lg border border-black bg-surface-card p-4 shadow-[0_14px_34px_rgba(0,0,0,0.34)]"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-black bg-surface-card-header text-slate-400">
                    <Box className="h-7 w-7" />
                  </span>
                  <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                    Caja
                  </span>
                </div>
                <p className="mb-5 whitespace-nowrap text-center text-2xl font-black leading-tight text-slate-300">
                  {box.size}
                </p>

                <label className="flex h-14 items-center justify-between gap-2 rounded-xl border border-black bg-surface-panel px-3">
                  <span className="text-sm font-black uppercase text-slate-400 text-slate-400">
                    Precio publico
                  </span>
                  <span className="flex h-10 w-28 items-center justify-center gap-1 text-slate-400">
                    <DollarSign className="h-5 w-5 shrink-0" />
                    <input
                      className="h-10 w-20 rounded-none border-0 bg-transparent px-0 text-center text-2xl font-black leading-10 text-[#f8fafc] outline-none focus:ring-0"
                      style={{ background: "transparent" }}
                      value={box.price.replace("$", "")}
                      onChange={(event) =>
                        updateCountryBoxPrice(box.size, event.target.value)
                      }
                    />
                  </span>
                </label>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {section === "distributors" && !selectedDistributor ? (
        <Panel title="Distribuidores globales" hideHeader={showSidebarNav}>
          <div className="mb-5 grid gap-3">
            <button
              onClick={() => setShowDistributorForm((current) => !current)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-6 text-lg font-black text-[#f8fafc] sm:w-fit"
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
                    ["Telefono", "phone", "Ej: (305) 000-0000"],
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
                    className="h-11 rounded-lg bg-[#34D399] px-5 font-black text-[#f8fafc]"
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
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-400 text-slate-950 text-slate-400">
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
                    {distributor.active ? "Activo" : "Apagado"}
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
          title={
            <span className="flex flex-wrap items-center gap-3">
              <Truck className="h-7 w-7 text-slate-400" />
              <span>Editando precios para {selectedDistributorData?.name}</span>
            </span>
          }
        >
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {countries.map((country) => (
              <button
                key={country.name}
                onClick={() => setSelectedDistributorCountry(country.name)}
                className="group relative min-h-36 overflow-hidden rounded-lg border border-black bg-surface-card p-5 text-left shadow-[0_14px_34px_rgba(0,0,0,0.34)] transition hover:bg-surface-card-hover"
              >
                <div className="relative flex h-full items-center justify-between gap-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <CountryFlag code={country.code} large />
                    <span className="min-w-0">
                      <span className="block truncate text-3xl font-black leading-tight">
                        {country.name}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-black bg-surface-panel px-3 text-sm font-black text-slate-300">
                          <Box className="h-4 w-4 text-slate-400" />
                          {country.boxes.length} productos
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
                        Publico general
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
          title={
            inventoryConfigSection === "menu"
              ? "Inventario"
              : inventoryConfigSection === "warehouses"
                ? "Bodegas"
                : "Categorias e items"
          }
        >
          {inventoryConfigSection === "menu" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,340px))] justify-start gap-4">
              <a
                href="/configuracion?view=inventory&inventory=categories"
                className="group flex min-w-0 flex-col rounded-xl border border-black bg-surface-card p-5 text-left shadow-sm transition hover:border-black"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-400 text-slate-950">
                  <Box className="h-7 w-7" />
                </span>
                <span className="mt-5 block break-words text-2xl font-black leading-snug sm:text-3xl">
                  Categorias e items
                </span>
                <span className="mt-2 block break-words text-base font-bold leading-snug text-slate-300">
                  Subcategorias y objetos del inventario.
                </span>
                <span className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-lg border border-black bg-surface-panel px-3 py-2 text-sm font-black text-slate-400">
                    Estructura por bodega
                  </span>
                </span>
              </a>

              <Link
                href="/configuracion?view=inventory&inventory=warehouses"
                className="group flex min-w-0 flex-col rounded-xl border border-black bg-surface-card p-5 text-left shadow-sm transition hover:border-black"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-400 text-slate-950">
                  <Building2 className="h-7 w-7" />
                </span>
                <span className="mt-5 block break-words text-2xl font-black leading-snug sm:text-3xl">
                  Bodegas
                </span>
                <span className="mt-2 block break-words text-base font-bold leading-snug text-slate-300">
                  Multiples bodegas, copiar catalogo y desactivar.
                </span>
              </Link>
            </div>
          ) : null}

          {inventoryConfigSection === "categories" ? <InventoryCategoriesPanel /> : null}

          {inventoryConfigSection === "warehouses" ? <WarehousesSettingsPanel /> : null}
        </Panel>
      ) : null}

      {section === "deliveries" ? (
        <Panel title="Rutas y horarios" hideHeader={showSidebarNav}>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            {[
              {
                title: "Entrega de caja vacia",
                text: "Horarios para llevar caja al cliente.",
                daysKey: "deliveryDays" as const,
                rangesKey: "deliveryRanges" as const,
                newRange: newDeliveryRange,
                setNewRange: setNewDeliveryRange,
              },
              {
                title: "Recoleccion de caja llena",
                text: "Horarios para recoger caja en domicilio.",
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
                      Dias de ruta
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
                    Opciones que usan entrega y recoleccion.
                  </span>
                </span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase text-slate-400">
                    Anticipacion minima
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
        <Panel title="Apariencia" hideHeader={showSidebarNav}>
          <div className="rounded-xl border border-black bg-surface-panel p-5 shadow-sm">
            <p className="text-xl font-black">Tema unico</p>
            <p className="mt-2 font-bold text-slate-400">
              Una sola paleta activa para todo el sistema.
            </p>
          </div>
        </Panel>
      ) : null}

      {section === "company" ? (
        <Panel title="Empresa" hideHeader={showSidebarNav}>
          <CompanySettingsPanel />
        </Panel>
      ) : null}

      {section === "users" ? <UsersSettingsPanel /> : null}
    </>
  );
}
