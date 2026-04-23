CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_src_delivery_note
ON public.movements (lower(trim(src_delivery_note)))
WHERE nullif(trim(src_delivery_note), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_src_mill_number
ON public.movements (lower(trim(src_mill_number)))
WHERE nullif(trim(src_mill_number), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_src_sample_number
ON public.movements (lower(trim(src_sample_number)))
WHERE nullif(trim(src_sample_number), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_fgc_consignment_note_number
ON public.movements (lower(trim(fgc_consignment_note_number)))
WHERE nullif(trim(fgc_consignment_note_number), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS movements_unique_fgc_zsm_weighbridge_number
ON public.movements (lower(trim(fgc_zsm_weighbridge_number)))
WHERE nullif(trim(fgc_zsm_weighbridge_number), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS movements_src_vehicle_registration_lookup
ON public.movements (lower(trim(src_vehicle_registration)))
WHERE nullif(trim(src_vehicle_registration), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS movements_fgc_vehicle_registration_lookup
ON public.movements (lower(trim(fgc_vehicle_registration)))
WHERE nullif(trim(fgc_vehicle_registration), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS movements_src_haulier_lookup
ON public.movements (lower(trim(src_haulier)))
WHERE nullif(trim(src_haulier), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS movements_fgc_haulier_lookup
ON public.movements (lower(trim(fgc_haulier)))
WHERE nullif(trim(fgc_haulier), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS movements_src_mill_lookup
ON public.movements (lower(trim(src_mill)))
WHERE nullif(trim(src_mill), '') IS NOT NULL;