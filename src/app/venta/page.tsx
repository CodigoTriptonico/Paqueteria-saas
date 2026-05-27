"use client";

import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  Copy,
  Edit3,
  Package,
  Plus,
  Printer,
  Search,
  Trash2,
  Mail,
  MapPin,
  Phone,
  UserPlus,
  X,
} from "lucide-react";
import { type MouseEvent, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSetShellConfig } from "@/components/app-frame";
import { cardHeaderClass, cardHoverClass, iconWellEmerald, Panel } from "@/components/ui-blocks";

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

function saleStepButtonClass(isActive: boolean, isUnlocked: boolean) {
  if (isActive) {
    return "border-emerald-600 bg-emerald-400 text-slate-950";
  }

  if (isUnlocked) {
    return "border-black bg-surface-card text-slate-300 hover:border-black hover:bg-surface-card-hover";
  }

  return "cursor-not-allowed border-black bg-surface-inset text-slate-500";
}

const unselectedDimClass =
  "opacity-45 saturate-[0.85] transition-opacity hover:opacity-75 hover:saturate-100";
const selectedBorderClass =
  "border-2 border-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_6px_20px_rgba(0,0,0,0.22)]";

function deliveryModeCardClass(selected: boolean, groupHasSelection: boolean) {
  if (selected) {
    return `relative overflow-hidden ${selectedBorderClass} bg-surface-card`;
  }

  const base = `${cardHoverClass} border-black bg-surface-panel hover:ring-1 hover:ring-white/10`;
  return groupHasSelection ? `${base} ${unselectedDimClass}` : base;
}

function deliveryModeIconClass(selected: boolean) {
  return selected
    ? "border-emerald-500/50 bg-emerald-400/15 text-emerald-300"
    : "border-black bg-surface-inset text-slate-400";
}

function deliverySegmentClass(selected: boolean) {
  return selected
    ? "bg-emerald-400 text-slate-950 shadow-sm"
    : "text-slate-400 hover:bg-surface-card/60 hover:text-slate-200";
}

type PersonName = {
  firstName: string;
  lastName: string;
};

type Recipient = PersonName & {
  country: string;
  phone: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode: string;
};

type Sender = PersonName & {
  phones: string[];
  email: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  recipients: Recipient[];
};

type NamedRecipientInput = Omit<Recipient, "firstName" | "lastName"> & { name: string };
type NamedSenderInput = Omit<Sender, "firstName" | "lastName" | "recipients" | "phones" | "email"> & {
  name: string;
  phone?: string;
  phones?: string[];
  email?: string;
  recipients: NamedRecipientInput[];
};

type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  firstName: string;
  lastName: string;
  type: "remitente" | "destinatario" | "caja";
  targetKey: string;
  phones: string[];
  address: {
    street?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

type SaleStep = "client" | "recipient" | "box" | "delivery" | "finish";
type AddressFormKind = "client" | "recipient";
type AddressValidation = {
  status: "idle" | "checking" | "valid" | "invalid";
  message: string;
  formattedAddress?: string;
};
type AddressSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

function splitFullName(fullName: string): PersonName {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function personFullName(person: PersonName) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

function samePersonName(a: PersonName, b: PersonName) {
  return (
    a.firstName.trim().toLowerCase() === b.firstName.trim().toLowerCase() &&
    a.lastName.trim().toLowerCase() === b.lastName.trim().toLowerCase()
  );
}

function recipientIdentityKey(recipient: Recipient) {
  return `${recipient.firstName}|${recipient.lastName}|${recipient.country}`.toLowerCase();
}

function buildSender(input: NamedSenderInput): Sender {
  const { name, recipients, phone, phones, email, ...rest } = input;
  const { firstName, lastName } = splitFullName(name);
  const phoneList = normalizePhoneList(phones?.length ? phones : phone ? [phone] : []);

  return {
    ...rest,
    firstName,
    lastName,
    email: email?.trim() || "",
    phones: phoneList.length ? phoneList : [""],
    recipients: recipients.map(({ name: recipientName, ...recipientRest }) => ({
      ...splitFullName(recipientName),
      ...recipientRest,
    })),
  };
}

const initialSenders: Sender[] = [
  buildSender({
    name: "Maria Lopez",
    phones: ["(305) 555-0182", "(305) 555-0183"],
    email: "maria.lopez@correo.com",
    street: "NW 17th Ave",
    houseNumber: "2450",
    neighborhood: "Allapattah",
    city: "Miami",
    state: "FL",
    postalCode: "33142",
    recipients: [
      {
        name: "Rosa Lopez",
        phone: "+52 55 1234 8899",
        street: "Calle 12",
        houseNumber: "45",
        neighborhood: "Centro",
        city: "CDMX",
        postalCode: "06000",
        country: "Mexico",
      },
      {
        name: "Luis Lopez",
        phone: "+52 55 7788 1122",
        street: "Av. Reforma",
        houseNumber: "200",
        neighborhood: "Juarez",
        city: "CDMX",
        postalCode: "06600",
        country: "Mexico",
      },
      {
        name: "Ana Lopez",
        phone: "+502 2233 4455",
        street: "6A Avenida",
        houseNumber: "10-22",
        neighborhood: "Zona 10",
        city: "Guatemala City",
        postalCode: "01010",
        country: "Guatemala",
      },
      {
        name: "Pedro Lopez",
        phone: "+52 55 9988 3344",
        street: "Calle Norte",
        houseNumber: "18",
        neighborhood: "Roma",
        city: "CDMX",
        postalCode: "06700",
        country: "Mexico",
      },
      {
        name: "Elena Morales",
        phone: "+504 2234 9012",
        street: "Avenida Central",
        houseNumber: "77",
        neighborhood: "Centro",
        city: "Tegucigalpa",
        postalCode: "11101",
        country: "Honduras",
      },
      {
        name: "Sofia Martinez",
        phone: "+57 301 555 2222",
        street: "Carrera 15",
        houseNumber: "40-20",
        neighborhood: "Chapinero",
        city: "Bogota",
        postalCode: "110231",
        country: "Colombia",
      },
      {
        name: "Miguel Garcia",
        phone: "+502 5566 7788",
        street: "Calzada Roosevelt",
        houseNumber: "14-80",
        neighborhood: "Zona 7",
        city: "Guatemala City",
        postalCode: "01007",
        country: "Guatemala",
      },
      {
        name: "Carmen Ruiz",
        phone: "+52 81 4444 0909",
        street: "Av. Universidad",
        houseNumber: "500",
        neighborhood: "San Nicolas",
        city: "Monterrey",
        postalCode: "66450",
        country: "Mexico",
      },
    ],
  }),
  buildSender({
    name: "Jose Ramirez",
    phones: ["(786) 555-0120", "(786) 555-0121"],
    email: "jose.ramirez@correo.com",
    street: "W 49th St",
    houseNumber: "1220",
    neighborhood: "Palm Springs",
    city: "Hialeah",
    state: "FL",
    postalCode: "33012",
    recipients: [
      {
        name: "Carlos Ramirez",
        phone: "+502 5555 1200",
        street: "1A Calle",
        houseNumber: "8-20",
        neighborhood: "Zona 1",
        city: "Guatemala City",
        postalCode: "01001",
        country: "Guatemala",
      },
      {
        name: "Marta Ruiz",
        phone: "+504 9988 7711",
        street: "Boulevard Kennedy",
        houseNumber: "310",
        neighborhood: "Col. Kennedy",
        city: "Tegucigalpa",
        postalCode: "11101",
        country: "Honduras",
      },
      {
        name: "Paola Ramirez",
        phone: "+52 55 4411 2200",
        street: "Av. Insurgentes",
        houseNumber: "890",
        neighborhood: "Narvarte",
        city: "CDMX",
        postalCode: "03020",
        country: "Mexico",
      },
      {
        name: "Luis Ramirez",
        phone: "+57 310 220 8899",
        street: "Calle 53",
        houseNumber: "21-10",
        neighborhood: "La Candelaria",
        city: "Bogota",
        postalCode: "110231",
        country: "Colombia",
      },
    ],
  }),
  buildSender({
    name: "Ana Perez",
    phone: "(954) 555-0177",
    email: "ana.perez@mail.com",
    street: "Sistrunk Blvd",
    houseNumber: "805",
    neighborhood: "Dorsey-Riverbend",
    city: "Fort Lauderdale",
    state: "FL",
    postalCode: "33311",
    recipients: [
      {
        name: "Diana Perez",
        phone: "+57 310 555 9090",
        street: "Carrera 7",
        houseNumber: "82-10",
        neighborhood: "Chico",
        city: "Bogota",
        postalCode: "110221",
        country: "Colombia",
      },
      {
        name: "Luz Gomez",
        phone: "+57 300 444 1234",
        street: "Calle 10",
        houseNumber: "33-18",
        neighborhood: "El Poblado",
        city: "Medellin",
        postalCode: "050021",
        country: "Colombia",
      },
      {
        name: "Ricardo Perez",
        phone: "+52 33 7788 9900",
        street: "Av. Vallarta",
        houseNumber: "3200",
        neighborhood: "Vallarta",
        city: "Guadalajara",
        postalCode: "44110",
        country: "Mexico",
      },
      {
        name: "Ines Perez",
        phone: "+502 3344 5566",
        street: "12 Avenida",
        houseNumber: "5-18",
        neighborhood: "Zona 1",
        city: "Guatemala City",
        postalCode: "01001",
        country: "Guatemala",
      },
    ],
  }),
  buildSender({
    name: "Carlos Diaz",
    phones: ["(305) 555-0000", "(786) 555-4411"],
    email: "carlos.diaz@mail.com",
    street: "Saratoga Way",
    houseNumber: "18006",
    neighborhood: "Canyon Country",
    city: "Santa Clarita",
    state: "CA",
    postalCode: "91387",
    recipients: [
      {
        name: "Patricia Diaz",
        phone: "+52 33 1122 3344",
        street: "Av. Chapultepec",
        houseNumber: "102",
        neighborhood: "Americana",
        city: "Guadalajara",
        postalCode: "44160",
        country: "Mexico",
      },
      {
        name: "Roberto Diaz",
        phone: "+52 55 6677 8899",
        street: "Insurgentes Sur",
        houseNumber: "1450",
        neighborhood: "Del Valle",
        city: "CDMX",
        postalCode: "03100",
        country: "Mexico",
      },
    ],
  }),
  buildSender({
    name: "Elena Vargas",
    phone: "(954) 555-0299",
    email: "elena.vargas@gmail.com",
    street: "Oakland Park Blvd",
    houseNumber: "4102",
    neighborhood: "Lauderdale Lakes",
    city: "Fort Lauderdale",
    state: "FL",
    postalCode: "33311",
    recipients: [
      {
        name: "Hector Vargas",
        phone: "+502 4444 5566",
        street: "Diagonal 6",
        houseNumber: "12-45",
        neighborhood: "Zona 9",
        city: "Guatemala City",
        postalCode: "01009",
        country: "Guatemala",
      },
      {
        name: "Isabel Vargas",
        phone: "+504 2211 3344",
        street: "Col. Palmira",
        houseNumber: "88",
        neighborhood: "Palmira",
        city: "San Pedro Sula",
        postalCode: "21102",
        country: "Honduras",
      },
      {
        name: "Natalia Vargas",
        phone: "+57 320 998 7766",
        street: "Calle 80",
        houseNumber: "22-15",
        neighborhood: "Laureles",
        city: "Medellin",
        postalCode: "050034",
        country: "Colombia",
      },
    ],
  }),
  buildSender({
    name: "Miguel Torres",
    phone: "(786) 555-0331",
    street: "E 8th St",
    houseNumber: "330",
    neighborhood: "Little Havana",
    city: "Miami",
    state: "FL",
    postalCode: "33130",
    recipients: [
      {
        name: "Laura Torres",
        phone: "+52 81 2200 1100",
        street: "Av. Constitucion",
        houseNumber: "900",
        neighborhood: "Centro",
        city: "Monterrey",
        postalCode: "64000",
        country: "Mexico",
      },
    ],
  }),
  buildSender({
    name: "Sofia Herrera",
    phones: ["(305) 555-0777"],
    email: "sofia.herrera@empresa.co",
    street: "Coral Way",
    houseNumber: "1520",
    neighborhood: "Coral Gables",
    city: "Miami",
    state: "FL",
    postalCode: "33145",
    recipients: [
      {
        name: "Diego Herrera",
        phone: "+52 55 4400 2211",
        street: "Calle Madero",
        houseNumber: "55",
        neighborhood: "Centro Historico",
        city: "CDMX",
        postalCode: "06000",
        country: "Mexico",
      },
      {
        name: "Valentina Herrera",
        phone: "+52 33 8899 0011",
        street: "Av. Mexico",
        houseNumber: "2100",
        neighborhood: "Providencia",
        city: "Guadalajara",
        postalCode: "44630",
        country: "Mexico",
      },
      {
        name: "Andres Herrera",
        phone: "+502 7788 9900",
        street: "7A Avenida",
        houseNumber: "3-12",
        neighborhood: "Zona 4",
        city: "Guatemala City",
        postalCode: "01004",
        country: "Guatemala",
      },
      {
        name: "Camila Herrera",
        phone: "+57 301 220 3344",
        street: "Carrera 50",
        houseNumber: "12-30",
        neighborhood: "Envigado",
        city: "Medellin",
        postalCode: "055421",
        country: "Colombia",
      },
    ],
  }),
  buildSender({
    name: "Ricardo Mendoza",
    phone: "(954) 555-0412",
    street: "Pines Blvd",
    houseNumber: "9801",
    neighborhood: "Pembroke Pines",
    city: "Pembroke Pines",
    state: "FL",
    postalCode: "33024",
    recipients: [],
  }),
  buildSender({
    name: "Lucia Fernandez",
    phones: ["(786) 555-0888", "(305) 555-0991"],
    email: "lucia.fernandez@outlook.com",
    street: "Bird Rd",
    houseNumber: "7420",
    neighborhood: "Westchester",
    city: "Miami",
    state: "FL",
    postalCode: "33155",
    recipients: [
      {
        name: "Jorge Fernandez",
        phone: "+504 9900 1122",
        street: "Boulevard Morazan",
        houseNumber: "1200",
        neighborhood: "Centro",
        city: "Tegucigalpa",
        postalCode: "11101",
        country: "Honduras",
      },
      {
        name: "Mariana Fernandez",
        phone: "+52 55 3010 4050",
        street: "Av. Patriotismo",
        houseNumber: "300",
        neighborhood: "San Pedro de los Pinos",
        city: "CDMX",
        postalCode: "03800",
        country: "Mexico",
      },
    ],
  }),
  buildSender({
    name: "Pedro Castillo",
    phone: "(305) 555-0618",
    street: "SW 8th St",
    houseNumber: "12001",
    neighborhood: "Sweetwater",
    city: "Miami",
    state: "FL",
    postalCode: "33184",
    recipients: [
      {
        name: "Gabriela Castillo",
        phone: "+57 310 550 7788",
        street: "Calle 100",
        houseNumber: "19-40",
        neighborhood: "Chico Norte",
        city: "Bogota",
        postalCode: "110221",
        country: "Colombia",
      },
      {
        name: "Felipe Castillo",
        phone: "+57 300 881 2200",
        street: "Av. Santander",
        houseNumber: "45-10",
        neighborhood: "Cabecera",
        city: "Bucaramanga",
        postalCode: "680003",
        country: "Colombia",
      },
      {
        name: "Renata Castillo",
        phone: "+502 5511 2233",
        street: "18 Calle",
        houseNumber: "8-55",
        neighborhood: "Zona 10",
        city: "Guatemala City",
        postalCode: "01010",
        country: "Guatemala",
      },
      {
        name: "Oscar Castillo",
        phone: "+52 81 9000 1122",
        street: "Calle Morelos",
        houseNumber: "220",
        neighborhood: "Centro",
        city: "Monterrey",
        postalCode: "64000",
        country: "Mexico",
      },
      {
        name: "Paula Castillo",
        phone: "+504 2233 9900",
        street: "Col. Las Colinas",
        houseNumber: "15",
        neighborhood: "Las Colinas",
        city: "Tegucigalpa",
        postalCode: "11101",
        country: "Honduras",
      },
    ],
  }),
  buildSender({
    name: "Daniela Rios",
    phone: "(954) 555-0520",
    email: "daniela.rios@correo.com",
    street: "Commercial Blvd",
    houseNumber: "2200",
    neighborhood: "Tamarac",
    city: "Tamarac",
    state: "FL",
    postalCode: "33321",
    recipients: [
      {
        name: "Emilio Rios",
        phone: "+52 55 8800 4411",
        street: "Eje Central",
        houseNumber: "75",
        neighborhood: "Guerrero",
        city: "CDMX",
        postalCode: "06300",
        country: "Mexico",
      },
      {
        name: "Claudia Rios",
        phone: "+52 33 5500 6677",
        street: "Av. Americas",
        houseNumber: "1500",
        neighborhood: "Country Club",
        city: "Guadalajara",
        postalCode: "44610",
        country: "Mexico",
      },
    ],
  }),
  buildSender({
    name: "Andres Navarro",
    phone: "(786) 555-0701",
    street: "NW 36th St",
    houseNumber: "5100",
    neighborhood: "Doral",
    city: "Doral",
    state: "FL",
    postalCode: "33166",
    recipients: [
      {
        name: "Teresa Navarro",
        phone: "+502 6600 7788",
        street: "Calzada Aguilar Batres",
        houseNumber: "22-10",
        neighborhood: "Zona 12",
        city: "Guatemala City",
        postalCode: "01012",
        country: "Guatemala",
      },
      {
        name: "Raul Navarro",
        phone: "+57 315 440 9900",
        street: "Carrera 43A",
        houseNumber: "1-50",
        neighborhood: "El Poblado",
        city: "Medellin",
        postalCode: "050021",
        country: "Colombia",
      },
      {
        name: "Beatriz Navarro",
        phone: "+504 8811 2233",
        street: "Res. Las Uvas",
        houseNumber: "4-B",
        neighborhood: "Las Uvas",
        city: "Comayaguela",
        postalCode: "11102",
        country: "Honduras",
      },
    ],
  }),
  buildSender({
    name: "Gabriela Morales",
    phones: ["(305) 555-0912", "(954) 555-0913"],
    email: "gabriela.morales@paquemas.demo",
    street: "Flagler St",
    houseNumber: "88",
    neighborhood: "Downtown",
    city: "Miami",
    state: "FL",
    postalCode: "33130",
    recipients: [
      {
        name: "Ignacio Morales",
        phone: "+52 55 1122 9900",
        street: "Calle Durango",
        houseNumber: "210",
        neighborhood: "Roma Norte",
        city: "CDMX",
        postalCode: "06700",
        country: "Mexico",
      },
      {
        name: "Silvia Morales",
        phone: "+52 81 3344 5566",
        street: "Av. Garza Sada",
        houseNumber: "2501",
        neighborhood: "Tecnologico",
        city: "Monterrey",
        postalCode: "64849",
        country: "Mexico",
      },
      {
        name: "Tomas Morales",
        phone: "+502 9900 1122",
        street: "Boulevard Liberacion",
        houseNumber: "15-20",
        neighborhood: "Zona 9",
        city: "Guatemala City",
        postalCode: "01009",
        country: "Guatemala",
      },
    ],
  }),
  buildSender({
    name: "Hector Salinas",
    phone: "(954) 555-0633",
    street: "Sunrise Blvd",
    houseNumber: "3300",
    neighborhood: "Plantation",
    city: "Plantation",
    state: "FL",
    postalCode: "33322",
    recipients: [
      {
        name: "Monica Salinas",
        phone: "+57 320 110 9988",
        street: "Calle 72",
        houseNumber: "10-22",
        neighborhood: "Chapinero",
        city: "Bogota",
        postalCode: "110231",
        country: "Colombia",
      },
    ],
  }),
  buildSender({
    name: "Valentina Cruz",
    phone: "(305) 555-0844",
    email: "valentina.cruz@demo.com",
    street: "Biscayne Blvd",
    houseNumber: "4500",
    neighborhood: "Edgewater",
    city: "Miami",
    state: "FL",
    postalCode: "33137",
    recipients: [
      {
        name: "Alonso Cruz",
        phone: "+52 55 6677 1122",
        street: "Av. Universidad",
        houseNumber: "1200",
        neighborhood: "Copilco",
        city: "CDMX",
        postalCode: "04360",
        country: "Mexico",
      },
      {
        name: "Jimena Cruz",
        phone: "+502 2233 4455",
        street: "6A Avenida",
        houseNumber: "10-22",
        neighborhood: "Zona 10",
        city: "Guatemala City",
        postalCode: "01010",
        country: "Guatemala",
      },
      {
        name: "Mateo Cruz",
        phone: "+504 5566 7788",
        street: "Col. Miraflores",
        houseNumber: "22",
        neighborhood: "Miraflores",
        city: "Tegucigalpa",
        postalCode: "11101",
        country: "Honduras",
      },
      {
        name: "Renata Cruz",
        phone: "+57 301 555 2222",
        street: "Carrera 15",
        houseNumber: "40-20",
        neighborhood: "Chapinero",
        city: "Bogota",
        postalCode: "110231",
        country: "Colombia",
      },
    ],
  }),
];

const countryBoxes = {
  Mexico: [
    ["30 x 30 x 30", "$100", "$60", "FedEx", "10-15 dias"],
    ["20 x 20 x 20", "$85", "$54", "Paquete Express", "8-12 dias"],
    ["16 x 16 x 16", "$62", "$40", "Estafeta", "8-12 dias"],
  ],
  Guatemala: [
    ["30 x 30 x 30", "$115", "$73", "MGS", "12-18 dias"],
    ["20 x 20 x 20", "$92", "$61", "MGS", "12-18 dias"],
  ],
  Colombia: [
    ["16 x 16 x 16", "$62", "$40", "Estafeta", "8-12 dias"],
    ["14 x 14 x 14", "$48", "$31", "MGS", "7-10 dias"],
  ],
  Honduras: [["20 x 20 x 20", "$88", "$56", "MGS", "12-18 dias"]],
};

const countries = Object.keys(countryBoxes);
const RECIPIENTS_PER_PAGE = 3;
const SENDERS_PER_PAGE = 3;
const RECENT_SENDERS_PER_PAGE = 3;

const countryCodes: Record<string, string> = {
  USA: "US",
  Mexico: "MX",
  Guatemala: "GT",
  Colombia: "CO",
  Honduras: "HN",
};

function parseMoney(value: string) {
  return Number(value.replace(/[^\d.-]/g, "")) || 0;
}

function boxProfitDisplay(box: string[]) {
  const profit = parseMoney(box[1] || "0") - parseMoney(box[2] || "0");
  return `$${Math.max(profit, 0)}`;
}

type SaleInvoicePaperProps = {
  invoiceNumber: string;
  sender: Sender;
  recipient: Recipient;
  box: string[];
  deliveryLine: string;
  className?: string;
};

function SaleInvoicePaper({
  invoiceNumber,
  sender,
  recipient,
  box,
  deliveryLine,
  className,
}: SaleInvoicePaperProps) {
  const issuedAt = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <article
      className={`w-full shrink-0 overflow-hidden rounded-sm border border-slate-300 bg-[#fdfcf8] text-slate-900 shadow-[0_1px_0_rgba(0,0,0,0.06),0_6px_18px_rgba(0,0,0,0.1)] ${className ?? ""}`}
    >
      <div className="border-b border-dashed border-slate-300 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-serif text-lg font-black tracking-tight text-slate-900">Paquemas</p>
            <p className="text-[11px] font-medium text-slate-600">Paqueteria y envios internacionales</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Factura</p>
            <p className="font-serif text-xl font-black tabular-nums text-slate-900">{invoiceNumber}</p>
            <p className="text-[11px] text-slate-600">{issuedAt}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-b border-slate-200 px-4 py-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Remitente</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{personFullName(sender)}</p>
          <p className="text-xs text-slate-700">{senderPhonesLabel(sender)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Destinatario</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">{personFullName(recipient)}</p>
          <p className="text-xs text-slate-600">
            {[recipient.city, recipient.country].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-600">
              <th className="pb-1.5 font-bold">Concepto</th>
              <th className="pb-1.5 text-right font-bold">Importe</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            <tr className="border-b border-slate-200">
              <td className="py-2 pr-2 align-top">
                <p className="font-bold">Caja {box[0]}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {box[3]} · {box[4]} · {recipient.country}
                </p>
              </td>
              <td className="py-2 text-right align-top font-bold tabular-nums">{box[1]}</td>
            </tr>
            <tr>
              <td className="py-2 pr-2 align-top">
                <p className="font-bold">Entrega caja vacia</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{deliveryLine}</p>
              </td>
              <td className="py-2 text-right align-top tabular-nums text-slate-500">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-300 bg-slate-100/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-700">
          <span>Costo carrier</span>
          <span className="font-semibold tabular-nums">{box[2]}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-300 pt-2">
          <span className="text-sm font-black uppercase tracking-wide text-slate-900">Total a cobrar</span>
          <span className="font-serif text-2xl font-black tabular-nums text-slate-900">{box[1]}</span>
        </div>
        <p className="mt-1 text-right text-[11px] text-slate-500">Ganancia: {boxProfitDisplay(box)}</p>
      </div>
    </article>
  );
}

type AddressSuggestResponse = {
  ok?: boolean;
  error?: string;
  suggestions?: AddressSuggestion[];
};

function applyAddressSuggestResult(
  data: AddressSuggestResponse,
  responseOk: boolean,
  setSuggestions: (suggestions: AddressSuggestion[]) => void,
  setValidation: (validation: AddressValidation) => void,
) {
  if (!responseOk || data.ok === false) {
    setSuggestions([]);
    if (data.error?.includes("GOOGLE_MAPS_API_KEY")) {
      setValidation({
        status: "invalid",
        message: "Configura GOOGLE_MAPS_API_KEY en .env.local y reinicia el servidor",
      });
    } else if (data.error) {
      setValidation({ status: "invalid", message: data.error });
    }
    return;
  }

  setSuggestions(data.suggestions || []);
}

const inputClass =
  "h-11 min-w-0 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-[#f8fafc] outline-none focus:border-black";
const compactInputClass =
  "h-8 min-w-0 rounded-md border border-black bg-[#101820] px-2.5 text-xs font-black text-[#f8fafc] outline-none ring-1 ring-black focus:ring-2 focus:ring-emerald-400";
const clientFormInputClass =
  "client-form-field h-11 w-full rounded-lg border border-black bg-surface-inset px-3.5 text-[15px] font-bold text-[#f8fafc] outline-none transition placeholder:font-bold placeholder:text-slate-500 focus:border-black focus:bg-surface-panel focus:ring-2 focus:ring-emerald-400";
const clientFormLabelClass =
  "text-[11px] font-black uppercase tracking-[0.1em] text-slate-400";
const noBrowserAutocomplete = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function senderPrimaryPhone(sender: Pick<Sender, "phones">) {
  return sender.phones[0]?.trim() || "";
}

function senderPhoneKey(sender: Pick<Sender, "phones">) {
  return cleanPhone(senderPrimaryPhone(sender));
}

function senderPhonesLabel(sender: Pick<Sender, "phones">) {
  return sender.phones.filter(Boolean).join(" · ");
}

function senderHasPhone(sender: Pick<Sender, "phones">, phone: string) {
  const target = cleanPhone(phone);
  if (!target) {
    return false;
  }

  return sender.phones.some((entry) => cleanPhone(entry) === target);
}

function normalizePhoneList(phones: string[]) {
  return phones.map((phone) => phone.trim()).filter(Boolean);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function CountryBadge({ country }: { country: string }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-black bg-surface-card-header px-2.5 text-[13px] font-black text-[#f8fafc] shadow-[0_8px_18px_rgba(0,0,0,0.22)]">
      <Flag country={country} />
      <span className="leading-none">{country}</span>
    </span>
  );
}

function Flag({ country }: { country: string }) {
  const base = "h-[18px] w-[30px] overflow-hidden rounded-[5px] border border-black shadow-[0_1px_0_rgba(255,255,255,0.12),0_6px_12px_rgba(0,0,0,0.22)]";

  if (country === "Mexico") {
    return (
      <span className={`${base} grid grid-cols-3 bg-white`}>
        <span className="bg-[#07865f]" />
        <span className="relative bg-[#f8fafc]">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9a6b2f]" />
        </span>
        <span className="bg-[#d6262f]" />
      </span>
    );
  }

  if (country === "Guatemala") {
    return (
      <span className={`${base} grid grid-cols-3 bg-white`}>
        <span className="bg-[#1597d3]" />
        <span className="relative bg-[#f8fafc]">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#88a45c]" />
        </span>
        <span className="bg-[#1597d3]" />
      </span>
    );
  }

  if (country === "Colombia") {
    return (
      <span className={`${base} grid grid-rows-4`}>
        <span className="row-span-2 bg-yellow-400" />
        <span className="bg-blue-600" />
        <span className="bg-red-600" />
      </span>
    );
  }

  if (country === "Honduras") {
    return (
      <span className={`${base} grid grid-rows-3 bg-white`}>
        <span className="bg-[#1f9bd7]" />
        <span className="relative bg-[#f8fafc]">
          <span className="absolute left-[10px] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#1f9bd7]" />
          <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1f9bd7]" />
          <span className="absolute right-[10px] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[#1f9bd7]" />
        </span>
        <span className="bg-[#1f9bd7]" />
      </span>
    );
  }

  if (country === "USA") {
    return (
      <span className={`${base} relative bg-red-600`}>
        <span className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,#b91c1c_0_2px,#fff_2px_4px)]" />
        <span className="absolute left-0 top-0 h-2.5 w-3.5 bg-blue-700" />
      </span>
    );
  }

  return (
    <span className={`${base} flex items-center justify-center bg-slate-300 text-[9px]`}>
      {countryCodes[country] || "--"}
    </span>
  );
}

function AddressTags({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div
          key={`${label}-${value}`}
          className="rounded-lg border border-black bg-surface-panel px-3 py-2 border-black bg-surface-card"
        >
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="truncate text-sm font-black text-[#f8fafc]">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

const contextActiveClass =
  "scale-[1.01] border-2 border-emerald-400 bg-surface-card shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_6px_20px_rgba(0,0,0,0.22)]";
const selectedCardClass = `${selectedBorderClass} bg-surface-card`;
const senderCardClass =
  "border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:border-black hover:bg-surface-card-hover";
const recipientCardClass =
  "border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:border-black hover:bg-surface-card-hover";
const boxCardClass =
  "border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:border-black hover:bg-surface-card-hover";
const saleSteps: { id: SaleStep; label: string }[] = [
  { id: "client", label: "Cliente" },
  { id: "recipient", label: "Destino" },
  { id: "box", label: "Caja" },
  { id: "delivery", label: "Entrega" },
  { id: "finish", label: "Final" },
];

type SaleFlowNavProps = {
  activeStep: SaleStep;
  activeStepIndex: number;
  completedStepIndex: number;
  maxUnlockedStepIndex: number;
  canOpenStep: (step: SaleStep) => boolean;
  openStep: (step: SaleStep) => void;
  goStep: (direction: -1 | 1) => void;
  variant?: "float" | "panel";
};

function SaleFlowNav({
  activeStep,
  activeStepIndex,
  completedStepIndex,
  maxUnlockedStepIndex,
  canOpenStep,
  openStep,
  goStep,
  variant = "float",
}: SaleFlowNavProps) {
  const currentStep = saleSteps[activeStepIndex] ?? saleSteps[0];

  const flowPanel = (
    <div className="rounded-xl border border-black bg-surface-panel p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)] ring-1 ring-black">
          <div className="mb-3 border-b border-black pb-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
              Flujo de venta
            </p>
            <p className="text-[11px] font-black text-slate-500">
              Paso {activeStepIndex + 1} de {saleSteps.length}
            </p>
          </div>
          <div className="grid gap-2">
            {saleSteps.map((step, index) => {
              const isActive = activeStep === step.id;
              const isUnlocked = canOpenStep(step.id);
              const isDone = index < completedStepIndex;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!isUnlocked}
                  onClick={() => openStep(step.id)}
                  className={`relative flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${saleStepButtonClass(
                    isActive,
                    isUnlocked,
                  )}`}
                  title={step.label}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-black ${
                      isActive
                        ? "bg-slate-950 text-emerald-300"
                        : isDone
                          ? "bg-emerald-400 text-slate-950"
                          : "bg-surface-inset text-slate-400"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{step.label}</span>
                    <span
                      className={`block text-[10px] font-black uppercase ${
                        isActive ? "text-slate-800" : "text-slate-500"
                      }`}
                    >
                      {isActive ? "Actual" : isDone ? "Listo" : isUnlocked ? "Abierto" : "Bloqueado"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => goStep(-1)}
              disabled={activeStepIndex <= 0}
              className="flex h-10 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goStep(1)}
              disabled={activeStepIndex >= maxUnlockedStepIndex}
              className="flex h-10 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] hover:border-black disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
    </div>
  );

  if (variant === "panel") {
    return flowPanel;
  }

  return (
    <>
      <aside className="sticky top-3 z-40 hidden md:block">
        {flowPanel}
      </aside>

      <div className="fixed inset-x-3 bottom-3 z-50 md:hidden">
        <div className="rounded-xl border border-black bg-surface-panel p-2 shadow-2xl shadow-black ring-1 ring-black">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => goStep(-1)}
              disabled={activeStepIndex <= 0}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => openStep(currentStep.id)}
              className="min-w-0 rounded-lg border border-emerald-600 bg-emerald-400 px-3 py-2 text-left text-slate-950"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-base font-black text-[#f8fafc]">{currentStep.label}</span>
                <span className="shrink-0 rounded-md bg-emerald-400 px-2 py-1 text-xs font-black text-slate-950">
                  {activeStepIndex + 1}/5
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {saleSteps.map((step, index) => {
                  const isActive = activeStep === step.id;
                  const isDone = index < completedStepIndex;
                  const isUnlocked = canOpenStep(step.id);

                  return (
                    <span
                      key={step.id}
                      className={`h-1.5 flex-1 rounded-full ${
                        isActive || isDone
                          ? "bg-emerald-300"
                          : isUnlocked
                            ? "bg-surface-card"
                            : "bg-[#1f2937]"
                      }`}
                    />
                  );
                })}
              </div>
            </button>

            <button
              type="button"
              onClick={() => goStep(1)}
              disabled={activeStepIndex >= maxUnlockedStepIndex}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-black bg-surface-card text-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-30"
              title="Paso siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function VentaPage() {
  const setShellConfig = useSetShellConfig();
  const [mode, setMode] = useState<"sale" | "clients" | "new-client" | "new-recipient">("sale");
  const [activeStep, setActiveStep] = useState<SaleStep>("client");
  const [senderList, setSenderList] = useState<Sender[]>(initialSenders);
  const [selectedSender, setSelectedSender] = useState<Sender | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [selectedBox, setSelectedBox] = useState<string[] | null>(null);
  const [senderQuery, setSenderQuery] = useState("");
  const [senderPage, setSenderPage] = useState(0);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientPage, setRecipientPage] = useState(0);
  const [recentSenderPage, setRecentSenderPage] = useState(0);
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
  const [editingClientPhone, setEditingClientPhone] = useState<string | null>(null);
  const [deleteConfirmPhone, setDeleteConfirmPhone] = useState<string | null>(null);
  const [recipientAddressValidation, setRecipientAddressValidation] = useState<AddressValidation>({
    status: "idle",
    message: "",
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [activeCopyGroup, setActiveCopyGroup] = useState<string | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceSequence, setInvoiceSequence] = useState(124);
  const [invoiceNumber, setInvoiceNumber] = useState("INV-000124");
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
  const activeStepIndex = saleSteps.findIndex((step) => step.id === activeStep);
  const completedStepIndex = saleSteps.findIndex((step) => step.id === completedStep);
  const maxUnlockedStepIndex = completedStepIndex;

  function canOpenStep(step: SaleStep) {
    return saleSteps.findIndex((currentStep) => currentStep.id === step) <= maxUnlockedStepIndex;
  }

  function openStep(step: SaleStep) {
    if (!canOpenStep(step)) {
      return;
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

  function goStep(direction: -1 | 1) {
    const nextIndex = Math.min(
      maxUnlockedStepIndex,
      Math.max(0, activeStepIndex + direction),
    );

    const nextStep = saleSteps[nextIndex].id;
    setActiveStep(nextStep);
    scrollToStep(nextStep);
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
      if (editingClientPhone && senderPhoneKey(sender) === cleanPhone(editingClientPhone)) {
        return false;
      }

      return newClientPhoneList.some((phone) => senderHasPhone(sender, phone));
    });
  }, [editingClientPhone, newClientPhoneList, senderList]);

  const recentSenderPageCount = Math.max(
    1,
    Math.ceil(senderList.length / RECENT_SENDERS_PER_PAGE),
  );
  const safeRecentSenderPage = Math.min(recentSenderPage, recentSenderPageCount - 1);
  const visibleRecentSenders = senderList.slice(
    safeRecentSenderPage * RECENT_SENDERS_PER_PAGE,
    safeRecentSenderPage * RECENT_SENDERS_PER_PAGE + RECENT_SENDERS_PER_PAGE,
  );
  const totalRecipients = useMemo(
    () => senderList.reduce((total, sender) => total + sender.recipients.length, 0),
    [senderList],
  );
  const sendersWithoutRecipients = useMemo(
    () => senderList.filter((sender) => sender.recipients.length === 0).length,
    [senderList],
  );
  const topDestinationCountries = useMemo(() => {
    const totals = new Map<string, number>();

    senderList.forEach((sender) => {
      sender.recipients.forEach((recipient) => {
        totals.set(recipient.country, (totals.get(recipient.country) || 0) + 1);
      });
    });

    return Array.from(totals.entries())
      .sort((first, second) => second[1] - first[1])
      .slice(0, 4);
  }, [senderList]);

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
        samePersonName(recipient, candidate) && recipient.country === newRecipientCountry,
    );
  }, [
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

  const boxesForCountry = useMemo(
    () =>
      selectedRecipient
        ? countryBoxes[selectedRecipient.country as keyof typeof countryBoxes] || []
        : [],
    [selectedRecipient],
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
    setRecentSenderPage((current) =>
      Math.min(current, Math.max(0, recentSenderPageCount - 1)),
    );
  }, [recentSenderPageCount]);

  useEffect(() => {
    setSenderPage((current) => Math.min(current, Math.max(0, senderPageCount - 1)));
  }, [senderPageCount]);

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
    setSelectedSender(sender);
    setSelectedRecipient(null);
    setSelectedBox(null);
    setEmptyBoxMode("");
    setEmptyBoxScheduleMode("");
    setEmptyBoxScheduleAt("");
    setRecipientPage(0);
    setActiveStep("recipient");
    scrollToNext(recipientsRef);
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
    setClientAddressSearch("");
    setClientAddressSuggestions([]);
    setClientAddressValidation({ status: "idle", message: "" });
    setEditingClientPhone(null);
    setDeleteConfirmPhone(null);
    setRecentSenderPage(0);
  }

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

      setValidation({
        status: "valid",
        message: needsUnit
          ? "Validada — agrega unidad o apt en Casa si aplica"
          : "Direccion valida",
        formattedAddress: data.address.formattedAddress,
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
    setClientAddressValidation((current) =>
      current.status === "valid"
        ? { ...current, message: "Puedes corregir unidad o detalles" }
        : { status: "idle", message: "" },
    );
  }

  function touchRecipientAddressField(update: () => void) {
    update();
    setRecipientAddressValidation((current) =>
      current.status === "valid"
        ? { ...current, message: "Puedes corregir unidad o detalles" }
        : { status: "idle", message: "" },
    );
  }

  useEffect(() => {
    const query = clientAddressSearch.trim();

    if (clientAddressValidation.status === "valid" || query.length < 3) {
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
  }, [clientAddressSearch, clientAddressValidation.status]);

  useEffect(() => {
    const query = recipientAddressSearch.trim();

    if (recipientAddressValidation.status === "valid" || query.length < 3 || !newRecipientCountry) {
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
  }, [newRecipientCountry, recipientAddressSearch, recipientAddressValidation.status]);

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

  function createClient() {
    const phones = normalizePhoneList(newClientPhones);

    if (!phones.length) {
      return;
    }

    if (duplicateClient) {
      if (editingClientPhone) {
        return;
      }

      chooseSender(duplicateClient);
      setMode("sale");
      return;
    }

    if (!newClientFirstName.trim() || !newClientLastName.trim()) {
      return;
    }

    if (clientAddressValidation.status !== "valid") {
      setClientAddressValidation({
        status: "invalid",
        message: "Primero valida direccion en Google",
      });
      return;
    }

    const currentSender = editingClientPhone
      ? senderList.find((sender) => senderPhoneKey(sender) === cleanPhone(editingClientPhone))
      : null;
    const nextSender: Sender = {
      firstName: newClientFirstName.trim(),
      lastName: newClientLastName.trim(),
      phones,
      email: newClientEmail.trim(),
      street: newClientStreet.trim() || "Sin calle",
      houseNumber: newClientHouse.trim() || "-",
      neighborhood: newClientNeighborhood.trim() || "-",
      city: newClientCity.trim() || "-",
      state: newClientState.trim() || "FL",
      postalCode: newClientPostalCode.trim() || "-",
      recipients: currentSender?.recipients || [],
    };

    setSenderList((current) =>
      editingClientPhone
        ? current.map((sender) =>
            senderPhoneKey(sender) === cleanPhone(editingClientPhone) ? nextSender : sender,
          )
        : [nextSender, ...current],
    );
    chooseSender(nextSender);
    resetNewClientForm();
    setMode("sale");
  }

  function editSender(sender: Sender) {
    setNewClientFirstName(sender.firstName);
    setNewClientLastName(sender.lastName);
    setNewClientPhones(sender.phones.length ? [...sender.phones] : [""]);
    setNewClientEmail(sender.email);
    setNewClientStreet(sender.street);
    setNewClientHouse(sender.houseNumber);
    setNewClientNeighborhood(sender.neighborhood);
    setNewClientCity(sender.city);
    setNewClientState(sender.state);
    setNewClientPostalCode(sender.postalCode);
    setClientAddressSearch([
      sender.houseNumber,
      sender.street,
      sender.city,
      sender.state,
      sender.postalCode,
      "USA",
    ].filter(Boolean).join(", "));
    setClientAddressSuggestions([]);
    setClientAddressValidation({
      status: "valid",
      message: "Direccion cargada",
      formattedAddress: [
        sender.houseNumber,
        sender.street,
        sender.neighborhood,
        sender.city,
        sender.state,
        sender.postalCode,
        "USA",
      ].filter(Boolean).join(", "),
    });
    setEditingClientPhone(senderPrimaryPhone(sender));
    setDeleteConfirmPhone(null);
    setMode("new-client");
  }

  function deleteSender(sender: Sender) {
    setSenderList((current) =>
      current.filter((item) => senderPhoneKey(item) !== senderPhoneKey(sender)),
    );

    if (selectedSender && senderPhoneKey(selectedSender) === senderPhoneKey(sender)) {
      setSelectedSender(null);
      setSelectedRecipient(null);
      setSelectedBox(null);
      setActiveStep("client");
    }

    if (editingClientPhone && cleanPhone(editingClientPhone) === senderPhoneKey(sender)) {
      resetNewClientForm();
    }

    setDeleteConfirmPhone(null);
  }

  function createRecipient() {
    if (
      !selectedSender ||
      !newRecipientFirstName.trim() ||
      !newRecipientLastName.trim() ||
      !newRecipientPhone.trim() ||
      !newRecipientCountry
    ) {
      return;
    }

    if (duplicateRecipient) {
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

    const nextRecipient: Recipient = {
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

    const nextSender = {
      ...selectedSender,
      recipients: [nextRecipient, ...selectedSender.recipients],
    };

    setSenderList((current) =>
      current.map((sender) =>
        senderPhoneKey(sender) === senderPhoneKey(selectedSender) ? nextSender : sender,
      ),
    );
    setSelectedSender(nextSender);
    chooseRecipient(nextRecipient);
    resetNewRecipientForm();
    setMode("sale");
  }

  function chooseRecipient(recipient: Recipient) {
    setSelectedRecipient(recipient);
    setSelectedBox(null);
    setEmptyBoxMode("");
    setEmptyBoxScheduleMode("");
    setEmptyBoxScheduleAt("");
    setActiveStep("box");
    scrollToNext(boxesRef);
  }

  function chooseBox(box: string[]) {
    setSelectedBox(box);
    setActiveStep("delivery");
    scrollToNext(deliveryRef);
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

  function openInvoice() {
    if (!deliveryComplete) {
      return;
    }

    setInvoiceNumber(nextInvoiceNumber);
    setShowInvoice(true);
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

  useEffect(() => {
    setShellConfig({
      compactContent:
        mode === "sale" || mode === "clients" ? (
          <SaleFlowNav
            activeStep={activeStep}
            activeStepIndex={activeStepIndex}
            completedStepIndex={completedStepIndex}
            maxUnlockedStepIndex={maxUnlockedStepIndex}
            canOpenStep={canOpenStep}
            openStep={openStep}
            goStep={goStep}
            variant="panel"
          />
        ) : null,
      compactNavFocusKey: `${activeStep}-${completedStepIndex}`,
    });

    return () => setShellConfig({});
  }, [activeStep, activeStepIndex, completedStepIndex, maxUnlockedStepIndex, mode, setShellConfig]);

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
      <div className="min-w-0">

      {mode === "clients" || mode === "sale" ? (
        <div
          ref={clientRef}
          className={stepShellClass("client")}
        >
        <Panel title="Clientes">
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} w-full pl-12`}
                placeholder="Buscar remitente o telefono"
                value={senderQuery}
                onChange={(event) => {
                  setSenderQuery(event.target.value);
                  setSenderPage(0);
                }}
              />
            </div>
            <button
              onClick={() => setMode("new-client")}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950"
            >
              <UserPlus className="h-6 w-6" />
              Nuevo cliente
            </button>
          </div>

          <div className="relative">
            <div className="mb-3 flex justify-start">
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSenderPage((current) => Math.max(0, current - 1))}
                  disabled={safeSenderPage === 0 || filteredSenders.length === 0}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600"
                  aria-label="Remitentes anteriores"
                  title="Anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-[3.25rem] rounded-md border border-black bg-surface-card px-2 py-1 text-center text-xs font-black text-[#f8fafc]">
                  {filteredSenders.length ? safeSenderPage + 1 : 0}/{filteredSenders.length ? senderPageCount : 0}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSenderPage((current) => Math.min(senderPageCount - 1, current + 1))
                  }
                  disabled={
                    filteredSenders.length === 0 || safeSenderPage >= senderPageCount - 1
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600"
                  aria-label="Remitentes siguientes"
                  title="Siguiente"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {visibleSenders.length ? visibleSenders.map((sender) => (
              <button
                key={senderPhoneKey(sender)}
                data-sale-context-key={`sender:${senderPhoneKey(sender)}`}
                data-sale-context-type="remitente"
                data-sale-context-title={personFullName(sender)}
                data-sale-context-first-name={sender.firstName}
                data-sale-context-last-name={sender.lastName}
                data-sale-context-phones={sender.phones.join("|")}
                data-sale-context-street={sender.street}
                data-sale-context-house={sender.houseNumber}
                data-sale-context-neighborhood={sender.neighborhood}
                data-sale-context-city={sender.city}
                data-sale-context-state={sender.state}
                data-sale-context-postal-code={sender.postalCode}
                data-sale-context-country="USA"
                onClick={() => chooseSender(sender)}
                onContextMenu={(event) =>
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
                className={`relative overflow-hidden rounded-xl border p-4 text-left shadow-none transition-all ${
                  contextCardClass(
                    "remitente",
                    `sender:${senderPhoneKey(sender)}`,
                    selectedSender !== null && senderPhoneKey(selectedSender) === senderPhoneKey(sender),
                    senderCardClass,
                    selectedSender !== null,
                  )
                }`}
              >
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div>
                    <p className="text-2xl font-black">{personFullName(sender)}</p>
                    <p className="font-bold text-slate-400">
                      {senderPhonesLabel(sender)}
                    </p>
                    {sender.email ? (
                      <p className="text-sm font-bold text-slate-400">{sender.email}</p>
                    ) : null}
                  </div>
                  <CountryBadge country="USA" />
                </div>
                <AddressTags
                  items={[
                    ["Calle", sender.street],
                    ["Casa", sender.houseNumber],
                    ["Colonia", sender.neighborhood],
                    ["Ciudad", sender.city],
                    ["Estado", sender.state],
                    ["CP", sender.postalCode],
                  ]}
                />
                <p className="mt-3 rounded-lg border border-black bg-surface-inset px-3 py-2 font-black text-[#f8fafc]">
                  {sender.recipients.length} destinatarios
                </p>
              </button>
            )) : (
              <div className="rounded-xl border border-black bg-surface-card p-4 text-xl font-black border-black bg-surface-card">
                Sin clientes
              </div>
            )}
            </div>
          </div>
        </Panel>
        </div>
      ) : null}

      {mode === "new-client" ? (
        <div className="grid w-full items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <section className="rounded-xl border border-black bg-surface-panel p-5 shadow-md sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <h3 className="truncate text-2xl font-black">
                {editingClientPhone ? "Editar remitente" : "Nuevo cliente"}
              </h3>
              <span
                className={`rounded-lg border px-3 py-1 text-xs font-black uppercase ${
                  clientAddressValidation.status === "valid"
                    ? "border-black bg-surface-inset text-slate-200"
                    : clientAddressValidation.status === "invalid"
                      ? "border-amber-600 bg-amber-400 text-slate-950"
                      : "border-black bg-surface-card text-slate-300"
                }`}
              >
                {clientAddressValidation.status === "valid"
                  ? "Google OK"
                  : clientAddressValidation.status === "invalid" && clientAddressValidation.message
                    ? "Error direccion"
                    : "Sin validar"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  resetNewClientForm();
                  setMode("sale");
                }}
                className="h-11 rounded-lg border border-black bg-surface-card px-4 text-sm font-black text-[#f8fafc]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={createClient}
                disabled={
                  !newClientPhoneList.length ||
                  (!duplicateClient &&
                    (!newClientFirstName.trim() ||
                      !newClientLastName.trim() ||
                      clientAddressValidation.status !== "valid"))
                }
                className="h-11 rounded-lg bg-emerald-400 px-5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingClientPhone ? "Guardar" : duplicateClient ? "Usar existente" : "Crear cliente"}
              </button>
            </div>
          </div>

          <form
            className="relative grid gap-4 xl:grid-cols-2 xl:items-start"
            autoComplete="off"
            onSubmit={(event) => event.preventDefault()}
          >
            <div
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
              aria-hidden
            >
              <input tabIndex={-1} name="fake-street" autoComplete="street-address" readOnly />
              <input tabIndex={-1} name="fake-city" autoComplete="address-level2" readOnly />
            </div>
            <div className="flex flex-col self-start overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <div className={cardHeaderClass}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-slate-300">
                  <UserPlus className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-wide text-[#f8fafc]">Remitente</p>
                  <p className="text-xs font-bold text-slate-400">Nombre, correo y telefonos</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5">
                    <span className={clientFormLabelClass}>Nombre</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-first-name"
                      className={clientFormInputClass}
                      placeholder="Carlos"
                      value={newClientFirstName}
                      onChange={(event) => setNewClientFirstName(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className={clientFormLabelClass}>Apellido</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-last-name"
                      className={clientFormInputClass}
                      placeholder="Diaz"
                      value={newClientLastName}
                      onChange={(event) => setNewClientLastName(event.target.value)}
                    />
                  </label>
                </div>

                <label className="grid gap-1.5">
                  <span className={clientFormLabelClass}>Correo</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-email"
                      type="email"
                      className={`${clientFormInputClass} pl-10`}
                      placeholder="cliente@correo.com"
                      value={newClientEmail}
                      onChange={(event) => setNewClientEmail(event.target.value)}
                    />
                  </div>
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={clientFormLabelClass}>Telefonos</span>
                    <button
                      type="button"
                      onClick={addClientPhone}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-black bg-emerald-400 px-2.5 text-xs font-black text-slate-950"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar
                    </button>
                  </div>
                  {newClientPhones.map((phone, index) => (
                    <div key={`client-phone-${index}`} className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          {...noBrowserAutocomplete}
                          name={`paquemas-client-phone-${index}`}
                          type="tel"
                          className={`${clientFormInputClass} pl-10`}
                          placeholder={index === 0 ? "(305) 555-0000" : "Otro telefono"}
                          value={phone}
                          onChange={(event) => updateClientPhone(index, event.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        title="Quitar telefono"
                        aria-label="Quitar telefono"
                        disabled={newClientPhones.length === 1}
                        onClick={() => removeClientPhone(index)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-black bg-[#3A1818] text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {duplicateClient ? (
                  <div className="rounded-lg border border-amber-600 bg-amber-400 px-3 py-2.5 text-slate-950">
                    <p className="text-xs font-black uppercase text-amber-200">Telefono ya registrado</p>
                    <p className="truncate text-sm font-black text-[#f8fafc]">
                      {personFullName(duplicateClient)}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_6px_20px_rgba(0,0,0,0.18)]">
              <div className={cardHeaderClass}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-slate-300">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black uppercase tracking-wide text-[#f8fafc]">Direccion USA</p>
                  <p className="text-xs font-bold text-slate-400">Buscar y validar en Google</p>
                </div>
              </div>
              <div className="space-y-3 p-4">
                <label className="grid gap-1.5">
                  <span className={clientFormLabelClass}>Busqueda</span>
                  <div className="relative">
                  <input
                    {...noBrowserAutocomplete}
                    name="paquemas-client-gmaps-query"
                    type="search"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={clientAddressSuggestions.length > 0}
                    className={clientFormInputClass}
                    placeholder="Buscar calle o lugar en Google"
                    value={clientAddressSearch}
                    onChange={(event) => {
                      const nextSearch = event.target.value;
                      setClientAddressSearch(nextSearch);
                      if (nextSearch.trim().length < 3) {
                        setClientAddressSuggestions([]);
                      }
                      setClientAddressValidation({ status: "idle", message: "" });
                    }}
                  />
                  {clientAddressSuggestions.length ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-black bg-[#101820] shadow-2xl">
                      {clientAddressSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          onClick={() => void selectAddressSuggestion("client", suggestion)}
                          className="grid w-full gap-0.5 border-b border-black px-4 py-3 text-left last:border-b-0 hover:bg-surface-card-header"
                        >
                          <span className="truncate text-sm font-black text-[#f8fafc]">
                            {suggestion.mainText}
                          </span>
                          <span className="truncate text-xs font-bold text-slate-300">
                            {suggestion.secondaryText}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                </label>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_6.5rem_5.5rem]">
                  <label className="grid min-w-0 gap-1.5">
                    <span className={clientFormLabelClass}>Calle</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-line-1"
                      className={clientFormInputClass}
                      placeholder="Calle"
                      value={newClientStreet}
                      onChange={(event) => {
                        touchClientAddressField(() => setNewClientStreet(event.target.value));
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className={clientFormLabelClass}>Unidad</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-line-2"
                      className={clientFormInputClass}
                      placeholder="511"
                      value={newClientHouse}
                      onChange={(event) => {
                        touchClientAddressField(() => setNewClientHouse(event.target.value));
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className={clientFormLabelClass}>CP</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-zip"
                      className={clientFormInputClass}
                      placeholder="CP"
                      value={newClientPostalCode}
                      onChange={(event) => {
                        touchClientAddressField(() => setNewClientPostalCode(event.target.value));
                      }}
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem]">
                  <label className="grid min-w-0 gap-1.5">
                    <span className={clientFormLabelClass}>Colonia</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-zone"
                      className={clientFormInputClass}
                      placeholder="Colonia"
                      value={newClientNeighborhood}
                      onChange={(event) => {
                        touchClientAddressField(() => setNewClientNeighborhood(event.target.value));
                      }}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5">
                    <span className={clientFormLabelClass}>Ciudad</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-city"
                      className={clientFormInputClass}
                      placeholder="Ciudad"
                      value={newClientCity}
                      onChange={(event) => {
                        touchClientAddressField(() => setNewClientCity(event.target.value));
                      }}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className={clientFormLabelClass}>Estado</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-client-region"
                      className={clientFormInputClass}
                      placeholder="FL"
                      value={newClientState}
                      onChange={(event) => {
                        touchClientAddressField(() => setNewClientState(event.target.value));
                      }}
                    />
                  </label>
                </div>

                <p
                  className={`rounded-lg border px-3.5 py-2.5 text-sm font-bold leading-snug break-words ${
                    clientAddressValidation.status === "valid"
                      ? "border-black bg-surface-inset text-slate-300"
                      : clientAddressValidation.status === "invalid"
                        ? "border-amber-600 bg-amber-400 text-slate-950"
                        : "border-black bg-surface-inset text-slate-500"
                  }`}
                >
                  {clientAddressValidation.formattedAddress || clientAddressValidation.message || "Elige una sugerencia de Google"}
                </p>
              </div>
            </div>
          </form>
        </section>
        <section className="flex min-h-0 flex-col rounded-lg border border-black bg-surface-panel p-3 shadow-md">
          <div className="-mx-3 -mt-3 mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black bg-surface-card-header px-3 py-2.5 sm:-mx-3">
            <div className="min-w-0">
              <h3 className="text-base font-black text-[#f8fafc]">Ultimos remitentes</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRecentSenderPage((current) => Math.max(0, current - 1))}
                disabled={safeRecentSenderPage === 0 || senderList.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600"
                aria-label="Remitentes anteriores"
                title="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="min-w-[3.25rem] rounded-md border border-black bg-surface-card px-2 py-1 text-center text-xs font-black text-[#f8fafc]">
                {senderList.length ? safeRecentSenderPage + 1 : 0}/{senderList.length ? recentSenderPageCount : 0}
              </span>
              <button
                type="button"
                onClick={() =>
                  setRecentSenderPage((current) =>
                    Math.min(recentSenderPageCount - 1, current + 1),
                  )
                }
                disabled={
                  senderList.length === 0 || safeRecentSenderPage >= recentSenderPageCount - 1
                }
                className="flex h-8 w-8 items-center justify-center rounded-md border border-black bg-emerald-400 text-slate-950 disabled:cursor-not-allowed disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600"
                aria-label="Remitentes siguientes"
                title="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={resetNewClientForm}
                className="h-8 rounded-md border border-black bg-surface-card px-3 text-xs font-black text-[#f8fafc]"
              >
                Nuevo
              </button>
            </div>
          </div>

          <div className="flex min-h-[320px] flex-1 flex-col gap-2">
            {visibleRecentSenders.length ? visibleRecentSenders.map((sender) => (
              <div
                key={`${senderPhoneKey(sender)}-${sender.firstName}-${sender.lastName}`}
                className="group relative flex min-h-0 flex-1 flex-col rounded-lg border border-black bg-surface-card p-3 shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition-colors hover:border-black hover:bg-surface-card-hover"
              >
                <div className="absolute bottom-2 left-2 z-10 flex w-[8.25rem] gap-1.5">
                  {deleteConfirmPhone === senderPhoneKey(sender) ? (
                    <>
                      <button
                        type="button"
                        title="Cancelar"
                        aria-label="Cancelar"
                        onClick={() => setDeleteConfirmPhone(null)}
                        className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-md border border-black bg-[#101820] text-[#f8fafc]"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        title="Confirmar borrar"
                        aria-label="Confirmar borrar"
                        onClick={() => deleteSender(sender)}
                        className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-md border border-black bg-[#7F1D1D] text-rose-100"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => {
                          setDeleteConfirmPhone(null);
                          editSender(sender);
                        }}
                        className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-md border border-black bg-[#101820] text-[#f8fafc]"
                      >
                        <Edit3 className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        title="Borrar"
                        aria-label="Borrar"
                        onClick={() => setDeleteConfirmPhone(senderPhoneKey(sender))}
                        className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-md border border-black bg-[#3A1818] text-rose-100"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmPhone(null);
                    chooseSender(sender);
                    setMode("sale");
                  }}
                  className="flex h-full min-h-0 w-full flex-col justify-between rounded-md pb-14 pr-1 pt-1 text-left shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-base font-black leading-tight">{personFullName(sender)}</p>
                    <p className="truncate text-sm font-bold text-slate-300">
                      {senderPhonesLabel(sender)} · {sender.recipients.length} dest.
                    </p>
                    {sender.email ? (
                      <p className="truncate text-xs font-bold text-slate-400">{sender.email}</p>
                    ) : null}
                  </div>
                  <p className="line-clamp-3 text-sm font-bold leading-snug text-slate-300">
                    {[sender.houseNumber, sender.street, sender.city, sender.state, sender.postalCode]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </button>
              </div>
            )) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-black bg-surface-card p-4 text-center text-sm font-black text-slate-300">
                Sin remitentes
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 xl:col-span-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
          {[
            ["Remitentes", String(senderList.length)],
            ["Destinatarios", String(totalRecipients)],
            ["Sin destino", String(sendersWithoutRecipients)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-black bg-surface-panel p-3 shadow-md"
            >
              <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
              <p className="mt-1 text-3xl font-black text-[#f8fafc]">{value}</p>
            </div>
          ))}

          <div className="rounded-lg border border-black bg-surface-panel p-3 shadow-md">
            <p className="mb-2 text-[11px] font-black uppercase text-slate-500">
              Destinos frecuentes
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {topDestinationCountries.length ? topDestinationCountries.map(([country, total]) => (
                <div
                  key={country}
                  className="flex items-center justify-between gap-3 rounded-md border border-black bg-surface-inset px-3 py-2"
                >
                  <span className="truncate text-sm font-black">{country}</span>
                  <span className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-black text-slate-950">
                    {total}
                  </span>
                </div>
              )) : (
                <div className="rounded-md border border-black bg-surface-inset px-3 py-2 text-sm font-black text-slate-300">
                  Sin destinos
                </div>
              )}
            </div>
          </div>
        </section>
        </div>
      ) : null}

      {selectedSender &&
      (mode === "clients" || mode === "sale" || mode === "new-recipient") ? (
        <div
          ref={recipientsRef}
          className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"
        >
          <Panel
            title={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>Destinatarios de {personFullName(selectedSender)}</span>
                <span className="flex items-center gap-3">
                  <button
                    onClick={() => setRecipientPage((current) => Math.max(0, current - 1))}
                    disabled={safeRecipientPage === 0}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-black bg-emerald-400 text-slate-950 shadow-sm disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600 disabled:cursor-not-allowed"
                    aria-label="Pagina anterior"
                    title="Pagina anterior"
                  >
                    <ChevronLeft className="h-7 w-7" />
                  </button>
                  <span className="min-w-20 rounded-lg border border-black bg-surface-card px-3 py-2 text-center text-base font-black text-[#f8fafc]">
                    {safeRecipientPage + 1}/{recipientPageCount}
                  </span>
                  <button
                    onClick={() =>
                      setRecipientPage((current) =>
                        Math.min(recipientPageCount - 1, current + 1),
                      )
                    }
                    disabled={safeRecipientPage >= recipientPageCount - 1}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-black bg-emerald-400 text-slate-950 shadow-sm disabled:border-black disabled:bg-[#1a211e] disabled:text-slate-600 disabled:cursor-not-allowed"
                    aria-label="Pagina siguiente"
                    title="Pagina siguiente"
                  >
                    <ChevronRight className="h-7 w-7" />
                  </button>
                </span>
              </div>
            }
          >
          <div
            className={stepShellClass("recipient")}
          >
            <div className="mb-4 flex flex-wrap gap-3">
              <button
                onClick={() => setMode("new-recipient")}
                className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950"
              >
                <Plus className="h-6 w-6" />
                Nuevo destinatario
              </button>
              <button className="h-10 rounded-lg border border-black bg-surface-card px-3 text-sm font-black text-[#f8fafc] hover:border-black">
                Pendiente
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-500" />
              <input
                className={`${inputClass} w-full pl-12`}
                placeholder="Buscar destinatario, telefono o pais"
                value={recipientQuery}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  setRecipientPage(0);
                }}
              />
            </div>

            {mode === "new-recipient" ? (
              <form
                className="relative mb-4 rounded-xl border border-black bg-surface-card p-4"
                autoComplete="off"
                onSubmit={(event) => event.preventDefault()}
              >
                <div
                  className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
                  aria-hidden
                >
                  <input tabIndex={-1} name="fake-street" autoComplete="street-address" readOnly />
                  <input tabIndex={-1} name="fake-city" autoComplete="address-level2" readOnly />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="font-black">Nombre</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-first-name"
                      className={inputClass}
                      placeholder="Nombre"
                      value={newRecipientFirstName}
                      onChange={(event) => setNewRecipientFirstName(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Apellido</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-last-name"
                      className={inputClass}
                      placeholder="Apellido"
                      value={newRecipientLastName}
                      onChange={(event) => setNewRecipientLastName(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Telefono</span>
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-phone"
                      type="tel"
                      className={inputClass}
                      placeholder="+52 55 0000 0000"
                      value={newRecipientPhone}
                      onChange={(event) => setNewRecipientPhone(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Pais obligatorio</span>
                    <select
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-country"
                      className={inputClass}
                      value={newRecipientCountry}
                      onChange={(event) => {
                        setNewRecipientCountry(event.target.value);
                        setRecipientAddressSuggestions([]);
                        setRecipientAddressValidation({ status: "idle", message: "" });
                      }}
                    >
                      <option value="">Elegir pais</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 rounded-xl border border-black bg-surface-panel p-3">
                  <div className="mb-3 grid gap-2 lg:grid-cols-[auto_1fr] lg:items-center">
                    <p className="text-base font-black">Direccion destino</p>
                    <div className="relative">
                      <input
                        {...noBrowserAutocomplete}
                        name="paquemas-recipient-gmaps-query"
                        type="search"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={recipientAddressSuggestions.length > 0}
                        className={`${inputClass} w-full`}
                        placeholder={
                          newRecipientCountry
                            ? "Buscar calle o lugar en Google"
                            : "Elige pais primero"
                        }
                        value={recipientAddressSearch}
                        onChange={(event) => {
                          const nextSearch = event.target.value;
                          setRecipientAddressSearch(nextSearch);
                          if (nextSearch.trim().length < 3) {
                            setRecipientAddressSuggestions([]);
                          }
                          setRecipientAddressValidation({ status: "idle", message: "" });
                        }}
                        disabled={!newRecipientCountry}
                      />
                      {recipientAddressSuggestions.length ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border border-black bg-[#101820] shadow-2xl">
                          {recipientAddressSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.placeId}
                              type="button"
                              onClick={() => void selectAddressSuggestion("recipient", suggestion)}
                              className="grid w-full gap-0.5 border-b border-black px-3 py-2 text-left last:border-b-0 hover:bg-surface-card-header"
                            >
                              <span className="truncate text-sm font-black text-[#f8fafc]">
                                {suggestion.mainText}
                              </span>
                              <span className="truncate text-xs font-bold text-slate-300">
                                {suggestion.secondaryText}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-line-1"
                      className={inputClass}
                      placeholder="Calle"
                      value={newRecipientStreet}
                      onChange={(event) => {
                        touchRecipientAddressField(() => setNewRecipientStreet(event.target.value));
                      }}
                    />
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-line-2"
                      className={inputClass}
                      placeholder="Unidad / apt (Ej. 511)"
                      value={newRecipientHouse}
                      onChange={(event) => {
                        touchRecipientAddressField(() => setNewRecipientHouse(event.target.value));
                      }}
                    />
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-zone"
                      className={inputClass}
                      placeholder="Colonia"
                      value={newRecipientNeighborhood}
                      onChange={(event) => {
                        touchRecipientAddressField(() => setNewRecipientNeighborhood(event.target.value));
                      }}
                    />
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-city"
                      className={inputClass}
                      placeholder="Ciudad"
                      value={newRecipientCity}
                      onChange={(event) => {
                        touchRecipientAddressField(() => setNewRecipientCity(event.target.value));
                      }}
                    />
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-region"
                      className={inputClass}
                      placeholder="Estado"
                      value={newRecipientState}
                      onChange={(event) => {
                        touchRecipientAddressField(() => setNewRecipientState(event.target.value));
                      }}
                    />
                    <input
                      {...noBrowserAutocomplete}
                      name="paquemas-recipient-zip"
                      className={inputClass}
                      placeholder="CP"
                      value={newRecipientPostalCode}
                      onChange={(event) => {
                        touchRecipientAddressField(() => setNewRecipientPostalCode(event.target.value));
                      }}
                    />
                  </div>
                  <div className="mt-3 flex min-h-9 items-center rounded-md border border-black bg-[#101820] px-3">
                    <p
                      className={`text-sm font-black ${
                        recipientAddressValidation.status === "valid"
                          ? "text-slate-400"
                          : recipientAddressValidation.status === "invalid"
                            ? "text-amber-200"
                            : "text-slate-300"
                      }`}
                    >
                      {recipientAddressValidation.formattedAddress || recipientAddressValidation.message || "Valida antes de guardar"}
                    </p>
                  </div>
                </div>

                {duplicateRecipient ? (
                  <div className="mt-3 rounded-lg border border-amber-600 bg-amber-400 p-3 font-black text-slate-950">
                    Ese destinatario ya existe para este cliente.
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetNewRecipientForm();
                      setMode("sale");
                    }}
                    className="h-10 rounded-lg border border-black bg-surface-card px-3 text-sm font-black text-[#f8fafc] hover:border-black"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={createRecipient}
                    disabled={
                      !newRecipientFirstName.trim() ||
                      !newRecipientLastName.trim() ||
                      !newRecipientPhone.trim() ||
                      !newRecipientCountry ||
                      (!duplicateRecipient && recipientAddressValidation.status !== "valid")
                    }
                    className="h-10 rounded-lg bg-emerald-400 px-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {duplicateRecipient ? "Usar existente" : "Guardar destinatario"}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="grid gap-2">
              {filteredRecipients.length ? (
                <>
              {visibleRecipients.map((recipient) => (
                <button
                  key={recipientIdentityKey(recipient)}
                  data-sale-context-key={`recipient:${recipientIdentityKey(recipient)}`}
                  data-sale-context-type="destinatario"
                  data-sale-context-title={personFullName(recipient)}
                  data-sale-context-first-name={recipient.firstName}
                  data-sale-context-last-name={recipient.lastName}
                  data-sale-context-phones={recipient.phone}
                  data-sale-context-street={recipient.street}
                  data-sale-context-house={recipient.houseNumber}
                  data-sale-context-neighborhood={recipient.neighborhood}
                  data-sale-context-city={recipient.city}
                  data-sale-context-state={recipient.state}
                  data-sale-context-postal-code={recipient.postalCode}
                  data-sale-context-country={recipient.country}
                  onClick={() => chooseRecipient(recipient)}
                  onContextMenu={(event) =>
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
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 text-left transition-all hover:-translate-y-0.5 ${
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
                    }`}
                >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-xl font-black">{personFullName(recipient)}</span>
                      <CountryBadge country={recipient.country} />
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-400">
                      {recipient.phone}
                    </span>
                    <AddressTags
                      items={[
                        ["Calle", recipient.street],
                        ["Casa", recipient.houseNumber],
                        ["Colonia", recipient.neighborhood],
                        ["Ciudad", recipient.city],
                        ["Estado", recipient.state || "-"],
                        ["CP", recipient.postalCode],
                      ]}
                    />
                  </button>
              ))}
              {Array.from({ length: emptyRecipientSlots }).map((_, index) => (
                  <button
                    key={`empty-recipient-${safeRecipientPage}-${index}`}
                    onClick={() => setMode("new-recipient")}
                    className="flex min-h-[218px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-black bg-surface-card text-slate-300 transition hover:border-black hover:bg-surface-panel hover:text-slate-300"
                  >
                    <Plus className="h-10 w-10" />
                    <span className="text-lg font-black">Agregar destinatario</span>
                  </button>
              ))}
                </>
              ) : (
                <div className="rounded-xl border border-black bg-surface-card p-4 text-xl font-black border-black bg-surface-card">
                  Sin destinatarios
                </div>
              )}
            </div>
          </div>
          </Panel>

          {selectedRecipient ? (
            <div
              ref={boxesRef}
              className={stepShellClass("box")}
            >
            <Panel
              title={
                selectedRecipient
                  ? `Cajas para ${selectedRecipient.country}`
                  : "Cajas"
              }
            >
              {!selectedRecipient ? (
                <p className="text-xl font-black text-slate-400">
                  Selecciona un destinatario.
                </p>
              ) : (
                <div className="grid gap-3">
                  {boxesForCountry.map((box) => (
                    <button
                      key={box[0]}
                      data-sale-context-key={`box:${box[0]}`}
                      data-sale-context-type="caja"
                      data-sale-context-title={`Caja ${box[0]}`}
                      onClick={() => chooseBox(box)}
                      onContextMenu={(event) =>
                        openContextMenu(event, `Caja ${box[0]}`, "caja", `box:${box[0]}`)
                      }
                      className={`relative grid gap-4 overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 lg:grid-cols-[auto_1fr_auto] ${
                        contextCardClass(
                          "caja",
                          `box:${box[0]}`,
                          selectedBox?.[0] === box[0],
                          boxCardClass,
                          selectedBox !== null,
                        )
                      }`}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-card shadow-inner bg-surface-panel">
                        <Package className="h-9 w-9 text-slate-400" />
                      </div>

                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <p className="text-2xl font-black">Caja {box[0]}</p>
                          <CountryBadge country={selectedRecipient.country} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-lg bg-surface-card px-3 py-2 text-sm font-black text-slate-300 bg-surface-panel text-slate-300">
                            Carrier: {box[3]}
                          </span>
                          <span className="rounded-lg bg-surface-card px-3 py-2 text-sm font-black text-slate-300 bg-surface-panel text-slate-300">
                            Tiempo: {box[4]}
                          </span>
                          <span className="rounded-lg bg-surface-card px-3 py-2 text-sm font-black text-slate-300 bg-surface-panel text-slate-300">
                            Costo: {box[2]}
                          </span>
                        </div>
                      </div>

                      <div className="grid min-w-44 grid-cols-2 gap-2">
                        <div className="rounded-xl border border-black bg-surface-card px-4 py-3 text-right border-black bg-surface-panel">
                          <p className="text-[11px] font-black uppercase text-slate-400">
                            Cobra
                          </p>
                          <p className="text-2xl font-black">{box[1]}</p>
                        </div>
                        <div className="rounded-xl border border-black bg-surface-card-header px-4 py-3 text-right text-slate-300">
                          <p className="text-[11px] font-black uppercase">
                            Gana
                          </p>
                          <p className="text-2xl font-black">{boxProfitDisplay(box)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedSender && selectedRecipient && selectedBox ? (
        <div
          className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-start"
        >
          <div
            ref={deliveryRef}
            className={`min-w-0 flex-1 ${stepShellClass("delivery")}`}
          >
          <Panel title="Opciones del envio">
            <div className="grid gap-5">
              <div className="flex items-center gap-3">
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
                    className={`min-h-[5.5rem] rounded-xl border p-4 text-left transition-all ${deliveryModeCardClass(
                      emptyBoxMode === "Cliente recoge caja vacia en oficina",
                      Boolean(emptyBoxMode),
                    )}`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${deliveryModeIconClass(
                          emptyBoxMode === "Cliente recoge caja vacia en oficina",
                        )}`}
                      >
                        <Package className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-black leading-tight text-[#f8fafc]">
                          En oficina
                        </span>
                        <span className="mt-0.5 block text-xs font-bold text-slate-400">
                          Cliente recibe la caja aqui
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectEmptyBoxMode("Programar entrega de caja vacia")}
                    className={`min-h-[5.5rem] rounded-xl border p-4 text-left transition-all ${deliveryModeCardClass(
                      emptyBoxMode === "Programar entrega de caja vacia",
                      Boolean(emptyBoxMode),
                    )}`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${deliveryModeIconClass(
                          emptyBoxMode === "Programar entrega de caja vacia",
                        )}`}
                      >
                        <MapPin className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-black leading-tight text-[#f8fafc]">
                          Entrega domicilio
                        </span>
                        <span className="mt-0.5 block text-xs font-bold text-slate-400">
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
          </Panel>
          </div>

          <div
            ref={finishRef}
            className={`min-w-0 xl:w-[38%] xl:shrink-0 ${deliveryComplete ? stepShellClass("finish") : "rounded-xl"}`}
          >
          <Panel title="Finalizar">
            {deliveryComplete ? (
              <div className="grid gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#163A2A] p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl border border-black bg-surface-panel p-5 shadow-2xl border-black bg-surface-panel">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-black pb-4 border-black">
              <div>
                <p className="text-sm font-black uppercase text-slate-400">
                  Confirmar venta
                </p>
                <h3 className="text-3xl font-black">Invoice {invoiceNumber}</h3>
                <p className="font-bold text-slate-400">
                  Paquemas - venta correlativa
                </p>
              </div>
              <button
                onClick={() => setShowInvoice(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-black border-black"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-black bg-surface-card p-4 border-black bg-surface-card">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Remitente
                    </p>
                    <p className="text-xl font-black">{personFullName(selectedSender)}</p>
                    <p className="font-bold text-slate-400">{senderPhonesLabel(selectedSender)}</p>
                    {selectedSender.email ? (
                      <p className="text-sm font-bold text-slate-300">{selectedSender.email}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-black bg-surface-card p-4 border-black bg-surface-card">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Destinatario
                    </p>
                    <p className="text-xl font-black">{personFullName(selectedRecipient)}</p>
                    <p className="font-bold text-slate-400">
                      {selectedRecipient.city}, {selectedRecipient.country}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-black p-4 border-black">
                  <p className="mb-3 text-xl font-black">Detalle</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Caja
                      </p>
                      <p className="font-black">{selectedBox[0]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Carrier
                      </p>
                      <p className="font-black">{selectedBox[3]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Tiempo
                      </p>
                      <p className="font-black">{selectedBox[4]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Pais
                      </p>
                      <p className="font-black">{selectedRecipient.country}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">
                        Entrega caja vacia
                      </p>
                      <p className="font-black">
                        {deliverySummary(emptyBoxMode, emptyBoxScheduleMode, emptyBoxScheduleAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-black bg-surface-card p-4 text-right border-black bg-surface-card">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Cliente paga
                    </p>
                    <p className="text-3xl font-black">{selectedBox[1]}</p>
                  </div>
                  <div className="rounded-xl border border-black bg-surface-card p-4 text-right border-black bg-surface-card">
                    <p className="text-xs font-black uppercase text-slate-500">
                      Carrier cobra
                    </p>
                    <p className="text-3xl font-black">{selectedBox[2]}</p>
                  </div>
                  <div className="rounded-xl border border-black bg-surface-card-header p-4 text-right text-slate-300">
                    <p className="text-xs font-black uppercase">Ganancia</p>
                    <p className="text-3xl font-black">{boxProfitDisplay(selectedBox)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-black bg-surface-card p-4 text-center text-[#f8fafc]">
                <div className="rounded-lg bg-[#f8fafc] p-3">
                  <QRCodeSVG
                    value={`invoice:${invoiceNumber}`}
                    size={144}
                    level="M"
                    marginSize={1}
                  />
                </div>
                <p className="mt-3 text-lg font-black">{invoiceNumber}</p>
                <p className="text-sm font-bold text-slate-300">
                  QR del invoice
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-black pt-4 border-black sm:grid-cols-3">
              <button
                onClick={() => setShowInvoice(false)}
                className="h-14 rounded-lg border border-black text-lg font-black border-black"
              >
                Cancelar
              </button>
              <button
                onClick={() => window.print()}
                className="flex h-14 items-center justify-center gap-2 rounded-lg border border-black bg-surface-card text-lg font-black text-[#f8fafc]"
              >
                <Printer className="h-6 w-6" />
                Imprimir
              </button>
              <button
                onClick={() => {
                  setShowInvoice(false);
                  setInvoiceSequence((current) => current + 1);
                }}
                className="h-14 rounded-lg bg-emerald-400 text-lg font-black text-slate-950"
              >
                Confirmar cobro
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
