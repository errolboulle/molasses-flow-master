import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/types";
import type { Movement, Dam } from "@/lib/types";
import { Trash2, Pencil, Lock } from "lucide-react";

type FieldDef = { key: keyof Movement; label: string; type: "text" | "number" | "date" | "time" };
const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  { title: "Source (SRC)", fields: [
    { key: "src_date_of_departure", label: "Date of departure", type: "date" },
    { key: "src_time", label: "Time", type: "time" },
    { key: "src_vehicle_registration", label: "Vehicle registration", type: "text" },
    { key: "src_haulier", label: "Haulier", type: "text" },
    { key: "src_delivery_note", label: "Delivery note", type: "text" },
    { key: "src_mill_number", label: "Mill number", type: "text" },
    { key: "src_mill", label: "Mill", type: "text" },
    { key: "src_gross_mass", label: "Gross mass (t)", type: "number" },
    { key: "src_tare_mass", label: "Tare mass (t)", type: "number" },
    { key: "src_net_mass", label: "Net mass (t)", type: "number" },
    { key: "src_molasses_temperature", label: "Molasses temperature", type: "number" },
    { key: "src_sample_number", label: "Sample number", type: "text" },
  ]},
  { title: "FGC", fields: [
    { key: "fgc_date_of_arrival", label: "Date of arrival", type: "date" },
    { key: "fgc_time", label: "Time", type: "time" },
    { key: "fgc_vehicle_registration", label: "Vehicle registration", type: "text" },
    { key: "fgc_haulier", label: "Haulier", type: "text" },
    { key: "fgc_consignment_note_number", label: "Consignment note number", type: "text" },
    { key: "fgc_zsm_weighbridge_number", label: "ZSM weighbridge number", type: "text" },
    { key: "fgc_gross_mass", label: "Gross mass (t)", type: "number" },
    { key: "fgc_tare_mass", label: "Tare mass (t)", type: "number" },
    { key: "fgc_net_mass", label: "Net mass (t)", type: "number" },
    { key: "fgc_variance", label: "Variance", type: "number" },
    { key: "fgc_brix", label: "Brix", type: "number" },
    { key: "fgc_zsm_operator", label: "ZSM operator", type: "text" },
    { key: "fgc_if_out_haulier", label: "If OUT — haulier", type: "text" },
  ]},
];

export function MovementEditDialog({
  movement,
  dams,
  onClose,
}: {
  movement: Movement;
  dams: Dam[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const initial = {
    dam_id: movement.dam_id,
    movement_type: movement.movement_type as "incoming" | "outgoing",
    occurred_at: movement.occurred_at ? new Date(movement.occurred_at).toISOString().slice(0, 16) : "",
    quantity_tons: String(movement.quantity_tons ?? ""),
    driver_or_company: movement.driver_or_company ?? "",
    notes: movement.notes ?? "",
    ...Object.fromEntries(SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, (movement as any)[f.key] ?? ""])),
  } as Record<string, any>;

  const [form, setForm] = useState(initial);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const canEdit = isAdmin && editing;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) { toast.error("Only admins can edit historical records"); return; }
    const qty = parseFloat(form.quantity_tons);
    if (isNaN(qty) || qty <= 0) { toast.error("Mass must be greater than 0"); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        dam_id: form.dam_id,
        movement_type: form.movement_type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        quantity_tons: qty,
        driver_or_company: form.driver_or_company?.trim() || null,
        notes: form.notes?.trim() || null,
        fgc_in_out: form.movement_type === "incoming" ? "In" : "Out",
      };
      for (const f of SECTIONS.flatMap((s) => s.fields)) {
        const v = form[f.key as string];
        if (v === "" || v == null) { payload[f.key as string] = null; continue; }
        payload[f.key as string] = f.type === "number" ? Number(v) : v;
      }
      const { error } = await supabase.from("movements").update(payload as any).eq("id", movement.id);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["movements"] }),
        qc.invalidateQueries({ queryKey: ["dams"] }),
      ]);
      toast.success("Movement updated — dam balance recalculated");
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to update");
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!isAdmin) { toast.error("Only admins can delete movements"); return; }
    if (!confirm("Delete this movement? Dam balance will be reversed.")) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("movements").delete().eq("id", movement.id);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["movements"] }),
        qc.invalidateQueries({ queryKey: ["dams"] }),
      ]);
      toast.success("Movement deleted — dam balance updated");
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to delete");
    } finally { setDeleting(false); }
  };

  const damName = dams.find((d) => d.id === form.dam_id)?.name ?? "—";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Movement details
            {!isAdmin && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Read-only</Badge>}
            {isAdmin && editing && <Badge>Editing</Badge>}
          </DialogTitle>
          <DialogDescription>
            Created {fmtDateTime(movement.created_at)}.{" "}
            {isAdmin
              ? "As an admin you can edit any field. Saving recalculates dam balances."
              : "Only admins can edit historical records."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-5 py-2">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Core</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Type">
                <select disabled={!canEdit} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-70" value={form.movement_type} onChange={(e) => set("movement_type", e.target.value)}>
                  <option value="incoming">Incoming (IN)</option>
                  <option value="outgoing">Outgoing (OUT)</option>
                </select>
              </Field>
              <Field label="Dam">
                {canEdit ? (
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.dam_id} onChange={(e) => set("dam_id", e.target.value)}>
                    {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                ) : <Input value={damName} disabled />}
              </Field>
              <Field label="Date & time">
                <Input disabled={!canEdit} type="datetime-local" value={form.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} />
              </Field>
              <Field label="Mass (tons)">
                <Input disabled={!canEdit} type="number" step="0.001" value={form.quantity_tons} onChange={(e) => set("quantity_tons", e.target.value)} />
              </Field>
              <Field label="Driver / company">
                <Input disabled={!canEdit} value={form.driver_or_company} onChange={(e) => set("driver_or_company", e.target.value)} />
              </Field>
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.title} className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.title}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.fields.map((f) => (
                  <Field key={f.key as string} label={f.label}>
                    <Input
                      disabled={!canEdit}
                      type={f.type}
                      step={f.type === "number" ? "0.001" : undefined}
                      value={form[f.key as string] ?? ""}
                      onChange={(e) => set(f.key as string, e.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-2">
            <Label className="text-xs">Notes</Label>
            <Textarea disabled={!canEdit} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </section>

          <DialogFooter className="gap-2 sm:justify-between">
            {isAdmin && editing ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting || saving}>
                <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              {isAdmin && !editing && (
                <Button type="button" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
              {isAdmin && editing && (
                <Button type="submit" disabled={saving || deleting}>{saving ? "Saving…" : "Save changes"}</Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
