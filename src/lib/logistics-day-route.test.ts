import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAY_AS_ROUTE_TEMPLATE_ID,
  availableEnabledDaysHint,
  dayAsRouteHint,
  enabledWeekdayIndexes,
  genericLogisticsRouteName,
  isDayAsRouteTemplateId,
  logisticsWeekdayChipLabels,
  logisticsWeekdayFullLabels,
  logisticsEnabledWeekdayFilterOptions,
  defaultLogisticsWeekdayFilter,
  nextWeekdayScheduleHint,
  resolveDayRouteTemplateId,
  selectWeekdayDate,
} from "./logistics-day-route.ts";

describe("logistics-day-route", () => {
  it("maps enabled catalog days to weekday indexes", () => {
    assert.deepEqual(enabledWeekdayIndexes(["Vie", "Sab"]), [4, 5]);
    assert.deepEqual(enabledWeekdayIndexes(["Dom", "Lun"]), [0, 6]);
    assert.deepEqual(enabledWeekdayIndexes([]), []);
  });

  it("builds the generic day-as-route name used when a day has 0 named templates", () => {
    assert.equal(genericLogisticsRouteName(4), "Ruta del viernes");
    assert.equal(genericLogisticsRouteName(5), "Ruta del sabado");
  });

  it("resolves named templates when present and day-as-route when empty", () => {
    const sabTemplates = [
      { id: "hollywood", weekday: 5, name: "Hollywood" },
      { id: "van", weekday: 5, name: "Van Nuys" },
    ];

    assert.equal(
      resolveDayRouteTemplateId({ weekday: 5, templates: sabTemplates }),
      "hollywood",
    );
    assert.equal(
      resolveDayRouteTemplateId({
        weekday: 5,
        templates: sabTemplates,
        preferNotId: "hollywood",
      }),
      "van",
    );
    assert.equal(
      resolveDayRouteTemplateId({ weekday: 4, templates: sabTemplates }),
      DAY_AS_ROUTE_TEMPLATE_ID,
    );
    assert.equal(isDayAsRouteTemplateId(DAY_AS_ROUTE_TEMPLATE_ID), true);
    assert.equal(isDayAsRouteTemplateId("hollywood"), false);
  });

  it("labels available days and day-as-route hints for the UI", () => {
    assert.equal(availableEnabledDaysHint([4, 5]), "Días disponibles: Vie, Sab");
    assert.equal(dayAsRouteHint(4), "Vie es la ruta (sin rutas con nombre).");
    assert.match(availableEnabledDaysHint([]), /No hay días disponibles/);
  });

  it("exposes Lun→Dom chip labels matching the route catalog", () => {
    assert.deepEqual([...logisticsWeekdayChipLabels], [
      "Lun",
      "Mar",
      "Mie",
      "Jue",
      "Vie",
      "Sab",
      "Dom",
    ]);
  });

  it("exposes full weekday labels for toolbar selects", () => {
    assert.deepEqual([...logisticsWeekdayFullLabels], [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ]);
  });

  it("only lists enabled weekdays for the logistics day filter", () => {
    assert.deepEqual(logisticsEnabledWeekdayFilterOptions([4, 5]), [
      { value: 4, label: "Viernes" },
      { value: 5, label: "Sábado" },
    ]);
    assert.deepEqual(logisticsEnabledWeekdayFilterOptions([]), []);
  });

  it("defaults the day filter to today when enabled, else the first enabled day", () => {
    assert.equal(defaultLogisticsWeekdayFilter([4, 5], 5), 5);
    assert.equal(defaultLogisticsWeekdayFilter([4, 5], 0), 4);
    assert.equal(defaultLogisticsWeekdayFilter([], 0), null);
  });

  it("selects the next calendar date for a weekday and formats the hint", () => {
    assert.equal(selectWeekdayDate(5, "2026-07-20"), "2026-07-25");
    assert.equal(selectWeekdayDate(0, "2026-07-20"), "2026-07-20");
    assert.equal(selectWeekdayDate(4, "2026-07-24"), "2026-07-24");
    assert.equal(nextWeekdayScheduleHint("2026-07-25"), "Próximo: 25 jul 2026");
    assert.equal(nextWeekdayScheduleHint("bad"), "");
  });
});
