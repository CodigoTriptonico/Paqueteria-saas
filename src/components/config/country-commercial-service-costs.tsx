"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { loadCommercialAdminAction, saveCountryCommercialServiceAction } from "@/app/actions/commercial-config";
import { inputClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";

export function CountryCommercialServiceCosts({
  destinationCode,
  agencyModuleEnabled = false,
}: {
  destinationCode: string;
  agencyModuleEnabled?: boolean;
}) {
  const notify=useNotify(); const [pending,startTransition]=useTransition(); const [loading,setLoading]=useState(true); const [values,setValues]=useState({home_delivery:"0",home_pickup:"0"});
  const reload=useCallback(async()=>{setLoading(true);const result=await loadCommercialAdminAction();setLoading(false);if(!result.ok)return;const delivery=result.data.countryServices.find((row)=>row.destinationCode===destinationCode&&row.serviceConcept==="home_delivery");const pickup=result.data.countryServices.find((row)=>row.destinationCode===destinationCode&&row.serviceConcept==="home_pickup");setValues({home_delivery:String((delivery?.amountCents||0)/100),home_pickup:String((pickup?.amountCents||0)/100)});},[destinationCode]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void reload();},0);return()=>window.clearTimeout(timer);},[reload]);
  function save(concept:"home_delivery"|"home_pickup"){const amountCents=Math.round(Number.parseFloat(values[concept]||"0")*100);startTransition(async()=>{const result=await saveCountryCommercialServiceAction({destinationCode,serviceConcept:concept,amountCents,currency:"USD"});if(!result.ok)return notify.error(result.error);notify.success("Costo base del país guardado");await reload();});}
  if(loading)return <p className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin"/> Cargando servicios adicionales...</p>;
  return <div className="mt-4 grid gap-2 border-t border-black pt-4 sm:grid-cols-2"><p className="text-xs font-bold text-slate-400 sm:col-span-2">Costos base del país. {agencyModuleEnabled ? "Las agencias y vendedores los heredan" : "Los vendedores los heredan"} mientras no exista una excepción.</p>{(["home_delivery","home_pickup"] as const).map((concept)=><label key={concept} className="grid gap-1 text-xs font-black text-slate-300"><span>{concept==="home_delivery"?"Entrega en domicilio de cliente":"Recogida en domicilio de cliente"}</span><span className="flex gap-2"><span className="relative min-w-0 flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">USD</span><input className={`${inputClass} w-full pl-12`} inputMode="decimal" value={values[concept]} onChange={(event)=>setValues((current)=>({...current,[concept]:event.target.value.replace(/[^0-9.]/g,"")}))}/></span><button type="button" className={secondaryButtonClass} disabled={pending} onClick={()=>save(concept)}><Save className="h-4 w-4"/> Guardar</button></span></label>)}</div>;
}
