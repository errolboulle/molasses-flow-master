import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, CheckCircle2, Gauge, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SmartAutocompleteInput } from "@/components/smart-autocomplete-input";
import { useAuth } from "@/lib/auth-context";
import { useDams, useMovementAutocompleteOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { duplicateFieldFromDatabaseError, findDuplicateMovementReference, type DuplicateFieldName } from "@/lib/movement-duplicates";
import { supabase } from "@/integrations/supabase/client";
import { type Tables } from "@/integrations/supabase/types";

type MovementType = "incoming" | "outgoing";
type Truck = Tables<"trucks">;

const STORAGE_KEY = "weigh-bridge-mode-defaults";

const todayParts = () => {
  const nowIso = new Date().toISOString();
  return { nowIso, today: nowIso.slice(0, 10), nowTime: nowIso.slice(11, 16) };
};

const initialForm = (movementType: MovementType) => {
  const { nowIso, today, nowTime } = todayParts();
  return {
    dam_id: "",
    occurred_at: nowIso.slice(0, 16),
    driver_or_company: "",
    quantity_tons: "",
    notes: "",
    src_date_of_departure: today,
    src_time: nowTime,
    src_vehicle_registration: "",
    src_haulier: "",
    src_delivery_note: "",
    src_mill_number: "",
    src_mill: "",
    src_gross_mass: "",
    src_tare_mass: "",
    src_net_mass: "",
    src_molasses_temperature: "",
    src_sample_number: "",
    fgc_date_of_arrival: today,
    fgc_time: nowTime,
    fgc_vehicle_registration: "",
    fgc_haulier: "",
    fgc_consignment_note_number: "",
    fgc_zsm_weighbridge_number: "",
    fgc_gross_mass: "",
    fgc_tare_mass: "",
    fgc_net_mass: "",
    fgc_brix: "",
    fgc_in_out: movementType === "incoming" ? "In" : "Out",
    fgc_zsm_operator: "",
    fgc_if_out_haulier: "",
  };
};

export const Route = createFileRoute("/weigh-bridge")({
  component: WeighBridgeModePage,
});

function WeighBridgeModePage() {
  const { canEntry, user } = useAuth();
  const { data: dams = [] } = useDams();
  const { data: autocompleteOptions } = useMovementAutocompleteOptions();
  const { data: trucks = [] } = useQuery({
    queryKey: ["trucks", "weigh-bridge"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trucks").select("*").is("deleted_at", null).order("registration_number");
      if (error) throw error;
      return data;
    },
  });
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [activeField, setActiveField] = useState("movement_type");
  const [movementType, setMovementTypeState] = useState<MovementType>("incoming");
  const [form, setForm] = useState<Record<string, string>>(() => initialForm("incoming"));
  const [duplicateField, setDuplicateField] = useState<DuplicateFieldName | null>(null);
  const [damSearch, setDamSearch] = useState("");
  const [truckSearch, setTruckSearch] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { dam_id?: string; movement_type?: MovementType };
      if (parsed.movement_type === "incoming" || parsed.movement_type === "outgoing") {
        setType(parsed.movement_type);
      }
      const savedDamId = parsed.dam_id;
      if (savedDamId) setForm((current) => ({ ...current, dam_id: savedDamId }));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const selectedDam = dams.find((dam) => dam.id === form.dam_id);
    if (selectedDam) setDamSearch(selectedDam.name);
  }, [dams, form.dam_id]);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const set = (key: string, value: string) => {
    if (key === duplicateField) setDuplicateField(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const persistDefaults = (damId = form.dam_id, type = movementType) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ dam_id: damId, movement_type: type }));
  };

  const setType = (nextType: MovementType) => {
    setMovementTypeState(nextType);
    setForm((current) => ({ ...current, fgc_in_out: nextType === "incoming" ? "In" : "Out" }));
    persistDefaults(form.dam_id, nextType);
  };

  const srcNet = useMemo(() => {
    if (form.src_net_mass) return parseFloat(form.src_net_mass);
    const gross = parseFloat(form.src_gross_mass);
    const tare = parseFloat(form.src_tare_mass);
    return !isNaN(gross) && !isNaN(tare) ? gross - tare : NaN;
  }, [form.src_gross_mass, form.src_tare_mass, form.src_net_mass]);

  const fgcNet = useMemo(() => {
    if (form.fgc_net_mass) return parseFloat(form.fgc_net_mass);
    const gross = parseFloat(form.fgc_gross_mass);
    const tare = parseFloat(form.fgc_tare_mass);
    return !isNaN(gross) && !isNaN(tare) ? gross - tare : NaN;
  }, [form.fgc_gross_mass, form.fgc_tare_mass, form.fgc_net_mass]);

  const variance = !isNaN(srcNet) && !isNaN(fgcNet) ? srcNet - fgcNet : NaN;

  const focusableFields = () =>
    Array.from(formRef.current?.querySelectorAll<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type='submit']:not([disabled])") ?? []).filter(
      (element) => element.offsetParent !== null,
    );

  const moveFocus = (direction: 1 | -1) => {
    const fields = focusableFields();
    const currentIndex = fields.findIndex((field) => field === document.activeElement);
    const nextIndex = currentIndex < 0 ? 0 : Math.min(Math.max(currentIndex + direction, 0), fields.length - 1);
    fields[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    }
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, name: string) => {
    setActiveField(name);
    if (event.currentTarget instanceof HTMLInputElement || event.currentTarget instanceof HTMLTextAreaElement) {
      event.currentTarget.select();
    }
  };

  const applyTruck = (value: string) => {
    setTruckSearch(value);
    const truck = trucks.find((item) => `${item.registration_number} — ${item.driver_name}` === value || item.registration_number === value);
    if (!truck) {
      set("driver_or_company", value);
      return;
    }
    setForm((current) => ({
      ...current,
      driver_or_company: truck.driver_name,
      src_vehicle_registration: truck.registration_number,
      fgc_vehicle_registration: truck.registration_number,
      src_haulier: truck.transporter_company,
      fgc_haulier: truck.transporter_company,
    }));
  };

  const resetForNextTruck = () => {
    const { nowIso, today, nowTime } = todayParts();
    setForm((current) => ({
      ...initialForm(movementType),
      dam_id: current.dam_id,
      occurred_at: nowIso.slice(0, 16),
      src_date_of_departure: today,
      src_time: nowTime,
      fgc_date_of_arrival: today,
      fgc_time: nowTime,
      fgc_in_out: movementType === "incoming" ? "In" : "Out",
    }));
    setTruckSearch("");
    window.setTimeout(() => firstFieldRef.current?.focus(), 0);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    if (!form.dam_id) {
      toast.error("Please select a dam");
      return;
    }
    if (isNaN(fgcNet) || fgcNet <= 0) {
      toast.error("FGC net mass must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      const duplicate = await findDuplicateMovementReference(form);
      if (duplicate) {
        setDuplicateField(duplicate.field);
        setActiveField(duplicate.field);
        toast.error(`Duplicate detected: ${duplicate.label} already exists`);
        return;
      }
      const numOrNull = (value: string) => (value === "" ? null : parseFloat(value));
      const strOrNull = (value: string) => (value.trim() === "" ? null : value.trim());
      const payload = {
        dam_id: form.dam_id,
        movement_type: movementType,
        occurred_at: new Date().toISOString(),
        quantity_tons: fgcNet,
        driver_or_company: strOrNull(form.driver_or_company),
        notes: strOrNull(form.notes),
        created_by: user.id,
        src_date_of_departure: strOrNull(form.src_date_of_departure),
        src_time: strOrNull(form.src_time),
        src_vehicle_registration: strOrNull(form.src_vehicle_registration),
        src_haulier: strOrNull(form.src_haulier),
        src_delivery_note: strOrNull(form.src_delivery_note),
        src_mill_number: strOrNull(form.src_mill_number),
        src_mill: strOrNull(form.src_mill),
        src_gross_mass: numOrNull(form.src_gross_mass),
        src_tare_mass: numOrNull(form.src_tare_mass),
        src_net_mass: !isNaN(srcNet) ? srcNet : null,
        src_molasses_temperature: numOrNull(form.src_molasses_temperature),
        src_sample_number: strOrNull(form.src_sample_number),
        fgc_date_of_arrival: strOrNull(form.fgc_date_of_arrival),
        fgc_time: strOrNull(form.fgc_time),
        fgc_vehicle_registration: strOrNull(form.fgc_vehicle_registration),
        fgc_haulier: strOrNull(form.fgc_haulier),
        fgc_consignment_note_number: strOrNull(form.fgc_consignment_note_number),
        fgc_zsm_weighbridge_number: strOrNull(form.fgc_zsm_weighbridge_number),
        fgc_gross_mass: numOrNull(form.fgc_gross_mass),
        fgc_tare_mass: numOrNull(form.fgc_tare_mass),
        fgc_net_mass: fgcNet,
        fgc_variance: !isNaN(variance) ? variance : null,
        fgc_brix: numOrNull(form.fgc_brix),
        fgc_in_out: strOrNull(form.fgc_in_out),
        fgc_zsm_operator: strOrNull(form.fgc_zsm_operator),
        fgc_if_out_haulier: strOrNull(form.fgc_if_out_haulier),
        fgc_in: movementType === "incoming" ? fgcNet : null,
        fgc_out: movementType === "outgoing" ? fgcNet : null,
        fgc_net: fgcNet,
      };

      const { error } = await supabase.from("movements").insert(payload);
      if (error) throw error;

      persistDefaults();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["movements"] }),
        qc.invalidateQueries({ queryKey: ["dams"] }),
        qc.invalidateQueries({ queryKey: ["settings"] }),
      ]);
      toast.success("Movement saved — ready for next truck");
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 1200);
      resetForNextTruck();
    } catch (error: any) {
      console.error("Weigh Bridge save failed:", error);
      const duplicate = duplicateFieldFromDatabaseError(error);
      if (duplicate) {
        setDuplicateField(duplicate.field);
        setActiveField(duplicate.field);
        toast.error(`Duplicate detected: ${duplicate.label} already exists`);
        return;
      }
      toast.error(error?.message ?? "Failed to save movement");
    } finally {
      setSaving(false);
    }
  };

  if (!canEntry) {
    return <div className="py-16 text-center text-muted-foreground">You don't have permission to add entries.</div>;
  }

  const ModeIcon = movementType === "incoming" ? ArrowDownToLine : ArrowUpFromLine;

  return (
    <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      <datalist id="weigh-bridge-dams">
        {dams.map((dam) => <option key={dam.id} value={dam.name} />)}
      </datalist>
      <datalist id="weigh-bridge-trucks">
        {trucks.map((truck) => <option key={truck.id} value={`${truck.registration_number} — ${truck.driver_name}`} />)}
      </datalist>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold lg:text-3xl">Weigh Bridge Mode</h1>
            <p className="text-sm text-muted-foreground">Fast keyboard entry for continuous truck movements.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn("flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold transition-all", savedPulse && "border-success bg-success/10 text-success")}>
            {savedPulse ? <CheckCircle2 className="h-4 w-4" /> : <ModeIcon className="h-4 w-4" />}
            {savedPulse ? "Saved — next truck" : movementType === "incoming" ? "Incoming active" : "Outgoing active"}
          </div>
          <Button asChild type="button" variant="outline" className="gap-2">
            <Link to="/movements">
              <ArrowLeft className="h-4 w-4" /> Exit mode
            </Link>
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FastField label="Movement Type" name="movement_type" activeField={activeField} className="xl:col-span-1">
            <select ref={firstFieldRef} className="fast-control" value={movementType} onFocus={(event) => handleFocus(event, "movement_type")} onChange={(event) => setType(event.target.value as MovementType)}>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </FastField>
          <FastField label="Dam" name="dam_id" activeField={activeField} className="xl:col-span-1">
            <Input
              required
              list="weigh-bridge-dams"
              className="fast-control"
              value={damSearch}
              onFocus={(event) => handleFocus(event, "dam_id")}
              onChange={(event) => {
                const value = event.target.value;
                setDamSearch(value);
                const dam = dams.find((item) => item.name === value);
                set("dam_id", dam?.id ?? "");
                if (dam) persistDefaults(dam.id, movementType);
              }}
              placeholder="Type dam name"
            />
          </FastField>
          <FastField label="Truck / Driver" name="truck" activeField={activeField} className="xl:col-span-1">
            <Input list="weigh-bridge-trucks" className="fast-control" value={truckSearch} onFocus={(event) => handleFocus(event, "truck")} onChange={(event) => applyTruck(event.target.value)} placeholder="Type truck" />
          </FastField>
          <FastField label="Volume (tons, auto from FGC net)" name="quantity_tons" activeField={activeField} className="xl:col-span-1">
            <Input readOnly type="number" step="0.001" className="fast-control" value={!isNaN(fgcNet) ? fgcNet.toString() : ""} onFocus={(event) => handleFocus(event, "quantity_tons")} />
          </FastField>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Source Mill</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <FastInput label="Date of departure" name="src_date_of_departure" type="date" value={form.src_date_of_departure} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("src_date_of_departure", value)} />
            <FastInput label="Time" name="src_time" type="time" value={form.src_time} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("src_time", value)} />
            <FastAutocomplete label="Vehicle registration" name="src_vehicle_registration" value={form.src_vehicle_registration} activeField={activeField} suggestions={autocompleteOptions?.vehicleRegistrations ?? []} onFocus={handleFocus} onChange={(value) => set("src_vehicle_registration", value)} />
            <FastAutocomplete label="Haulier" name="src_haulier" value={form.src_haulier} activeField={activeField} suggestions={autocompleteOptions?.hauliers ?? []} onFocus={handleFocus} onChange={(value) => set("src_haulier", value)} />
            <FastInput label="Delivery note" name="src_delivery_note" value={form.src_delivery_note} activeField={activeField} duplicate={duplicateField === "src_delivery_note"} onFocus={handleFocus} onChange={(value) => set("src_delivery_note", value)} />
            <FastInput label="Mill number" name="src_mill_number" value={form.src_mill_number} activeField={activeField} duplicate={duplicateField === "src_mill_number"} onFocus={handleFocus} onChange={(value) => set("src_mill_number", value)} />
            <FastAutocomplete label="Mill" name="src_mill" value={form.src_mill} activeField={activeField} suggestions={autocompleteOptions?.mills ?? []} onFocus={handleFocus} onChange={(value) => set("src_mill", value)} />
            <FastInput label="Gross mass (tons)" name="src_gross_mass" type="number" step="0.001" value={form.src_gross_mass} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("src_gross_mass", value)} />
            <FastInput label="Tare mass (tons)" name="src_tare_mass" type="number" step="0.001" value={form.src_tare_mass} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("src_tare_mass", value)} />
            <FastInput label="Net mass (tons, auto)" name="src_net_mass" type="number" step="0.001" value={isNaN(srcNet) ? "" : srcNet.toString()} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("src_net_mass", value)} />
            <FastInput label="Molasses temperature (°C)" name="src_molasses_temperature" type="number" step="0.01" value={form.src_molasses_temperature} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("src_molasses_temperature", value)} />
            <FastInput label="Sample number" name="src_sample_number" value={form.src_sample_number} activeField={activeField} duplicate={duplicateField === "src_sample_number"} onFocus={handleFocus} onChange={(value) => set("src_sample_number", value)} />
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">FGC</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <FastInput label="Date of arrival" name="fgc_date_of_arrival" type="date" value={form.fgc_date_of_arrival} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_date_of_arrival", value)} />
            <FastInput label="Time" name="fgc_time" type="time" value={form.fgc_time} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_time", value)} />
            <FastAutocomplete label="Vehicle registration" name="fgc_vehicle_registration" value={form.fgc_vehicle_registration} activeField={activeField} suggestions={autocompleteOptions?.vehicleRegistrations ?? []} onFocus={handleFocus} onChange={(value) => set("fgc_vehicle_registration", value)} />
            <FastAutocomplete label="Haulier" name="fgc_haulier" value={form.fgc_haulier} activeField={activeField} suggestions={autocompleteOptions?.hauliers ?? []} onFocus={handleFocus} onChange={(value) => set("fgc_haulier", value)} />
            <FastInput label="Consignment note number" name="fgc_consignment_note_number" value={form.fgc_consignment_note_number} activeField={activeField} duplicate={duplicateField === "fgc_consignment_note_number"} onFocus={handleFocus} onChange={(value) => set("fgc_consignment_note_number", value)} />
            <FastInput label="ZSM weighbridge number" name="fgc_zsm_weighbridge_number" value={form.fgc_zsm_weighbridge_number} activeField={activeField} duplicate={duplicateField === "fgc_zsm_weighbridge_number"} onFocus={handleFocus} onChange={(value) => set("fgc_zsm_weighbridge_number", value)} />
            <FastInput label="Gross mass (tons)" name="fgc_gross_mass" type="number" step="0.001" value={form.fgc_gross_mass} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_gross_mass", value)} />
            <FastInput label="Tare mass (tons)" name="fgc_tare_mass" type="number" step="0.001" value={form.fgc_tare_mass} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_tare_mass", value)} />
            <FastInput label="Net mass (tons, auto)" name="fgc_net_mass_secondary" type="number" step="0.001" value={isNaN(fgcNet) ? "" : fgcNet.toString()} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_net_mass", value)} />
            <FastInput label="Variance (Source − FGC)" name="fgc_variance" type="number" step="0.001" value={isNaN(variance) ? "" : variance.toString()} activeField={activeField} onFocus={handleFocus} readOnly />
            <FastInput label="Brix" name="fgc_brix" type="number" step="0.01" value={form.fgc_brix} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_brix", value)} />
            <FastField label="In/Out" name="fgc_in_out" activeField={activeField}>
              <select className="fast-control" value={form.fgc_in_out} onFocus={(event) => handleFocus(event, "fgc_in_out")} onChange={(event) => set("fgc_in_out", event.target.value)}>
                <option value="In">In</option>
                <option value="Out">Out</option>
              </select>
            </FastField>
            <FastInput label="ZSM operator" name="fgc_zsm_operator" value={form.fgc_zsm_operator} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_zsm_operator", value)} />
            <FastInput label="If Out — haulier" name="fgc_if_out_haulier" value={form.fgc_if_out_haulier} activeField={activeField} onFocus={handleFocus} onChange={(value) => set("fgc_if_out_haulier", value)} />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <FastField label="Reference / notes" name="notes" activeField={activeField}>
          <Textarea rows={2} className="fast-control min-h-16" value={form.notes} onFocus={(event) => handleFocus(event, "notes")} onChange={(event) => set("notes", event.target.value)} placeholder="Optional reference, note, or explanation" />
        </FastField>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <Button type="button" variant="outline" onClick={resetForNextTruck} className="gap-2">
          <RotateCcw className="h-4 w-4" /> Clear truck fields
        </Button>
        <Button type="submit" disabled={saving || dams.length === 0} className="min-w-48 gap-2 text-base">
          {saving ? "Saving…" : "Enter · Save movement"}
        </Button>
      </div>
    </form>
  );
}

function FastField({ label, name, activeField, children, className }: { label: string; name: string; activeField: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5 rounded-md border border-transparent p-1.5 transition-all", activeField === name && "border-primary bg-primary/8 shadow-[0_0_0_1px_var(--primary)]", className)}>
      <Label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FastInput({
  label,
  name,
  value,
  activeField,
  onFocus,
  onChange,
  type = "text",
  step,
  readOnly,
  duplicate,
}: {
  label: string;
  name: string;
  value: string;
  activeField: string;
  onFocus: (event: FocusEvent<HTMLInputElement>, name: string) => void;
  onChange?: (value: string) => void;
  type?: string;
  step?: string;
  readOnly?: boolean;
  duplicate?: boolean;
}) {
  return (
    <FastField label={label} name={name} activeField={activeField} className={duplicate ? "border-destructive bg-destructive/10" : undefined}>
      <Input type={type} step={step} readOnly={readOnly} className={cn("fast-control", duplicate && "border-destructive focus-visible:ring-destructive/30")} value={value} onFocus={(event) => onFocus(event, name)} onChange={(event) => onChange?.(event.target.value)} />
    </FastField>
  );
}

function FastAutocomplete({
  label,
  name,
  value,
  activeField,
  suggestions,
  onFocus,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  activeField: string;
  suggestions: string[];
  onFocus: (event: FocusEvent<HTMLInputElement>, name: string) => void;
  onChange: (value: string) => void;
}) {
  return (
    <FastField label={label} name={name} activeField={activeField}>
      <SmartAutocompleteInput className="fast-control" value={value} suggestions={suggestions} onFocus={(event) => onFocus(event, name)} onChange={onChange} />
    </FastField>
  );
}
