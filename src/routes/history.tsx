import { createFileRoute } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/protected-layout";
import { useAdjustments, useDams, useMovements } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEffect, useMemo, useState } from "react";
import { fmtTons, fmtDateTime, type Movement } from "@/lib/types";
import { ArrowDownToLine, ArrowUpFromLine, FileSpreadsheet } from "lucide-react";
import { exportMovementsToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import { MovementEditDialog } from "@/components/movement-edit-dialog";
import { PaginationControls } from "@/components/pagination-controls";
import { RouteError } from "@/components/route-error";

export const Route = createFileRoute("/history")({
  component: () => <ProtectedLayout><HistoryPage /></ProtectedLayout>,
  errorComponent: RouteError,
});

function HistoryPage() {
  const { data: dams = [] } = useDams();
  const { data: adjustments = [] } = useAdjustments();
  const [damId, setDamId] = useState("");
  const [type, setType] = useState<"" | "incoming" | "outgoing">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Movement | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

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

  // Reset to first page when filters/search change
  useEffect(() => { setPage(0); }, [damId, type, from, to, search, pageSize]);

  const paged = useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize]
  );

  const damName = (id: string) => dams.find((d) => d.id === id)?.name ?? "—";

  const handleExport = async (mode: "single" | "all") => {
    try {
      if (mode === "single") {
        if (!damId) { toast.error("Select a dam first"); return; }
        const dam = dams.find((d) => d.id === damId);
        if (!dam) { toast.error("Dam not found"); return; }
        await exportMovementsToExcel({
          dams: [dam], movements: filtered, adjustments: adjustments as any, perDamSheets: false, allDams: dams,
          filename: `FGC_${dam.name.replace(/\s+/g, "")}_${new Date().toISOString().slice(0,10)}.xlsx`,
        });
      } else {
        // Full report: always uses ALL dams + ALL movements (ignore dam filter), so summary is complete.
        await exportMovementsToExcel({
          dams, movements, adjustments: adjustments as any, perDamSheets: true, allDams: dams,
          filename: `FGC_FullReport_${new Date().toISOString().slice(0,10)}.xlsx`,
        });
      }
      toast.success("Excel file exported");
    } catch (e: any) {
      console.error("Excel export failed:", e);
      toast.error(`Export failed: ${e?.message ?? "unknown error"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold">History & Excel export</h1>
        <p className="text-sm text-muted-foreground mt-1">Click any entry to view or edit. Export per dam or full report.</p>
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
          <Button variant="outline" onClick={() => handleExport("single")} disabled={!damId}>
            <FileSpreadsheet className="h-4 w-4" /> Export selected dam
          </Button>
          <Button onClick={() => handleExport("all")}>
            <FileSpreadsheet className="h-4 w-4" /> Export full report (all dams + summary)
          </Button>
        </div>
      </Card>

      <div>
        <div className="text-sm text-muted-foreground mb-3">{filtered.length} movements · click to edit</div>
        {filtered.length > 0 ? (
          <>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow><TableHead>Type</TableHead><TableHead>Quantity</TableHead><TableHead>Dam</TableHead><TableHead>Driver / vehicle</TableHead><TableHead>Date</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer" tabIndex={0} onClick={() => setEditing(m)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(m); } }}>
                      <TableCell className="whitespace-nowrap"><Badge variant="outline" className={m.movement_type === "incoming" ? "text-success" : "text-purple"}>{m.movement_type === "incoming" ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}{m.movement_type}</Badge></TableCell>
                      <TableCell className="font-semibold tabular-nums whitespace-nowrap">{fmtTons(m.quantity_tons)}</TableCell>
                      <TableCell className="whitespace-nowrap">{damName(m.dam_id)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[18rem] truncate">{m.driver_or_company || "—"} · {m.src_vehicle_registration || m.fgc_vehicle_registration || "—"} · {m.fgc_haulier || m.src_haulier || "—"}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{fmtDateTime(m.occurred_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationControls page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </>
        ) : <Card className="p-8 text-center text-sm text-muted-foreground">No movements match.</Card>}
      </div>

      {editing && <MovementEditDialog movement={editing} dams={dams} onClose={() => setEditing(null)} />}
    </div>
  );
}
