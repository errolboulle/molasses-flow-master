DROP INDEX IF EXISTS public.movements_unique_fgc_zsm_weighbridge_number;
DROP INDEX IF EXISTS public.movements_unique_src_delivery_note;
DROP INDEX IF EXISTS public.movements_unique_fgc_consignment_note_number;

ALTER TABLE public.movements DISABLE TRIGGER USER;

INSERT INTO public.movements (
  dam_id, movement_type, occurred_at, quantity_tons,
  fgc_date_of_arrival, fgc_time, fgc_vehicle_registration, fgc_haulier,
  fgc_consignment_note_number, fgc_zsm_weighbridge_number,
  fgc_gross_mass, fgc_tare_mass, fgc_net_mass, fgc_variance,
  fgc_in_out, fgc_zsm_operator,
  fgc_in, fgc_out, fgc_net
) VALUES (
  '50aa212d-1821-45e8-8df1-e6e4749c13c3', 'outgoing',
  '2026-04-24 16:31:00+00', 35.72,
  '2026-04-24', '16:31:00', 'KHC544NW', 'FTS',
  '64828', '7119',
  57.18, 21.46, 35.72, 35.72,
  'OUT', 'lucky',
  NULL, 35.72, 35.72
);

UPDATE public.dams
SET current_volume_tons = current_volume_tons - 35.72,
    updated_at = now()
WHERE id = '50aa212d-1821-45e8-8df1-e6e4749c13c3';

ALTER TABLE public.movements ENABLE TRIGGER USER;