export type BusinessContext = {
  tenantId: string | null;
  tenantName: string;
  organizationId: string;
  organizationName: string;
  organizationCode: string | null;
  organizationType: "platform" | "matrix" | "agency";
};

type AgencyNetworkRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  statusVersion: number;
  captorName: string | null;
  openRequests: number;
  chargeBalanceCents: number;
};

type AgencyRequestRow = {
  id: string;
  requestNumber: string;
  agencyName: string;
  status: string;
  requestedAt: string | null;
  scheduledFor: string | null;
  lineCount: number;
};

type FinancialHoldRow = {
  id: string;
  reference: string;
  status: string;
  balanceCents: number;
  createdAt: string;
};

export type BusinessWorkspace = {
  context: BusinessContext;
  agencies: AgencyNetworkRow[];
  requests: AgencyRequestRow[];
  holds: FinancialHoldRow[];
  metrics: {
    agencyReceivableCents: number;
    customerReceivableCents: number;
    unappliedAgencyPaymentsCents: number;
    driverCashInTransitCents: number;
    activeHolds: number;
    unbalancedJournalEntries: number;
    openRequests: number;
    availableMatrixBoxes: number;
  };
};

export function emptyBusinessWorkspace(context: BusinessContext): BusinessWorkspace {
  return {
    context,
    agencies: [],
    requests: [],
    holds: [],
    metrics: {
      agencyReceivableCents: 0,
      customerReceivableCents: 0,
      unappliedAgencyPaymentsCents: 0,
      driverCashInTransitCents: 0,
      activeHolds: 0,
      unbalancedJournalEntries: 0,
      openRequests: 0,
      availableMatrixBoxes: 0,
    },
  };
}

export function withoutAgencyModuleData(
  workspace: BusinessWorkspace,
): BusinessWorkspace {
  return {
    ...workspace,
    agencies: [],
    requests: [],
    holds: [],
    metrics: {
      ...workspace.metrics,
      agencyReceivableCents: 0,
      customerReceivableCents: 0,
      unappliedAgencyPaymentsCents: 0,
      activeHolds: 0,
      openRequests: 0,
    },
  };
}

export function formatUsdCents(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}
