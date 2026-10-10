import { it } from "node:test";
import { strict as assert } from "node:assert";
import { calculateDamPeriodTotals } from "./dam-period-totals";

const now = new Date("2026-10-10T14:12:00Z");
const movement = (occurred_at: string, quantity_tons: number, movement_type = "incoming", dam_id = "dam-1") => ({ occurred_at, quantity_tons, movement_type, dam_id });

it("week totals include only the selected dam's Monday-to-Sunday movements", () => {
  assert.deepEqual(calculateDamPeriodTotals([
    movement("2026-10-04T21:59:59Z", 100),
    movement("2026-10-04T22:00:00Z", 10),
    movement("2026-10-10T10:00:00Z", 3, "outgoing"),
    movement("2026-10-10T10:00:00Z", 200, "incoming", "dam-2"),
    movement("2026-10-11T22:00:00Z", 300),
  ], "dam-1", "week", now), { totalIn: 10, totalOut: 3 });
});

it("month totals use the current calendar month for the selected dam", () => {
  assert.deepEqual(calculateDamPeriodTotals([
    movement("2026-09-30T21:59:59Z", 100),
    movement("2026-09-30T22:00:00Z", 20),
    movement("2026-10-10T10:00:00Z", 5, "outgoing"),
    movement("2026-10-31T22:00:00Z", 300),
  ], "dam-1", "month", now), { totalIn: 20, totalOut: 5 });
});

it("year totals use the current calendar year without mixing other dams", () => {
  assert.deepEqual(calculateDamPeriodTotals([
    movement("2025-12-31T21:59:59Z", 100),
    movement("2025-12-31T22:00:00Z", 30),
    movement("2026-03-01T10:00:00Z", 7, "outgoing"),
    movement("2026-12-31T22:00:00Z", 300),
    movement("2026-03-01T10:00:00Z", 200, "outgoing", "dam-2"),
  ], "dam-1", "year", now), { totalIn: 30, totalOut: 7 });
});