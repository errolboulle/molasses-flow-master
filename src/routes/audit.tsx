import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useAdjustments, useDams } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtTons, fmtDateTime } from "@/lib/types";
import { useState } from "react";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/audit")({
  component: () => <ProtectedLayout><AuditPage /></ProtectedLayout>,
});

function AuditPage() {
  const { data: dams = [] } = useDams();
  const [damId, setDamId] = useState("");
  const { data: adjustments = [] } = useAdjustments(damId || undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">Dam adjustments log</h1>
        <p className="text-sm text-muted-foreground mt-1">Immutable audit trail of every manual volume change.</p>
      </div>

      <Card className="p-4">
        <div className="max-w-xs space-y-1">
          <Label className="text-xs">Filter by dam</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={damId} onChange={(e) => setDamId(e.target.value)}>
            <option value="">All dams</option>
            {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-2">
        {adjustments.map((a) => {
          const diff = Number(a.difference_tons);
          return (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{a.dams?.name ?? "—"}</Badge>
                    <span className={`text-sm font-bold tabular-nums ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                      {diff >= 0 ? "+" : ""}{fmtTons(diff)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{fmtTons(a.previous_volume_tons)}</span> → <span className="font-semibold">{fmtTons(a.new_volume_tons)}</span>
                  </div>
                  <div className="text-sm mt-1"><span className="text-muted-foreground">Reason:</span> {a.reason}</div>
                  <div className="text-xs text-muted-foreground">By {a.profiles?.full_name || a.profiles?.email || "—"}</div>
                </div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</div>
              </div>
            </Card>
          );
        })}
        {adjustments.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No adjustments recorded.</Card>}
      </div>
    </div>
  );
}
