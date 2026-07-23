"use client";

import dynamic from "next/dynamic";
import { Building2, FileSpreadsheet, Gauge, Users, Warehouse } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import { CompanySettingsPanel } from "@/components/config/company-settings-panel";
import { PlanSettingsPanel } from "@/components/config/plan-settings-panel";
import { PageLoading } from "@/components/page-loading";

export type OrganizationManagementTab = "company" | "plan" | "users" | "warehouses" | "import";

const ORGANIZATION_MANAGEMENT_TABS: OrganizationManagementTab[] = [
  "company",
  "plan",
  "users",
  "warehouses",
  "import",
];

export function isOrganizationManagementTab(
  value: string | null | undefined,
): value is OrganizationManagementTab {
  return Boolean(value && ORGANIZATION_MANAGEMENT_TABS.includes(value as OrganizationManagementTab));
}

const UsersSettingsPanel = dynamic(
  () => import("@/components/config/users-settings-panel").then((mod) => mod.UsersSettingsPanel),
  { loading: () => <PageLoading inline /> },
);

const WarehousesSettingsPanel = dynamic(
  () =>
    import("@/components/config/warehouses-settings-panel").then((mod) => mod.WarehousesSettingsPanel),
  { loading: () => <PageLoading inline /> },
);

const CustomersImportPanel = dynamic(
  () =>
    import("@/components/config/customers-import-panel").then((mod) => mod.CustomersImportPanel),
  { loading: () => <PageLoading inline /> },
);

const managementTabs: AppTabDefinition<OrganizationManagementTab>[] = [
  { id: "company", label: "Empresa", icon: Building2 },
  { id: "plan", label: "Plan", icon: Gauge },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "warehouses", label: "Bodegas", icon: Warehouse },
  { id: "import", label: "Importar", icon: FileSpreadsheet },
];

export function OrganizationManagementPanel({ initialTab }: { initialTab: OrganizationManagementTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  function changeTab(nextTab: OrganizationManagementTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "organization");
    params.set("tab", nextTab);
    router.replace(`/configuracion?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-black bg-surface-card p-3 shadow-[0_6px_20px_rgba(0,0,0,0.18)] sm:p-4">
        <AppTabs
          tabs={managementTabs}
          value={initialTab}
          onChange={changeTab}
          size="compact"
          ariaLabel="Empresa, plan, usuarios, bodegas e importar"
        />
      </div>
      {initialTab === "company" ? <CompanySettingsPanel /> : null}
      {initialTab === "plan" ? <PlanSettingsPanel /> : null}
      {initialTab === "users" ? <UsersSettingsPanel /> : null}
      {initialTab === "warehouses" ? <WarehousesSettingsPanel /> : null}
      {initialTab === "import" ? <CustomersImportPanel /> : null}
    </div>
  );
}
