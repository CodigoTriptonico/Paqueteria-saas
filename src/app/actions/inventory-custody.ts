"use server";

import { requireAppSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { createScopedSupabase } from "@/lib/supabase/scoped";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  buildInventoryCustodyFullCounts,
  type InventoryCustodyAgencyRow,
  type InventoryCustodyServerSnapshot,
} from "@/lib/inventory-custody";
import type { PhysicalPackageStatus } from "@/lib/physical-packages";

type AgencyRow = {
  id: string;
  organization_id: string;
  code: string | null;
};

type OrganizationRow = {
  id: string;
  name: string | null;
};

type AgencyLotBalanceRow = {
  agency_id: string;
  product_key: string | null;
  box_size: string | null;
  available_quantity: number | string | null;
  allocated_quantity: number | string | null;
  delivered_quantity: number | string | null;
};

type PackageStatusCountRow = {
  status: PhysicalPackageStatus;
  count: number | string | null;
};

export async function loadInventoryCustodySnapshotAction(): Promise<
  ActionResult<InventoryCustodyServerSnapshot>
> {
  try {
    const session = await requireAppSession();

    if (!sessionHasPermission(session, "inventory.view")) {
      throw new Error("FORBIDDEN");
    }

    const admin = createSupabaseAdminClient();
    const supabase = await createScopedSupabase(session);

    if (!supabase) {
      return fail("Supabase no configurado");
    }

    const agencyRows: InventoryCustodyAgencyRow[] = [];

    if (admin) {
      const { data: agencies, error: agenciesError } = await admin
        .from("agencies")
        .select("id, organization_id, code")
        .eq("matrix_organization_id", session.organizationId)
        .is("archived_at", null);

      if (agenciesError && agenciesError.code !== "42P01") {
        throw new Error(agenciesError.message);
      }

      const agencyNameById = new Map<string, string>();
      const agencyRowsData = (agencies || []) as AgencyRow[];
      const organizationIds = [...new Set(agencyRowsData.map((agency) => agency.organization_id))];

      const { data: organizations, error: organizationsError } = organizationIds.length
        ? await admin.from("organizations").select("id, name").in("id", organizationIds)
        : { data: [], error: null };

      if (organizationsError && organizationsError.code !== "42P01") {
        throw new Error(organizationsError.message);
      }

      const organizationNameById = new Map(
        ((organizations || []) as OrganizationRow[]).map((organization) => [
          organization.id,
          String(organization.name || "").trim(),
        ]),
      );

      for (const agency of agencyRowsData) {
        const organizationName = organizationNameById.get(agency.organization_id);
        agencyNameById.set(
          agency.id,
          organizationName || String(agency.code || "").trim() || "Agencia",
        );
      }

      if (agencyNameById.size) {
        const { data: lotRows, error: lotError } = await admin
          .from("agency_box_lot_balances")
          .select(
            "agency_id, product_key, box_size, available_quantity, allocated_quantity, delivered_quantity",
          )
          .in("agency_id", [...agencyNameById.keys()]);

        if (lotError && lotError.code !== "42P01") {
          throw new Error(lotError.message);
        }

        for (const row of (lotRows || []) as AgencyLotBalanceRow[]) {
          const availableQuantity = Math.max(0, Number(row.available_quantity) || 0);
          const allocatedQuantity = Math.max(0, Number(row.allocated_quantity) || 0);
          const deliveredQuantity = Math.max(0, Number(row.delivered_quantity) || 0);

          if (availableQuantity + allocatedQuantity <= 0) {
            continue;
          }

          agencyRows.push({
            agencyId: String(row.agency_id),
            agencyName: agencyNameById.get(String(row.agency_id)) || "Agencia",
            productKey: String(row.product_key || "Caja").trim() || "Caja",
            boxSize: String(row.box_size || "Estándar").trim() || "Estándar",
            availableQuantity,
            allocatedQuantity,
            deliveredQuantity,
          });
        }
      }
    }

    const { data: packageRows, error: packageError } = await supabase
      .from("shipment_packages")
      .select("status")
      .eq("organization_id", session.organizationId);

    if (packageError && packageError.code !== "42P01") {
      throw new Error(packageError.message);
    }

    const counts: Partial<Record<PhysicalPackageStatus, number>> = {};

    for (const row of (packageRows || []) as PackageStatusCountRow[]) {
      const status = row.status;
      counts[status] = (counts[status] || 0) + 1;
    }

    return ok({
      agencyRows,
      fullPackageCounts: buildInventoryCustodyFullCounts(counts),
    });
  } catch (error) {
    return fail(actionErrorMessage(error));
  }
}
