import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useDams, useMovements } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { fmtTons, fmtDateTime } from "@/lib/types";
import { ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet } from "lucide-react";
import { exportMovementsToExcel } from "@/lib/excel-export";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  component: () => <ProtectedLayout><HistoryPage /></ProtectedLayout>,
});

function HistoryPage() {
  const { data: dams = [] } = useDams();
  const [damId, setDamId] = useState("");
  const [type, setType] = useState<"" | "incoming" | "outgoing">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const { data: movements = [] } = useMovements({
    damId: damId || undefined,
    type: type || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return movements;
    const s = search.toLowerCase();
    return movements.filter((m) =>
      [m.driver_or_company, m.src_haulier, m.fgc_haulier, m.src_vehicle_registration, m.fgc_vehicle_registration, m.src_mill, m.src_delivery_note, m.fgc_consignment_note_number]
        .some((v) => v?.toLowerCase().includes(s))
    );
  }, [movements, search]);

  const damName = (id: string) => dams.find((d) => d.id === id)?.name ?? "—";

  const handleExport = async (mode: "single" | "all") => {
    if (filtered.length === 0) { return; }
    if (mode === "single") {
      if (!damId) return;
      const dam = dams.find((d) => d.id === damId);
      if (!dam) return;
      await exportMovementsToExcel({
        dams: [dam], movements: filtered, perDamSheets: false,
        filename: `FGC_${dam.name.replace(/\s+/g, "")}_${new Date().toISOString().slice(0,10)}.xlsx`,
      });
    } else {
      await exportMovementsToExcel({
        dams, movements: filtered, perDamSheets: true,
        filename: `FGC_AllDams_${new Date().toISOString().slice(0,10)}.xlsx`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">History & Excel export</h1>
        <p className="text-sm text-muted-foreground mt-1">Filter movements and export per-dam sheets.</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Dam</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={damId} onChange={(e) => setDamId(e.target.value)}>
              <option value="">All dams</option>
              {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="">All</option>
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </div>
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Search</Label><Input placeholder="Driver, vehicle, mill…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={() => handleExport("single")} disabled={!damId || filtered.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Export selected dam
          </Button>
          <Button onClick={() => handleExport("all")} disabled={filtered.length === 0}>
            <FileSpreadsheet className="h-4 w-4" /> Export all dams (sheets)
          </Button>
        </div>
      </Card>

      <div>
        <div className="text-sm text-muted-foreground mb-3">{filtered.length} movements</div>
        <div className="space-y-2">
          {filtered.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center ${m.movement_type === "incoming" ? "bg-success/10 text-success" : "bg-purple/10 text-purple"}`}>
                    {m.movement_type === "incoming" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-semibold tabular-nums">{fmtTons(m.quantity_tons)} <Badge variant="outline" className="ml-1">{damName(m.dam_id)}</Badge></div>
                    <div className="text-xs text-muted-foreground">
                      {m.driver_or_company || "—"} · {m.src_vehicle_registration || m.fgc_vehicle_registration || "—"} · {m.src_mill || "—"}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(m.occurred_at)}</div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No movements match.</Card>}
        </div>
      </div>
    </div>
  );
}
