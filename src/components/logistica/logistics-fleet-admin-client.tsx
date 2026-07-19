"use client";

import {
  Camera,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  PlusCircle,
  Search,
  Trash2,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { generateTemporaryPassword } from "@/lib/auth/temporary-password";
import { formatPersonNameInput } from "@/lib/person-name";
import {
  createLogisticsDriverAction,
  createLogisticsVehicleAction,
  deactivateLogisticsDriverAction,
  deactivateLogisticsVehicleAction,
  listLogisticsDriversAction,
  listLogisticsVehiclesAction,
  resetLogisticsDriverPasswordAction,
  updateLogisticsDriverAction,
  updateLogisticsVehicleAction,
  uploadLogisticsVehiclePhotoAction,
  type LogisticsDriverRow,
  type LogisticsVehicleInput,
  type LogisticsVehicleRow,
} from "@/app/actions/logistics-fleet";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { LogisticsSectionNav } from "@/components/logistica/logistics-section-nav";
import { PageLoading } from "@/components/page-loading";
import { SupabaseRequiredBanner } from "@/components/supabase-required-banner";
import {
  cardClass,
  insetShellClass,
  inputClass,
  Panel,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { settingsFieldLabelClass as fieldLabelClass } from "@/components/config/settings-panel-styles";

type FleetView = "drivers" | "vehicles";

type DriverForm = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
};

type VehicleForm = LogisticsVehicleInput & {
  id: string;
};

const emptyDriverForm: DriverForm = {
  id: "",
  email: "",
  password: "",
  fullName: "",
  phone: "",
};

const emptyVehicleForm: VehicleForm = {
  id: "",
  name: "",
  plate: "",
  photoUrl: "",
  cargoBoxSize: "",
  cargoCapacity: "",
  notes: "",
  assignedDriverId: null,
};

const compactInputClass = `${inputClass} h-10`;

function driverName(driver: LogisticsDriverRow) {
  return driver.fullName || driver.email;
}

function driverVehicleLabel(driver: LogisticsDriverRow) {
  if (!driver.vehicleId) {
    return "Sin vehiculo";
  }

  return [driver.vehicleName, driver.vehiclePlate].filter(Boolean).join(" - ");
}

function vehicleDriverLabel(vehicle: LogisticsVehicleRow) {
  return vehicle.assignedDriverName || vehicle.assignedDriverEmail || "Sin conductor";
}

function matchesQuery(values: string[], query: string) {
  const clean = query.trim().toLowerCase();

  if (!clean) {
    return true;
  }

  return values.join(" ").toLowerCase().includes(clean);
}

export function LogisticsFleetAdminClient({
  view,
  initialDrivers = [],
  initialVehicles = [],
}: {
  view: FleetView;
  initialDrivers?: LogisticsDriverRow[];
  initialVehicles?: LogisticsVehicleRow[];
}) {
  const notify = useNotify();
  const supabaseReady = isSupabaseConfigured();
  const [drivers, setDrivers] = useState(initialDrivers);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [loaded, setLoaded] = useState(Boolean(initialDrivers && initialVehicles));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [driverForm, setDriverForm] = useState<DriverForm | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm | null>(null);
  const [resetDriver, setResetDriver] = useState<{ id: string; label: string; password: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function reload() {
    const [driversResult, vehiclesResult] = await Promise.all([
      listLogisticsDriversAction(),
      listLogisticsVehiclesAction(),
    ]);

    if (driversResult.ok) {
      setDrivers(driversResult.data);
    } else {
      notify.error(driversResult.error);
    }

    if (vehiclesResult.ok) {
      setVehicles(vehiclesResult.data);
    } else {
      notify.error(vehiclesResult.error);
    }

    setLoaded(true);
  }

  const driverOptions = useMemo(
    () => [
      { value: "", label: "Sin conductor", searchText: "sin conductor" },
      ...drivers.map((driver) => ({
        value: driver.id,
        label: driverName(driver),
        searchText: [driver.fullName, driver.email, driver.phone].join(" "),
      })),
    ],
    [drivers],
  );

  const filteredDrivers = useMemo(
    () =>
      drivers.filter((driver) =>
        matchesQuery(
          [driver.fullName, driver.email, driver.phone, driver.vehicleName, driver.vehiclePlate],
          query,
        ),
      ),
    [drivers, query],
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((vehicle) =>
        matchesQuery(
          [
            vehicle.name,
            vehicle.plate,
            vehicle.cargoBoxSize,
            vehicle.cargoCapacity,
            vehicle.assignedDriverName,
            vehicle.assignedDriverEmail,
          ],
          query,
        ),
      ),
    [query, vehicles],
  );

  function openCreateDriver() {
    setDriverForm({ ...emptyDriverForm, password: generateTemporaryPassword() });
  }

  function openEditDriver(driver: LogisticsDriverRow) {
    setDriverForm({
      id: driver.id,
      email: driver.email,
      password: "",
      fullName: driver.fullName,
      phone: driver.phone,
    });
  }

  function openCreateVehicle() {
    setVehicleForm({ ...emptyVehicleForm });
  }

  function openEditVehicle(vehicle: LogisticsVehicleRow) {
    setVehicleForm({
      id: vehicle.id,
      name: vehicle.name,
      plate: vehicle.plate,
      photoUrl: vehicle.photoUrl,
      cargoBoxSize: vehicle.cargoBoxSize,
      cargoCapacity: vehicle.cargoCapacity,
      notes: vehicle.notes,
      assignedDriverId: vehicle.assignedDriverId,
    });
  }

  async function saveDriver(event: React.FormEvent) {
    event.preventDefault();

    if (!driverForm) {
      return;
    }

    setBusy("driver:save");
    const result = driverForm.id
      ? await updateLogisticsDriverAction({
          driverId: driverForm.id,
          email: driverForm.email,
          fullName: driverForm.fullName,
          phone: driverForm.phone,
        })
      : await createLogisticsDriverAction({
          email: driverForm.email,
          password: driverForm.password,
          fullName: driverForm.fullName,
          phone: driverForm.phone,
        });

    setBusy("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success(driverForm.id ? "Conductor actualizado" : "Conductor creado");
    setDriverForm(null);
    await reload();
  }

  async function deleteDriver(driver: LogisticsDriverRow) {
    if (!window.confirm(`Desactivar conductor ${driverName(driver)}?`)) {
      return;
    }

    setBusy(`driver:delete:${driver.id}`);
    const result = await deactivateLogisticsDriverAction(driver.id);
    setBusy("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Conductor desactivado");
    await reload();
  }

  async function saveResetPassword(event: React.FormEvent) {
    event.preventDefault();

    if (!resetDriver) {
      return;
    }

    setBusy("driver:password");
    const result = await resetLogisticsDriverPasswordAction({
      driverId: resetDriver.id,
      password: resetDriver.password,
    });
    setBusy("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Contrasena actualizada");
    setResetDriver(null);
  }

  async function saveVehicle(event: React.FormEvent) {
    event.preventDefault();

    if (!vehicleForm) {
      return;
    }

    setBusy("vehicle:save");
    const payload: LogisticsVehicleInput = {
      name: vehicleForm.name,
      plate: vehicleForm.plate,
      photoUrl: vehicleForm.photoUrl,
      cargoBoxSize: vehicleForm.cargoBoxSize,
      cargoCapacity: vehicleForm.cargoCapacity,
      notes: vehicleForm.notes,
      assignedDriverId: vehicleForm.assignedDriverId || null,
    };
    const result = vehicleForm.id
      ? await updateLogisticsVehicleAction({ vehicleId: vehicleForm.id, data: payload })
      : await createLogisticsVehicleAction(payload);

    setBusy("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success(vehicleForm.id ? "Vehiculo actualizado" : "Vehiculo creado");
    setVehicleForm(null);
    await reload();
  }

  async function deleteVehicle(vehicle: LogisticsVehicleRow) {
    if (!window.confirm(`Eliminar vehiculo ${vehicle.name}?`)) {
      return;
    }

    setBusy(`vehicle:delete:${vehicle.id}`);
    const result = await deactivateLogisticsVehicleAction(vehicle.id);
    setBusy("");

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    notify.success("Vehiculo eliminado");
    await reload();
  }

  async function uploadVehiclePhoto(file: File | null) {
    if (!file || !vehicleForm) {
      return;
    }

    const formData = new FormData();
    formData.set("photo", file);
    setUploadingPhoto(true);
    const result = await uploadLogisticsVehiclePhotoAction(formData);
    setUploadingPhoto(false);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setVehicleForm((current) => (current ? { ...current, photoUrl: result.data } : current));
    notify.success("Foto subida");
  }

  if (!loaded) {
    void reload();
    return <PageLoading inline />;
  }

  const activeCount = view === "drivers" ? drivers.length : vehicles.length;

  return (
    <Panel title={view === "drivers" ? "Conductores" : "Vehiculos"} hideHeader clipContent={false}>
      {!supabaseReady ? (
        <SupabaseRequiredBanner detail="Conductores y vehiculos se guardan en Supabase." />
      ) : null}

      <div className="grid gap-4">
        <div className={`${cardClass} overflow-visible p-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 shrink-0 items-center rounded-lg border border-black bg-surface-inset px-2.5 text-sm font-black text-slate-300">
              {activeCount} activos
            </span>

            <label className={`${insetShellClass} flex h-9 min-w-[14rem] flex-[1_1_18rem] items-center gap-2 rounded-lg border border-black bg-surface-inset px-3`}>
              <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#f8fafc] outline-none placeholder:text-slate-500"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={view === "drivers" ? "Buscar conductor" : "Buscar vehiculo"}
                aria-label="Buscar"
              />
            </label>

            <button
              type="button"
              className={`${primaryButtonClass} h-9 shrink-0 px-4`}
              onClick={view === "drivers" ? openCreateDriver : openCreateVehicle}
            >
              <PlusCircle className="h-4 w-4" />
              Nuevo
            </button>

            <LogisticsSectionNav active={view === "drivers" ? "drivers" : "vehicles"} className="ml-auto" />
          </div>
        </div>

        {view === "drivers" ? (
          <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredDrivers.length ? (
              filteredDrivers.map((driver) => (
                <article key={driver.id} className={`${cardClass} overflow-hidden`}>
                  <div className="border-b border-black bg-surface-card-header p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-[#f8fafc]">{driverName(driver)}</p>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-bold text-slate-400">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{driver.email}</span>
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black bg-emerald-400 text-slate-950">
                        <UserRound className="h-5 w-5" />
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2 p-4">
                    <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
                      <p className="text-[10px] font-black uppercase text-slate-500">Vehiculo</p>
                      <p className="mt-0.5 truncate text-sm font-black text-slate-200">
                        {driverVehicleLabel(driver)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
                      <p className="text-[10px] font-black uppercase text-slate-500">Telefono</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-black text-slate-200">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                        {driver.phone || "Sin telefono"}
                      </p>
                    </div>
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-9 text-xs`}
                        onClick={() => openEditDriver(driver)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-9 text-xs`}
                        onClick={() =>
                          setResetDriver({
                            id: driver.id,
                            label: driverName(driver),
                            password: generateTemporaryPassword(),
                          })
                        }
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Clave
                      </button>
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-9 text-xs text-rose-200`}
                        disabled={busy === `driver:delete:${driver.id}`}
                        onClick={() => void deleteDriver(driver)}
                      >
                        {busy === `driver:delete:${driver.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-black bg-surface-inset p-6 text-center md:col-span-2 2xl:col-span-3">
                <div>
                  <Users className="mx-auto h-9 w-9 text-slate-600" />
                  <p className="mt-3 text-sm font-black text-slate-300">Sin conductores</p>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {view === "vehicles" ? (
          <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredVehicles.length ? (
              filteredVehicles.map((vehicle) => (
                <article key={vehicle.id} className={`${cardClass} overflow-hidden`}>
                  <div className="aspect-[16/8] border-b border-black bg-surface-inset">
                    {vehicle.photoUrl ? (
                      // Supabase vehicle photos use signed, short-lived URLs outside Next's static remote host list.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vehicle.photoUrl}
                        alt={vehicle.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Truck className="h-12 w-12 text-slate-600" />
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-[#f8fafc]">{vehicle.name}</p>
                        <p className="mt-1 inline-flex rounded-md border border-black bg-emerald-400 px-2 py-0.5 text-sm font-black text-slate-950">
                          {vehicle.plate}
                        </p>
                      </div>
                      <span className="rounded-lg border border-black bg-surface-inset px-2 py-1 text-[11px] font-black text-slate-300">
                        {vehicleDriverLabel(vehicle)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
                        <p className="text-[10px] font-black uppercase text-slate-500">Volco</p>
                        <p className="mt-0.5 truncate text-sm font-black text-slate-200">
                          {vehicle.cargoBoxSize}
                        </p>
                      </div>
                      <div className="rounded-lg border border-black bg-surface-inset px-3 py-2">
                        <p className="text-[10px] font-black uppercase text-slate-500">Carga</p>
                        <p className="mt-0.5 truncate text-sm font-black text-slate-200">
                          {vehicle.cargoCapacity}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-9 text-xs`}
                        onClick={() => openEditVehicle(vehicle)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`${secondaryButtonClass} h-9 text-xs text-rose-200`}
                        disabled={busy === `vehicle:delete:${vehicle.id}`}
                        onClick={() => void deleteVehicle(vehicle)}
                      >
                        {busy === `vehicle:delete:${vehicle.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-black bg-surface-inset p-6 text-center md:col-span-2 2xl:col-span-3">
                <div>
                  <Truck className="mx-auto h-9 w-9 text-slate-600" />
                  <p className="mt-3 text-sm font-black text-slate-300">Sin vehiculos</p>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {driverForm ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4">
          <form
            className="w-full max-w-xl overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_18px_45px_rgba(0,0,0,0.5)]"
            onSubmit={saveDriver}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black bg-surface-card-header px-4 py-3">
              <p className="text-sm font-black text-[#f8fafc]">
                {driverForm.id ? "Editar conductor" : "Nuevo conductor"}
              </p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300"
                onClick={() => setDriverForm(null)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <label className={fieldLabelClass}>
                Nombre
                <input
                  className={compactInputClass}
                  value={driverForm.fullName}
                  onChange={(event) =>
                    setDriverForm(
                      (current) =>
                        current && {
                          ...current,
                          fullName: formatPersonNameInput(event.target.value),
                        },
                    )
                  }
                />
              </label>
              <label className={fieldLabelClass}>
                Telefono
                <input
                  className={compactInputClass}
                  value={driverForm.phone}
                  onChange={(event) =>
                    setDriverForm((current) => current && { ...current, phone: event.target.value })
                  }
                />
              </label>
              <label className={fieldLabelClass}>
                Correo
                <input
                  className={compactInputClass}
                  type="email"
                  value={driverForm.email}
                  onChange={(event) =>
                    setDriverForm((current) => current && { ...current, email: event.target.value })
                  }
                  required
                />
              </label>
              {!driverForm.id ? (
                <label className={fieldLabelClass}>
                  Contrasena temporal
                  <div className="flex gap-2">
                    <input
                      className={`${compactInputClass} min-w-0 flex-1 font-mono`}
                      value={driverForm.password}
                      onChange={(event) =>
                        setDriverForm((current) => current && { ...current, password: event.target.value })
                      }
                      required
                    />
                    <button
                      type="button"
                      className={`${secondaryButtonClass} h-10`}
                      onClick={() =>
                        setDriverForm((current) => current && { ...current, password: generateTemporaryPassword() })
                      }
                    >
                      Nueva
                    </button>
                  </div>
                </label>
              ) : null}
            </div>
            <div className="flex gap-2 border-t border-black p-4">
              <button type="submit" className={primaryButtonClass} disabled={busy === "driver:save"}>
                {busy === "driver:save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setDriverForm(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {resetDriver ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4">
          <form
            className="w-full max-w-md overflow-hidden rounded-xl border border-black bg-surface-card shadow-[0_18px_45px_rgba(0,0,0,0.5)]"
            onSubmit={saveResetPassword}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black bg-surface-card-header px-4 py-3">
              <p className="text-sm font-black text-[#f8fafc]">Contrasena - {resetDriver.label}</p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300"
                onClick={() => setResetDriver(null)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-4">
              <label className={fieldLabelClass}>
                Nueva contrasena
                <div className="flex gap-2">
                  <input
                    className={`${compactInputClass} min-w-0 flex-1 font-mono`}
                    value={resetDriver.password}
                    onChange={(event) =>
                      setResetDriver((current) =>
                        current ? { ...current, password: event.target.value } : current,
                      )
                    }
                  />
                  <button
                    type="button"
                    className={`${secondaryButtonClass} h-10`}
                    onClick={() =>
                      setResetDriver((current) =>
                        current ? { ...current, password: generateTemporaryPassword() } : current,
                      )
                    }
                  >
                    Nueva
                  </button>
                </div>
              </label>
            </div>
            <div className="flex gap-2 border-t border-black p-4">
              <button type="submit" className={primaryButtonClass} disabled={busy === "driver:password"}>
                {busy === "driver:password" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Guardar
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setResetDriver(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {vehicleForm ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4">
          <form
            className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-black bg-surface-card shadow-[0_18px_45px_rgba(0,0,0,0.5)]"
            onSubmit={saveVehicle}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black bg-surface-card-header px-4 py-3">
              <p className="text-sm font-black text-[#f8fafc]">
                {vehicleForm.id ? "Editar vehiculo" : "Nuevo vehiculo"}
              </p>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-black bg-surface-inset text-slate-300"
                onClick={() => setVehicleForm(null)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <div className="grid gap-3">
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-black bg-surface-inset">
                  {vehicleForm.photoUrl ? (
                    // Local previews and signed Supabase URLs must render before a permanent remote URL exists.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vehicleForm.photoUrl} alt="Vehiculo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Camera className="h-10 w-10 text-slate-600" />
                    </div>
                  )}
                </div>
                <label className={`${secondaryButtonClass} h-10 cursor-pointer`}>
                  {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  Subir foto
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void uploadVehiclePhoto(event.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={fieldLabelClass}>
                  Nombre
                  <input
                    className={compactInputClass}
                    value={vehicleForm.name}
                    onChange={(event) =>
                      setVehicleForm((current) => current && { ...current, name: event.target.value })
                    }
                    required
                  />
                </label>
                <label className={fieldLabelClass}>
                  Placa
                  <input
                    className={compactInputClass}
                    value={vehicleForm.plate}
                    onChange={(event) =>
                      setVehicleForm((current) => current && { ...current, plate: event.target.value })
                    }
                    required
                  />
                </label>
                <label className={fieldLabelClass}>
                  Tamano de volco
                  <input
                    className={compactInputClass}
                    value={vehicleForm.cargoBoxSize}
                    onChange={(event) =>
                      setVehicleForm((current) => current && { ...current, cargoBoxSize: event.target.value })
                    }
                    placeholder="8 pies / 10 pies"
                    required
                  />
                </label>
                <label className={fieldLabelClass}>
                  Capacidad
                  <input
                    className={compactInputClass}
                    value={vehicleForm.cargoCapacity}
                    onChange={(event) =>
                      setVehicleForm((current) => current && { ...current, cargoCapacity: event.target.value })
                    }
                    placeholder="1200 lb / 12 cajas"
                    required
                  />
                </label>
                <label className={`${fieldLabelClass} sm:col-span-2`}>
                  Conductor asignado
                  <InlineSearchPicker
                    compact={false}
                    className="w-full"
                    minWidthClass="w-full min-w-0"
                    value={vehicleForm.assignedDriverId || ""}
                    onChange={(value) =>
                      setVehicleForm((current) =>
                        current ? { ...current, assignedDriverId: value || null } : current,
                      )
                    }
                    options={driverOptions}
                    placeholder="Sin conductor"
                    searchPlaceholder="Buscar conductor"
                    emptyLabel="Sin conductores"
                    ariaLabel="Conductor asignado"
                  />
                </label>
                <label className={`${fieldLabelClass} sm:col-span-2`}>
                  Notas
                  <textarea
                    className={`${inputClass} min-h-24 py-3`}
                    value={vehicleForm.notes}
                    onChange={(event) =>
                      setVehicleForm((current) => current && { ...current, notes: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="sticky bottom-0 flex gap-2 border-t border-black bg-surface-card p-4">
              <button type="submit" className={primaryButtonClass} disabled={busy === "vehicle:save"}>
                {busy === "vehicle:save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Guardar
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setVehicleForm(null)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </Panel>
  );
}
