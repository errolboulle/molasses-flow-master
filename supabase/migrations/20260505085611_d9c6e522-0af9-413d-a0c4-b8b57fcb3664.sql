DELETE FROM public.movements;
UPDATE public.dams SET current_volume_tons=0, current_volume_liters=0, starting_balance_tons=0, updated_at=now() WHERE deleted_at IS NULL;