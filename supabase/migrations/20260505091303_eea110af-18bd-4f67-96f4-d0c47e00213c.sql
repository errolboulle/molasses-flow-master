
-- Drop duplicate triggers (keep one of each)
DROP TRIGGER IF EXISTS apply_movement_after_insert ON public.movements;
DROP TRIGGER IF EXISTS trg_apply_movement ON public.movements;
-- keep: trg_apply_movement_insert

DROP TRIGGER IF EXISTS reapply_movement_after_update ON public.movements;
-- keep: trg_reapply_movement_update

DROP TRIGGER IF EXISTS reverse_movement_after_delete ON public.movements;
-- keep: trg_reverse_movement_delete

DROP TRIGGER IF EXISTS prevent_duplicate_movement_references_trigger ON public.movements;
-- keep: trg_prevent_duplicate_movement_references

DROP TRIGGER IF EXISTS validate_movement_stock_input_before_update ON public.movements;
-- keep: validate_movement_stock_input_before_insert (insert-only is correct; update revalidation handled by reapply trigger)

-- Recalculate current_volume_tons for all dams from actual movements
UPDATE public.dams d
SET current_volume_tons = COALESCE(d.starting_balance_tons, 0) + COALESCE(agg.net, 0),
    updated_at = now()
FROM (
  SELECT dam_id,
    SUM(CASE WHEN movement_type = 'incoming' THEN fgc_net_mass
             WHEN movement_type = 'outgoing' THEN -fgc_net_mass
             ELSE 0 END) AS net
  FROM public.movements
  GROUP BY dam_id
) agg
WHERE d.id = agg.dam_id AND d.deleted_at IS NULL;

-- Also reset dams with no movements to their starting balance
UPDATE public.dams
SET current_volume_tons = COALESCE(starting_balance_tons, 0),
    updated_at = now()
WHERE deleted_at IS NULL
  AND id NOT IN (SELECT DISTINCT dam_id FROM public.movements);
