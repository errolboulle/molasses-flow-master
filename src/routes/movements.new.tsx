import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useAuth } from "@/lib/auth-context";
import { useDams } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

type SearchParams = { type?: "incoming" | "outgoing" };

export const Route = createFileRoute("/movements/new")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    type: s.type === "outgoing" ? "outgoing" : "incoming",
  }),
  component: () => <ProtectedLayout><NewMovementPage /></ProtectedLayout>,
});

function NewMovementPage() {
  const { type = "incoming" } = Route.useSearch();
  const { canEntry, user } = useAuth();
  const { data: dams = [] } = useDams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const nowTime = nowIso.slice(11, 16);

  const [form, setForm] = useState<Record<string, string>>({
    dam_id: "",
    occurred_at: nowIso.slice(0, 16),
    driver_or_company: "",
    quantity_tons: "",
    notes: "",
    // source mill
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
    // FGC
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
    fgc_in_out: type === "incoming" ? "In" : "Out",
    fgc_zsm_operator: "",
    fgc_if_out_haulier: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-calc nets and variance
  const srcNet = useMemo(() => {
    if (form.src_net_mass) return parseFloat(form.src_net_mass);
    const g = parseFloat(form.src_gross_mass), t = parseFloat(form.src_tare_mass);
    return !isNaN(g) && !isNaN(t) ? g - t : NaN;
  }, [form.src_gross_mass, form.src_tare_mass, form.src_net_mass]);

  const fgcNet = useMemo(() => {
    if (form.fgc_net_mass) return parseFloat(form.fgc_net_mass);
    const g = parseFloat(form.fgc_gross_mass), t = parseFloat(form.fgc_tare_mass);
    return !isNaN(g) && !isNaN(t) ? g - t : NaN;
  }, [form.fgc_gross_mass, form.fgc_tare_mass, form.fgc_net_mass]);

  const variance = !isNaN(srcNet) && !isNaN(fgcNet) ? srcNet - fgcNet : NaN;

  if (!canEntry) {
    return <div className="text-center py-16 text-muted-foreground">You don't have permission to add entries.</div>;
  }

  const handleSubmit = async () => {
    if (!user) { toast.error("You must be signed in"); return; }
    if (dams.length === 0) { toast.error("No dams available — ask an admin to add one"); return; }
    if (!form.dam_id) { toast.error("Please select a dam"); return; }
    const qty = parseFloat(form.quantity_tons);
    if (!qty || qty <= 0) { toast.error("Quantity (tons) must be greater than 0"); return; }
    if (!form.occurred_at) { toast.error("Date & time is required"); return; }
    setSaving(true);
    try {
      const numOrNull = (s: string) => s === "" ? null : parseFloat(s);
      const strOrNull = (s: string) => s.trim() === "" ? null : s.trim();
      const payload: any = {
        dam_id: form.dam_id,
        movement_type: type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        quantity_tons: qty,
        driver_or_company: strOrNull(form.driver_or_company),
        notes: strOrNull(form.notes),
        created_by: user!.id,
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
        fgc_net_mass: !isNaN(fgcNet) ? fgcNet : null,
        fgc_variance: !isNaN(variance) ? variance : null,
        fgc_brix: numOrNull(form.fgc_brix),
        fgc_in_out: strOrNull(form.fgc_in_out),
        fgc_zsm_operator: strOrNull(form.fgc_zsm_operator),
        fgc_if_out_haulier: strOrNull(form.fgc_if_out_haulier),
        fgc_in: type === "incoming" && !isNaN(fgcNet) ? fgcNet : null,
        fgc_out: type === "outgoing" && !isNaN(fgcNet) ? fgcNet : null,
        fgc_net: !isNaN(fgcNet) ? fgcNet : null,
      };
      const { error } = await supabase.from("movements").insert(payload);
      if (error) throw error;
      await qc.invalidateQueries();
      toast.success(`${type === "incoming" ? "Incoming delivery" : "Outgoing dispatch"} recorded`);
      navigate({ to: "/movements" });
    } catch (e: any) {
      console.error("Movement save failed:", e);
      toast.error(e?.message ?? "Failed to save movement");
    } finally { setSaving(false); }
  };

  const Icon = type === "incoming" ? ArrowDownToLine : ArrowUpFromLine;
  const accentColor = type === "incoming" ? "text-success" : "text-purple";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${type === "incoming" ? "bg-success/10" : "bg-purple/10"} ${accentColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">{type === "incoming" ? "New incoming delivery" : "New outgoing dispatch"}</h1>
          <p className="text-sm text-muted-foreground">All Source Mill + FGC fields. Net masses & variance auto-calculate.</p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Core</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Dam *">
            <select required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.dam_id} onChange={(e) => set("dam_id", e.target.value)}>
              <option value="">— Select —</option>
              {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Date & time *"><Input type="datetime-local" value={form.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} /></Field>
          <Field label="Quantity (tons) *"><Input type="number" step="0.001" min="0" value={form.quantity_tons} onChange={(e) => set("quantity_tons", e.target.value)} /></Field>
          <Field label={type === "incoming" ? "Truck/Driver" : "Company/Driver"}><Input value={form.driver_or_company} onChange={(e) => set("driver_or_company", e.target.value)} /></Field>
          <div className="sm:col-span-2 lg:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Source Mill</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Date of departure"><Input type="date" value={form.src_date_of_departure} onChange={(e) => set("src_date_of_departure", e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={form.src_time} onChange={(e) => set("src_time", e.target.value)} /></Field>
          <Field label="Vehicle registration"><Input value={form.src_vehicle_registration} onChange={(e) => set("src_vehicle_registration", e.target.value)} /></Field>
          <Field label="Haulier"><Input value={form.src_haulier} onChange={(e) => set("src_haulier", e.target.value)} /></Field>
          <Field label="Delivery note"><Input value={form.src_delivery_note} onChange={(e) => set("src_delivery_note", e.target.value)} /></Field>
          <Field label="Mill number"><Input value={form.src_mill_number} onChange={(e) => set("src_mill_number", e.target.value)} /></Field>
          <Field label="Mill"><Input value={form.src_mill} onChange={(e) => set("src_mill", e.target.value)} /></Field>
          <Field label="Gross mass (kg)"><Input type="number" step="0.001" value={form.src_gross_mass} onChange={(e) => set("src_gross_mass", e.target.value)} /></Field>
          <Field label="Tare mass (kg)"><Input type="number" step="0.001" value={form.src_tare_mass} onChange={(e) => set("src_tare_mass", e.target.value)} /></Field>
          <Field label="Net mass (auto)"><Input type="number" step="0.001" value={isNaN(srcNet) ? "" : srcNet.toString()} onChange={(e) => set("src_net_mass", e.target.value)} /></Field>
          <Field label="Molasses temperature (°C)"><Input type="number" step="0.01" value={form.src_molasses_temperature} onChange={(e) => set("src_molasses_temperature", e.target.value)} /></Field>
          <Field label="Sample number"><Input value={form.src_sample_number} onChange={(e) => set("src_sample_number", e.target.value)} /></Field>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">FGC</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Date of arrival"><Input type="date" value={form.fgc_date_of_arrival} onChange={(e) => set("fgc_date_of_arrival", e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={form.fgc_time} onChange={(e) => set("fgc_time", e.target.value)} /></Field>
          <Field label="Vehicle registration"><Input value={form.fgc_vehicle_registration} onChange={(e) => set("fgc_vehicle_registration", e.target.value)} /></Field>
          <Field label="Haulier"><Input value={form.fgc_haulier} onChange={(e) => set("fgc_haulier", e.target.value)} /></Field>
          <Field label="Consignment note number"><Input value={form.fgc_consignment_note_number} onChange={(e) => set("fgc_consignment_note_number", e.target.value)} /></Field>
          <Field label="ZSM weighbridge number"><Input value={form.fgc_zsm_weighbridge_number} onChange={(e) => set("fgc_zsm_weighbridge_number", e.target.value)} /></Field>
          <Field label="Gross mass (kg)"><Input type="number" step="0.001" value={form.fgc_gross_mass} onChange={(e) => set("fgc_gross_mass", e.target.value)} /></Field>
          <Field label="Tare mass (kg)"><Input type="number" step="0.001" value={form.fgc_tare_mass} onChange={(e) => set("fgc_tare_mass", e.target.value)} /></Field>
          <Field label="Net mass (auto)"><Input type="number" step="0.001" value={isNaN(fgcNet) ? "" : fgcNet.toString()} onChange={(e) => set("fgc_net_mass", e.target.value)} /></Field>
          <Field label="Variance (Source − FGC)"><Input type="number" step="0.001" value={isNaN(variance) ? "" : variance.toString()} readOnly /></Field>
          <Field label="Brix"><Input type="number" step="0.01" value={form.fgc_brix} onChange={(e) => set("fgc_brix", e.target.value)} /></Field>
          <Field label="In/Out">
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.fgc_in_out} onChange={(e) => set("fgc_in_out", e.target.value)}>
              <option value="In">In</option>
              <option value="Out">Out</option>
            </select>
          </Field>
          <Field label="ZSM operator"><Input value={form.fgc_zsm_operator} onChange={(e) => set("fgc_zsm_operator", e.target.value)} /></Field>
          <Field label="If Out — haulier"><Input value={form.fgc_if_out_haulier} onChange={(e) => set("fgc_if_out_haulier", e.target.value)} /></Field>
        </div>
      </Card>

      <div className="flex gap-3 sticky bottom-0 lg:static bg-background pb-4 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0 pt-2 border-t border-border lg:border-0">
        <Button variant="outline" onClick={() => navigate({ to: "/movements" })} className="flex-1 lg:flex-none">Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 lg:flex-none">
          {saving ? "Saving…" : "Save movement"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
