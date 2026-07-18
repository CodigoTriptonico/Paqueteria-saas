"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, ClipboardCheck, Truck } from "lucide-react";
import {
  movePhysicalPackageToWarehouseAction,
  reviewPhysicalPackageWeightDifferenceAction,
  updatePhysicalPackageReviewAction,
} from "@/app/actions/physical-packages";
import { useNotify } from "@/hooks/use-notify";
import {
  inputClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { ViewLayoutToggle } from "@/components/view-layout-toggle";
import { useViewLayout } from "@/hooks/use-view-layout";
import type { PhysicalPackage } from "@/lib/physical-packages";
import {
  packageInvoiceLifecycleLabel,
  packageInvoiceStateSummary,
} from "@/lib/package-invoice-lifecycle";
import { formatWarehouseDateTime, formatWarehouseElapsed } from "@/lib/warehouse-timing";

function contentText(pkg: PhysicalPackage) {
  return pkg.contents
    .map((line) => `${line.description}|${line.quantity}|${line.declaredValue}`)
    .join("\n");
}

function parseLines(value: string) {
  return value.split("\n").map((line) => {
    const [description = "", quantity = "", declaredValue = ""] = line.split("|");
    return {
      description: description.trim(),
      quantity: Number(quantity),
      declaredValue: Number(declaredValue),
    };
  });
}

function PackagePhaseTimes({
  pkg,
  includeWarehouse = false,
}: {
  pkg: PhysicalPackage;
  includeWarehouse?: boolean;
}) {
  return (
    <div className="mt-3 grid gap-1 border-t border-black pt-3 text-xs font-bold leading-5 text-slate-400">
      {pkg.truckArrivedAt ? (
        <p>
          Llegó el camión:{" "}
          <span className="text-slate-200">
            {formatWarehouseDateTime(pkg.truckArrivedAt)}
          </span>
        </p>
      ) : null}
      {pkg.truckUnloadedAt ? (
        <p>
          Descargada a Ingreso:{" "}
          <span className="text-slate-200">
            {formatWarehouseDateTime(pkg.truckUnloadedAt)}
          </span>{" "}
          <span className="text-amber-200">
            · {formatWarehouseElapsed(pkg.truckArrivedAt, pkg.truckUnloadedAt)}
          </span>
        </p>
      ) : null}
      {pkg.intakeRecordedAt ? (
        <p>
          Ingreso confirmado:{" "}
          <span className="text-slate-200">
            {formatWarehouseDateTime(pkg.intakeRecordedAt)}
          </span>{" "}
          <span className="text-sky-200">
            ·{" "}
            {formatWarehouseElapsed(
              pkg.truckUnloadedAt || pkg.collectionRecordedAt,
              pkg.intakeRecordedAt,
            )}
          </span>
        </p>
      ) : null}
      {includeWarehouse && pkg.warehousePlacedAt ? (
        <p>
          En bodega:{" "}
          <span className="text-emerald-100">
            {formatWarehouseDateTime(pkg.warehousePlacedAt)}
          </span>{" "}
          <span className="text-emerald-200">
            · {formatWarehouseElapsed(pkg.intakeRecordedAt, pkg.warehousePlacedAt)}
          </span>
        </p>
      ) : null}
      {!pkg.truckArrivedAt && !pkg.truckUnloadedAt ? (
        <p>
          Recepción inicial:{" "}
          <span className="text-slate-200">
            {formatWarehouseDateTime(pkg.collectionRecordedAt)}
          </span>
        </p>
      ) : null}
    </div>
  );
}

function PackageInvoiceTimeline({ pkg }: { pkg: PhysicalPackage }) {
  const state = packageInvoiceStateSummary({
    paymentStatus: pkg.invoicePaymentStatus,
    fulfillmentStatus: pkg.invoiceFulfillmentStatus,
  });

  return (
    <details className="mt-3 rounded-lg border border-black bg-surface-inset/40 p-3">
      <summary className="cursor-pointer list-none text-xs font-black text-emerald-200">
        Factura {pkg.invoiceCode} · {state}
      </summary>
      <div className="mt-3 grid gap-2 border-t border-black pt-3 text-xs font-bold text-slate-300">
        {pkg.invoiceLifecycle.map((event) => (
          <div key={event.state} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-black text-slate-100">{packageInvoiceLifecycleLabel[event.state]}</span>
            <span>{formatWarehouseDateTime(event.occurredAt)} · {event.changedByName}</span>
          </div>
        ))}
        {!pkg.invoiceLifecycle.length ? <p>Sin historial registrado.</p> : null}
      </div>
    </details>
  );
}

export function WarehouseClient({
  initialIntake = [],
  initialWarehouse = [],
  canReviewWeightDifferences = false,
  weightToleranceKg = 1,
}: {
  initialIntake?: PhysicalPackage[];
  initialWarehouse?: PhysicalPackage[];
  canReviewWeightDifferences?: boolean;
  weightToleranceKg?: number;
}) {
  const notify = useNotify();
  const { layout, toggleViewLayout } = useViewLayout();
  const [intake, setIntake] = useState(initialIntake);
  const [warehouse, setWarehouse] = useState(initialWarehouse);
  const [showIntake, setShowIntake] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState({
    contents: "",
    providerName: "",
    providerService: "",
    confirmationNumber: "",
    trackingNumber: "",
    trackingUrl: "",
  });

  async function move(pkg: PhysicalPackage) {
    setBusy(pkg.id);
    try {
      const result = await movePhysicalPackageToWarehouseAction(pkg.id);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setIntake((rows) => rows.filter((row) => row.id !== pkg.id));
      setWarehouse((rows) => [...rows, result.data]);
      notify.success(`${pkg.code} ya está en Bodega.`);
    } finally {
      setBusy("");
    }
  }

  function edit(pkg: PhysicalPackage) {
    setEditing(pkg.id);
    setForm({
      contents: contentText(pkg),
      providerName: pkg.providerName,
      providerService: pkg.providerService,
      confirmationNumber: pkg.providerConfirmationNumber,
      trackingNumber: pkg.providerTrackingNumber,
      trackingUrl: pkg.providerTrackingUrl,
    });
  }

  async function save(pkg: PhysicalPackage) {
    setBusy(pkg.id);
    try {
      const { contents, ...review } = form;
      const result = await updatePhysicalPackageReviewAction({
        packageId: pkg.id,
        contents: parseLines(contents),
        ...review,
      });
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setWarehouse((rows) => rows.map((row) => (row.id === pkg.id ? result.data : row)));
      setEditing(null);
      notify.success("Contenido y proveedor guardados.");
    } finally {
      setBusy("");
    }
  }

  async function reviewWeightDifference(pkg: PhysicalPackage) {
    setBusy(pkg.id);
    try {
      const result = await reviewPhysicalPackageWeightDifferenceAction(pkg.id);
      if (!result.ok) {
        notify.error(result.error);
        return;
      }
      setWarehouse((rows) => rows.map((row) => (row.id === pkg.id ? result.data : row)));
      notify.success("Diferencia de peso revisada.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel title="Bodega" hideHeader className="min-h-0" contentClassName="p-0">
      <div className="min-h-full space-y-5 p-4 pb-8 sm:p-5 sm:pb-10">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-4">
          <div>
            <h1 className="text-xl font-black text-slate-100">Bodega</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">
              Cajas ya transferidas a bodega.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewLayoutToggle layout={layout} onToggle={toggleViewLayout} />
            <button
              type="button"
              onClick={() => setShowIntake((value) => !value)}
              className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black ${showIntake ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-black bg-surface-inset text-slate-100"}`}
            >
              {showIntake ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Ingreso <span>{intake.length}</span>
            </button>
          </div>
        </header>

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-900/60 bg-sky-950/15 p-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-sky-300" />
            <div>
              <p className="font-black text-slate-100">Camiones y recepción física</p>
              <p className="text-sm font-bold text-slate-400">
                Descarga primero las cajas de un camión finalizado; después confírmalas una por una.
              </p>
            </div>
          </div>
          <Link href="/ingreso-bodega" className={`${secondaryButtonClass} h-10`}>
            <Truck className="h-4 w-4" />
            Descargar camión
          </Link>
        </section>

        <section hidden={!showIntake}>
          <div className="mb-3 flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-black">Listas en ingreso</h2>
            <span className="rounded-md bg-amber-400 px-2 py-0.5 text-xs font-black text-slate-950">
              {intake.length}
            </span>
          </div>
          <div
            className={
              layout === "cards" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-2"
            }
          >
            {intake.map((pkg) => (
              <article
                key={pkg.id}
                className="rounded-xl border border-black bg-surface-card p-4"
              >
                <p className="font-black text-[#f8fafc]">{pkg.code}</p>
                <p className="mt-1 text-sm font-bold text-slate-400">
                  {pkg.customerName} · {pkg.country}
                </p>
                <p className="mt-3 text-sm font-black">
                  Ingreso: {pkg.intakeWeightKg?.toFixed(2)} kg
                </p>
                 {pkg.weightDifferenceKg ? (
                  <p className="mt-1 text-xs font-bold text-amber-300">
                    Diferencia: {pkg.weightDifferenceKg.toFixed(2)} kg
                  </p>
                  ) : null}
                 <PackagePhaseTimes pkg={pkg} />
                 <PackageInvoiceTimeline pkg={pkg} />
                 <Link href={`/seguimiento/excepciones?package=${pkg.id}`} className={`${secondaryButtonClass} mt-3 h-9 text-xs`}>Custodia y excepción</Link>
                 <button
                  onClick={() => void move(pkg)}
                  disabled={busy === pkg.id}
                  className={`${primaryButtonClass} mt-4 h-10 w-full text-sm disabled:opacity-40`}
                >
                  Pasar a Bodega
                </button>
              </article>
            ))}
            {!intake.length ? (
              <p className="rounded-xl border border-dashed border-black p-5 text-sm font-bold text-slate-500">
                No hay cajas esperando traslado.
              </p>
            ) : null}
          </div>
        </section>

        <section className="border-t border-black pt-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-black">Cajas en bodega</h2>
            <span className="rounded-md bg-emerald-400 px-2 py-0.5 text-xs font-black text-slate-950">
              {warehouse.length}
            </span>
          </div>
          <div className={layout === "cards" ? "grid gap-3 lg:grid-cols-2" : "grid gap-2"}>
            {warehouse.map((pkg) => (
              <article
                key={pkg.id}
                className="rounded-xl border border-black bg-surface-card p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-black text-[#f8fafc]">{pkg.code}</p>
                    <p className="text-sm font-bold text-slate-400">
                      {pkg.customerName} · {pkg.country} · {pkg.intakeWeightKg?.toFixed(2)} kg
                    </p>
                  </div>
                  <button className={secondaryButtonClass} onClick={() => edit(pkg)}>
                    Revisar
                  </button>
                 </div>
                 <PackagePhaseTimes pkg={pkg} includeWarehouse />
                 <PackageInvoiceTimeline pkg={pkg} />
                 <Link href={`/seguimiento/excepciones?package=${pkg.id}`} className={`${secondaryButtonClass} mt-3 h-9 text-xs`}>Custodia y excepción</Link>
                 {pkg.weightDifferenceKg &&
                pkg.weightDifferenceKg > weightToleranceKg &&
                !pkg.weightDifferenceReviewedAt ? (
                  <div className="mt-3 rounded-lg border border-amber-500/45 bg-amber-950/30 p-3">
                    <p className="text-xs font-black uppercase text-amber-200">
                      Alerta pendiente de administrador · {pkg.weightDifferenceKg.toFixed(2)} kg
                    </p>
                    <p className="mt-1 text-sm font-bold text-amber-100">
                      {pkg.weightDifferenceNote || "Sin nota registrada"}
                    </p>
                    {canReviewWeightDifferences ? (
                      <button
                        className={`${secondaryButtonClass} mt-3 h-9 text-xs`}
                        disabled={busy === pkg.id}
                        onClick={() => void reviewWeightDifference(pkg)}
                      >
                        Marcar revisada
                      </button>
                    ) : null}
                  </div>
                ) : pkg.weightDifferenceKg && pkg.weightDifferenceKg > weightToleranceKg ? (
                  <p className="mt-3 text-xs font-black text-emerald-300">
                    Diferencia de peso revisada
                  </p>
                ) : null}
                {editing === pkg.id ? (
                  <div className="mt-4 grid gap-3 border-t border-black pt-4">
                    <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                      Contenido — una línea: descripción | cantidad | valor
                      <textarea
                        className={`${inputClass} min-h-24 py-2 normal-case`}
                        value={form.contents}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, contents: event.target.value }))
                        }
                        placeholder="Ropa|4|80"
                      />
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className={inputClass}
                        value={form.providerName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, providerName: event.target.value }))
                        }
                        placeholder="Proveedor"
                      />
                      <input
                        className={inputClass}
                        value={form.providerService}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            providerService: event.target.value,
                          }))
                        }
                        placeholder="Servicio"
                      />
                      <input
                        className={inputClass}
                        value={form.confirmationNumber}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            confirmationNumber: event.target.value,
                          }))
                        }
                        placeholder="No. confirmación"
                      />
                      <input
                        className={inputClass}
                        value={form.trackingNumber}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            trackingNumber: event.target.value,
                          }))
                        }
                        placeholder="No. rastreo"
                      />
                      <input
                        className={`${inputClass} sm:col-span-2`}
                        value={form.trackingUrl}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, trackingUrl: event.target.value }))
                        }
                        placeholder="Enlace de rastreo (opcional)"
                      />
                    </div>
                    <button
                      className={`${primaryButtonClass} h-10`}
                      disabled={busy === pkg.id}
                      onClick={() => void save(pkg)}
                    >
                      <Truck className="h-4 w-4" />
                      Guardar clasificación
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-bold text-slate-400">
                    {pkg.contentsValidatedAt
                      ? `${pkg.providerName} · ${pkg.providerTrackingNumber}`
                      : "Pendiente de validar contenido y asignar proveedor."}
                  </p>
                )}
              </article>
            ))}
            {!warehouse.length ? (
              <p className="rounded-xl border border-dashed border-black p-5 text-sm font-bold text-slate-500">
                Mueve cajas desde Ingreso a bodega para revisarlas aquí.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </Panel>
  );
}
