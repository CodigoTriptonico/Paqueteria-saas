"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Building2, ChevronRight, CircleDollarSign, History, Loader2, MapPinned, RotateCcw, Save, Search, Settings2, Store, Users } from "lucide-react";
import { changeAgencyDefaultRouteAction, restoreCommercialInheritanceAction, saveCommercialEntityProfileAction, saveCommercialOverrideAction } from "@/app/actions/commercial-config";
import { AppTabs, type AppTabDefinition } from "@/components/app-tabs";
import { CompactInfoDisclosure, Panel, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { resolveEffectiveCommercialPrice, type CommercialAudience, type CommercialPriceCandidate, type CommercialPriceKind } from "@/lib/commercial-config/resolver";
import type { CommercialAdminData, CommercialEntity, CommercialEntityProfile, CommercialOverride } from "@/lib/commercial-config/types";

type AudienceTab = "agency" | "seller";
type DetailTab = "general" | "operation" | "public" | "internal" | "additional" | "users" | "audit";

const audienceTabs: AppTabDefinition<AudienceTab>[] = [
  { id: "seller", label: "Vendedores", icon: Users },
  { id: "agency", label: "Agencias", icon: Building2 },
];

const detailTabs: AppTabDefinition<DetailTab>[] = [
  { id: "general", label: "Información", icon: Settings2 },
  { id: "operation", label: "Operación y ruta", icon: MapPinned },
  { id: "public", label: "Precios sugeridos", icon: Store },
  { id: "internal", label: "Tarifas internas", icon: CircleDollarSign },
  { id: "additional", label: "Servicios adicionales", icon: MapPinned },
  { id: "users", label: "Usuarios y permisos", icon: Users },
  { id: "audit", label: "Historial", icon: History },
];

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

function centsFromInput(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function sourceLabel(source: string) {
  if (source === "entity") return "Personalizado para esta entidad";
  if (source === "group") return "Configurado para todo el grupo";
  return "Heredado del país";
}

function activeOverride(data: CommercialAdminData, input: { audience: CommercialAudience; entityId: string | null; destinationCode: string; productCode: string; priceKind: CommercialPriceKind; serviceConcept: string }) {
  return data.overrides.find((row) => row.audience === input.audience && row.entityId === input.entityId && row.destinationCode === input.destinationCode && row.productCode === input.productCode && row.priceKind === input.priceKind && row.serviceConcept === input.serviceConcept) || null;
}

function resolvedPrice(data: CommercialAdminData, entity: CommercialEntity, base: CommercialPriceCandidate, input: { destinationCode: string; productCode: string; priceKind: CommercialPriceKind; serviceConcept: string }) {
  const group = activeOverride(data, { audience: entity.type, entityId: null, ...input });
  const own = activeOverride(data, { audience: entity.type, entityId: entity.id, ...input });
  return { group, own, effective: resolveEffectiveCommercialPrice({ country: base, group: group ? { amountCents: group.amountCents, currency: group.currency, sourceLevel: "group", sourceId: group.id } : null, entity: own ? { amountCents: own.amountCents, currency: own.currency, sourceLevel: "entity", sourceId: own.id } : null }) };
}

function SourceTrail({ source }: { source: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-black bg-surface-inset px-2 py-1 text-[10px] font-black text-slate-300"><span className="text-slate-500">País</span><ChevronRight className="h-3 w-3" /><span className={source === "group" ? "text-emerald-300" : "text-slate-500"}>Grupo</span><ChevronRight className="h-3 w-3" /><span className={source === "entity" ? "text-emerald-300" : "text-slate-500"}>Entidad</span></span>;
}

function PriceEditor({ data, entity, priceKind }: { data: CommercialAdminData; entity: CommercialEntity; priceKind: "public" | "internal" }) {
  const notify = useNotify();
  const [pending, startTransition] = useTransition();
  const [countryCode, setCountryCode] = useState(entity.profile.countryCode || data.countries[0]?.code || "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const lines = data.catalog.filter((line) => line.destinationCode === countryCode);

  function save(line: CommercialAdminData["catalog"][number], level: "group" | "entity") {
    const key = `${level}:${line.destinationCode}:${line.productCode}:${priceKind}`;
    const amountCents = centsFromInput(drafts[key] || "");
    const minimumKey = `${key}:minimum`;
    const minimumAmountCents = drafts[minimumKey] ? centsFromInput(drafts[minimumKey]) : null;
    if (!window.confirm(`Se reemplazará la configuración ${level === "group" ? "de todas las entidades" : "de esta entidad"}. ¿Continuar?`)) return;
    startTransition(async () => {
      const result = await saveCommercialOverrideAction({ audience: entity.type, entityId: level === "entity" ? entity.id : null, destinationCode: line.destinationCode, productCode: line.productCode, priceKind, serviceConcept: "international_shipping", amountCents, minimumAmountCents });
      if (!result.ok) return notify.error(result.error);
      notify.success("Configuración guardada"); window.location.reload();
    });
  }

  function restore(override: CommercialOverride) {
    if (!window.confirm("Se eliminará la personalización y volverá a aplicarse el valor heredado. ¿Continuar?")) return;
    startTransition(async () => { const result = await restoreCommercialInheritanceAction(override.id); if (!result.ok) return notify.error(result.error); notify.success("Valor heredado restaurado"); window.location.reload(); });
  }

  return <div className="space-y-3">
    <label className="grid max-w-sm gap-1 text-xs font-black text-slate-300">País<select className={inputClass} value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>{data.countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
    <div className="flex items-center gap-2"><span className="text-xs font-black uppercase text-slate-500">Prioridad</span><CompactInfoDisclosure ariaLabel="Cómo se resuelve la prioridad de precios">Entidad → grupo de {entity.type === "agency" ? "agencias" : "vendedores"} → país.</CompactInfoDisclosure></div>
    <div className="grid gap-2">{lines.map((line) => {
      const baseAmount = priceKind === "public" ? line.publicBaseCents : line.internalBaseCents;
      const resolved = resolvedPrice(data, entity, { amountCents: baseAmount, currency: line.currency, sourceLevel: "country" }, { destinationCode: line.destinationCode, productCode: line.productCode, priceKind, serviceConcept: "international_shipping" });
      return <article key={line.productCode} className="rounded-xl border border-black bg-surface-list-row p-3">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-black text-slate-100">{line.productName}</p><p className="text-xs font-bold text-slate-500">Base país {money(baseAmount, line.currency)}</p></div><div className="text-right"><p className="text-lg font-black text-emerald-300">{money(resolved.effective.amountCents, resolved.effective.currency)}</p><SourceTrail source={resolved.effective.sourceLevel} /></div></div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {(["group", "entity"] as const).map((level) => { const override = level === "group" ? resolved.group : resolved.own; const key = `${level}:${line.destinationCode}:${line.productCode}:${priceKind}`; const minimumKey = `${key}:minimum`; return <div key={level} className="border-t border-black/70 pt-2.5"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase text-slate-400">{level === "group" ? "Todas" : "Esta entidad"}</span>{override ? <button className="inline-flex items-center gap-1 text-[10px] font-black text-amber-200" onClick={() => restore(override)} disabled={pending}><RotateCcw className="h-3 w-3" /> Volver a heredar</button> : <span className="text-[10px] font-bold text-slate-600">Sin excepción</span>}</div><div className="flex gap-2"><input className={`${inputClass} min-w-0 flex-1`} inputMode="decimal" aria-label={`Precio ${level} ${line.productName}`} placeholder={override ? String(override.amountCents / 100) : String(baseAmount / 100)} value={drafts[key] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} /><button className={secondaryButtonClass} onClick={() => save(line, level)} disabled={pending || !drafts[key]}>Guardar</button></div>{entity.type === "seller" && priceKind === "public" ? <label className="mt-2 grid gap-1 text-[10px] font-black uppercase text-slate-400">Precio mínimo permitido<input className={inputClass} inputMode="decimal" aria-label={`Precio mínimo ${level} ${line.productName}`} placeholder={override?.minimumAmountCents === null || override?.minimumAmountCents === undefined ? "Sin mínimo" : String(override.minimumAmountCents / 100)} value={drafts[minimumKey] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [minimumKey]: event.target.value }))} /></label> : null}</div>; })}
        </div>
      </article>;
    })}</div>
  </div>;
}

function AdditionalServices({ data, entity }: { data: CommercialAdminData; entity: CommercialEntity }) {
  const notify=useNotify(); const [pending,startTransition]=useTransition(); const [drafts,setDrafts]=useState<Record<string,string>>({});
  const countryCode=entity.profile.countryCode||data.countries[0]?.code||"";
  return <div className="grid gap-3">{(["home_delivery","home_pickup"] as const).map((concept)=>{
    const base=data.countryServices.find((row)=>row.destinationCode===countryCode&&row.serviceConcept===concept); if(!base) return <p key={concept} className="rounded-lg border border-amber-900 bg-amber-950/20 p-3 text-sm font-bold text-amber-100">Configura primero {concept==="home_delivery"?"entrega a domicilio":"recogida a domicilio"} para {countryCode} en Países.</p>;
    const resolved=resolvedPrice(data,entity,{amountCents:base.amountCents,currency:base.currency,sourceLevel:"country"},{destinationCode:countryCode,productCode:"",priceKind:"additional_service",serviceConcept:concept});
    return <article key={concept} className="rounded-xl border border-black bg-surface-list-row p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><p className="font-black text-slate-100">{concept==="home_delivery"?"Entrega en domicilio del cliente":"Recogida en domicilio del cliente"}</p><CompactInfoDisclosure ariaLabel={`Información de ${concept==="home_delivery"?"entrega":"recogida"} a domicilio`}>La solicitud guarda una copia del valor efectivo.</CompactInfoDisclosure></div><p className="text-xs font-bold text-slate-500">Base del país {money(base.amountCents,base.currency)}</p></div><div className="text-right"><p className="text-lg font-black text-emerald-300">{money(resolved.effective.amountCents,resolved.effective.currency)}</p><p className="text-[10px] font-black text-slate-400">{sourceLabel(resolved.effective.sourceLevel)}</p></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{(["group","entity"] as const).map((level)=>{const override=level==="group"?resolved.group:resolved.own; const key=`${concept}:${level}`; return <div key={level} className="border-t border-black/70 pt-2"><div className="mb-2 flex justify-between text-[10px] font-black uppercase text-slate-400"><span>{level==="group"?"Todas las agencias":"Esta agencia"}</span>{override?<button className="text-amber-200" onClick={()=>startTransition(async()=>{const result=await restoreCommercialInheritanceAction(override.id);if(!result.ok)return notify.error(result.error);window.location.reload();})}>Restaurar</button>:null}</div><div className="flex gap-2"><input className={`${inputClass} min-w-0 flex-1`} value={drafts[key]||""} inputMode="decimal" placeholder={String((override?.amountCents??base.amountCents)/100)} onChange={(event)=>setDrafts((current)=>({...current,[key]:event.target.value}))}/><button className={secondaryButtonClass} disabled={pending||!drafts[key]} onClick={()=>startTransition(async()=>{const result=await saveCommercialOverrideAction({audience:"agency",entityId:level==="entity"?entity.id:null,destinationCode:countryCode,productCode:"",priceKind:"additional_service",serviceConcept:concept,amountCents:centsFromInput(drafts[key])});if(!result.ok)return notify.error(result.error);window.location.reload();})}>Guardar</button></div></div>})}</div></article>;
  })}</div>;
}

function EntityDetail({ data, entity }: { data: CommercialAdminData; entity: CommercialEntity }) {
  const notify=useNotify(); const [pending,startTransition]=useTransition(); const [tab,setTab]=useState<DetailTab>("general"); const [profile,setProfile]=useState(entity.profile); const [routeId,setRouteId]=useState(entity.routeTemplateId||"");
  const tabs=entity.type==="seller"?detailTabs.filter((item)=>!["internal","additional","users"].includes(item.id)):detailTabs;
  function saveProfile(){startTransition(async()=>{const result=await saveCommercialEntityProfileAction({entityType:entity.type,entityId:entity.id,profile});if(!result.ok)return notify.error(result.error);notify.success("Perfil comercial guardado");window.location.reload();});}
  return <div className="space-y-3">
    <div className="flex min-h-11 items-center gap-2 rounded-lg border border-black bg-surface-card px-3 py-2 shadow-[0_5px_16px_rgba(0,0,0,0.16)]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-black bg-surface-inset text-emerald-300">{entity.type==="agency"?<Building2 className="h-4 w-4"/>:<Store className="h-4 w-4"/>}</span><div className="min-w-0 flex-1"><p className="truncate font-black text-slate-50">{entity.name}</p><p className="truncate text-[10px] font-black uppercase tracking-wide text-emerald-300">{entity.type==="agency"?entity.code:"Vendedor"}</p></div><CompactInfoDisclosure ariaLabel={`Información de ${entity.name}`}>{entity.type==="agency"?"Configura el perfil. Los saldos y pagos permanecen fuera de esta página.":"Configura reglas de venta. Las ventas reales permanecen en Venta e Historial."}</CompactInfoDisclosure><span className="rounded-full border border-black bg-surface-inset px-3 py-1 text-xs font-black text-slate-300">{entity.status}</span></div>
    <AppTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Configuración comercial" />
    {tab==="general"?<Panel title="Información general" action={<button className={primaryButtonClass} onClick={saveProfile} disabled={!data.canManage||pending}>{pending?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Guardar</button>}><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-xs font-black text-slate-300">País<select className={inputClass} value={profile.countryCode} onChange={(event)=>setProfile({...profile,countryCode:event.target.value})}><option value="">Sin asignar</option>{data.countries.map((country)=><option key={country.code} value={country.code}>{country.name}</option>)}</select></label><label className="grid gap-1 text-xs font-black text-slate-300">Estado operativo<select className={inputClass} value={profile.operationalStatus} onChange={(event)=>setProfile({...profile,operationalStatus:event.target.value as CommercialEntityProfile["operationalStatus"]})}><option value="active">Activo</option><option value="paused">Pausado</option><option value="inactive">Inactivo</option></select></label><label className="grid gap-1 text-xs font-black text-slate-300">Zona<input className={inputClass} value={profile.zone} onChange={(event)=>setProfile({...profile,zone:event.target.value})}/></label><label className="grid gap-1 text-xs font-black text-slate-300">Territorio<input className={inputClass} value={profile.territory} onChange={(event)=>setProfile({...profile,territory:event.target.value})}/></label><label className="grid gap-1 text-xs font-black text-slate-300">Dirección<input className={inputClass} value={String(profile.address.formattedAddress||profile.address.address||"")} onChange={(event)=>setProfile({...profile,address:{...profile.address,formattedAddress:event.target.value}})}/></label><label className="grid gap-1 text-xs font-black text-slate-300">Contacto<input className={inputClass} value={String(profile.contact.phone||profile.contact.email||"")} onChange={(event)=>setProfile({...profile,contact:{...profile.contact,phone:event.target.value}})}/></label></div></Panel>:null}
    {tab==="operation"?<Panel title="Configuración operativa"><div className="grid gap-3 md:grid-cols-2">{entity.type==="agency"?<><label className="grid gap-1 text-xs font-black text-slate-300">Ruta asignada<select className={inputClass} value={routeId} onChange={(event)=>setRouteId(event.target.value)}><option value="">Sin ruta</option>{data.routeTemplates.map((route)=><option key={route.id} value={route.id}>{route.name}</option>)}</select></label><label className="grid gap-1 text-xs font-black text-slate-300">Frecuencia de visita<input className={inputClass} value={profile.visitFrequency} onChange={(event)=>setProfile({...profile,visitFrequency:event.target.value})}/></label><button className={`${primaryButtonClass} w-fit`} disabled={!data.canManage||pending||!routeId||routeId===entity.routeTemplateId} onClick={()=>{if(!window.confirm("La ruta anterior se conservará en el historial. ¿Cambiar la ruta?"))return;startTransition(async()=>{const result=await changeAgencyDefaultRouteAction({agencyId:entity.id,routeTemplateId:routeId,reason:"Cambio desde Vendedores y Agencias"});if(!result.ok)return notify.error(result.error);notify.success("Ruta actualizada sin borrar historial");window.location.reload();});}}><MapPinned className="h-4 w-4"/> Cambiar ruta</button></>:<><label className="grid gap-1 text-xs font-black text-slate-300">Sede<select className={inputClass} value={profile.warehouseId||""} onChange={(event)=>setProfile({...profile,warehouseId:event.target.value||null})}><option value="">Sin sede</option>{data.warehouses.map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="grid gap-1 text-xs font-black text-slate-300">Descuento máximo autorizado<input className={inputClass} type="number" min="0" max="100" value={profile.maxDiscountBps/100} onChange={(event)=>setProfile({...profile,maxDiscountBps:Math.round(Number(event.target.value)*100)})}/></label><label className="flex min-h-11 items-center gap-2 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-slate-200"><input type="checkbox" checked={profile.canModifyPublicPrice} onChange={(event)=>setProfile({...profile,canModifyPublicPrice:event.target.checked})}/> Puede modificar precios</label><fieldset className="rounded-lg border border-black bg-surface-inset p-3"><legend className="px-1 text-xs font-black text-slate-300">Servicios que puede vender</legend>{([['international_shipping','Envío internacional'],['home_delivery','Domicilio'],['home_pickup','Recogida'],['empty_box','Caja vacía']] as const).map(([value,label])=><label key={value} className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-200"><input type="checkbox" checked={profile.enabledServices.includes(value)} onChange={(event)=>setProfile({...profile,enabledServices:event.target.checked?[...new Set([...profile.enabledServices,value])]:profile.enabledServices.filter((service)=>service!==value)})}/>{label}</label>)}</fieldset><button className={`${primaryButtonClass} w-fit`} onClick={saveProfile} disabled={!data.canManage||pending}><Save className="h-4 w-4"/> Guardar reglas</button></>}</div></Panel>:null}
    {tab==="public"?<Panel title={entity.type==="agency"?"Precios sugeridos al público":"Precios públicos del vendedor"}><PriceEditor data={data} entity={entity} priceKind="public"/></Panel>:null}
    {tab==="internal"&&entity.type==="agency"?<Panel title="Tarifas internas de la matriz" action={<CompactInfoDisclosure ariaLabel="Información de tarifas internas">Solo configura cuánto debe la agencia a la matriz. No representa saldos ni pagos.</CompactInfoDisclosure>}><PriceEditor data={data} entity={entity} priceKind="internal"/></Panel>:null}
    {tab==="additional"&&entity.type==="agency"?<Panel title="Domicilios de clientes de agencia"><AdditionalServices data={data} entity={entity}/></Panel>:null}
    {tab==="users"?<Panel title="Usuarios y permisos" action={<CompactInfoDisclosure ariaLabel="Información de usuarios y permisos">Los roles y permisos se administran con el módulo existente de equipo. Aquí solo se muestra el contexto comercial.</CompactInfoDisclosure>}><p className="text-sm font-black text-slate-200"><Users className="mr-2 inline h-4 w-4 text-emerald-300"/>{entity.userCount} usuario{entity.userCount===1?"":"s"} asociado{entity.userCount===1?"":"s"}</p></Panel>:null}
    {tab==="audit"?<Panel title="Historial de cambios" action={<History className="h-5 w-5 text-emerald-300"/>}><div className="grid gap-2">{data.audit.filter((row)=>row.entityId===entity.id||row.metadata.entityId===entity.id).map((row)=><article key={row.id} className="rounded-lg border border-black bg-surface-list-row p-3"><p className="text-sm font-black text-slate-200">{row.action}</p><p className="text-xs font-bold text-slate-500">{new Date(row.occurredAt).toLocaleString("es-MX")}</p></article>)}{!data.audit.some((row)=>row.entityId===entity.id||row.metadata.entityId===entity.id)?<p className="text-sm font-bold text-slate-400">No hay cambios comerciales registrados.</p>:null}</div></Panel>:null}
  </div>;
}

export function CommercialAdminClient({ initialData, initialAudience="agency", selectedEntityId }: { initialData: CommercialAdminData; initialAudience?: AudienceTab; selectedEntityId?: string }) {
  const availableAudienceTabs = initialData.agencyModuleEnabled
    ? audienceTabs
    : audienceTabs.filter((item) => item.id === "seller");
  const effectiveInitialAudience = initialData.agencyModuleEnabled ? initialAudience : "seller";
  const [audience,setAudience]=useState<AudienceTab>(effectiveInitialAudience); const [query,setQuery]=useState(""); const [country,setCountry]=useState(""); const [status,setStatus]=useState("");
  const selected=selectedEntityId?initialData.entities.find((entity)=>entity.id===selectedEntityId):null;
  const entities=useMemo(()=>initialData.entities.filter((entity)=>entity.type===audience&&(!query||`${entity.name} ${entity.code} ${entity.email}`.toLowerCase().includes(query.toLowerCase()))&&(!country||entity.profile.countryCode===country)&&(!status||entity.status===status)),[initialData.entities,audience,query,country,status]);
  if(selected) return <div className="mx-auto w-full max-w-[1500px] space-y-3 p-3 sm:p-5"><Link href={selected.type==="agency"?"/agencias":"/vendedores"} className={`${secondaryButtonClass} w-fit`}>{initialData.agencyModuleEnabled ? "Volver a Vendedores y Agencias" : "Volver a Vendedores"}</Link><EntityDetail data={initialData} entity={selected}/></div>;
  return <div className="mx-auto w-full max-w-[1500px] space-y-4 p-3 sm:p-5">{initialData.agencyModuleEnabled ? <AppTabs tabs={availableAudienceTabs} value={audience} onChange={setAudience} ariaLabel="Vendedores y agencias"/> : null}<Panel title={audience==="agency"?"Agencias":"Vendedores"} action={<><span className="text-xs font-black text-slate-400">{entities.length} resultado{entities.length===1?"":"s"}</span><CompactInfoDisclosure ariaLabel="Información de administración comercial">Perfiles, reglas y precios. Las ventas, cobros y saldos permanecen en sus módulos.</CompactInfoDisclosure></>}><div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input className={`${inputClass} w-full pl-9`} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Buscar por nombre, código o correo"/></label><select className={inputClass} value={country} onChange={(event)=>setCountry(event.target.value)}><option value="">Todos los países</option>{initialData.countries.map((item)=><option key={item.code} value={item.code}>{item.name}</option>)}</select><select className={inputClass} value={status} onChange={(event)=>setStatus(event.target.value)}><option value="">Todos los estados</option><option value="active">Activo</option><option value="inactive">Inactivo</option><option value="temporarily_suspended">Suspendido</option></select></div><div className="grid gap-2">{entities.map((entity)=><article key={entity.id} className="grid gap-3 rounded-xl border border-black bg-surface-list-row p-3 md:grid-cols-[minmax(0,1fr)_9rem_12rem_9rem] md:items-center"><div className="min-w-0"><p className="truncate font-black text-slate-100">{entity.name}</p><p className="truncate text-xs font-bold text-slate-500">{entity.type==="agency"?`${entity.code} · ${entity.userCount} usuarios`:entity.email}</p></div><span className="text-xs font-black text-slate-300">{entity.profile.countryCode||"Sin país"}</span><span className="truncate text-xs font-bold text-slate-400">{entity.type==="agency"?entity.routeName:entity.profile.zone||"Sin zona"}</span><Link href={entity.type==="agency"?`/agencias/${entity.id}`:`/vendedores/${entity.id}`} className={`${secondaryButtonClass} w-full`}>Configurar</Link></article>)}{!entities.length?<p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm font-bold text-slate-400">No hay resultados con estos filtros.</p>:null}</div></Panel></div>;
}
