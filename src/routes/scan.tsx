import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Camera, Upload, Loader2, Check, X, ScanLine, FileText } from "lucide-react";
import { toast } from "sonner";
import { ProtectedLayout } from "@/components/protected-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDams } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { extractScannedDocument } from "@/lib/scan.functions";
import { findDuplicateMovementReference, formatDuplicateMessage, forceInsertMovement } from "@/lib/movement-duplicates";
import { RouteError } from "@/components/route-error";

export const Route = createFileRoute("/scan")({
  component: () => (
    <ProtectedLayout>
      <ScanPage />
    </ProtectedLayout>
  ),
  errorComponent: RouteError,
});

type ExtractedFields = Record<string, any>;
type SlipKind = "mill" | "fgc";

const FIELDS: { key: string; label: string; type: "text" | "number" | "date" | "time" }[] = [
  { key: "src_date_of_departure", label: "SRC Date of departure", type: "date" },
  { key: "src_time", label: "SRC Time", type: "time" },
  { key: "src_vehicle_registration", label: "SRC Vehicle registration", type: "text" },
  { key: "src_haulier", label: "SRC Haulier", type: "text" },
  { key: "src_delivery_note", label: "SRC Delivery note", type: "text" },
  { key: "src_mill_number", label: "SRC Mill number", type: "text" },
  { key: "src_mill", label: "SRC Mill", type: "text" },
  { key: "src_gross_mass", label: "SRC Gross mass (t)", type: "number" },
  { key: "src_tare_mass", label: "SRC Tare mass (t)", type: "number" },
  { key: "src_net_mass", label: "SRC Net mass (t)", type: "number" },
  { key: "src_sample_number", label: "SRC Sample number", type: "text" },
  { key: "fgc_date_of_arrival", label: "FGC Date of arrival", type: "date" },
  { key: "fgc_time", label: "FGC Time", type: "time" },
  { key: "fgc_vehicle_registration", label: "FGC Vehicle registration", type: "text" },
  { key: "fgc_haulier", label: "FGC Haulier", type: "text" },
  { key: "fgc_consignment_note_number", label: "FGC Consignment note", type: "text" },
  { key: "fgc_zsm_weighbridge_number", label: "FGC ZSM weighbridge no.", type: "text" },
  { key: "fgc_gross_mass", label: "FGC Gross mass (t)", type: "number" },
  { key: "fgc_tare_mass", label: "FGC Tare mass (t)", type: "number" },
  { key: "fgc_net_mass", label: "FGC Net mass (t)", type: "number" },
  { key: "fgc_brix", label: "FGC Brix", type: "number" },
  { key: "fgc_zsm_operator", label: "FGC ZSM operator", type: "text" },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const str = String(r.result || "");
      resolve(str.split(",")[1] || "");
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Slips print dates as YEAR-MONTH-DAY. Normalize any reasonable variant to ISO YYYY-MM-DD.
function normalizeYmd(v: any): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{2}|\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) return s;
  let [, y, mo, d] = m;
  if (y.length === 2) y = "20" + y;
  const mm = mo.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

const DATE_KEYS = ["src_date_of_departure", "fgc_date_of_arrival"];

type SlipState = { file: File | null; previewUrl: string | null; isPdf: boolean };
const emptySlip: SlipState = { file: null, previewUrl: null, isPdf: false };

function ScanPage() {
  const navigate = useNavigate();
  const { user, isSupervisorOnly } = useAuth();
  const { data: dams = [] } = useDams();

  const millCamRef = useRef<HTMLInputElement>(null);
  const millFileRef = useRef<HTMLInputElement>(null);
  const fgcCamRef = useRef<HTMLInputElement>(null);
  const fgcFileRef = useRef<HTMLInputElement>(null);

  const [mill, setMill] = useState<SlipState>(emptySlip);
  const [fgc, setFgc] = useState<SlipState>(emptySlip);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [movementType, setMovementType] = useState<"incoming" | "outgoing">("incoming");
  const [damId, setDamId] = useState("");
  const [notes, setNotes] = useState("");

  const setSlip = (which: SlipKind, f: File) => {
    const state: SlipState = { file: f, previewUrl: URL.createObjectURL(f), isPdf: f.type === "application/pdf" };
    if (which === "mill") setMill(state); else setFgc(state);
    setFields(null);
  };

  const clearSlip = (which: SlipKind) => {
    if (which === "mill") setMill(emptySlip); else setFgc(emptySlip);
  };

  const hasAny = !!(mill.file || fgc.file);

  const handleExtract = async () => {
    if (isSupervisorOnly) return;
    if (!hasAny) return;
    if (mill.isPdf || fgc.isPdf) {
      toast.error("PDF detected — OCR works best on images. Please upload photos/screenshots.");
      return;
    }
    setExtracting(true);
    try {
      const merged: ExtractedFields = {};
      if (mill.file) {
        const b64 = await fileToBase64(mill.file);
        const { fields: ex } = await extractScannedDocument({ data: { imageBase64: b64, mimeType: mill.file.type, slipType: "mill" } });
        for (const k of Object.keys(ex || {})) if (ex[k] != null && ex[k] !== "") merged[k] = ex[k];
      }
      if (fgc.file) {
        const b64 = await fileToBase64(fgc.file);
        const { fields: ex } = await extractScannedDocument({ data: { imageBase64: b64, mimeType: fgc.file.type, slipType: "fgc" } });
        // FGC values take priority for fgc_* fields; non-empty wins
        for (const k of Object.keys(ex || {})) if (ex[k] != null && ex[k] !== "") merged[k] = ex[k];
      }
      setFields(merged);
      for (const k of DATE_KEYS) if (merged[k]) merged[k] = normalizeYmd(merged[k]);
      if (merged?.movement_type === "outgoing") setMovementType("outgoing");
      if (merged?.notes) setNotes(merged.notes);
      toast.success("Documents scanned. Please review every field before saving.");
    } catch (e: any) {
      toast.error(e?.message || "Could not extract document");
    } finally {
      setExtracting(false);
    }
  };

  const setField = (k: string, v: any) => setFields((p) => ({ ...(p || {}), [k]: v }));

  const handleSave = async () => {
    if (isSupervisorOnly || !user) return;
    if (!fields) return;
    if (!damId) { toast.error("Select a dam"); return; }
    const qty = Number(fields.fgc_net_mass);
    if (!qty || qty <= 0) { toast.error("FGC Net mass is required and must be > 0"); return; }
    setSaving(true);
    try {
      // Upload first available slip image (prefer FGC, fall back to mill)
      let scanUrl: string | null = null;
      const uploadFile = fgc.file || mill.file;
      if (uploadFile) {
        const path = `${user?.id || "anon"}/${Date.now()}-${uploadFile.name}`.replace(/\s+/g, "_");
        const { error: upErr } = await supabase.storage.from("scanned-documents").upload(path, uploadFile, { upsert: false });
        if (upErr) throw upErr;
        scanUrl = path;
      }

      const allowedFromFields = new Set(FIELDS.map((f) => f.key));
      const cleanFields: Record<string, any> = {};
      for (const k of Object.keys(fields)) if (allowedFromFields.has(k)) cleanFields[k] = fields[k];

      const payload: Record<string, any> = {
        ...cleanFields,
        dam_id: damId,
        movement_type: movementType,
        occurred_at: new Date().toISOString(),
        quantity_tons: qty,
        notes: notes || null,
        fgc_in_out: movementType === "incoming" ? "In" : "Out",
        scanned_document_url: scanUrl,
      };
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;

      const stringForm: Record<string, string> = {};
      for (const k of Object.keys(payload)) stringForm[k] = payload[k] == null ? "" : String(payload[k]);
      const dup = await findDuplicateMovementReference(stringForm);
      if (dup) {
        const ok = window.confirm(`${formatDuplicateMessage(dup)}\n\nSave anyway?`);
        if (!ok) { setSaving(false); return; }
        await forceInsertMovement(payload);
      } else {
        const { error } = await supabase.from("movements").insert(payload as any);
        if (error) throw error;
      }
      toast.success("Movement saved from scan");
      navigate({ to: "/history" });
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const renderSlipCard = (
    which: SlipKind,
    title: string,
    subtitle: string,
    state: SlipState,
    camRef: React.RefObject<HTMLInputElement | null>,
    fileRef: React.RefObject<HTMLInputElement | null>,
  ) => (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {state.file && <Badge variant="outline">Ready</Badge>}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && setSlip(which, e.target.files[0])} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && setSlip(which, e.target.files[0])} />
      {!state.previewUrl ? (
        <div className="flex flex-col items-center gap-3 py-8 border border-dashed rounded-lg">
          <p className="text-xs text-muted-foreground">No photo yet</p>
          <div className="flex gap-2">
            <Button disabled={isSupervisorOnly} size="sm" onClick={() => camRef.current?.click()}><Camera className="h-4 w-4" /> Take photo</Button>
            <Button disabled={isSupervisorOnly} size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Upload</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden border bg-muted/30 max-h-[40vh] flex items-center justify-center">
            {state.isPdf ? (
              <div className="flex items-center gap-2 p-8 text-muted-foreground"><FileText className="h-6 w-6" /> {state.file?.name}</div>
            ) : (
              <img src={state.previewUrl} alt={`${title} preview`} className="max-h-[40vh] object-contain" />
            )}
          </div>
          <div className="flex justify-end">
            <Button disabled={isSupervisorOnly} size="sm" variant="outline" onClick={() => clearSlip(which)}>Replace</Button>
          </div>
        </div>
      )}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScanLine className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Scan Document</h1>
          <p className="text-sm text-muted-foreground">Scan the Mill slip and the FGC weighbridge slip. You can upload either or both — fields from each will be merged for review.</p>
        </div>
      </div>

      {!fields && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderSlipCard("mill", "Mill slip (SRC)", "Source mill / departure document", mill, millCamRef, millFileRef)}
            {renderSlipCard("fgc", "FGC slip", "FGC weighbridge / arrival document", fgc, fgcCamRef, fgcFileRef)}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleExtract} disabled={!hasAny || extracting || isSupervisorOnly}>
              {extracting ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : <>Extract data from {mill.file && fgc.file ? "both slips" : "slip"}</>}
            </Button>
          </div>
        </>
      )}

      {fields && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4 lg:sticky lg:top-4 self-start">
            {mill.file && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Mill slip</h3>
                  <Badge variant="outline">Reference</Badge>
                </div>
                {mill.previewUrl && !mill.isPdf ? (
                  <img src={mill.previewUrl} alt="Mill slip" className="w-full rounded-lg border max-h-[40vh] object-contain bg-muted/30" />
                ) : (
                  <div className="p-6 text-center text-muted-foreground"><FileText className="h-6 w-6 mx-auto mb-2" /> {mill.file?.name}</div>
                )}
              </Card>
            )}
            {fgc.file && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">FGC slip</h3>
                  <Badge variant="outline">Reference</Badge>
                </div>
                {fgc.previewUrl && !fgc.isPdf ? (
                  <img src={fgc.previewUrl} alt="FGC slip" className="w-full rounded-lg border max-h-[40vh] object-contain bg-muted/30" />
                ) : (
                  <div className="p-6 text-center text-muted-foreground"><FileText className="h-6 w-6 mx-auto mb-2" /> {fgc.file?.name}</div>
                )}
              </Card>
            )}
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Review & edit extracted data</h3>
              <Badge>Mandatory review</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Correct any mistakes. Nothing is saved until you confirm below.</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Movement type *</Label>
                  <select disabled={isSupervisorOnly} className="flex h-11 w-full rounded-xl border border-input bg-secondary/35 px-3 text-sm" value={movementType} onChange={(e) => setMovementType(e.target.value as any)}>
                    <option value="incoming">Incoming (IN)</option>
                    <option value="outgoing">Outgoing (OUT)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dam *</Label>
                  <select disabled={isSupervisorOnly} className="flex h-11 w-full rounded-xl border border-input bg-secondary/35 px-3 text-sm" value={damId} onChange={(e) => setDamId(e.target.value)}>
                    <option value="">Select dam…</option>
                    {dams.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      type={f.type}
                      step={f.type === "number" ? "0.001" : undefined}
                      value={fields[f.key] ?? ""}
                      onChange={(e) => setField(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea disabled={isSupervisorOnly} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {fields.raw_text && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Raw OCR text</summary>
                  <pre className="mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap">{fields.raw_text}</pre>
                </details>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5 pt-4 border-t">
              <Button variant="outline" onClick={() => { setFields(null); }} disabled={saving}>
                <X className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSave} disabled={saving || isSupervisorOnly}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Check className="h-4 w-4" /> Confirm & Save</>}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
