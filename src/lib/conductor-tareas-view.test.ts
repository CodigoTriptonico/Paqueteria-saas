import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildConductorPreviewPickerOptions,
  canPreviewConductorTasks,
  conductorPreviewSearchParam,
  conductorTasksNavLabel,
  isConductorRole,
  resolveConductorTasksView,
} from "@/lib/conductor-tareas-view";

const drivers = [
  { id: "driver-1", label: "Ana Conductor" },
  { id: "driver-2", label: "Luis Conductor" },
];

describe("conductor tareas view", () => {
  it("lets admins preview any conductor", () => {
    assert.equal(canPreviewConductorTasks("administrador"), true);
    assert.equal(canPreviewConductorTasks("conductor"), false);
  });

  it("locks conductors to their own session", () => {
    const view = resolveConductorTasksView({
      roleSlug: "conductor",
      sessionUserId: "driver-1",
      sessionLabel: "Ana Conductor",
      drivers,
      previewDriverId: "driver-2",
    });

    assert.equal(view.canPreview, false);
    assert.equal(view.effectiveDriverId, "driver-1");
    assert.equal(view.effectiveDriverLabel, "Ana Conductor");
  });

  it("defaults admin preview to the first conductor", () => {
    const view = resolveConductorTasksView({
      roleSlug: "administrador",
      sessionUserId: "admin-1",
      sessionLabel: "Admin",
      drivers,
    });

    assert.equal(view.canPreview, true);
    assert.equal(view.previewDriverId, "driver-1");
    assert.equal(view.effectiveDriverLabel, "Ana Conductor");
  });

  it("honors a valid admin preview selection", () => {
    const view = resolveConductorTasksView({
      roleSlug: "administrador",
      sessionUserId: "admin-1",
      sessionLabel: "Admin",
      drivers,
      previewDriverId: "driver-2",
    });

    assert.equal(view.previewDriverId, "driver-2");
    assert.equal(view.effectiveDriverLabel, "Luis Conductor");
  });

  it("ignores invalid preview ids", () => {
    const view = resolveConductorTasksView({
      roleSlug: "administrador",
      sessionUserId: "admin-1",
      sessionLabel: "Admin",
      drivers,
      previewDriverId: "missing",
    });

    assert.equal(view.previewDriverId, "driver-1");
  });

  it("builds picker options for active conductors", () => {
    assert.deepEqual(buildConductorPreviewPickerOptions(drivers), [
      { value: "driver-1", label: "Ana Conductor", searchText: "Ana Conductor" },
      { value: "driver-2", label: "Luis Conductor", searchText: "Luis Conductor" },
    ]);
  });

  it("uses a driver-friendly nav label", () => {
    assert.equal(isConductorRole("conductor"), true);
    assert.equal(isConductorRole("administrador"), false);
    assert.equal(conductorTasksNavLabel("conductor"), "Mis tareas");
    assert.equal(conductorTasksNavLabel("administrador"), "Tareas conductor");
  });

  it("serializes preview driver into search params", () => {
    assert.equal(conductorPreviewSearchParam("driver-2"), "conductor=driver-2");
    assert.equal(conductorPreviewSearchParam(null), "");
  });
});
