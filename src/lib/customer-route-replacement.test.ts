import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canSubmitCustomerRouteReplacement,
  customerRouteReplacementNote,
  draftFromScheduledAt,
  nextDateForTemplateWeekday,
} from "./customer-route-replacement.ts";

describe("customer-route-replacement", () => {
  it("builds a clear replacement note", () => {
    assert.equal(
      customerRouteReplacementNote("Van nuys", "Hollywood"),
      "Ruta del vendedor (Van nuys) reemplazada por Hollywood",
    );
  });

  it("parses schedule drafts from ISO timestamps", () => {
    const draft = draftFromScheduledAt("2026-07-25T17:00:00.000Z");
    assert.equal(draft.date.length, 10);
    assert.match(draft.time, /^\d{2}:\d{2}$/);
  });

  it("requires template, driver and matching weekday before submit", () => {
    assert.equal(
      canSubmitCustomerRouteReplacement({
        routeTemplateId: "t1",
        date: "2026-07-25",
        time: "10:00",
        driverId: "d1",
        templateWeekday: 5,
      }),
      true,
    );
    assert.equal(
      canSubmitCustomerRouteReplacement({
        routeTemplateId: "t1",
        date: "2026-07-25",
        time: "10:00",
        driverId: "",
        templateWeekday: 5,
      }),
      false,
    );
    assert.equal(
      canSubmitCustomerRouteReplacement({
        routeTemplateId: "t1",
        date: "2026-07-25",
        time: "10:00",
        driverId: "d1",
        templateWeekday: 0,
      }),
      false,
    );
  });

  it("moves the date to the next matching weekday for a template", () => {
    assert.equal(nextDateForTemplateWeekday(0, "2026-07-25"), "2026-07-27");
  });
});
