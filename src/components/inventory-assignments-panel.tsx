"use client";

import { ClipboardList, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { listInventoryAssignmentsAction } from "@/app/actions/inventory-assignments";
import {
  listOrgMembersForInventoryAction,
  type InventoryMemberRow,
} from "@/app/actions/users";
import { InventoryToolbarIconButton } from "@/components/inventory/inventory-toolbar-icon-button";
import {
  InlineSearchCombobox,
  InlineSearchPicker,
} from "@/components/inline-search-picker";
import {
  CloseAssignmentModal,
  type CloseAssignmentSubmit,
} from "@/components/inventory-assignment-modals";
import type { InventoryAssignment } from "@/lib/inventory-types";

type InventoryAssignmentsDrawerProps = {
  warehouseId: string;
  assignments: InventoryAssignment[];
  iconOnly?: boolean;
  initialItemId?: string | null;
  onAssignmentsChange: (next: InventoryAssignment[]) => void;
  onCloseAssignment: (
    assignmentId: string,
    input: CloseAssignmentSubmit,
  ) => Promise<boolean>;
  closingAssignmentId?: string;
};

function formatWhen(value: string) {
  try {
    return new Intl.DateTimeFormat("es", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function InventoryAssignmentsDrawer({
  warehouseId,
  assignments,
  iconOnly = false,
  initialItemId = null,
  onAssignmentsChange,
  onCloseAssignment,
  closingAssignmentId = "",
}: InventoryAssignmentsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<InventoryMemberRow[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [closeTarget, setCloseTarget] = useState<InventoryAssignment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      void listOrgMembersForInventoryAction().then((result) => {
        if (result.ok) {
          setMembers(result.data);
        }
      });
    });
  }, [open]);

  useEffect(() => {
    if (initialItemId) {
      queueMicrotask(() => {
        setOpen(true);
      });
    }
  }, [initialItemId]);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.id,
        label: member.full_name || member.email,
      })),
    [members],
  );

  const itemOptions = useMemo(() => {
    const names = [...new Set(assignments.map((row) => row.itemName))];
    return names.map((name) => ({ value: name, label: name }));
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();

    return assignments.filter((row) => {
      if (selectedAssigneeId && row.assigneeId !== selectedAssigneeId) {
        return false;
      }

      if (initialItemId && row.itemId !== initialItemId) {
        return false;
      }

      if (query && !row.itemName.toLowerCase().includes(query)) {
        return false;
      }

      return true;
    });
  }, [assignments, initialItemId, itemQuery, selectedAssigneeId]);

  const reload = useCallback(async () => {
    if (!warehouseId) {
      return;
    }

    setLoading(true);
    const result = await listInventoryAssignmentsAction({
      warehouseId,
      status: "open",
      itemId: initialItemId || undefined,
      assigneeId: selectedAssigneeId || undefined,
    });
    setLoading(false);

    if (result.ok) {
      onAssignmentsChange(result.data);
    }
  }, [initialItemId, onAssignmentsChange, selectedAssigneeId, warehouseId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    queueMicrotask(() => {
      void reload();
    });
  }, [open, reload]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setCloseTarget(null);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, open]);

  const drawer =
    open && mounted ? (
      <div className="fixed inset-0 z-[135] flex justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/50"
          aria-label="Cerrar asignaciones"
          onClick={closeDrawer}
        />
        <aside className="relative flex h-full w-full max-w-md flex-col border-l border-black bg-[#1a2320] shadow-[-20px_0_50px_rgba(0,0,0,0.45)]">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/70 px-4 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Inventario
              </p>
              <h2 className="text-lg font-black text-[#f8fafc]">Asignaciones activas</h2>
              <p className="mt-0.5 text-sm font-bold text-slate-400">
                {filteredAssignments.length} abiertas
              </p>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black bg-[#111827] text-slate-300"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="shrink-0 space-y-2 border-b border-black/70 p-4">
            <InlineSearchPicker
              value={selectedAssigneeId}
              onChange={setSelectedAssigneeId}
              options={[{ value: "", label: "Todos los empleados" }, ...memberOptions]}
              placeholder="Empleado"
              searchPlaceholder="Buscar empleado…"
              ariaLabel="Filtrar empleado"
              className="w-full"
              minWidthClass="w-full min-w-0"
            />
            <InlineSearchCombobox
              value={itemQuery}
              onChange={setItemQuery}
              options={itemOptions}
              placeholder="Filtrar item"
              emptyLabel="Sin items"
              ariaLabel="Filtrar item"
              className="w-full"
              minWidthClass="w-full min-w-0"
              onSelectOption={(option) => setItemQuery(option.label)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : filteredAssignments.length ? (
              <ul className="space-y-2">
                {filteredAssignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="rounded-xl border border-black bg-[#111827] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#f8fafc]">
                          {assignment.itemName}
                        </p>
                        <p className="mt-0.5 text-xs font-bold text-sky-300">
                          {assignment.assigneeName}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {formatWhen(assignment.assignedAt)}
                        </p>
                      </div>
                      <span className="rounded-lg border border-black bg-surface-inset px-2 py-1 text-sm font-black tabular-nums text-[#f8fafc]">
                        {assignment.qtyAssigned}
                      </span>
                    </div>
                    {assignment.note ? (
                      <p className="mt-2 text-xs font-bold text-slate-400">{assignment.note}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setCloseTarget(assignment)}
                      className="mt-3 inline-flex h-9 items-center rounded-lg border border-black bg-emerald-400/10 px-3 text-xs font-black text-emerald-200"
                    >
                      Cerrar asignación
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-16 text-center">
                <p className="text-base font-black text-[#f8fafc]">Sin asignaciones abiertas</p>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  Las entregas a empleados aparecerán aquí.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    ) : null;

  return (
    <>
      {iconOnly ? (
        <InventoryToolbarIconButton
          icon={ClipboardList}
          label="Asignaciones activas"
          badge={assignments.length || undefined}
          onClick={() => setOpen(true)}
          ariaHaspopup="dialog"
          ariaExpanded={open}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-black bg-[#1a2320] px-3 text-xs font-black text-slate-300 transition hover:bg-[#243029] hover:text-[#f8fafc]"
          title="Asignaciones activas"
          aria-label="Asignaciones activas"
        >
          <ClipboardList className="h-4 w-4 text-slate-400" aria-hidden />
          <span className="hidden sm:inline">Asignaciones</span>
          {assignments.length ? (
            <span className="rounded-md border border-black bg-surface-inset px-1.5 py-0.5 text-[10px] font-black tabular-nums text-slate-400">
              {assignments.length}
            </span>
          ) : null}
        </button>
      )}

      {drawer ? createPortal(drawer, document.body) : null}

      <CloseAssignmentModal
        open={Boolean(closeTarget)}
        assignment={closeTarget}
        saving={Boolean(closingAssignmentId)}
        onClose={() => setCloseTarget(null)}
        onSubmit={async (input) => {
          if (!closeTarget) {
            return;
          }

          const success = await onCloseAssignment(closeTarget.id, input);

          if (success) {
            setCloseTarget(null);
            await reload();
          }
        }}
      />
    </>
  );
}
