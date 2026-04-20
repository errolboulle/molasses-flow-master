import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useDams, useSettings } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { data: dams } = useDams();
  const { data: settings, isLoading: sLoading } = useSettings();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [density, setDensity] = useState("1.4");
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (authLoading || sLoading) return null;
  if (!user) return <Navigate to="/auth" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  if (settings?.onboarded) return <Navigate to="/dashboard" />;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const d = parseFloat(density);
      if (!d || d <= 0) throw new Error("Density must be > 0");

      const { error: sErr } = await supabase.from("settings").update({
        density_kg_per_l: d,
        onboarded: true,
        updated_by: user.id,
      }).eq("id", 1);
      if (sErr) throw sErr;

      for (const dam of dams ?? []) {
        const v = parseFloat(balances[dam.id] ?? "0") || 0;
        const { error } = await supabase.from("dams").update({
          starting_balance_tons: v,
          current_volume_tons: v,
        }).eq("id", dam.id);
        if (error) throw error;
      }
      await qc.invalidateQueries();
      toast.success("Setup complete");
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e.message ?? "Setup failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8" style={{ background: "var(--gradient-industrial)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Welcome — let's set up</h1>
          <p className="text-muted-foreground mt-2">Configure density and starting balances. You can change these later.</p>
        </div>

        <Card className="p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Molasses density</h2>
          <div className="space-y-2">
            <Label htmlFor="density">Density (kg per litre)</Label>
            <Input id="density" type="number" step="0.01" min="0.1" value={density} onChange={(e) => setDensity(e.target.value)} />
            <p className="text-xs text-muted-foreground">Standard cane molasses ≈ 1.40 kg/L. Used to convert tons ↔ litres.</p>
          </div>
        </Card>

        <Card className="p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Starting balances (tons)</h2>
          <p className="text-sm text-muted-foreground mb-4">Enter the current volume already in each dam.</p>
          <div className="space-y-3">
            {dams?.map((dam) => (
              <div key={dam.id} className="flex items-center gap-3">
                <Label className="w-24 shrink-0" htmlFor={`b-${dam.id}`}>{dam.name}</Label>
                <Input
                  id={`b-${dam.id}`}
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={balances[dam.id] ?? ""}
                  onChange={(e) => setBalances({ ...balances, [dam.id]: e.target.value })}
                />
                <span className="text-xs text-muted-foreground w-12">tons</span>
              </div>
            ))}
          </div>
        </Card>

        <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving…" : "Complete setup"}
        </Button>
      </div>
    </div>
  );
}
