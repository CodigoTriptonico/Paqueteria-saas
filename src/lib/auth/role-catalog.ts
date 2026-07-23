import type { PermissionKey } from "@/lib/auth/types";

export type RoleCatalogEntry = {
  slug: string;
  name: string;
  hint: string;
  /** Si true, se crea al bootstrap / queda fijo en cada org. */
  base: boolean;
  /** Roles de módulo agencia: solo se sugieren si el módulo está activo. */
  agencyModule?: boolean;
  permissions: PermissionKey[];
};

/** Roles que toda org tiene desde el día 1. */
export const BASE_ROLE_SLUGS = [
  "administrador",
  "vendedor",
  "conductor",
  "logistica",
] as const;

export type BaseRoleSlug = (typeof BASE_ROLE_SLUGS)[number];

export function isBaseRoleSlug(slug: string): slug is BaseRoleSlug {
  return (BASE_ROLE_SLUGS as readonly string[]).includes(slug);
}

/**
 * Catálogo de producto: base + opcionales.
 * Los opcionales aparecen al agregar roles; no se crean solos.
 */
const ROLE_CATALOG: RoleCatalogEntry[] = [
  {
    slug: "administrador",
    name: "Administrador",
    hint: "Gestión completa de la paquetería.",
    base: true,
    permissions: ["all"],
  },
  {
    slug: "vendedor",
    name: "Vendedor",
    hint: "Ventas, clientes e inventario operativo.",
    base: true,
    permissions: ["sales.manage", "customers.manage", "inventory.view", "inventory.reserve"],
  },
  {
    slug: "conductor",
    name: "Conductor",
    hint: "Consulta rutas y actualiza entregas.",
    base: true,
    permissions: ["routes.view", "routes.update_status"],
  },
  {
    slug: "logistica",
    name: "Logística",
    hint: "Rutas, asignación y operaciones de entrega.",
    base: true,
    permissions: ["routes.view", "routes.update_status"],
  },
  {
    slug: "bodega",
    name: "Bodega",
    hint: "Inventario y bodegas.",
    base: false,
    permissions: ["inventory.view", "warehouses.manage", "financial_hold.view"],
  },
  {
    slug: "finanzas",
    name: "Finanzas",
    hint: "Cuentas, cobros y retención financiera.",
    base: false,
    permissions: [
      "accounting.view",
      "accounting.post",
      "accounting.reconcile",
      "accounting.reverse",
      "financial_hold.view",
      "financial_hold.release",
      "financial_hold.release_manual",
    ],
  },
  {
    slug: "auditor",
    name: "Auditor",
    hint: "Consulta de auditoría y estados financieros.",
    base: false,
    permissions: [
      "accounting.view",
      "financial_hold.view",
      "audit.immutable.view",
    ],
  },
  {
    slug: "captador_distribuidores",
    name: "Captador de distribuidores",
    hint: "Alta y seguimiento de distribuidores.",
    base: false,
    permissions: ["distribution.acquire"],
  },
  {
    slug: "supervisor_agencias",
    name: "Supervisor de agencias",
    hint: "Supervisa captadores y soporte de agencias.",
    base: false,
    agencyModule: true,
    permissions: [
      "agency.view",
      "agency.captor.assign",
      "agency.supervisor.assign",
      "agency.support",
      "agency.requests.view",
    ],
  },
  {
    slug: "captador_agencias",
    name: "Captador de agencias",
    hint: "Crea y da soporte a agencias.",
    base: false,
    agencyModule: true,
    permissions: [
      "agency.view",
      "agency.create",
      "agency.support",
      "agency.requests.view",
    ],
  },
];

export function listBaseRoleCatalog() {
  return ROLE_CATALOG.filter((entry) => entry.base);
}

export function listSuggestedRoleCatalog(input?: {
  existingSlugs?: Iterable<string>;
  agencyModuleEnabled?: boolean;
}) {
  const existing = new Set(
    [...(input?.existingSlugs || [])].map((slug) => slug.trim().toLowerCase()),
  );
  const agencyOn = Boolean(input?.agencyModuleEnabled);

  return ROLE_CATALOG.filter((entry) => {
    if (entry.base) {
      return false;
    }
    if (entry.agencyModule && !agencyOn) {
      return false;
    }
    return !existing.has(entry.slug);
  });
}

export function findRoleCatalogEntry(slug: string) {
  const key = slug
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return (
    ROLE_CATALOG.find(
      (entry) =>
        entry.slug
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase() === key,
    ) || null
  );
}
