import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ProtectedLayout } from "@/components/protected-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useDams } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelImport, findExistingDuplicates, type ParsedRow, type DuplicateInfo } from "@/lib/excel-import";
import { forceInsertMovement } from "@/lib/movement-duplicates";
import { fmtNum } from "@/lib/types";

export const Route = createFileRoute("/import")({
  component: () => <ProtectedLayout><ImportPage /></ProtectedLayout>,
});

async function fetchAllMovementRefs() {
  const cols = "src_delivery_note,fgc_consignment_note_number,fgc_zsm_weighbridge_number,src_mill_number,src_sample_number,fgc_date_of_arrival,src_date_of_departure,occurred_at,fgc_vehicle_registration,src_vehicle_registration";
  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  // Loop pages until fewer than pageSize rows are returned
  // Supabase caps at 1000 per request — paginate explicitly to cover all rows
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("movements")
      .select(cols)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function ImportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: dams = [] } = useDams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dupes, setDupes] = useState<Map<number, DuplicateInfo>>(new Map());
  const [approvedDupes, setApprovedDupes] = useState<Set<number>>(new Set());

  const newRows = useMemo(() => rows.map((r, i) => ({ r, i })).filter(({ i }) => !dupes.has(i)), [rows, dupes]);
  const approvedRows = useMemo(() => rows.map((r, i) => ({ r, i })).filter(({ i }) => dupes.has(i) && approvedDupes.has(i)), [rows, dupes, approvedDupes]);
  const totalToImport = newRows.length + approvedRows.length;

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const { rows: parsed, warnings: w } = parseExcelImport(buf, dams);
      const existing = await fetchAllMovementRefs();
      const d = findExistingDuplicates(parsed, existing);
      setRows(parsed);
      setWarnings(w);
      setDupes(d);
      if (parsed.length === 0) {
        toast.warning("No movement rows found in this file");
      } else {
        toast.success(`Parsed ${parsed.length} rows — ${parsed.length - d.size} new, ${d.size} already logged`);
      }
    } catch (e: any) {
      toast.error(`Failed to parse file: ${e.message ?? e}`);
      setRows([]);
      setDupes(new Map());
    } finally {
      setParsing(false);
    }
  };

  const reset = () => {
    setFileName(null);
    setRows([]);
    setWarnings([]);
    setDupes(new Map());
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleImport = async () => {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    if (newRows.length === 0) {
      toast.warning("No new movements to import");
      return;
    }
    setImporting(true);
    let inserted = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of newRows) {
      const payload = {
        dam_id: row.damId,
        movement_type: row.movementType,
        occurred_at: row.fgc_date_of_arrival
          ? new Date(`${row.fgc_date_of_arrival}T${row.fgc_time ?? "00:00:00"}`).toISOString()
          : new Date().toISOString(),
        quantity_tons: row.fgc_net_mass,
        created_by: user.id,
        src_date_of_departure: row.src_date_of_departure,
        src_time: row.src_time,
        src_vehicle_registration: row.src_vehicle_registration,
        src_haulier: row.src_haulier,
        src_delivery_note: row.src_delivery_note,
        src_mill_number: row.src_mill_number,
        src_mill: row.src_mill,
        src_gross_mass: row.src_gross_mass,
        src_tare_mass: row.src_tare_mass,
        src_net_mass: row.src_net_mass,
        src_molasses_temperature: row.src_molasses_temperature,
        src_sample_number: row.src_sample_number,
        fgc_date_of_arrival: row.fgc_date_of_arrival,
        fgc_time: row.fgc_time,
        fgc_vehicle_registration: row.fgc_vehicle_registration,
        fgc_haulier: row.fgc_haulier,
        fgc_consignment_note_number: row.fgc_consignment_note_number,
        fgc_zsm_weighbridge_number: row.fgc_zsm_weighbridge_number,
        fgc_gross_mass: row.fgc_gross_mass,
        fgc_tare_mass: row.fgc_tare_mass,
        fgc_net_mass: row.fgc_net_mass,
        fgc_variance: row.fgc_variance,
        fgc_brix: row.fgc_brix,
        fgc_in_out: row.fgc_in_out ?? (row.movementType === "incoming" ? "IN" : "OUT"),
        fgc_zsm_operator: row.fgc_zsm_operator,
        fgc_in: row.movementType === "incoming" ? row.fgc_net_mass : null,
        fgc_out: row.movementType === "outgoing" ? row.fgc_net_mass : null,
        fgc_net: row.fgc_net_mass,
      };
      const { error } = await supabase.from("movements").insert(payload);
      if (error) {
        failed++;
        errors.push(`${row.damName} row ${row.sheetRow}: ${error.message}`);
      } else {
        inserted++;
      }
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["movements"] }),
      qc.invalidateQueries({ queryKey: ["dams"] }),
    ]);

    if (failed === 0) {
      toast.success(`Imported ${inserted} new movement${inserted === 1 ? "" : "s"}`);
      reset();
    } else {
      toast.error(`Imported ${inserted}, ${failed} failed`);
      setWarnings((prev) => [...prev, ...errors]);
    }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import from Excel</h1>
        <p className="text-sm text-muted-foreground">Upload a molasses report sheet — only new movements are added. Already-logged rows are skipped.</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border p-10 text-center">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">{fileName ?? "Choose an Excel file"}</p>
            <p className="text-xs text-muted-foreground">Sheets must match dam names (Dam 1, Dam 2, Dam 3 …)</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={parsing || importing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {fileName ? "Choose another file" : "Select file"}
            </Button>
            {fileName && (
              <Button variant="outline" onClick={reset} disabled={importing}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Total parsed</div>
              <div className="mt-1 text-2xl font-bold">{rows.length}</div>
            </Card>
            <Card className="p-4 border-success/40">
              <div className="text-xs uppercase text-success">New (will import)</div>
              <div className="mt-1 text-2xl font-bold text-success">{newRows.length}</div>
            </Card>
            <Card className="p-4 border-muted">
              <div className="text-xs uppercase text-muted-foreground">Already logged (skip)</div>
              <div className="mt-1 text-2xl font-bold">{dupes.size}</div>
            </Card>
          </div>

          {warnings.length > 0 && (
            <Card className="border-warning/50 bg-warning/5 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-warning" />
                <div className="text-sm space-y-1">
                  <div className="font-semibold">Warnings</div>
                  {warnings.map((w, i) => <div key={i} className="text-muted-foreground">{w}</div>)}
                </div>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="font-semibold">Preview</div>
              <Button onClick={handleImport} disabled={importing || newRows.length === 0}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Import {newRows.length} new movement{newRows.length === 1 ? "" : "s"}
              </Button>
            </div>
            <ScrollArea className="h-[480px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Dam</th>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Vehicle</th>
                    <th className="px-3 py-2">Delivery Note</th>
                    <th className="px-3 py-2">Sample #</th>
                    <th className="px-3 py-2 text-right">FGC Net (t)</th>
                    <th className="px-3 py-2">Reason skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const dup = dupes.get(i);
                    return (
                      <tr key={i} className={`border-t border-border ${dup ? "bg-muted/40 text-muted-foreground" : ""}`}>
                        <td className="px-3 py-2">
                          {dup ? <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Skip</Badge>
                            : <Badge className="gap-1 bg-success/20 text-success border-success/40"><CheckCircle2 className="h-3 w-3" /> New</Badge>}
                        </td>
                        <td className="px-3 py-2">{r.damName}</td>
                        <td className="px-3 py-2">{r.sheetRow}</td>
                        <td className="px-3 py-2">{r.fgc_date_of_arrival ?? r.src_date_of_departure ?? "—"}</td>
                        <td className="px-3 py-2 capitalize">{r.movementType}</td>
                        <td className="px-3 py-2">{r.fgc_vehicle_registration ?? r.src_vehicle_registration ?? "—"}</td>
                        <td className="px-3 py-2">{r.src_delivery_note ?? "—"}</td>
                        <td className="px-3 py-2">{r.src_sample_number ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.fgc_net_mass)}</td>
                        <td className="px-3 py-2">{dup ? `${dup.field} = ${dup.value}${dup.location ?? ""}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  );
}
