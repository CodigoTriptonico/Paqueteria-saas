const USD_CURRENCY = "USD" as const;

export type Money = {
  currency: typeof USD_CURRENCY;
  amountCents: number;
};

export type OperationResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  operationId: string;
  replayed: boolean;
  version: number;
  entities: T;
};

export type AgencyStatus =
  | "prospect"
  | "registration_started"
  | "documents_pending"
  | "approval_pending"
  | "activation_pending"
  | "active"
  | "temporarily_suspended"
  | "debt_blocked"
  | "inactive"
  | "closed"
  | "rejected";

export type AgencyRequestStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "confirmed"
  | "scheduled"
  | "assigned"
  | "in_route"
  | "partially_completed"
  | "completed"
  | "rejected"
  | "cancelled";

const AGENCY_TRANSITIONS: Record<AgencyStatus, readonly AgencyStatus[]> = {
  prospect: ["registration_started", "rejected", "closed"],
  registration_started: ["documents_pending", "rejected", "closed"],
  documents_pending: ["approval_pending", "registration_started", "rejected", "closed"],
  approval_pending: ["activation_pending", "documents_pending", "rejected", "closed"],
  activation_pending: ["active", "approval_pending", "rejected", "closed"],
  active: ["temporarily_suspended", "debt_blocked", "inactive", "closed"],
  temporarily_suspended: ["active", "inactive", "closed"],
  debt_blocked: ["active", "temporarily_suspended", "inactive", "closed"],
  inactive: ["active", "closed"],
  closed: [],
  rejected: ["registration_started", "closed"],
};

const REQUEST_TRANSITIONS: Record<AgencyRequestStatus, readonly AgencyRequestStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "rejected", "cancelled"],
  under_review: ["confirmed", "rejected", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
  scheduled: ["assigned", "cancelled"],
  assigned: ["in_route", "cancelled"],
  in_route: ["partially_completed", "completed"],
  partially_completed: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function isAgencyTransitionAllowed(from: AgencyStatus, to: AgencyStatus) {
  return AGENCY_TRANSITIONS[from].includes(to);
}

export function isRequestTransitionAllowed(from: AgencyRequestStatus, to: AgencyRequestStatus) {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function assertIdempotencyKey(value: string) {
  const key = value.trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9:_-]+$/.test(key)) {
    throw new Error("La clave de idempotencia debe tener entre 16 y 128 caracteres seguros.");
  }
  return key;
}

export function money(amountCents: number): Money {
  if (!Number.isSafeInteger(amountCents)) {
    throw new Error("El importe debe expresarse en centavos enteros.");
  }
  return { currency: USD_CURRENCY, amountCents };
}

export function addMoney(values: readonly Money[]): Money {
  return money(values.reduce((total, value) => {
    if (value.currency !== USD_CURRENCY) {
      throw new Error("Boxario admite únicamente USD en esta versión.");
    }
    return total + value.amountCents;
  }, 0));
}
