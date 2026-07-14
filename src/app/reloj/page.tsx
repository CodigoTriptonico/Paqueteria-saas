import { ClockUserClient } from "@/components/time-clock/clock-user-client";
import { loadClockUserSnapshot } from "@/lib/time-clock-data";
import { readClockSession } from "@/lib/time-clock-session";

async function loadInitialSnapshot(session: Parameters<typeof loadClockUserSnapshot>[0]) {
  try {
    return await loadClockUserSnapshot(session);
  } catch {
    return undefined;
  }
}

export default async function RelojPage() {
  const session = await readClockSession();
  if (!session) {
    return <ClockUserClient />;
  }

  const initialSnapshot = await loadInitialSnapshot(session);
  return <ClockUserClient initialSnapshot={initialSnapshot} />;
}
