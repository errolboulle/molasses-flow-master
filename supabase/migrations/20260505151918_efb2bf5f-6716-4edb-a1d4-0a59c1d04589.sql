ALTER TABLE movements DISABLE TRIGGER trg_prevent_duplicate_movement_references;
ALTER TABLE movements DISABLE TRIGGER movements_prevent_duplicate_references;

UPDATE movements
SET
  fgc_date_of_arrival = fgc_date_of_arrival + INTERVAL '1 day',
  src_date_of_departure = CASE
    WHEN src_date_of_departure IS NOT NULL THEN src_date_of_departure + INTERVAL '1 day'
    ELSE NULL
  END,
  occurred_at = ((fgc_date_of_arrival + INTERVAL '1 day') + fgc_time) AT TIME ZONE 'UTC'
WHERE fgc_time IS NOT NULL
  AND fgc_date_of_arrival IS NOT NULL
  AND (occurred_at AT TIME ZONE 'UTC')::time <> fgc_time;

ALTER TABLE movements ENABLE TRIGGER trg_prevent_duplicate_movement_references;
ALTER TABLE movements ENABLE TRIGGER movements_prevent_duplicate_references;