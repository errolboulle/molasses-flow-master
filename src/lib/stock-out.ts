export function calculateStockOut(movements: ReadonlyArray<{ movement_type: string; quantity_tons: number | string | null }>): number {
  return movements.reduce((total, movement) => {
    if (movement.movement_type !== "outgoing") return total;
    const quantity = Number(movement.quantity_tons);
    return Number.isFinite(quantity) ? total + quantity : total;
  }, 0);
}