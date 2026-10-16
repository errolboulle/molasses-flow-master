export type DamPeriod = "week" | "month" | "year";

type DamMovement = { dam_id: string; occurred_at: string; movement_type: string; quantity_tons: number | string | null };

// Operational calendar periods follow Johannesburg time, regardless of the viewer's timezone.
export function calculateDamPeriodTotals(movements: ReadonlyArray<DamMovement>, damId: string, period: DamPeriod, now = new Date(), anchorAt?: string | null) {
  const offset = 2 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  if (period === "week") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  if (period === "month") start.setUTCDate(1);
  if (period === "year") start.setUTCMonth(0, 1);
  const startTime = start.getTime() - offset;
  const end = new Date(start);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  if (period === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  const endTime = end.getTime() - offset;
  // Count only movements after the dam's latest stock adjustment so totals reconcile with the current balance.
  const anchorTime = anchorAt ? new Date(anchorAt).getTime() : NaN;
  const fromTime = Number.isFinite(anchorTime) ? Math.max(startTime, anchorTime + 1) : startTime;
  return movements.reduce((totals, movement) => {
    const at = new Date(movement.occurred_at).getTime();
    if (movement.dam_id !== damId || !Number.isFinite(at) || at < fromTime || at >= endTime) return totals;
    const quantity = Number(movement.quantity_tons);
    if (!Number.isFinite(quantity)) return totals;
    if (movement.movement_type === "incoming") totals.totalIn += quantity;
    if (movement.movement_type === "outgoing") totals.totalOut += quantity;
    return totals;
  }, { totalIn: 0, totalOut: 0 });
}