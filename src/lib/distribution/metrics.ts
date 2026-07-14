import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sessionHasPermission } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/types";
import { normalizeAnchorDate, periodBounds, periodLabel, type PeriodGranularity } from "@/lib/seller-metrics/period-buckets";

export type DistributionMetricsReport = {
  periodLabel: string;
  granularity: PeriodGranularity;
  anchorDate: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  totals: { activePartners: number; saleCount: number; internalSales: number; payments: number; totalDebt: number; activeCaptors: number };
  captors: { id: string; name: string; partnerCount: number; saleCount: number; internalSales: number }[];
  partners: { id: string; name: string; captorName: string; isActive: boolean; saleCount: number; internalSales: number; balance: number }[];
};

type SaleRow = { distribution_partner_id: string; distribution_acquisition_owner_id: string | null; distributor_wholesale_price: number | string; created_at: string; invoice_status: string };
type LedgerRow = { partner_id: string; kind: "charge" | "payment" | "reversal"; amount: number | string; created_at: string };

export function buildDistributionMetricsReport(input: {
  partners: { id: string; name: string; ownerId: string | null; ownerName: string | null; isActive: boolean }[];
  owners: { id: string; name: string }[];
  sales: SaleRow[];
  ledger: LedgerRow[];
  granularity: PeriodGranularity;
  anchor: Date;
  rangeFrom?: string | null;
  rangeTo?: string | null;
}): DistributionMetricsReport {
  const anchor = normalizeAnchorDate(input.anchor);
  const { start, end } = periodBounds(anchor, input.granularity, input.granularity === "range" && input.rangeFrom && input.rangeTo ? { from: input.rangeFrom, to: input.rangeTo } : null);
  const inPeriod = (value: string) => { const date = new Date(value); return date >= start && date < end; };
  const balanceByPartner = new Map<string, number>();
  const payments = input.ledger.reduce((sum, row) => {
    balanceByPartner.set(row.partner_id, (balanceByPartner.get(row.partner_id) || 0) + Number(row.amount || 0));
    return row.kind === "payment" && inPeriod(row.created_at) ? sum + Math.abs(Number(row.amount || 0)) : sum;
  }, 0);
  const partnerMap = new Map(input.partners.map((partner) => [partner.id, partner]));
  const sales = input.sales.filter((sale) => sale.invoice_status !== "void" && inPeriod(sale.created_at));
  const partnerSales = new Map<string, { saleCount: number; internalSales: number }>();
  const captorSales = new Map<string, { saleCount: number; internalSales: number }>();
  for (const sale of sales) {
    const amount = Number(sale.distributor_wholesale_price || 0);
    const partner = partnerSales.get(sale.distribution_partner_id) || { saleCount: 0, internalSales: 0 };
    partner.saleCount += 1; partner.internalSales += amount; partnerSales.set(sale.distribution_partner_id, partner);
    if (sale.distribution_acquisition_owner_id) {
      const captor = captorSales.get(sale.distribution_acquisition_owner_id) || { saleCount: 0, internalSales: 0 };
      captor.saleCount += 1; captor.internalSales += amount; captorSales.set(sale.distribution_acquisition_owner_id, captor);
    }
  }
  const captors = new Map(input.owners.map((owner) => [owner.id, { ...owner, partnerCount: 0, saleCount: 0, internalSales: 0 }]));
  for (const partner of input.partners) {
    if (!partner.ownerId) continue;
    const captor = captors.get(partner.ownerId) || { id: partner.ownerId, name: partner.ownerName || "Sin captador", partnerCount: 0, saleCount: 0, internalSales: 0 };
    captor.partnerCount += 1;
    captors.set(partner.ownerId, captor);
  }
  for (const [captorId, salesForCaptor] of captorSales) {
    const captor = captors.get(captorId) || { id: captorId, name: "Captador anterior", partnerCount: 0, saleCount: 0, internalSales: 0 };
    captor.saleCount = salesForCaptor.saleCount;
    captor.internalSales = salesForCaptor.internalSales;
    captors.set(captorId, captor);
  }
  const partners = input.partners.map((partner) => ({ ...partner, captorName: partner.ownerName || "Sin asignar", ...(partnerSales.get(partner.id) || { saleCount: 0, internalSales: 0 }), balance: Math.max(0, balanceByPartner.get(partner.id) || 0) })).sort((a, b) => b.internalSales - a.internalSales || a.name.localeCompare(b.name, "es"));
  return {
    periodLabel: periodLabel(anchor, input.granularity), granularity: input.granularity, anchorDate: anchor.toISOString().slice(0, 10), rangeFrom: input.rangeFrom || null, rangeTo: input.rangeTo || null,
    totals: { activePartners: input.partners.filter((partner) => partner.isActive).length, saleCount: sales.length, internalSales: sales.reduce((sum, sale) => sum + Number(sale.distributor_wholesale_price || 0), 0), payments, totalDebt: [...balanceByPartner.values()].reduce((sum, balance) => sum + Math.max(0, balance), 0), activeCaptors: [...captors.values()].filter((captor) => captor.saleCount > 0).length },
    captors: [...captors.values()].filter((captor) => captor.saleCount > 0 || captor.partnerCount > 0).sort((a, b) => b.internalSales - a.internalSales || b.saleCount - a.saleCount), partners,
  };
}

export async function loadDistributionMetricsForSession(session: AppSession, input: { granularity: PeriodGranularity; anchorDate?: string | null; rangeFrom?: string | null; rangeTo?: string | null }) {
  if (!sessionHasPermission(session, "settings.manage")) throw new Error("FORBIDDEN");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Supabase no configurado");
  const [partnersResult, salesResult, ledgerResult, profilesResult] = await Promise.all([
    admin.from("distribution_partners").select("id, distributor_organization_id, acquisition_owner_id, is_active, organizations!distribution_partners_distributor_organization_id_fkey(name)").eq("parent_organization_id", session.organizationId),
    admin.from("shipments").select("distribution_partner_id, distribution_acquisition_owner_id, distributor_wholesale_price, created_at, invoice_status").eq("organization_id", session.organizationId).not("distribution_partner_id", "is", null),
    admin.from("distribution_partner_ledger").select("partner_id, kind, amount, created_at"),
    admin.from("profiles").select("id, full_name, email, roles(slug)").eq("organization_id", session.organizationId),
  ]);
  if (partnersResult.error) throw new Error(partnersResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);
  if (ledgerResult.error) throw new Error(ledgerResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  const ownerNames = new Map((profilesResult.data || []).map((profile) => [profile.id as string, ((profile.full_name as string | null) || (profile.email as string) || "Captador").trim()]));
  const owners = (profilesResult.data || []).flatMap((profile) => {
    const role = profile.roles as { slug: string } | { slug: string }[] | null;
    const roleSlug = Array.isArray(role) ? role[0]?.slug : role?.slug;
    return roleSlug === "captador_distribuidores" ? [{ id: profile.id as string, name: ownerNames.get(profile.id as string) || "Captador" }] : [];
  });
  const partnerIds = new Set((partnersResult.data || []).map((partner) => partner.id as string));
  const partners = (partnersResult.data || []).map((partner) => {
    const organization = partner.organizations as { name: string } | { name: string }[] | null;
    const org = Array.isArray(organization) ? organization[0] : organization;
    const ownerId = (partner.acquisition_owner_id as string | null) || null;
    return { id: partner.id as string, name: org?.name || "Distribuidor", ownerId, ownerName: ownerId ? ownerNames.get(ownerId) || null : null, isActive: Boolean(partner.is_active) };
  });
  return buildDistributionMetricsReport({ partners, owners, sales: (salesResult.data || []) as SaleRow[], ledger: (ledgerResult.data || []).filter((row) => partnerIds.has(row.partner_id as string)) as LedgerRow[], granularity: input.granularity, anchor: normalizeAnchorDate(input.anchorDate || undefined), rangeFrom: input.rangeFrom, rangeTo: input.rangeTo });
}
