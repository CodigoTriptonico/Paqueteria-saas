export type ConductorDriverOption = {
  id: string;
  label: string;
};

export type ConductorTasksView = {
  canPreview: boolean;
  previewDriverId: string | null;
  effectiveDriverId: string | null;
  effectiveDriverLabel: string;
};

export function canPreviewConductorTasks(roleSlug: string) {
  return roleSlug === "administrador";
}

export function isConductorRole(roleSlug: string) {
  return roleSlug === "conductor";
}

export function conductorTasksNavLabel(roleSlug: string) {
  return isConductorRole(roleSlug) ? "Mis tareas" : "Tareas conductor";
}

export function buildConductorPreviewPickerOptions(drivers: ReadonlyArray<ConductorDriverOption>) {
  return drivers.map((driver) => ({
    value: driver.id,
    label: driver.label,
    searchText: driver.label,
  }));
}

export function resolveConductorTasksView(input: {
  roleSlug: string;
  sessionUserId: string;
  sessionLabel: string;
  drivers: ReadonlyArray<ConductorDriverOption>;
  previewDriverId?: string | null;
}): ConductorTasksView {
  if (!canPreviewConductorTasks(input.roleSlug)) {
    return {
      canPreview: false,
      previewDriverId: null,
      effectiveDriverId: input.sessionUserId || null,
      effectiveDriverLabel: input.sessionLabel,
    };
  }

  const driverById = new Map(input.drivers.map((driver) => [driver.id, driver]));
  const requested = input.previewDriverId?.trim() || null;
  const validRequested = requested && driverById.has(requested) ? requested : null;
  const effectiveDriverId = validRequested ?? input.drivers[0]?.id ?? null;

  return {
    canPreview: true,
    previewDriverId: effectiveDriverId,
    effectiveDriverId,
    effectiveDriverLabel: effectiveDriverId
      ? driverById.get(effectiveDriverId)!.label
      : "Sin conductores",
  };
}

export function conductorPreviewSearchParam(driverId: string | null) {
  if (!driverId) {
    return "";
  }

  return `conductor=${encodeURIComponent(driverId)}`;
}

export function isConductorAdminActing(input: {
  roleSlug: string;
  actorUserId: string;
  effectiveDriverId: string | null;
}) {
  return (
    canPreviewConductorTasks(input.roleSlug) &&
    Boolean(input.effectiveDriverId) &&
    input.actorUserId !== input.effectiveDriverId
  );
}

export function conductorAdminActorLabel(actorName: string) {
  const label = String(actorName || "").trim();
  return label || "Administrador";
}

export function conductorAdminAuditMetadata(input: {
  roleSlug: string;
  actorUserId: string;
  actorName: string;
  effectiveDriverId: string | null;
}) {
  if (!isConductorAdminActing(input)) {
    return {};
  }

  return {
    actedByAdmin: true,
    actorUserId: input.actorUserId,
    actorName: conductorAdminActorLabel(input.actorName),
    assignedDriverId: input.effectiveDriverId,
  };
}

export function formatConductorAdminActionNote(
  note: string,
  input: {
    roleSlug: string;
    actorUserId: string;
    actorName: string;
    effectiveDriverId: string | null;
  },
) {
  const cleanNote = String(note || "").trim();

  if (!isConductorAdminActing(input)) {
    return cleanNote;
  }

  const prefix = `[Admin: ${conductorAdminActorLabel(input.actorName)}]`;
  return cleanNote ? `${prefix} ${cleanNote}` : prefix;
}

export function formatConductorAdminActorDescription(
  input: {
    roleSlug: string;
    actorUserId: string;
    actorName: string;
    effectiveDriverId: string | null;
  },
  fallbackLabel = "conductor",
) {
  if (!isConductorAdminActing(input)) {
    return fallbackLabel;
  }

  return `admin ${conductorAdminActorLabel(input.actorName)} por conductor`;
}
