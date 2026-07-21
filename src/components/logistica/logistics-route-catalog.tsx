"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, PlusCircle, Route, Trash2 } from "lucide-react";
import {
  createLogisticsRouteTemplateAction,
  deleteLogisticsRouteTemplateAction,
  setLogisticsWeekdayDefaultDriverAction,
  setLogisticsRouteWeekdayEnabledAction,
  updateLogisticsRouteTemplateAction,
  type LogisticsRouteCatalog,
  type LogisticsRouteTemplateRow,
} from "@/app/actions/logistics-routes";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui-blocks";
import { useNotify } from "@/hooks/use-notify";
import { logisticsWeekdayKeys, type LogisticsWeekdayKey } from "@/lib/logistics-route-catalog";
import { genericLogisticsRouteName } from "@/lib/logistics-day-route";

const weekdayNames = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

export function LogisticsRouteCatalog({
  initialCatalog,
  canManage,
  routeMembers = [],
  onCatalogChange,
}: {
  initialCatalog?: LogisticsRouteCatalog;
  canManage: boolean;
  routeMembers?: Array<{ id: string; label: string; roleSlug: string }>;
  onCatalogChange?: () => void;
}) {
  const notify = useNotify();
  const [enabledDays, setEnabledDays] = useState<LogisticsWeekdayKey[]>(
    initialCatalog?.enabledDays || [],
  );
  const [templates, setTemplates] = useState<LogisticsRouteTemplateRow[]>(
    initialCatalog?.templates || [],
  );
  const [defaultDriverByWeekday, setDefaultDriverByWeekday] = useState<Array<string | null>>(
    initialCatalog?.defaultDriverByWeekday || Array<string | null>(7).fill(null),
  );
  const [selectedDay, setSelectedDay] = useState(0);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<LogisticsRouteTemplateRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!initialCatalog) {
      return;
    }

    const enabledDays = initialCatalog.enabledDays || [];
    const templates = initialCatalog.templates || [];
    const defaultDriverByWeekday =
      initialCatalog.defaultDriverByWeekday || Array<string | null>(7).fill(null);
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setEnabledDays(enabledDays);
      setTemplates(templates);
      setDefaultDriverByWeekday(defaultDriverByWeekday);
    });
    return () => {
      active = false;
    };
  }, [initialCatalog]);

  const selectedDayKey = logisticsWeekdayKeys[selectedDay] || "Lun";
  const selectedDayEnabled = enabledDays.includes(selectedDayKey);
  const selectedTemplates = useMemo(
    () => templates.filter((template) => template.weekday === selectedDay),
    [selectedDay, templates],
  );
  const driverOptions = useMemo(
    () =>
      routeMembers
        .filter((member) => member.roleSlug === "conductor")
        .map((member) => ({ value: member.id, label: member.label, searchText: member.label })),
    [routeMembers],
  );

  async function setDefaultDriver(day: number, driverId: string | null) {
    if (!canManage) return;

    setBusy(`driver:${day}`);
    const result = await setLogisticsWeekdayDefaultDriverAction({ weekday: day, driverId });
    setBusy(null);
    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setDefaultDriverByWeekday((current) =>
      current.map((value, index) => (index === day ? result.data : value)),
    );
    notify.success(result.data ? "Conductor predeterminado actualizado" : "Conductor predeterminado eliminado");
    onCatalogChange?.();
  }

  async function toggleDay(day: number) {
    if (!canManage) {
      return;
    }

    const key = logisticsWeekdayKeys[day];
    if (!key) {
      return;
    }

    const enabled = !enabledDays.includes(key);
    setBusy(`day:${day}`);
    const result = await setLogisticsRouteWeekdayEnabledAction({ day: key, enabled });
    setBusy(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setEnabledDays(result.data);
    notify.success(enabled ? `${weekdayNames[day]} disponible` : `${weekdayNames[day]} no disponible`);
    onCatalogChange?.();
  }

  async function createRoute(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setBusy("create");
    const result = await createLogisticsRouteTemplateAction({ weekday: selectedDay, name: trimmed });
    setBusy(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setTemplates((current) => [...current, result.data]);
    setDraftName("");
    setCreating(false);
    notify.success("Ruta semanal creada");
    onCatalogChange?.();
  }

  async function saveRename() {
    if (!editingTemplate) {
      return;
    }

    const name = editingTemplate.name.trim();
    if (!name) {
      return;
    }

    setBusy(`edit:${editingTemplate.id}`);
    const result = await updateLogisticsRouteTemplateAction({ templateId: editingTemplate.id, name });
    setBusy(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setTemplates((current) =>
      current.map((template) => (template.id === result.data.id ? result.data : template)),
    );
    setEditingTemplate(null);
    notify.success("Ruta semanal actualizada");
    onCatalogChange?.();
  }

  async function removeRoute(template: LogisticsRouteTemplateRow) {
    if (!window.confirm(`Eliminar “${template.name}”?`)) {
      return;
    }

    setBusy(`delete:${template.id}`);
    const result = await deleteLogisticsRouteTemplateAction({ templateId: template.id });
    setBusy(null);

    if (!result.ok) {
      notify.error(result.error);
      return;
    }

    setTemplates((current) => current.filter((entry) => entry.id !== template.id));
    notify.success("Ruta semanal eliminada");
    onCatalogChange?.();
  }

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
        <div className="border-b border-black bg-surface-card-header px-4 py-3">
          <p className="text-base font-black text-[#f8fafc]">Calendario de rutas</p>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            Verde significa disponible para dejar y recoger cajas.
          </p>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-7">
          {logisticsWeekdayKeys.map((day, index) => {
            const enabled = enabledDays.includes(day);
            const selected = selectedDay === index;
            const routeCount = templates.filter((template) => template.weekday === index).length;

            return (
              <article
                key={day}
                className={`grid min-h-32 gap-3 rounded-lg border p-3 transition ${
                  enabled
                    ? "border-emerald-600 bg-emerald-950/35"
                    : "border-black bg-surface-inset"
                } ${selected ? "ring-2 ring-sky-400/60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(index)}
                    className="min-w-0 text-left"
                    aria-pressed={selected}
                  >
                    <span className="block text-sm font-black text-[#f8fafc]">{day}</span>
                    <span className={`mt-0.5 block text-[11px] font-bold ${enabled ? "text-emerald-200" : "text-slate-500"}`}>
                      {enabled ? "Disponible" : "No disponible"}
                    </span>
                  </button>
                  {canManage ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${enabled ? "Desactivar" : "Activar"} ${weekdayNames[index]}`}
                      disabled={busy === `day:${index}`}
                      onClick={() => void toggleDay(index)}
                      className={`inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition disabled:opacity-50 ${
                        enabled ? "border-emerald-300 bg-emerald-400" : "border-black bg-surface-card"
                      }`}
                    >
                      <span className={`h-4 w-4 rounded-full bg-slate-950 transition ${enabled ? "translate-x-4" : ""}`} />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(index)}
                  className="mt-auto flex items-center justify-between border-t border-black/60 pt-2 text-left text-[11px] font-black text-slate-400"
                >
                  {routeCount} {routeCount === 1 ? "ruta" : "rutas"}
                  <span className="text-slate-200">Gestionar</span>
                </button>
                <div className="grid gap-1 border-t border-black/60 pt-2">
                  <span className="text-[10px] font-black uppercase text-slate-500">Conductor por defecto</span>
                  <InlineSearchPicker
                    value={defaultDriverByWeekday[index] || ""}
                    onChange={(driverId) => void setDefaultDriver(index, driverId || null)}
                    options={driverOptions}
                    placeholder="Sin conductor"
                    searchPlaceholder="Buscar conductor..."
                    emptyLabel="Sin conductores"
                    ariaLabel={`Conductor predeterminado de ${weekdayNames[index]}`}
                    disabled={!canManage || busy === `driver:${index}`}
                    className="w-full min-w-0"
                    minWidthClass="w-full min-w-0"
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-black bg-surface-panel">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black bg-surface-card-header px-4 py-3">
          <div>
            <p className="text-base font-black text-[#f8fafc]">Rutas del {weekdayNames[selectedDay]}</p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {selectedDayEnabled
                ? "Este dia esta disponible cada semana."
                : "Estas rutas quedan guardadas, pero el dia no esta disponible."}
            </p>
          </div>
          {canManage && selectedDayEnabled ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${secondaryButtonClass} h-9 px-3 text-xs disabled:opacity-50`}
                disabled={busy === "create"}
                onClick={() => void createRoute(genericLogisticsRouteName(selectedDay))}
              >
                {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                {genericLogisticsRouteName(selectedDay)}
              </button>
              <button
                type="button"
                className={`${primaryButtonClass} h-9 px-3 text-xs`}
                onClick={() => setCreating((current) => !current)}
              >
                <PlusCircle className="h-4 w-4" />
                Nueva ruta
              </button>
            </div>
          ) : null}
        </div>

        {creating ? (
          <form
            className="flex flex-wrap items-end gap-2 border-b border-black bg-surface-inset p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createRoute(draftName);
            }}
          >
            <label className="grid min-w-[14rem] flex-1 gap-1">
              <span className="text-[10px] font-black uppercase text-slate-500">Nombre de la ruta</span>
              <input
                autoFocus
                className="h-9 rounded-lg border border-black bg-surface-card px-3 text-sm font-bold text-[#f8fafc] outline-none"
                placeholder="Ej. Riverside"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </label>
            <button type="submit" className={`${primaryButtonClass} h-9 px-3 text-xs`} disabled={busy === "create" || !draftName.trim()}>
              Crear ruta
            </button>
            <button type="button" className={`${secondaryButtonClass} h-9 px-3 text-xs`} onClick={() => setCreating(false)}>
              Cancelar
            </button>
          </form>
        ) : null}

        <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {selectedTemplates.length ? (
            selectedTemplates.map((template) => {
              const editing = editingTemplate?.id === template.id;
              return (
                <article key={template.id} className="flex min-h-20 items-center gap-3 rounded-lg border border-black bg-surface-card px-3 py-2.5">
                  <Route className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <input
                        className="h-8 w-full rounded-md border border-sky-500 bg-surface-inset px-2 text-sm font-black text-[#f8fafc] outline-none"
                        value={editingTemplate.name}
                        onChange={(event) =>
                          setEditingTemplate((current) =>
                            current ? { ...current, name: event.target.value } : current,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveRename();
                          }
                        }}
                      />
                    ) : (
                      <p className="truncate text-sm font-black text-[#f8fafc]">{template.name}</p>
                    )}
                    <p className="mt-0.5 text-xs font-bold text-slate-500">Ruta semanal</p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      {editing ? (
                        <button type="button" className={`${secondaryButtonClass} h-8 w-8 p-0`} aria-label="Guardar nombre" onClick={() => void saveRename()}>
                          <Check className="h-4 w-4" />
                        </button>
                      ) : (
                        <button type="button" className={`${secondaryButtonClass} h-8 w-8 p-0`} aria-label={`Renombrar ${template.name}`} onClick={() => setEditingTemplate(template)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button type="button" className={`${secondaryButtonClass} h-8 w-8 p-0 text-rose-200 disabled:opacity-50`} aria-label={`Eliminar ${template.name}`} disabled={busy === `delete:${template.id}`} onClick={() => void removeRoute(template)}>
                        {busy === `delete:${template.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-black bg-surface-inset px-4 text-center md:col-span-2 xl:col-span-3">
              <div>
                <Route className="mx-auto h-7 w-7 text-slate-600" />
                <p className="mt-2 text-sm font-black text-slate-300">Sin rutas para este dia</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {selectedDayEnabled ? "Crea una ruta general o una ruta con nombre." : "Activa el dia para crear rutas."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
