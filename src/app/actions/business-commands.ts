"use server";

import { revalidatePath } from "next/cache";
import { actionErrorMessage, fail, ok, type ActionResult } from "@/lib/actions/errors";
import {
  captorAgencyLimitMessage,
  isCaptorAgencyLimitError,
} from "@/lib/agency-captor-limit";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { requireAppSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";
import { assertIdempotencyKey, type AgencyStatus, type OperationResult } from "@/lib/business/contract";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RpcName =
  | "transition_agency_status"
  | "assign_agency_captor"
  | "assign_captor_supervisor"
  | "create_agency_sale"
  | "confirm_agency_visit"
  | "record_agency_payment"
  | "reconcile_driver_settlement"
  | "reverse_financial_event"
  | "authorize_international_release";

function businessActionErrorMessage(error: unknown) {
  const message = actionErrorMessage(error);

  return isCaptorAgencyLimitError(message) ? captorAgencyLimitMessage() : message;
}

async function runBusinessRpc(
  name: RpcName,
  permission: PermissionKey,
  args: Record<string, unknown>,
  revalidate: readonly string[],
): Promise<ActionResult<OperationResult>> {
  try {
    const session = await requireAppSession();
    if (!sessionHasPermission(session, permission)) {
      throw new Error("FORBIDDEN");
    }

    const db = await createSupabaseServerClient();
    if (!db) {
      throw new Error("Supabase no configurado");
    }

    const { data, error } = await db.rpc(name, args);
    if (error) {
      throw new Error(error.message);
    }

    for (const path of revalidate) {
      revalidatePath(path);
    }

    return ok(data as OperationResult);
  } catch (error) {
    return fail(businessActionErrorMessage(error));
  }
}

function commandArgs(command: Record<string, unknown>, idempotencyKey: string) {
  return {
    command,
    idempotency_key: assertIdempotencyKey(idempotencyKey),
  };
}

export async function transitionAgencyStatusAction(input: {
  agencyId: string;
  status: AgencyStatus;
  expectedVersion: number;
  reason: string;
  requestId: string;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "transition_agency_status",
    "agency.status.transition",
    {
      target_agency_id: input.agencyId,
      target_status: input.status,
      expected_version: input.expectedVersion,
      transition_reason: input.reason.trim(),
      request_id: input.requestId,
      idempotency_key: assertIdempotencyKey(input.idempotencyKey),
    },
    ["/agencias", "/captacion", "/agencia"],
  );
}

export async function assignAgencyCaptorAction(input: {
  agencyId: string;
  captorMembershipId: string;
  reason: string;
  requestId: string;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "assign_agency_captor",
    "agency.captor.assign",
    {
      target_agency_id: input.agencyId,
      target_captor_membership_id: input.captorMembershipId,
      assignment_reason: input.reason.trim(),
      request_id: input.requestId,
      idempotency_key: assertIdempotencyKey(input.idempotencyKey),
    },
    ["/agencias", "/captacion"],
  );
}

export async function assignCaptorSupervisorAction(input: {
  captorMembershipId: string;
  supervisorMembershipId: string;
  reason: string;
  requestId: string;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "assign_captor_supervisor",
    "agency.supervisor.assign",
    {
      target_captor_membership_id: input.captorMembershipId,
      target_supervisor_membership_id: input.supervisorMembershipId,
      assignment_reason: input.reason.trim(),
      request_id: input.requestId,
      idempotency_key: assertIdempotencyKey(input.idempotencyKey),
    },
    ["/agencias", "/captacion"],
  );
}

export async function confirmAgencyVisitAction(input: {
  visitId: string;
  lineConfirmations: Array<{
    visitLineId: string;
    confirmedQuantity: number;
    differenceReason?: string;
    evidence?: Record<string, unknown>;
  }>;
  reason: string;
  requestId: string;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "confirm_agency_visit",
    "agency.visits.confirm",
    {
      target_visit_id: input.visitId,
      line_confirmations: input.lineConfirmations,
      confirmation_reason: input.reason.trim(),
      request_id: input.requestId,
      idempotency_key: assertIdempotencyKey(input.idempotencyKey),
    },
    ["/solicitudes", "/agencia", "/inventario", "/contabilidad"],
  );
}

export async function createAgencySaleAction(input: {
  command: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "create_agency_sale",
    "agency.sales.create",
    commandArgs(input.command, input.idempotencyKey),
    ["/agencia", "/venta", "/contabilidad", "/seguimiento"],
  );
}

export async function recordAgencyPaymentAction(input: {
  command: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "record_agency_payment",
    "agency.account.payment",
    commandArgs(input.command, input.idempotencyKey),
    ["/contabilidad", "/agencias", "/agencia"],
  );
}

export async function reconcileDriverSettlementAction(input: {
  command: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "reconcile_driver_settlement",
    "accounting.reconcile",
    commandArgs(input.command, input.idempotencyKey),
    ["/contabilidad", "/conductor/tareas"],
  );
}

export async function reverseFinancialEventAction(input: {
  command: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return runBusinessRpc(
    "reverse_financial_event",
    "accounting.reverse",
    commandArgs(input.command, input.idempotencyKey),
    ["/contabilidad", "/agencias", "/agencia"],
  );
}

export async function authorizeInternationalReleaseAction(input: {
  command: Record<string, unknown>;
  idempotencyKey: string;
}) {
  const manual = input.command.manual === true;
  return runBusinessRpc(
    "authorize_international_release",
    manual ? "financial_hold.release_manual" : "financial_hold.release",
    commandArgs(input.command, input.idempotencyKey),
    ["/contabilidad", "/seguimiento", "/bodega"],
  );
}
