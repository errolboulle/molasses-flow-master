CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_src_delivery_note
  ON public.movements (lower(trim(src_delivery_note)))
  WHERE src_delivery_note IS NOT NULL AND trim(src_delivery_note) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_src_mill_number
  ON public.movements (lower(trim(src_mill_number)))
  WHERE src_mill_number IS NOT NULL AND trim(src_mill_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_src_sample_number
  ON public.movements (lower(trim(src_sample_number)))
  WHERE src_sample_number IS NOT NULL AND trim(src_sample_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_fgc_consignment_note_number
  ON public.movements (lower(trim(fgc_consignment_note_number)))
  WHERE fgc_consignment_note_number IS NOT NULL AND trim(fgc_consignment_note_number) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_fgc_zsm_weighbridge_number
  ON public.movements (lower(trim(fgc_zsm_weighbridge_number)))
  WHERE fgc_zsm_weighbridge_number IS NOT NULL AND trim(fgc_zsm_weighbridge_number) <> '';

DROP TRIGGER IF EXISTS trg_prevent_duplicate_movement_references ON public.movements;
CREATE TRIGGER trg_prevent_duplicate_movement_references
  BEFORE INSERT OR UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_movement_references();