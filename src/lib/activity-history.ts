import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSession } from "@/lib/auth/types";

export type ActivityHistoryInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export async function recordActivityHistory(
  supabase: SupabaseClient,
  session: AppSession,
  input: ActivityHistoryInput,
) {
  const { error } = await supabase.from("activity_history").insert({
    organization_id: session.organizationId,
    actor_id: session.userId,
    actor_name: session.fullName || session.email,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId || null,
    title: input.title,
    description: input.description || "",
    metadata: input.metadata || {},
  });

  if (error && error.code !== "42P01") {
    throw new Error(error.message);
  }
}
