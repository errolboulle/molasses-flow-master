CREATE INDEX IF NOT EXISTS idx_movements_occurred_at ON public.movements (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_dam_id_occurred_at ON public.movements (dam_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_created_by ON public.movements (created_by);
CREATE INDEX IF NOT EXISTS idx_movements_is_demo ON public.movements (is_demo);
CREATE INDEX IF NOT EXISTS idx_movements_fgc_date_of_arrival ON public.movements (fgc_date_of_arrival DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_log_type_timestamp ON public.audit_logs (log_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_dam_adjustments_dam_id_created_at ON public.dam_adjustments (dam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dam_adjustments_created_at ON public.dam_adjustments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loads_dam_id_timestamp ON public.loads (dam_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_loads_truck_id ON public.loads (truck_id);

CREATE INDEX IF NOT EXISTS idx_dam_transactions_dam_id_created_at ON public.dam_transactions (dam_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dams_deleted_at ON public.dams (deleted_at);
CREATE INDEX IF NOT EXISTS idx_trucks_deleted_at ON public.trucks (deleted_at);