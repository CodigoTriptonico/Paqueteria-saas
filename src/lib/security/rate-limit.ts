import type { SupabaseClient } from "@supabase/supabase-js";

export class RateLimitError extends Error {
  constructor(message = "Demasiados intentos. Intenta mas tarde.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export type RateLimitOptions = {
  bucket: string;
  key: string;
  windowMs: number;
  maxAttempts: number;
};

export async function assertRateLimit(
  supabase: SupabaseClient,
  options: RateLimitOptions,
) {
  const windowSeconds = Math.max(1, Math.floor(options.windowMs / 1000));

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: options.bucket,
    p_key: options.key,
    p_window_seconds: windowSeconds,
    p_max_attempts: options.maxAttempts,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new RateLimitError();
  }
}
