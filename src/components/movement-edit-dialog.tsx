import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/types";
import type { Movement, Dam } from "@/lib/types";
import { Trash2 } from "lucide-react";

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
  const { isAdmin, canEntry } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    dam_id: movement.dam_id,
    movement_type: movement.movement_type as "incoming" | "outgoing",
    occurred_at: movement.occurred_at ? new Date(movement.occurred_at).toISOString().slice(0, 16) : "",
    quantity_tons: String(movement.quantity_tons ?? ""),
    driver_or_company: movement.driver_or_company ?? "",
    fgc_haulier: movement.fgc_haulier ?? "",
    fgc_zsm_operator: movement.fgc_zsm_operator ?? "",
    fgc_if_out_haulier: movement.fgc_if_out_haulier ?? "",
    notes: movement.notes ?? "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEntry) { toast.error("No permission"); return; }
    const qty = parseFloat(form.quantity_tons);
    if (isNaN(qty) || qty <= 0) { toast.error("Volume must be greater than 0"); return; }
    if (!form.dam_id) { toast.error("Dam is required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("movements").update({
        dam_id: form.dam_id,
        movement_type: form.movement_type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        quantity_tons: qty,
        driver_or_company: form.driver_or_company.trim() || null,
        fgc_haulier: form.fgc_haulier.trim() || null,
        fgc_zsm_operator: form.fgc_zsm_operator.trim() || null,
        fgc_if_out_haulier: form.fgc_if_out_haulier.trim() || null,
        fgc_in_out: form.movement_type === "incoming" ? "In" : "Out",
        notes: form.notes.trim() || null,
      }).eq("id", movement.id);
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
    } finally {
      setSaving(false);
    }
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
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit movement</DialogTitle>
          <DialogDescription>
            Created {fmtDateTime(movement.created_at)}. Saving will recalculate the dam balance automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.movement_type} onChange={(e) => set("movement_type", e.target.value)}>
                <option value="incoming">Incoming (IN)</option>
                <option value="outgoing">Outgoing (OUT)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dam</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.dam_id} onChange={(e) => set("dam_id", e.target.value)}>
                {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date & time</Label>
              <Input type="datetime-local" value={form.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mass (tons)</Label>
              <Input type="number" step="0.001" min="0.001" value={form.quantity_tons} onChange={(e) => set("quantity_tons", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Driver / company</Label>
              <Input value={form.driver_or_company} onChange={(e) => set("driver_or_company", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Haulier</Label>
              <Input value={form.fgc_haulier} onChange={(e) => set("fgc_haulier", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ZSM Operator</Label>
              <Input value={form.fgc_zsm_operator} onChange={(e) => set("fgc_zsm_operator", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">If OUT — Haulier</Label>
              <Input value={form.fgc_if_out_haulier} onChange={(e) => set("fgc_if_out_haulier", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {isAdmin ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting || saving}>
                <Trash2 className="h-4 w-4" /> {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving || deleting}>{saving ? "Saving…" : "Save changes"}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
