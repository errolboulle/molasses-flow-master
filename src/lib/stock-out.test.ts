import { describe, expect, test } from "bun:test";
import { calculateStockOut } from "./stock-out";

describe("stock out", () => {
  test("totals outgoing stock across every dam and all dates, excluding incoming", () => {
    const movements = [
      { dam_id: "dam-1", occurred_at: "2025-01-01", movement_type: "outgoing", quantity_tons: 12.5 },
      { dam_id: "dam-2", occurred_at: "2026-09-01", movement_type: "outgoing", quantity_tons: 20 },
      { dam_id: "dam-3", occurred_at: "2026-10-10", movement_type: "outgoing", quantity_tons: 7.25 },
      { dam_id: "dam-3", occurred_at: "2026-10-10", movement_type: "incoming", quantity_tons: 100 },
    ];
    expect(calculateStockOut(movements)).toBe(39.75);
  });
});