"use client";

import dynamic from "next/dynamic";
import { Building2, Gauge, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import { CompanySettingsPanel } from "@/components/config/company-settings-panel";
import { PlanSettingsPanel } from "@/components/config/plan-settings-panel";
import { PageLoading } from "@/components/page-loading";

export type OrganizationManagementTab = "company" | "plan" | "users";

const UsersSettingsPanel = dynamic(
  () => import("@/components/config/users-settings-panel").then((mod) => mod.UsersSettingsPanel),
  { loading: () => <PageLoading inline /> },
);

const managementTabs: AppTabDefinition<OrganizationManagementTab>[] = [
  { id: "company", label: "Empresa", icon: Building2 },
  { id: "plan", label: "Plan", icon: Gauge },
  { id: "users", label: "Usuarios", icon: Users },
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
        <AppTabs tabs={managementTabs} value={initialTab} onChange={changeTab} size="compact" ariaLabel="Empresa, plan y usuarios" />
      </div>
      {initialTab === "company" ? <CompanySettingsPanel /> : null}
      {initialTab === "plan" ? <PlanSettingsPanel /> : null}
      {initialTab === "users" ? <UsersSettingsPanel /> : null}
    </div>
  );
}
