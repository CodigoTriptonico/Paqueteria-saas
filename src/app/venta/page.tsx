"use client";

import { Check, Edit3, Package, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { type MouseEvent, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui-blocks";

type Recipient = {
  name: string;
  country: string;
  phone: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  postalCode: string;
};

type Sender = {
  name: string;
  phone: string;
  street: string;
  houseNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  recipients: Recipient[];
};

type ContextMenuState = {
  x: number;
  y: number;
  title: string;
  type: "remitente" | "destinatario" | "caja";
};

const senders: Sender[] = [
  {
    name: "Maria Lopez",
    phone: "(305) 555-0182",
    street: "NW 17th Ave",
    houseNumber: "2450",
    neighborhood: "Allapattah",
    city: "Miami",
    state: "FL",
    postalCode: "33142",
    recipients: [
      {
        name: "Rosa Lopez",
        phone: "+52 55 1234 8899",
        street: "Calle 12",
        houseNumber: "45",
        neighborhood: "Centro",
        city: "CDMX",
        postalCode: "06000",
        country: "Mexico",
      },
      {
        name: "Luis Lopez",
        phone: "+52 55 7788 1122",
        street: "Av. Reforma",
        houseNumber: "200",
        neighborhood: "Juarez",
        city: "CDMX",
        postalCode: "06600",
        country: "Mexico",
      },
      {
        name: "Ana Lopez",
        phone: "+502 2233 4455",
        street: "6A Avenida",
        houseNumber: "10-22",
        neighborhood: "Zona 10",
        city: "Guatemala City",
        postalCode: "01010",
        country: "Guatemala",
      },
    ],
  },
  {
    name: "Jose Ramirez",
    phone: "(786) 555-0120",
    street: "W 49th St",
    houseNumber: "1220",
    neighborhood: "Palm Springs",
    city: "Hialeah",
    state: "FL",
    postalCode: "33012",
    recipients: [
      {
        name: "Carlos Ramirez",
        phone: "+502 5555 1200",
        street: "1A Calle",
        houseNumber: "8-20",
        neighborhood: "Zona 1",
        city: "Guatemala City",
        postalCode: "01001",
        country: "Guatemala",
      },
      {
        name: "Marta Ruiz",
        phone: "+504 9988 7711",
        street: "Boulevard Kennedy",
        houseNumber: "310",
        neighborhood: "Col. Kennedy",
        city: "Tegucigalpa",
        postalCode: "11101",
        country: "Honduras",
      },
    ],
  },
  {
    name: "Ana Perez",
    phone: "(954) 555-0177",
    street: "Sistrunk Blvd",
    houseNumber: "805",
    neighborhood: "Dorsey-Riverbend",
    city: "Fort Lauderdale",
    state: "FL",
    postalCode: "33311",
    recipients: [
      {
        name: "Diana Perez",
        phone: "+57 310 555 9090",
        street: "Carrera 7",
        houseNumber: "82-10",
        neighborhood: "Chico",
        city: "Bogota",
        postalCode: "110221",
        country: "Colombia",
      },
      {
        name: "Luz Gomez",
        phone: "+57 300 444 1234",
        street: "Calle 10",
        houseNumber: "33-18",
        neighborhood: "El Poblado",
        city: "Medellin",
        postalCode: "050021",
        country: "Colombia",
      },
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

const countryCodes: Record<string, string> = {
  USA: "US",
  Mexico: "MX",
  Guatemala: "GT",
  Colombia: "CO",
  Honduras: "HN",
};

const inputClass =
  "h-14 min-w-0 rounded-lg border border-slate-200 px-4 text-lg font-bold outline-none focus:border-emerald-500 dark:border-slate-700";

function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function CountryBadge({ country }: { country: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
      <Flag country={country} />
      {country}
    </span>
  );
}

function Flag({ country }: { country: string }) {
  const base = "h-4 w-7 overflow-hidden rounded-sm border border-white/50 shadow-sm";

  if (country === "Mexico") {
    return (
      <span className={`${base} grid grid-cols-3`}>
        <span className="bg-emerald-600" />
        <span className="bg-white" />
        <span className="bg-red-600" />
      </span>
    );
  }

  if (country === "Guatemala") {
    return (
      <span className={`${base} grid grid-cols-3`}>
        <span className="bg-sky-500" />
        <span className="bg-white" />
        <span className="bg-sky-500" />
      </span>
    );
  }

  if (country === "Colombia") {
    return (
      <span className={`${base} grid grid-rows-4`}>
        <span className="row-span-2 bg-yellow-400" />
        <span className="bg-blue-600" />
        <span className="bg-red-600" />
      </span>
    );
  }

  if (country === "Honduras") {
    return (
      <span className={`${base} grid grid-rows-3`}>
        <span className="bg-sky-500" />
        <span className="bg-white" />
        <span className="bg-sky-500" />
      </span>
    );
  }

  if (country === "USA") {
    return (
      <span className={`${base} relative bg-red-600`}>
        <span className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,#b91c1c_0_2px,#fff_2px_4px)]" />
        <span className="absolute left-0 top-0 h-2.5 w-3.5 bg-blue-700" />
      </span>
    );
  }

  return (
    <span className={`${base} flex items-center justify-center bg-slate-300 text-[9px]`}>
      {countryCodes[country] || "--"}
    </span>
  );
}

function AddressTags({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value]) => (
        <div
          key={`${label}-${value}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
        >
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function BottomAccent() {
  return (
    <span className="absolute inset-x-4 bottom-0 h-2 rounded-t-full bg-emerald-500 shadow-[0_-8px_24px_rgba(16,185,129,0.55)]" />
  );
}

export default function VentaPage() {
  const [mode, setMode] = useState<"sale" | "clients" | "new-client" | "new-recipient">("sale");
  const [selectedSender, setSelectedSender] = useState<Sender | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [selectedBox, setSelectedBox] = useState<string[] | null>(null);
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const [newRecipientCountry, setNewRecipientCountry] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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
  }

  function openContextMenu(
    event: MouseEvent,
    title: string,
    type: ContextMenuState["type"],
  ) {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, title, type });
  }

  return (
    <AppShell active="Nueva venta" title="Nueva venta" kicker="Clientes + venta">
      <div onClick={() => setContextMenu(null)}>
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
                onContextMenu={(event) =>
                  openContextMenu(event, sender.name, "remitente")
                }
                className={`relative overflow-hidden rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${
                  selectedSender?.phone === sender.phone
                    ? "border-emerald-500 bg-white ring-2 ring-emerald-100 dark:border-emerald-500 dark:bg-slate-950 dark:ring-emerald-900"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-800 dark:hover:bg-slate-900"
                }`}
              >
                {selectedSender?.phone === sender.phone ? (
                  <BottomAccent />
                ) : null}
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div>
                    <p className="text-2xl font-black">{sender.name}</p>
                    <p className="font-bold text-slate-500 dark:text-slate-400">
                      {sender.phone}
                    </p>
                  </div>
                  <CountryBadge country="USA" />
                </div>
                <AddressTags
                  items={[
                    ["Calle", sender.street],
                    ["Casa", sender.houseNumber],
                    ["Colonia", sender.neighborhood],
                    ["Ciudad", sender.city],
                    ["Estado", sender.state],
                    ["CP", sender.postalCode],
                  ]}
                />
                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-black text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
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
            <div className="mb-4 flex flex-wrap gap-3">
              <button
                onClick={() => setMode("new-recipient")}
                className="flex h-14 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-lg font-black text-white"
              >
                <Plus className="h-6 w-6" />
                Nuevo destinatario
              </button>
              <button className="h-14 rounded-lg bg-amber-500 px-5 text-lg font-black text-slate-950">
                Pendiente
              </button>
            </div>

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
                  onContextMenu={(event) =>
                    openContextMenu(event, recipient.name, "destinatario")
                  }
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                    selectedRecipient?.name === recipient.name &&
                    selectedRecipient?.country === recipient.country
                      ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 dark:bg-emerald-950 dark:ring-emerald-900"
                      : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800"
                    }`}
                >
                    {selectedRecipient?.name === recipient.name &&
                    selectedRecipient?.country === recipient.country ? (
                      <BottomAccent />
                    ) : null}
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-xl font-black">{recipient.name}</span>
                      <CountryBadge country={recipient.country} />
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-500 dark:text-slate-400">
                      {recipient.phone}
                    </span>
                    <AddressTags
                      items={[
                        ["Calle", recipient.street],
                        ["Casa", recipient.houseNumber],
                        ["Colonia", recipient.neighborhood],
                        ["Ciudad", recipient.city],
                        ["CP", recipient.postalCode],
                      ]}
                    />
                  </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={
              selectedRecipient
                ? `Cajas para ${selectedRecipient.country}`
                : "Cajas"
            }
          >
            {!selectedRecipient ? (
              <p className="text-xl font-black text-slate-500 dark:text-slate-400">
                Selecciona un destinatario.
              </p>
            ) : (
              <div className="grid gap-3">
                {boxesForCountry.map((box) => (
                  <button
                    key={box[0]}
                    onClick={() => setSelectedBox(box)}
                    onContextMenu={(event) =>
                      openContextMenu(event, `Caja ${box[0]}`, "caja")
                    }
                    className={`relative grid gap-4 overflow-hidden rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 lg:grid-cols-[auto_1fr_auto] ${
                      selectedBox?.[0] === box[0]
                        ? "border-emerald-500 bg-white ring-2 ring-emerald-100 dark:bg-slate-950 dark:ring-emerald-900"
                        : "border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-800"
                    }`}
                  >
                    {selectedBox?.[0] === box[0] ? <BottomAccent /> : null}
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 shadow-inner dark:bg-slate-900">
                      <Package className="h-9 w-9 text-slate-500" />
                    </div>

                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="text-2xl font-black">Caja {box[0]}</p>
                        <CountryBadge country={selectedRecipient.country} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          Carrier: {box[3]}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          Tiempo: {box[4]}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          Costo: {box[2]}
                        </span>
                      </div>
                    </div>

                    <div className="grid min-w-44 grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-[11px] font-black uppercase text-slate-500">
                          Cobra
                        </p>
                        <p className="text-2xl font-black">{box[1]}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-100 px-4 py-3 text-right text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        <p className="text-[11px] font-black uppercase">
                          Gana
                        </p>
                        <p className="text-2xl font-black">$40</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
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

      {selectedSender && selectedRecipient && selectedBox ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.55fr]">
          <Panel title="Datos del envio">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-lg font-black">Peso</span>
                <input className={inputClass} placeholder="Peso" />
              </label>
              <label className="grid gap-2">
                <span className="text-lg font-black">Entrega/Pickup</span>
                <select className={inputClass} defaultValue="">
                  <option value="" disabled>
                    Elegir opcion
                  </option>
                  <option>Cliente trajo caja a oficina</option>
                  <option>Recoger caja llena a domicilio</option>
                  <option>Cliente recoge caja vacia</option>
                  <option>Entregar caja vacia a domicilio</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-lg font-black">Notas</span>
                <input className={inputClass} placeholder="Notas" />
              </label>
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
      </div>

      {contextMenu ? (
        <div
          className="fixed z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            <p className="text-xs font-black uppercase text-slate-400">
              {contextMenu.type}
            </p>
            <p className="truncate text-base font-black">{contextMenu.title}</p>
          </div>

          <button
            className="mt-1 flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-black hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setContextMenu(null)}
          >
            <Edit3 className="h-5 w-5" />
            Editar
          </button>
          <button
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-black hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setContextMenu(null)}
          >
            <Check className="h-5 w-5" />
            Marcar pendiente
          </button>
          <button
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
            onClick={() => setContextMenu(null)}
          >
            <Trash2 className="h-5 w-5" />
            Eliminar
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}
