import type { PaymentMethod } from "@/lib/payment-methods";
import type { ConductorPaymentChoice } from "@/lib/conductor-driver-payment";
import type { ConductorDriverTask } from "@/lib/conductor-tasks";

export type ConductorOfflineScope = {
  organizationId: string;
  userId: string;
  driverId: string;
};

type ConductorOfflineStatus =
  | "pending"
  | "syncing"
  | "needs_attention"
  | "synced";

type ConductorOfflineEvidence = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

export type ConductorOfflineOperation = {
  id: string;
  scopeKey: string;
  taskKey: string;
  organizationId: string;
  userId: string;
  driverId: string;
  taskId: string;
  task: ConductorDriverTask;
  result: "completed" | "failed";
  failureReason: string;
  note: string;
  paymentChoice: ConductorPaymentChoice | "";
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  evidence: ConductorOfflineEvidence | null;
  status: ConductorOfflineStatus;
  attempts: number;
  createdAt: string;
  capturedAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  syncedAt: string | null;
  lastError: string;
};

export type ConductorOfflineDraft = {
  scope: ConductorOfflineScope;
  task: ConductorDriverTask;
  result: "completed" | "failed";
  failureReason: string;
  note: string;
  paymentChoice: ConductorPaymentChoice | null;
  paymentAmount: string;
  paymentMethod: PaymentMethod;
  evidence: File | null;
  capturedAt?: string;
};

export type ConductorOfflineSnapshot = {
  operations: ConductorOfflineOperation[];
  pendingCount: number;
  syncingCount: number;
  needsAttentionCount: number;
  syncedCount: number;
};
