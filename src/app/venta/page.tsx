"use client";

import { Check, Plus, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui-blocks";

type Recipient = {
  name: string;
  country: string;
  phone?: string;
};

type Sender = {
  name: string;
  phone: string;
  address?: string;
  recipients: Recipient[];
};

const senders: Sender[] = [
  {
    name: "Maria Lopez",
    phone: "(305) 555-0182",
    address: "Miami, FL",
    recipients: [
      { name: "Rosa Lopez", country: "Mexico" },
      { name: "Luis Lopez", country: "Mexico" },
      { name: "Ana Lopez", country: "Guatemala" },
    ],
  },
  {
    name: "Jose Ramirez",
    phone: "(786) 555-0120",
    address: "Hialeah, FL",
    recipients: [
      { name: "Carlos Ramirez", country: "Guatemala" },
      { name: "Marta Ruiz", country: "Honduras" },
    ],
  },
  {
    name: "Ana Perez",
    phone: "(954) 555-0177",
    address: "Fort Lauderdale, FL",
    recipients: [
      { name: "Diana Perez", country: "Colombia" },
      { name: "Luz Gomez", country: "Colombia" },
    ],
  },
];

const countryBoxes = {
  Mexico: [
    ["30 x 30 x 30", "$100", "$60", "FedEx", "10-15 dias"],
    ["20 x 20 x 20", "$85", "$54", "Paquete Express", "8-12 dias"],
    ["16 x 16 x 16", "$62", "$40", "Estafeta", "8-12 dias"],
  ],
  Guatemala: [
    ["30 x 30 x 30", "$115", "$73", "MGS", "12-18 dias"],
    ["20 x 20 x 20", "$92", "$61", "MGS", "12-18 dias"],
  ],
  Colombia: [
    ["16 x 16 x 16", "$62", "$40", "Estafeta", "8-12 dias"],
    ["14 x 14 x 14", "$48", "$31", "MGS", "7-10 dias"],
  ],
  Honduras: [["20 x 20 x 20", "$88", "$56", "MGS", "12-18 dias"]],
};

const countries = Object.keys(countryBoxes);

const inputClass =
  "h-14 min-w-0 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700";

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export default function VentaPage() {
  const [mode, setMode] = useState<"sale" | "clients" | "new-client" | "new-recipient">("sale");
  const [selectedSender, setSelectedSender] = useState<Sender | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [selectedBox, setSelectedBox] = useState<string[] | null>(null);
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientCountry, setNewRecipientCountry] = useState("");

  const duplicateClient = useMemo(() => {
    if (!newClientPhone.trim()) {
      return null;
    }

    return senders.find(
      (sender) => cleanPhone(sender.phone) === cleanPhone(newClientPhone),
    );
  }, [newClientPhone]);

  const duplicateRecipient = useMemo(() => {
    if (!selectedSender || !newRecipientName.trim() || !newRecipientCountry) {
      return null;
    }

    return selectedSender.recipients.find(
      (recipient) =>
        recipient.name.toLowerCase() === newRecipientName.trim().toLowerCase() &&
        recipient.country === newRecipientCountry,
    );
  }, [newRecipientCountry, newRecipientName, selectedSender]);

  const boxesForCountry = selectedRecipient
    ? countryBoxes[selectedRecipient.country as keyof typeof countryBoxes] || []
    : [];

  function chooseSender(sender: Sender) {
    setSelectedSender(sender);
    setSelectedRecipient(null);
    setSelectedBox(null);
  }

  function chooseRecipient(recipient: Recipient) {
    setSelectedRecipient(recipient);
    setSelectedBox(null);
    setMode("sale");
  }

  return (
    <AppShell active="Nueva venta" title="Nueva venta" kicker="Clientes + venta">
      <div className="mb-5 grid gap-3 sm:grid-cols-[auto_auto_1fr]">
        <button
          onClick={() => setMode("clients")}
          className="h-14 rounded-lg bg-slate-950 px-6 text-lg font-black text-white dark:bg-slate-100 dark:text-slate-950"
        >
          Clientes
        </button>
        <button
          onClick={() => {
            setMode("sale");
            setSelectedBox(null);
          }}
          className="h-14 rounded-lg bg-emerald-500 px-6 text-lg font-black text-slate-950"
        >
          Nueva venta
        </button>
      </div>

      {mode === "clients" ? (
        <Panel title="Clientes">
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputClass} w-full pl-12`}
                placeholder="Buscar remitente o telefono"
              />
            </div>
            <button
              onClick={() => setMode("new-client")}
              className="flex h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-lg font-black text-white"
            >
              <UserPlus className="h-6 w-6" />
              Nuevo cliente
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {senders.map((sender) => (
              <button
                key={sender.phone}
                onClick={() => chooseSender(sender)}
                className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-emerald-950"
              >
                <p className="text-2xl font-black">{sender.name}</p>
                <p className="font-bold text-slate-500 dark:text-slate-400">
                  {sender.phone}
                </p>
                <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 font-black dark:bg-slate-900">
                  {sender.recipients.length} destinatarios
                </p>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {mode === "new-client" ? (
        <Panel title="Agregar nuevo cliente">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-lg font-black">Nombre</span>
              <input className={inputClass} placeholder="Nombre completo" />
            </label>
            <label className="grid gap-2">
              <span className="text-lg font-black">Telefono</span>
              <input
                className={inputClass}
                placeholder="Telefono"
                value={newClientPhone}
                onChange={(event) => setNewClientPhone(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-lg font-black">Direccion</span>
              <input className={inputClass} placeholder="Opcional" />
            </label>
          </div>

          {duplicateClient ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xl font-black">Este cliente ya existe</p>
              <p className="font-bold text-slate-600 dark:text-slate-300">
                {duplicateClient.name} - {duplicateClient.phone}
              </p>
              <button
                onClick={() => {
                  chooseSender(duplicateClient);
                  setMode("sale");
                }}
                className="mt-3 rounded-lg bg-amber-500 px-5 py-3 font-black text-slate-950"
              >
                Usar este cliente
              </button>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {selectedSender && (mode === "clients" || mode === "new-recipient") ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title={`Destinatarios de ${selectedSender.name}`}>
            <button
              onClick={() => setMode("new-recipient")}
              className="mb-4 flex h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-lg font-black text-white"
            >
              <Plus className="h-6 w-6" />
              Nuevo destinatario
            </button>

            {mode === "new-recipient" ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="font-black">Nombre destinatario</span>
                    <input
                      className={inputClass}
                      placeholder="Nombre"
                      value={newRecipientName}
                      onChange={(event) => setNewRecipientName(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="font-black">Pais obligatorio</span>
                    <select
                      className={inputClass}
                      value={newRecipientCountry}
                      onChange={(event) => setNewRecipientCountry(event.target.value)}
                    >
                      <option value="">Elegir pais</option>
                      {countries.map((country) => (
                        <option key={country} value={country}>
                          {country}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {duplicateRecipient ? (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-black dark:border-amber-800 dark:bg-amber-950">
                    Ese destinatario ya existe para este cliente.
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2">
              {selectedSender.recipients.map((recipient) => (
                <button
                  key={`${recipient.name}-${recipient.country}`}
                  onClick={() => chooseRecipient(recipient)}
                  className={`rounded-lg border px-4 py-3 text-left text-lg font-black ${
                    selectedRecipient?.name === recipient.name &&
                    selectedRecipient?.country === recipient.country
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  {recipient.name} - {recipient.country}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Siguiente paso">
            <p className="text-xl font-black text-slate-500 dark:text-slate-400">
              Selecciona un destinatario para ir a cajas.
            </p>
          </Panel>
        </div>
      ) : null}

      {mode === "sale" && !selectedRecipient ? (
        <Panel title="Nueva venta">
          <p className="mb-4 text-2xl font-black">
            Primero elige un cliente.
          </p>
          <button
            onClick={() => setMode("clients")}
            className="h-14 rounded-lg bg-slate-950 px-6 text-lg font-black text-white dark:bg-slate-100 dark:text-slate-950"
          >
            Clientes
          </button>
        </Panel>
      ) : null}

      {mode === "sale" && selectedSender && selectedRecipient ? (
        <div className="grid gap-5">
          <Panel title="Cliente seleccionado">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-bold text-slate-500 dark:text-slate-400">
                  Remitente
                </p>
                <p className="text-2xl font-black">{selectedSender.name}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-bold text-slate-500 dark:text-slate-400">
                  Destinatario
                </p>
                <p className="text-2xl font-black">
                  {selectedRecipient.name} - {selectedRecipient.country}
                </p>
              </div>
              <button
                onClick={() => setMode("clients")}
                className="h-full min-h-16 rounded-xl border border-slate-200 px-5 text-lg font-black dark:border-slate-700"
              >
                Cambiar
              </button>
            </div>
          </Panel>

          <Panel title={`Cajas para ${selectedRecipient.country}`}>
            <div className="grid gap-3">
              {boxesForCountry.map((box) => (
                <button
                  key={box[0]}
                  onClick={() => setSelectedBox(box)}
                  className={`grid gap-3 rounded-xl border p-4 text-left md:grid-cols-[1fr_auto_auto_auto] ${
                    selectedBox?.[0] === box[0]
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                      : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div>
                    <p className="text-2xl font-black">Caja {box[0]}</p>
                    <p className="font-bold text-slate-500 dark:text-slate-400">
                      {box[3]} - {box[4]}
                    </p>
                  </div>
                  <p className="text-2xl font-black">{box[1]}</p>
                  <p className="text-lg font-black text-slate-500 dark:text-slate-400">
                    Costo {box[2]}
                  </p>
                  <p className="rounded-lg bg-emerald-100 px-4 py-2 text-xl font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    Ganancia $40
                  </p>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {selectedSender && selectedRecipient && selectedBox ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.55fr]">
          <Panel title="Datos del envio">
            <div className="grid gap-4 md:grid-cols-3">
              {["Peso", "Entrega/Pickup", "Notas"].map((label) => (
                <label key={label} className="grid gap-2">
                  <span className="text-lg font-black">{label}</span>
                  <input className={inputClass} placeholder={label} />
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Finalizar">
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
              <p className="text-lg font-black">{selectedSender.name}</p>
              <p className="font-bold">{selectedRecipient.name}</p>
              <p className="font-bold">Caja {selectedBox[0]}</p>
            </div>
            <button className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 text-lg font-black text-slate-950">
              <Check className="h-6 w-6" />
              Cobrar venta
            </button>
          </Panel>
        </div>
      ) : null}
    </AppShell>
  );
}
