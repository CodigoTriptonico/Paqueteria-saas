"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listOrgMembersForInventoryAction,
  type InventoryMemberRow,
} from "@/app/actions/users";
import { InlineSearchPicker } from "@/components/inline-search-picker";
import { inputClass } from "@/components/ui-blocks";
import type { InventoryAssignment, InventoryAssignmentOutcome } from "@/lib/inventory-types";
import { assignmentOutcomeLabels } from "@/lib/inventory-reports";

type AssignInventoryModalProps = {
  open: boolean;
  itemName: string;
  maxQty: number;
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: { assigneeId: string; qty: number; note: string }) => void;
};

export function AssignInventoryModal({
  open,
  itemName,
  maxQty,
  saving,
  onClose,
  onSubmit,
}: AssignInventoryModalProps) {
  const [members, setMembers] = useState<InventoryMemberRow[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

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

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.id,
        label: member.full_name || member.email,
        searchText: [member.full_name, member.email, member.role.name]
          .filter(Boolean)
          .join(" "),
      })),
    [members],
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="w-full max-w-md rounded-xl border border-black bg-[#17211d] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            assigneeId,
            qty: Number(qty),
            note: note.trim(),
          });
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3">
          <p className="text-lg font-black text-[#f8fafc]">Asignar a empleado</p>
          <p className="truncate text-sm font-bold text-slate-400">{itemName}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Disponible en bodega: {maxQty}
          </p>
        </div>

        <label className="grid gap-1.5 text-xs font-black uppercase text-slate-400">
          Empleado
          <InlineSearchPicker
            compact={false}
            className="w-full"
            minWidthClass="w-full min-w-0"
            value={assigneeId}
            onChange={setAssigneeId}
            options={memberOptions}
            placeholder="Elegir empleado"
            searchPlaceholder="Buscar empleado…"
            ariaLabel="Empleado"
          />
        </label>

        <label className="mt-3 grid gap-1.5 text-xs font-black uppercase text-slate-400">
          Cantidad
          <input
            className={`${inputClass} h-10 text-sm`}
            type="number"
            min={1}
            max={maxQty}
            step="1"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            required
          />
        </label>

        <label className="mt-3 grid gap-1.5 text-xs font-black uppercase text-slate-400">
          Nota
          <input
            className={`${inputClass} h-10 text-sm`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Opcional"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !assigneeId || Number(qty) <= 0 || Number(qty) > maxQty}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Asignar
          </button>
        </div>
      </form>
    </div>
  );
}

const OUTCOME_OPTIONS: {
  value: InventoryAssignmentOutcome;
  label: string;
  description: string;
}[] = [
  {
    value: "returned_intact",
    label: assignmentOutcomeLabels.returned_intact,
    description: "Vuelve al stock en bodega.",
  },
  {
    value: "consumed",
    label: assignmentOutcomeLabels.consumed,
    description: "Se usó por completo, no hay nada que devolver.",
  },
  {
    value: "damaged",
    label: assignmentOutcomeLabels.damaged,
    description: "No sirve para volver al inventario.",
  },
  {
    value: "lost",
    label: assignmentOutcomeLabels.lost,
    description: "No se recupera.",
  },
  {
    value: "partial",
    label: assignmentOutcomeLabels.partial,
    description: "Reparte cantidades entre devuelto, consumido, daño y pérdida.",
  },
];

type CloseAssignmentModalProps = {
  open: boolean;
  assignment: InventoryAssignment | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (input: CloseAssignmentSubmit) => void;
};

export type CloseAssignmentSubmit = {
  outcome: InventoryAssignmentOutcome;
  qtyReturned: number;
  qtyConsumed: number;
  qtyDamaged: number;
  qtyLost: number;
  note: string;
};

export function CloseAssignmentModal({
  open,
  assignment,
  saving,
  onClose,
  onSubmit,
}: CloseAssignmentModalProps) {
  const [outcome, setOutcome] = useState<InventoryAssignmentOutcome>("returned_intact");
  const [qtyReturned, setQtyReturned] = useState("0");
  const [qtyConsumed, setQtyConsumed] = useState("0");
  const [qtyDamaged, setQtyDamaged] = useState("0");
  const [qtyLost, setQtyLost] = useState("0");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!assignment || !open) {
      return;
    }

    queueMicrotask(() => {
      setOutcome("returned_intact");
      setQtyReturned(String(assignment.qtyAssigned));
      setQtyConsumed("0");
      setQtyDamaged("0");
      setQtyLost("0");
      setNote("");
    });
  }, [assignment, open]);

  useEffect(() => {
    if (!assignment) {
      return;
    }

    queueMicrotask(() => {
      if (outcome === "returned_intact") {
        setQtyReturned(String(assignment.qtyAssigned));
        setQtyConsumed("0");
        setQtyDamaged("0");
        setQtyLost("0");
      } else if (outcome === "consumed") {
        setQtyReturned("0");
        setQtyConsumed(String(assignment.qtyAssigned));
        setQtyDamaged("0");
        setQtyLost("0");
      } else if (outcome === "damaged") {
        setQtyReturned("0");
        setQtyConsumed("0");
        setQtyDamaged(String(assignment.qtyAssigned));
        setQtyLost("0");
      } else if (outcome === "lost") {
        setQtyReturned("0");
        setQtyConsumed("0");
        setQtyDamaged("0");
        setQtyLost(String(assignment.qtyAssigned));
      }
    });
  }, [assignment, outcome]);

  if (!open || !assignment) {
    return null;
  }

  const openQty = assignment.qtyAssigned;
  const partialTotal =
    Number(qtyReturned) + Number(qtyConsumed) + Number(qtyDamaged) + Number(qtyLost);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="max-h-[min(90dvh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-black bg-[#17211d] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            outcome,
            qtyReturned: Number(qtyReturned),
            qtyConsumed: Number(qtyConsumed),
            qtyDamaged: Number(qtyDamaged),
            qtyLost: Number(qtyLost),
            note: note.trim(),
          });
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3">
          <p className="text-lg font-black text-[#f8fafc]">Cerrar asignación</p>
          <p className="truncate text-sm font-bold text-slate-400">
            {assignment.itemName} · {assignment.assigneeName}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            Cantidad asignada: {openQty}
          </p>
        </div>

        <div className="space-y-2">
          {OUTCOME_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${
                outcome === option.value
                  ? "border-black bg-emerald-400/10"
                  : "border-black bg-surface-inset"
              }`}
            >
              <input
                type="radio"
                name="assignment-outcome"
                checked={outcome === option.value}
                onChange={() => setOutcome(option.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-black text-[#f8fafc]">{option.label}</span>
                <span className="block text-xs font-bold text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {outcome === "partial" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] font-black uppercase text-slate-400">
              Devuelto
              <input
                className={`${inputClass} h-9 text-sm`}
                type="number"
                min={0}
                max={openQty}
                value={qtyReturned}
                onChange={(event) => setQtyReturned(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[11px] font-black uppercase text-slate-400">
              Consumido
              <input
                className={`${inputClass} h-9 text-sm`}
                type="number"
                min={0}
                max={openQty}
                value={qtyConsumed}
                onChange={(event) => setQtyConsumed(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[11px] font-black uppercase text-slate-400">
              Dañado
              <input
                className={`${inputClass} h-9 text-sm`}
                type="number"
                min={0}
                max={openQty}
                value={qtyDamaged}
                onChange={(event) => setQtyDamaged(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-[11px] font-black uppercase text-slate-400">
              Perdido
              <input
                className={`${inputClass} h-9 text-sm`}
                type="number"
                min={0}
                max={openQty}
                value={qtyLost}
                onChange={(event) => setQtyLost(event.target.value)}
              />
            </label>
            <p
              className={`col-span-2 text-xs font-bold ${
                partialTotal === openQty ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              Total: {partialTotal} / {openQty}
            </p>
          </div>
        ) : null}

        <label className="mt-3 grid gap-1.5 text-xs font-black uppercase text-slate-400">
          Nota
          <input
            className={`${inputClass} h-10 text-sm`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Opcional"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-black bg-surface-inset px-3 text-sm font-black text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={
              saving ||
              (outcome === "partial" && partialTotal !== openQty)
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}
