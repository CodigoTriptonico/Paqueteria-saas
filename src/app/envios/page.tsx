"use client";

import { cardClass, labelMutedClass, Panel, StatCard, inputClass, primaryButtonClass, textMutedClass } from "@/components/ui-blocks";
import Link from "next/link";
import { useMemo, useState } from "react";

const shipments = [
  ["#1008", "Maria Lopez", "Mexico", "FedEx", "$100", "$40", "En oficina"],
  ["#1007", "Jose Ramirez", "Guatemala", "MGS", "$85", "$31", "Pickup"],
  ["#1006", "Ana Perez", "Colombia", "Estafeta", "$62", "$22", "Enviado"],
  ["#1005", "Carlos Diaz", "Honduras", "Paquete Express", "$94", "$35", "Entregado"],
];

export default function EnviosPage() {
  const [query, setQuery] = useState("");
  const [carrier, setCarrier] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState("");
  const filteredShipments = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const cleanCarrier = carrier.trim().toLowerCase();
    const cleanCountry = country.trim().toLowerCase();
    const cleanStatus = status.trim().toLowerCase();

    return shipments.filter(([code, name, shipmentCountry, carrier, , , shipmentStatus]) => {
      const matchesQuery = [code, name, carrier]
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
      const matchesCarrier = carrier.toLowerCase().includes(cleanCarrier);
      const matchesCountry = shipmentCountry.toLowerCase().includes(cleanCountry);
      const matchesStatus = shipmentStatus.toLowerCase().includes(cleanStatus);

      return matchesQuery && matchesCarrier && matchesCountry && matchesStatus;
    });
  }, [carrier, country, query, status]);

  return (
    <>
      <Panel title="Envios" hideHeader>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={labelMutedClass}>Gestion de envios</p>
            <h3 className="truncate text-2xl font-black text-[#f8fafc]">Envios</h3>
          </div>
          <Link href="/venta" className={primaryButtonClass}>
            Nuevo envio
          </Link>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Hoy" value="14" tone="text-slate-400" />
        <StatCard label="En transito" value="38" tone="text-slate-400" />
        <StatCard label="Pendientes" value="11" tone="text-slate-400" />
        <StatCard label="Ganancia" value="$430" tone="text-slate-400" />
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <input
            className={inputClass}
            placeholder="Buscar cliente"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Carrier"
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Pais"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        </div>

        <div className="grid gap-3">
          {filteredShipments.length ? filteredShipments.map(([code, name, country, carrier, paid, profit, status]) => (
            <div key={code} className={`${cardClass} overflow-hidden`}>
              <div className="grid gap-3 border-b border-black bg-surface-card-header px-3 py-2 lg:grid-cols-[auto_1fr_1fr_auto]">
                <p className="text-xl font-black text-[#f8fafc]">{code}</p>
                <div>
                  <p className="text-lg font-black text-[#f8fafc]">{name}</p>
                  <p className={textMutedClass}>{country}</p>
                </div>
                <p className="font-black text-slate-300">{carrier}</p>
                <p className={`font-bold lg:text-right ${textMutedClass}`}>{status}</p>
              </div>
              <div className="grid gap-3 px-3 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <p className="text-xl font-black text-[#f8fafc]">Cobrado: {paid}</p>
                <p className="rounded-lg border border-black bg-surface-inset px-4 py-2 text-center text-xl font-black text-[#f8fafc]">
                  Ganancia {profit}
                </p>
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-black bg-surface-card p-4 text-xl font-black">
              Sin resultados
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
