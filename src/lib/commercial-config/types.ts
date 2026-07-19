import type { CommercialAudience, CommercialPriceKind, CommercialSourceLevel } from "@/lib/commercial-config/resolver";

type CommercialEntityType = "agency" | "seller";

type CommercialCatalogLine = {
  destinationCode: string;
  destinationName: string;
  productCode: string;
  productName: string;
  publicBaseCents: number;
  internalBaseCents: number;
  currency: string;
};

export type CommercialOverride = {
  id: string;
  audience: CommercialAudience;
  entityId: string | null;
  destinationCode: string;
  productCode: string;
  priceKind: CommercialPriceKind;
  serviceConcept: "international_shipping" | "home_delivery" | "home_pickup";
  amountCents: number;
  minimumAmountCents: number | null;
  currency: string;
  sourceLevel: Exclude<CommercialSourceLevel, "country">;
};

export type CommercialEntityProfile = {
  countryCode: string;
  warehouseId: string | null;
  zone: string;
  territory: string;
  visitFrequency: string;
  operationalStatus: "active" | "paused" | "inactive";
  enabledServices: string[];
  canModifyPublicPrice: boolean;
  maxDiscountBps: number;
  address: Record<string, unknown>;
  contact: Record<string, unknown>;
  logisticsOptions: Record<string, unknown>;
};

export type CommercialEntity = {
  id: string;
  type: CommercialEntityType;
  name: string;
  code: string;
  status: string;
  email: string;
  createdAt: string;
  organizationId: string;
  userCount: number;
  routeTemplateId: string | null;
  routeName: string;
  profile: CommercialEntityProfile;
};

type CommercialCountryService = {
  id: string;
  destinationCode: string;
  serviceConcept: "home_delivery" | "home_pickup";
  amountCents: number;
  currency: string;
};

type CommercialAuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  occurredAt: string;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type CommercialAdminData = {
  canManage: boolean;
  countries: Array<{ code: string; name: string; currency: string }>;
  catalog: CommercialCatalogLine[];
  countryServices: CommercialCountryService[];
  overrides: CommercialOverride[];
  entities: CommercialEntity[];
  routeTemplates: Array<{ id: string; name: string; weekday: number }>;
  warehouses: Array<{ id: string; name: string }>;
  audit: CommercialAuditEntry[];
};

export const emptyCommercialEntityProfile: CommercialEntityProfile = {
  countryCode: "",
  warehouseId: null,
  zone: "",
  territory: "",
  visitFrequency: "",
  operationalStatus: "active",
  enabledServices: ["international_shipping"],
  canModifyPublicPrice: false,
  maxDiscountBps: 0,
  address: {},
  contact: {},
  logisticsOptions: {},
};
