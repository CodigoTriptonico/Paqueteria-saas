"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  MapPin,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import type { PublicTrackingShipment } from "@/lib/public-tracking";

function formatDate(value: string | null) {
  if (!value) return "Pendiente";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Pendiente"
    : new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function publicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function PublicTrackingClient() {
  const params = useSearchParams();
  const [code, setCode] = useState(() => params.get("codigo") || "");
  const [phoneLastFour, setPhoneLastFour] = useState("");
  const [shipment, setShipment] = useState<PublicTrackingShipment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setShipment(null);
    try {
      const response = await fetch("/api/public/tracking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, phoneLastFour }),
      });
      const result = await response.json() as {
        ok: boolean;
        error?: string;
        shipment?: PublicTrackingShipment;
      };
      if (!response.ok || !result.ok || !result.shipment) {
        setError(result.error || "No pudimos consultar el envío.");
        return;
      }
      setShipment(result.shipment);
    } catch {
      setError("No pudimos conectarnos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-tracking-page min-h-dvh px-4 py-5 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Boxario</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Rastrea tu envío</h1>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300">
            <PackageCheck className="h-5 w-5" />
          </span>
        </header>

        <section className="rounded-2xl border border-black bg-surface-panel p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-5">
          <p className="max-w-xl text-sm font-bold leading-relaxed text-slate-300">
            Escribe el código de tu recibo y los últimos cuatro dígitos del teléfono del remitente.
          </p>
          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Código de envío</span>
              <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="INV-000001" className="h-12 rounded-xl border border-black bg-surface-inset px-3 text-base font-black outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Teléfono</span>
              <input value={phoneLastFour} onChange={(event) => setPhoneLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" placeholder="1234" className="h-12 rounded-xl border border-black bg-surface-inset px-3 text-base font-black outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20" />
            </label>
            <button type="submit" disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-400 px-4 text-sm font-black text-slate-950 shadow-[0_10px_24px_rgba(16,185,129,0.2)] transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-70">
              <Search className="h-4 w-4" />{loading ? "Buscando..." : "Consultar"}
            </button>
          </form>
          {error ? <p role="alert" className="mt-3 rounded-xl border border-rose-500/40 bg-rose-400/10 px-3 py-2 text-sm font-bold text-rose-100">{error}</p> : null}
        </section>

        {shipment ? <TrackingResult shipment={shipment} /> : <section className="mt-5 rounded-2xl border border-black/70 bg-surface-card/45 p-4 text-sm font-bold text-slate-400 sm:p-5"><span className="flex items-center gap-2 text-slate-300"><CircleHelp className="h-4 w-4 text-emerald-300" />¿No tienes tu código?</span><p className="mt-2 leading-relaxed">Pídelo a la persona que realizó el envío o revisa el recibo de venta.</p></section>}
      </div>
    </main>
  );
}

function TrackingResult({ shipment }: { shipment: PublicTrackingShipment }) {
  return <section className="mt-5 space-y-4">
    <header className="overflow-hidden rounded-2xl border border-black bg-surface-card shadow-[0_12px_28px_rgba(0,0,0,0.17)]">
      <div className="flex items-start justify-between gap-4 border-b border-black bg-surface-card-header px-4 py-4 sm:px-5">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Envío {shipment.code}</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-50">{shipment.status}</h2></div>
        <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black text-emerald-200">{shipment.country}</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5"><Detail icon={Truck} label="Servicio" value={shipment.carrier || "Envío estándar"} /><Detail icon={CreditCard} label="Pago" value={`${shipment.payment.status} · ${shipment.payment.balance} de saldo`} /></div>
    </header>

    <section className="rounded-2xl border border-black bg-surface-card p-4 sm:p-5"><h3 className="flex items-center gap-2 text-sm font-black text-slate-100"><ClipboardCheck className="h-4 w-4 text-emerald-300" />Seguimiento</h3><ol className="mt-4 space-y-0">{shipment.milestones.map((milestone, index) => <li key={milestone.id} className="relative flex gap-3 pb-4 last:pb-0"><span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${milestone.complete ? "border-emerald-300/50 bg-emerald-400 text-slate-950" : "border-slate-600 bg-surface-inset text-slate-500"}`}>{milestone.complete ? <Check className="h-4 w-4 stroke-[3]" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>{index < shipment.milestones.length - 1 ? <span className={`absolute left-[13px] top-7 h-[calc(100%-1.05rem)] w-px ${milestone.complete ? "bg-emerald-400/35" : "bg-slate-700"}`} /> : null}<span className="min-w-0 pt-0.5"><b className="block text-sm text-slate-100">{milestone.label}</b><small className={milestone.complete ? "font-bold text-slate-400" : "font-bold text-slate-500"}>{formatDate(milestone.at)}</small></span></li>)}</ol></section>

    <section className="grid gap-4 sm:grid-cols-2"><Person title="Remitente" name={shipment.sender.name} address={shipment.sender.address} /><Person title="Destino" name={shipment.recipient.name || "Destinatario"} address={shipment.recipient.address} /></section>

    <section className="rounded-2xl border border-black bg-surface-card p-4 sm:p-5"><h3 className="text-sm font-black text-slate-100">Cajas y cobro</h3><div className="mt-3 grid gap-2">{shipment.boxes.map((box) => <div key={`${box.label}-${box.quantity}`} className="flex items-center justify-between gap-3 rounded-xl border border-black bg-surface-inset px-3 py-2.5 text-sm"><span className="font-bold text-slate-200">{box.label}</span><b className="shrink-0 text-emerald-300">×{box.quantity}</b></div>)}{!shipment.boxes.length ? <p className="text-sm font-bold text-slate-500">Sin detalle de cajas.</p> : null}</div><dl className="mt-4 grid grid-cols-3 divide-x divide-black overflow-hidden rounded-xl border border-black bg-surface-inset"><Money label="Total" value={shipment.payment.total} /><Money label="Pagado" value={shipment.payment.paid} /><Money label="Saldo" value={shipment.payment.balance} /></dl>{shipment.payments.length ? <div className="mt-4 border-t border-black pt-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Pagos registrados</p>{shipment.payments.map((payment) => <div key={`${payment.at}-${payment.amount}`} className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-300">{payment.method} · {formatDate(payment.at)}</span><b className="shrink-0 text-emerald-300">{payment.amount}</b></div>)}</div> : null}</section>

    {shipment.providerTracking.length ? <section className="rounded-2xl border border-black bg-surface-card p-4 sm:p-5"><h3 className="text-sm font-black text-slate-100">Rastreo del proveedor</h3>{shipment.providerTracking.map((tracking) => { const url = publicUrl(tracking.url); return <div key={`${tracking.code}-${tracking.number}`} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black bg-surface-inset p-3"><span className="min-w-0"><b className="block text-sm text-slate-100">{tracking.provider || "Proveedor"}</b><small className="font-bold text-slate-400">{tracking.number}</small></span>{url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-xs font-black text-slate-950">Ver rastreo <ArrowRight className="h-4 w-4" /></a> : null}</div>; })}</section> : null}
  </section>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300"><Icon className="h-4 w-4" /></span><span className="min-w-0"><small className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</small><b className="block truncate text-sm text-slate-100">{value}</b></span></div>; }
function Person({ title, name, address }: { title: string; name: string; address: string }) { return <section className="rounded-2xl border border-black bg-surface-card p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{title}</p><b className="mt-1 block text-sm text-slate-100">{name || "Sin nombre"}</b><p className="mt-2 flex gap-2 text-sm font-bold leading-relaxed text-slate-400"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{address || "Dirección no disponible"}</p></section>; }
function Money({ label, value }: { label: string; value: string }) { return <div className="min-w-0 px-2 py-3 text-center"><dt className="truncate text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 truncate text-sm font-black text-slate-100">{value}</dd></div>; }
