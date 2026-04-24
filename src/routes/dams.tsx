import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useDams, useSettings } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fmtTons, fmtLitres, tonsToLitres, type Dam } from "@/lib/types";
import { Pencil, Plus, Sliders, Droplet } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/dams")({
  component: () => <ProtectedLayout><DamsPage /></ProtectedLayout>,
});

function DamsPage() {
  const { isAdmin } = useAuth();
  const { data: dams = [] } = useDams();
  const { data: settings } = useSettings();
  const density = settings?.density_kg_per_l ?? 1.4;
  const [addOpen, setAddOpen] = useState(false);
  const [editDam, setEditDam] = useState<Dam | null>(null);
  const [adjustDam, setAdjustDam] = useState<Dam | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Storage control</p>
          <h1 className="mt-1 text-3xl font-black lg:text-4xl">Dams</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage storage dams.</p>
        </div>
        {isAdmin && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add dam</Button></DialogTrigger>
            <DamFormDialog onClose={() => setAddOpen(false)} />
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dams.map((dam) => (
          <Card key={dam.id} className="p-5 hover:-translate-y-1 hover:border-primary/35">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{dam.name}</h3>
                {dam.notes && <p className="text-xs text-muted-foreground mt-1">{dam.notes}</p>}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Droplet className="h-5 w-5" /></div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Current" value={fmtTons(dam.current_volume_tons)} sub={fmtLitres(tonsToLitres(Number(dam.current_volume_tons), density))} />
              <Row label="Starting balance" value={fmtTons(dam.starting_balance_tons)} />
              <Row label="Capacity" value={dam.capacity_tons ? fmtTons(dam.capacity_tons) : "—"} />
            </div>
            {dam.capacity_tons && Number(dam.capacity_tons) > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Capacity used</span><span>{Math.min(100, (Number(dam.current_volume_tons) / Number(dam.capacity_tons)) * 100).toFixed(0)}%</span></div>
                <Progress value={Math.min(100, (Number(dam.current_volume_tons) / Number(dam.capacity_tons)) * 100)} />
              </div>
            )}
            {isAdmin && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditDam(dam)}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setAdjustDam(dam)}>
                  <Sliders className="h-3 w-3" /> Adjust
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {editDam && (
        <Dialog open onOpenChange={(o) => !o && setEditDam(null)}>
          <DamFormDialog dam={editDam} onClose={() => setEditDam(null)} />
        </Dialog>
      )}
      {adjustDam && (
        <Dialog open onOpenChange={(o) => !o && setAdjustDam(null)}>
          <AdjustVolumeDialog dam={adjustDam} onClose={() => setAdjustDam(null)} />
        </Dialog>
      )}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <div className="text-right">
        <div className="font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function DamFormDialog({ dam, onClose }: { dam?: Dam; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(dam?.name ?? "");
  const [capacity, setCapacity] = useState(dam?.capacity_tons?.toString() ?? "");
  const [startingBalance, setStartingBalance] = useState(dam?.starting_balance_tons?.toString() ?? "0");
  const [notes, setNotes] = useState(dam?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const trimmedStart = startingBalance.trim();
      const startingValue = trimmedStart === "" ? 0 : parseFloat(trimmedStart);
      if (isNaN(startingValue) || startingValue < 0) throw new Error("Starting balance must be 0 or greater");

      if (dam) {
        // Editing: only adjust starting balance + carry the delta into current volume so the
        // app-wide rule (current = starting + Σin − Σout ± adjustments) stays intact.
        const previousStart = Number(dam.starting_balance_tons ?? 0);
        const delta = startingValue - previousStart;
        const payload = {
          name: name.trim(),
          capacity_tons: capacity ? parseFloat(capacity) : null,
          notes: notes.trim() || null,
          starting_balance_tons: startingValue,
          ...(delta !== 0 ? { current_volume_tons: Number(dam.current_volume_tons ?? 0) + delta } : {}),
        };
        const { error } = await supabase.from("dams").update(payload).eq("id", dam.id);
        if (error) throw error;
      } else {
        // Creating: seed both starting balance and current volume so future movements
        // build on the correct opening number — same rule applied to every dam.
        const { error } = await supabase.from("dams").insert({
          name: name.trim(),
          capacity_tons: capacity ? parseFloat(capacity) : null,
          notes: notes.trim() || null,
          starting_balance_tons: startingValue,
          current_volume_tons: startingValue,
        });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["dams"] });
      toast.success(dam ? "Dam updated" : "Dam created");
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{dam ? "Edit dam" : "Add dam"}</DialogTitle>
        <DialogDescription>{dam ? "Update dam details. Changing the starting balance shifts the current volume by the same amount so movement totals stay correct." : "Create a new storage dam. Enter any stock already in it as the starting balance."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dam 4" />
        </div>
        <div className="space-y-2">
          <Label>Starting balance (tons)</Label>
          <Input type="number" step="0.001" min="0" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} placeholder="0.000" />
          <p className="text-xs text-muted-foreground">Opening stock used by every report: <span className="font-mono">current = starting + incoming − outgoing ± adjustments</span>.</p>
        </div>
        <div className="space-y-2">
          <Label>Capacity (tons, optional)</Label>
          <Input type="number" step="0.001" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AdjustVolumeDialog({ dam, onClose }: { dam: Dam; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const density = settings?.density_kg_per_l ?? 1.4;
  const [unit, setUnit] = useState<"tons" | "litres">("tons");
  const [value, setValue] = useState(String(dam.current_volume_tons));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    setSaving(true);
    try {
      const numericValue = parseFloat(value);
      if (isNaN(numericValue) || numericValue < 0) throw new Error("Invalid volume");
      const newTons = unit === "tons" ? numericValue : (numericValue * density) / 1000;
      const prev = Number(dam.current_volume_tons);

      const { error: aErr } = await supabase.from("dam_adjustments").insert({
        dam_id: dam.id,
        user_id: user!.id,
        previous_volume_tons: prev,
        new_volume_tons: newTons,
        reason: reason.trim(),
      });
      if (aErr) throw aErr;

      const { error } = await supabase.from("dams").update({ current_volume_tons: newTons }).eq("id", dam.id);
      if (error) throw error;

      await qc.invalidateQueries();
      toast.success("Volume adjusted (logged to audit)");
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Adjust {dam.name} volume</DialogTitle>
        <DialogDescription>Manual adjustments are logged to the audit trail.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="text-sm text-muted-foreground">
          Current: <span className="font-semibold text-foreground">{fmtTons(dam.current_volume_tons)}</span>
          {" · "}<span>{fmtLitres(tonsToLitres(Number(dam.current_volume_tons), density))}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-2">
            <Label>New volume</Label>
            <Input type="number" step="0.001" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Unit</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
              <option value="tons">tons</option>
              <option value="litres">litres</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reason (required)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stock take correction, sample loss…" rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save adjustment"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
