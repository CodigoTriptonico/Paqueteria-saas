"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Boxes, ClipboardPlus, Loader2, PackageCheck, Plus, Truck } from "lucide-react";
import {
  createAgencyBoxRequestAction,
  listAgencyRequestsAction,
  loadAgencyBoxInventoryAction,
  loadAgencyDeliveryCatalogAction,
  type AgencyBoxBalance,
  type AgencyBoxCatalogItem,
  type AgencyRequest,
} from "@/app/actions/agency-operations";
import { useNotify } from "@/hooks/use-notify";
import { Panel, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";

type RequestKind = "empty_box_delivery" | "full_box_pickup";
type RequestDraft = { kind: RequestKind; inventoryItemId: string; warehouseId: string; productKey: string; boxSize: string; quantity: string };

const statusLabel: Record<string, string> = { submitted: "Enviada", under_review: "En revisión", confirmed: "Confirmada", scheduled: "Programada", assigned: "Asignada", in_route: "En ruta", completed: "Completada", partially_completed: "Atendida parcialmente" };
const emptyDraft = (): RequestDraft => ({ kind: "empty_box_delivery", inventoryItemId: "", warehouseId: "", productKey: "", boxSize: "", quantity: "" });

export function AgencyOperationsPanel({ canRequest = false }: { canRequest?: boolean }) {
  const notify = useNotify();
  const [inventory, setInventory] = useState<AgencyBoxBalance[]>([]);
  const [deliveryCatalog, setDeliveryCatalog] = useState<AgencyBoxCatalogItem[]>([]);
  const [requests, setRequests] = useState<AgencyRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [lines, setLines] = useState<RequestDraft[]>([]);
  const [note, setNote] = useState("");
  const available = useMemo(() => inventory.reduce((total, item) => total + item.availableQuantity, 0), [inventory]);

  const reload = useCallback(async () => {
    const [inventoryResult, requestsResult, catalogResult] = await Promise.all([loadAgencyBoxInventoryAction(), listAgencyRequestsAction(), loadAgencyDeliveryCatalogAction()]);
    if (inventoryResult.ok) setInventory(inventoryResult.data);
    if (requestsResult.ok) setRequests(requestsResult.data);
    if (catalogResult.ok) setDeliveryCatalog(catalogResult.data);
  }, []);

  useEffect(() => {
    const reloadTimer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(reloadTimer);
  }, [reload]);

  function chooseBox(value: string) {
    const selected = draft.kind === "empty_box_delivery"
      ? deliveryCatalog.find((item) => `${item.inventoryItemId}:${item.warehouseId}` === value)
      : inventory.find((item) => item.inventoryItemId === value);
    setDraft((current) => ({
      ...current,
      inventoryItemId: selected?.inventoryItemId || "",
      warehouseId: "warehouseId" in (selected || {}) ? (selected as AgencyBoxCatalogItem).warehouseId || "" : "",
      productKey: selected?.productKey || "",
      boxSize: selected?.boxSize || "",
    }));
  }

  function addLine() {
    if (!draft.inventoryItemId || !Number.isSafeInteger(Number(draft.quantity)) || Number(draft.quantity) < 1) {
      notify.error("Selecciona una caja y una cantidad válida.");
      return;
    }
    setLines((current) => [...current, draft]);
    setDraft(emptyDraft());
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentLineIsComplete = draft.inventoryItemId && Number.isSafeInteger(Number(draft.quantity)) && Number(draft.quantity) > 0;
    const requestLines = [...lines, ...(currentLineIsComplete ? [draft] : [])];
    if (!requestLines.length) {
      notify.error("Agrega al menos una caja con cantidad válida.");
      return;
    }
    startTransition(async () => {
      const result = await createAgencyBoxRequestAction({ lines: requestLines.map((line) => ({ serviceKind: line.kind, inventoryItemId: line.inventoryItemId, warehouseId: line.warehouseId, productKey: line.productKey, boxSize: line.boxSize, quantity: Number(line.quantity) })), note });
      if (!result.ok) return notify.error(result.error);
      notify.success("Solicitud enviada a logística.");
      setOpen(false);
      setDraft(emptyDraft());
      setLines([]);
      setNote("");
      await reload();
    });
  }

  return <div className="space-y-4">
    <Panel title="Cajas de mi agencia" action={<span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-200">{available} disponibles</span>}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{inventory.length ? inventory.map((item) => <article key={item.id} className="rounded-lg border border-black bg-surface-list-row p-3"><p className="truncate text-sm font-black text-slate-100">{item.productKey || "Caja"}</p><p className="text-xs font-bold text-slate-400">{item.boxSize || "Sin tamaño"}</p><p className="mt-3 text-2xl font-black text-emerald-200">{item.availableQuantity}</p><p className="text-xs font-bold text-slate-500">{item.allocatedQuantity} usadas de {item.deliveredQuantity}</p></article>) : <p className="sm:col-span-2 xl:col-span-4 rounded-lg border border-dashed border-slate-700 px-3 py-6 text-sm font-bold text-slate-400">Todavía no hay cajas confirmadas en la agencia.</p>}</div>
    </Panel>

    <Panel title="Solicitudes" action={canRequest ? <button type="button" className={primaryButtonClass} onClick={() => setOpen((value) => !value)}><ClipboardPlus className="h-4 w-4" /> Pedir cajas</button> : <Boxes className="h-5 w-5 text-emerald-300" />}>
      {open ? <form className="mb-3 grid gap-2 rounded-lg border border-black bg-surface-inset p-3 sm:grid-cols-2" onSubmit={submit}>
        {lines.length ? <div className="sm:col-span-2 grid gap-1">{lines.map((line, index) => <div key={`${line.inventoryItemId}-${index}`} className="flex items-center justify-between rounded-md bg-surface-card px-3 py-2 text-sm font-bold text-slate-200"><span>{line.kind === "empty_box_delivery" ? "Llevar" : "Recoger"} {line.quantity} {line.productKey} · {line.boxSize}</span><button type="button" className="text-xs text-rose-200" onClick={() => removeLine(index)}>Quitar</button></div>)}</div> : null}
        <label className="grid gap-1 text-xs font-black text-slate-300">Movimiento<select className={inputClass} value={draft.kind} onChange={(event) => setDraft({ ...emptyDraft(), kind: event.target.value as RequestKind })}><option value="empty_box_delivery">Que nos lleven cajas vacías</option><option value="full_box_pickup">Que recojan cajas llenas</option></select></label>
        <label className="grid gap-1 text-xs font-black text-slate-300">Cantidad<input className={inputClass} inputMode="numeric" min="1" type="number" required value={draft.quantity} onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))} /></label>
        <label className="grid gap-1 text-xs font-black text-slate-300 sm:col-span-2">Tipo de caja<select className={inputClass} required value={draft.kind === "empty_box_delivery" ? `${draft.inventoryItemId}:${draft.warehouseId}` : draft.inventoryItemId} onChange={(event) => chooseBox(event.target.value)}><option value="">Selecciona una caja</option>{draft.kind === "empty_box_delivery" ? deliveryCatalog.map((item) => <option key={`${item.inventoryItemId}:${item.warehouseId}`} value={`${item.inventoryItemId}:${item.warehouseId}`}>{item.label} ({item.availableQuantity} disponibles)</option>) : inventory.map((item) => <option key={item.id} value={item.inventoryItemId}>{item.productKey || "Caja"} · {item.boxSize || "Estándar"} ({item.availableQuantity} disponibles)</option>)}</select>{draft.kind === "empty_box_delivery" && !deliveryCatalog.length ? <span className="text-xs font-bold text-amber-200">Logística debe registrar cajas disponibles en matriz antes de solicitarlas.</span> : null}</label>
        <button type="button" className={`${secondaryButtonClass} w-fit sm:col-span-2`} onClick={addLine}><Plus className="h-4 w-4" /> Agregar otra caja</button>
        <label className="grid gap-1 text-xs font-black text-slate-300 sm:col-span-2">Nota<input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Horario o indicación" /></label>
        <div className="flex gap-2 sm:col-span-2"><button className={primaryButtonClass} disabled={pending}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Enviar solicitud</button><button type="button" className={secondaryButtonClass} onClick={() => setOpen(false)} disabled={pending}>Cancelar</button></div>
      </form> : null}
      <div className="grid gap-2">{requests.length ? requests.map((request) => <article key={request.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-black bg-surface-list-row p-3"><Truck className="h-4 w-4 text-emerald-300" /><div className="min-w-0 flex-1"><p className="font-black text-slate-100">{request.code}</p><p className="text-xs font-bold text-slate-400">{request.lines.map((line) => `${line.serviceKind === "empty_box_delivery" ? "Llevar" : "Recoger"} ${line.requestedQuantity} ${line.productKey || "cajas"}`).join(" · ")}</p></div><span className="text-xs font-black text-amber-200">{statusLabel[request.status] || request.status}</span></article>) : <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-sm font-bold text-slate-400">No hay solicitudes abiertas.</p>}</div>
    </Panel>
  </div>;
}
