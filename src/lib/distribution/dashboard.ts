import type { DistributionLedgerEntry } from "./ledger";

export type DistributionDashboardPartner = {
  id: string;
  creditLimit: number;
  balance: number;
  isActive: boolean;
  ledger: DistributionLedgerEntry[];
  shipmentsCreatedAt: string[];
};

export type DistributionDashboardPeriod = "today" | "7d" | "30d" | "all";

export type DistributionDashboardMetrics = {
  activePartners: number;
  pausedPartners: number;
  blockedPartners: number;
  totalDebt: number;
  creditCommitted: number;
  creditAvailable: number;
  paymentsInPeriod: number;
  internalSalesInPeriod: number;
  activeShipmentsInPeriod: number;
};

export function dashboardPeriodStart(period: DistributionDashboardPeriod, now = new Date()) {
  if (period === "all") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "7d") start.setDate(start.getDate() - 6);
  if (period === "30d") start.setDate(start.getDate() - 29);
  return start;
}

export function isDistributionPartnerCreditBlocked(partner: Pick<DistributionDashboardPartner, "creditLimit" | "balance" | "isActive">) {
  return partner.isActive && partner.creditLimit > 0 && partner.balance >= partner.creditLimit;
}

export function distributionDashboardMetrics(
  partners: DistributionDashboardPartner[],
  period: DistributionDashboardPeriod,
  now = new Date(),
): DistributionDashboardMetrics {
  const start = dashboardPeriodStart(period, now);
  const inPeriod = (createdAt: string) => !start || new Date(createdAt) >= start;
  return partners.reduce<DistributionDashboardMetrics>((metrics, partner) => {
    const debt = Math.max(0, partner.balance);
    const available = Math.max(0, partner.creditLimit - debt);
    metrics.activePartners += partner.isActive ? 1 : 0;
    metrics.pausedPartners += partner.isActive ? 0 : 1;
    metrics.blockedPartners += isDistributionPartnerCreditBlocked(partner) ? 1 : 0;
    metrics.totalDebt += debt;
    metrics.creditCommitted += Math.min(partner.creditLimit, debt);
    metrics.creditAvailable += available;
    metrics.activeShipmentsInPeriod += partner.shipmentsCreatedAt.filter(inPeriod).length;
    for (const entry of partner.ledger) {
      if (!inPeriod(entry.createdAt)) continue;
      if (entry.kind === "payment") metrics.paymentsInPeriod += Math.abs(entry.amount);
      if (entry.kind === "charge") metrics.internalSalesInPeriod += entry.amount;
    }
    return metrics;
  }, {
    activePartners: 0,
    pausedPartners: 0,
    blockedPartners: 0,
    totalDebt: 0,
    creditCommitted: 0,
    creditAvailable: 0,
    paymentsInPeriod: 0,
    internalSalesInPeriod: 0,
    activeShipmentsInPeriod: 0,
  });
}
