import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useAdjustments, useDams } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Audit control</p>
        <h1 className="mt-1 text-3xl font-black lg:text-4xl">Dam adjustments log</h1>
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

      {adjustments.length > 0 ? <Table>
        <TableHeader><TableRow><TableHead>Dam</TableHead><TableHead>Change</TableHead><TableHead>Volume</TableHead><TableHead>Reason</TableHead><TableHead>By</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
        <TableBody>{adjustments.map((a) => { const diff = Number(a.difference_tons); return <TableRow key={a.id}><TableCell><Badge variant="outline">{a.dams?.name ?? "—"}</Badge></TableCell><TableCell className={`font-bold tabular-nums ${diff >= 0 ? "text-success" : "text-destructive"}`}>{diff >= 0 ? "+" : ""}{fmtTons(diff)}</TableCell><TableCell><span className="text-muted-foreground">{fmtTons(a.previous_volume_tons)}</span> → <span className="font-semibold">{fmtTons(a.new_volume_tons)}</span></TableCell><TableCell>{a.reason}</TableCell><TableCell className="text-muted-foreground">{a.profiles?.full_name || a.profiles?.email || "—"}</TableCell><TableCell className="text-muted-foreground">{fmtDateTime(a.created_at)}</TableCell></TableRow>; })}</TableBody>
      </Table> : <Card className="p-8 text-center text-sm text-muted-foreground">No adjustments recorded.</Card>}
    </div>
  );
}
