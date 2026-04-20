import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useSettings } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  component: () => <ProtectedLayout requireAdmin><SettingsPage /></ProtectedLayout>,
});

function SettingsPage() {
  const { data: settings } = useSettings();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [density, setDensity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setDensity(String(settings.density_kg_per_l));
  }, [settings]);

  const save = async () => {
    setSaving(true);
    const d = parseFloat(density);
    if (!d || d <= 0) { toast.error("Density must be > 0"); setSaving(false); return; }
    const { error } = await supabase.from("settings")
      .update({ density_kg_per_l: d, updated_by: user!.id })
      .eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries();
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Global system configuration.</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">Conversion factor</h2>
        <div className="space-y-2">
          <Label>Molasses density (kg / litre)</Label>
          <Input type="number" step="0.01" min="0.1" value={density} onChange={(e) => setDensity(e.target.value)} />
          <p className="text-xs text-muted-foreground">Used to convert tons ↔ litres throughout the app.</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </Card>
    </div>
  );
}
