import Link from "next/link";
import { Building2, CircleDollarSign, ClipboardList, PackageOpen, ShieldCheck, WalletCards } from "lucide-react";
import { Panel, StatCard, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { formatUsdCents, type BusinessWorkspace } from "@/lib/business/workspace";
import { AgencyCaptorCreatePanel } from "@/components/business/agency-captor-create-panel";
import { AgencyOperationsPanel } from "@/components/business/agency-operations-panel";

export type BusinessSurface = "network" | "agency" | "captor" | "operations" | "finance";

const STATUS_LABELS: Record<string, string> = {
  prospect: "Prospecto",
  registration_started: "Registro iniciado",
  documents_pending: "Documentos pendientes",
  approval_pending: "Pendiente de aprobación",
  activation_pending: "Pendiente de activación",
  active: "Activa",
  temporarily_suspended: "Suspendida temporalmente",
  debt_blocked: "Retenida por saldo",
  inactive: "Inactiva",
  closed: "Cerrada",
  rejected: "Rechazada",
  draft: "Borrador",
  submitted: "Enviada",
  under_review: "En revisión",
  confirmed: "Confirmada",
  scheduled: "Programada",
  assigned: "Asignada",
  in_route: "En ruta",
  partially_completed: "Atendida parcialmente",
  completed: "Completada",
  cancelled: "Cancelada",
};

function statusLabel(value: string) {
  return STATUS_LABELS[value] ?? value.replaceAll("_", " ");
}

function ContextTrail({ workspace }: { workspace: BusinessWorkspace }) {
  const { context } = workspace;
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-lg border border-black bg-surface-inset px-3 py-2 text-xs font-black text-slate-400">
      <span className="text-emerald-300">Boxario</span>
      <span aria-hidden>/</span>
      <span>{context.tenantName}</span>
      <span aria-hidden>/</span>
      <span className="text-slate-100">{context.organizationName}</span>
      {context.organizationCode ? <span className="ml-auto rounded border border-black bg-black/20 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300">{context.organizationCode}</span> : null}
    </div>
  );
}

function EmptyRows({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 bg-black/10 px-4 py-8 text-center">
      <p className="text-sm font-bold text-slate-300">{text}</p>
      <p className="mt-1 text-xs text-slate-500">La pantalla se actualizará cuando se registre la primera operación.</p>
    </div>
  );
}

function Network({ workspace, captorOnly = false }: { workspace: BusinessWorkspace; captorOnly?: boolean }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={captorOnly ? "Agencias a mi cargo" : "Agencias"} value={String(workspace.agencies.length)} tone="text-slate-100" />
        <StatCard label="Solicitudes abiertas" value={String(workspace.metrics.openRequests)} tone="text-amber-300" />
        <StatCard label="Cuenta por cobrar" value={formatUsdCents(workspace.metrics.agencyReceivableCents)} tone="text-emerald-300" />
        <StatCard label="Retenciones activas" value={String(workspace.metrics.activeHolds)} tone={workspace.metrics.activeHolds ? "text-amber-300" : "text-slate-100"} />
      </section>
      <Panel title={captorOnly ? "Agencias a mi cargo" : "Red de agencias"} action={captorOnly ? <AgencyCaptorCreatePanel /> : <Building2 className="h-5 w-5 text-emerald-300" />}>
        {workspace.agencies.length ? (
          <div className="grid gap-2">
            {workspace.agencies.map((agency) => (
              <article key={agency.id} className="grid gap-3 rounded-lg border border-black bg-surface-list-row p-3 md:grid-cols-[7rem_minmax(0,1fr)_12rem_9rem_10rem] md:items-center">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300">{agency.code}</span>
                <div className="min-w-0"><p className="truncate font-black text-slate-100">{agency.name}</p><p className="text-xs font-bold text-slate-500">{agency.captorName ? `Captador: ${agency.captorName}` : "Sin captador activo"}</p></div>
                <span className="text-sm font-black text-slate-300">{statusLabel(agency.status)}</span>
                <div className="text-right"><p className="font-black text-slate-100">{formatUsdCents(agency.chargeBalanceCents)}</p><p className="text-xs text-slate-500">{agency.openRequests} solicitudes</p></div>
                {!captorOnly ? <Link href={`/agencias/${agency.id}`} className={`${secondaryButtonClass} w-full text-xs`}>Tarifas y saldo</Link> : null}
              </article>
            ))}
          </div>
        ) : <EmptyRows text={captorOnly ? "No tienes agencias asignadas." : "Todavía no hay agencias en este tenant."} />}
      </Panel>
    </div>
  );
}

function Operations({ workspace }: { workspace: BusinessWorkspace }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Solicitudes abiertas" value={String(workspace.metrics.openRequests)} tone="text-amber-300" />
        <StatCard label="Cajas disponibles" value={String(workspace.metrics.availableMatrixBoxes)} tone="text-emerald-300" />
        <StatCard label="Retenciones activas" value={String(workspace.metrics.activeHolds)} tone="text-slate-100" />
      </section>
      <Panel title="Solicitudes y visitas" action={<ClipboardList className="h-5 w-5 text-emerald-300" />}>
        {workspace.requests.length ? (
          <div className="grid gap-2">
            {workspace.requests.map((request) => (
              <article key={request.id} className="grid gap-2 rounded-lg border border-black bg-surface-list-row p-3 md:grid-cols-[8rem_minmax(0,1fr)_11rem_10rem] md:items-center">
                <span className="text-xs font-black text-emerald-300">{request.requestNumber}</span>
                <div><p className="font-black text-slate-100">{request.agencyName}</p><p className="text-xs text-slate-500">{request.lineCount} conceptos solicitados</p></div>
                <span className="text-sm font-black text-slate-300">{statusLabel(request.status)}</span>
                <span className="text-xs font-bold text-slate-400">{request.scheduledFor ? new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(request.scheduledFor)) : "Sin fecha asignada"}</span>
              </article>
            ))}
          </div>
        ) : <EmptyRows text="No hay solicitudes pendientes." />}
      </Panel>
    </div>
  );
}

function Finance({ workspace }: { workspace: BusinessWorkspace }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="CxC de agencias" value={formatUsdCents(workspace.metrics.agencyReceivableCents)} tone="text-emerald-300" />
        <StatCard label="Pagos sin aplicar" value={formatUsdCents(workspace.metrics.unappliedAgencyPaymentsCents)} tone="text-amber-300" />
        <StatCard label="Efectivo en tránsito" value={formatUsdCents(workspace.metrics.driverCashInTransitCents)} tone="text-slate-100" />
        <StatCard label="Asientos desbalanceados" value={String(workspace.metrics.unbalancedJournalEntries)} tone={workspace.metrics.unbalancedJournalEntries ? "text-red-300" : "text-emerald-300"} />
      </section>
      <Panel title="Retenciones vinculadas" action={<ShieldCheck className="h-5 w-5 text-emerald-300" />}>
        {workspace.holds.length ? (
          <div className="grid gap-2">
            {workspace.holds.map((hold) => (
              <article key={hold.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-black bg-surface-list-row p-3">
                <span className="font-black text-slate-100">{hold.reference}</span>
                <span className="text-xs font-black uppercase text-amber-300">{statusLabel(hold.status)}</span>
                <span className="ml-auto font-black text-slate-100">{formatUsdCents(hold.balanceCents)}</span>
              </article>
            ))}
          </div>
        ) : <EmptyRows text="No hay salidas retenidas por cargos vinculados." />}
      </Panel>
    </div>
  );
}

function Agency({ workspace, canManageTeam, canRequest, canCloseDay }: { workspace: BusinessWorkspace; canManageTeam: boolean; canRequest: boolean; canCloseDay: boolean }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cartera de clientes" value={formatUsdCents(workspace.metrics.customerReceivableCents)} tone="text-emerald-300" />
        <StatCard label="Mi cuenta con la matriz" value={formatUsdCents(workspace.metrics.agencyReceivableCents)} tone="text-amber-300" />
        <StatCard label="Cajas disponibles" value={String(workspace.metrics.availableMatrixBoxes)} tone="text-slate-100" />
        <StatCard label="Solicitudes abiertas" value={String(workspace.metrics.openRequests)} tone="text-slate-100" />
      </section>
      <Panel title="Trabajo de mi agencia" action={<WalletCards className="h-5 w-5 text-emerald-300" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link className={secondaryButtonClass} href="/agencia/precios">Mis precios y ganancia</Link>
          <Link className={secondaryButtonClass} href="/solicitudes">Nueva solicitud</Link>
          {canCloseDay ? <Link className={secondaryButtonClass} href="/agencia/cierre">Cierre diario</Link> : null}
          {canManageTeam ? <Link className={secondaryButtonClass} href="/agencia/equipo">Equipo: 1 admin + 2 vendedores</Link> : <Link className={secondaryButtonClass} href="/agencia#clientes">Clientes y facturas</Link>}
          <Link className={secondaryButtonClass} href="/agencia#cuenta-matriz">Mi cuenta con la matriz</Link>
        </div>
      </Panel>
      <AgencyOperationsPanel canRequest={canRequest} />
    </div>
  );
}

export function BusinessCommandCenter({ surface, workspace, canManageAgencyTeam = false, canRequestAgencyOperations = false, canCloseAgencyDay = false }: { surface: BusinessSurface; workspace: BusinessWorkspace; canManageAgencyTeam?: boolean; canRequestAgencyOperations?: boolean; canCloseAgencyDay?: boolean }) {
  const title = surface === "network" ? "Red de agencias" : surface === "agency" ? "Mi agencia" : surface === "captor" ? "Agencias a mi cargo" : surface === "operations" ? "Solicitudes" : "Contabilidad";
  const description = surface === "finance"
    ? "Cargos, pagos, aplicaciones, efectivo en tránsito y liberaciones en una sola vista."
    : surface === "operations"
      ? "Cantidades solicitadas y confirmadas, visitas combinadas y ruta asignada."
      : surface === "agency"
        ? "Ventas, cartera de clientes, cajas y cuenta con la matriz sin mezclar el dinero."
        : "Estado, responsable, operación y saldo de cada agencia dentro del tenant.";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-3 sm:p-5">
      <ContextTrail workspace={workspace} />
      <header className="rounded-xl border border-black bg-surface-shell p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-emerald-700 bg-emerald-400 text-slate-950">
            {surface === "finance" ? <CircleDollarSign className="h-6 w-6" /> : surface === "operations" ? <PackageOpen className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
          </div>
          <div className="min-w-0"><h1 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-sm font-bold text-slate-300">{description}</p></div>
        </div>
      </header>
      {surface === "network" ? <Network workspace={workspace} /> : surface === "captor" ? <Network workspace={workspace} captorOnly /> : surface === "agency" ? <Agency workspace={workspace} canManageTeam={canManageAgencyTeam} canRequest={canRequestAgencyOperations} canCloseDay={canCloseAgencyDay} /> : surface === "operations" ? <Operations workspace={workspace} /> : <Finance workspace={workspace} />}
    </div>
  );
}
