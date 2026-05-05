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
import { extractScannedDocument } from "@/server/scan.functions";
import { findDuplicateMovementReference, formatDuplicateMessage, forceInsertMovement } from "@/lib/movement-duplicates";

export const Route = createFileRoute("/scan")({
  component: () => (
    <ProtectedLayout>
      <ScanPage />
    </ProtectedLayout>
  ),
});

type ExtractedFields = Record<string, any>;

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

function ScanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dams = [] } = useDams();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<ExtractedFields | null>(null);
  const [movementType, setMovementType] = useState<"incoming" | "outgoing">("incoming");
  const [damId, setDamId] = useState("");
  const [notes, setNotes] = useState("");

  const handleFile = async (f: File) => {
    setFile(f);
    setIsPdf(f.type === "application/pdf");
    setPreviewUrl(URL.createObjectURL(f));
    setFields(null);
  };

  const handleExtract = async () => {
    if (!file) return;
    if (file.type === "application/pdf") {
      toast.error("PDF detected — OCR works best on images. Please upload a photo/screenshot of the page.");
      return;
    }
    setExtracting(true);
    try {
      const b64 = await fileToBase64(file);
      const { fields: extracted } = await extractScannedDocument({ data: { imageBase64: b64, mimeType: file.type } });
      setFields(extracted || {});
      if (extracted?.movement_type === "outgoing") setMovementType("outgoing");
      if (extracted?.notes) setNotes(extracted.notes);
      toast.success("Document scanned. Please review every field before saving.");
    } catch (e: any) {
      toast.error(e?.message || "Could not extract document");
    } finally {
      setExtracting(false);
    }
  };

  const setField = (k: string, v: any) => setFields((p) => ({ ...(p || {}), [k]: v }));

  const handleSave = async () => {
    if (!fields) return;
    if (!damId) { toast.error("Select a dam"); return; }
    const qty = Number(fields.fgc_net_mass);
    if (!qty || qty <= 0) { toast.error("FGC Net mass is required and must be > 0"); return; }
    setSaving(true);
    try {
      // upload image
      let scanUrl: string | null = null;
      if (file) {
        const path = `${user?.id || "anon"}/${Date.now()}-${file.name}`.replace(/\s+/g, "_");
        const { error: upErr } = await supabase.storage.from("scanned-documents").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        scanUrl = path;
      }

      const payload: Record<string, any> = {
        dam_id: damId,
        movement_type: movementType,
        occurred_at: new Date().toISOString(),
        quantity_tons: qty,
        notes: notes || null,
        fgc_in_out: movementType === "incoming" ? "In" : "Out",
        scanned_document_url: scanUrl,
        ...fields,
      };
      // strip empty strings
      for (const k of Object.keys(payload)) if (payload[k] === "") payload[k] = null;

      // duplicate check
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScanLine className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Scan Document</h1>
          <p className="text-sm text-muted-foreground">Upload or photograph a delivery / weighbridge document. Review every field before saving.</p>
        </div>
      </div>

      {!fields && (
        <Card className="p-6">
          {!previewUrl ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <p className="text-sm text-muted-foreground">Take a photo or upload an image / PDF</p>
              <div className="flex flex-wrap gap-3 justify-center">
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <Button onClick={() => cameraRef.current?.click()}><Camera className="h-4 w-4" /> Take photo</Button>
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Upload file</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border bg-muted/30 max-h-[60vh] flex items-center justify-center">
                {isPdf ? (
                  <div className="flex items-center gap-2 p-10 text-muted-foreground"><FileText className="h-8 w-8" /> {file?.name}</div>
                ) : (
                  <img src={previewUrl} alt="Scan preview" className="max-h-[60vh] object-contain" />
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setFile(null); setPreviewUrl(null); }}>Change file</Button>
                <Button onClick={handleExtract} disabled={extracting}>
                  {extracting ? <><Loader2 className="h-4 w-4 animate-spin" /> Extracting…</> : <>Extract data</>}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {fields && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-4 lg:sticky lg:top-4 self-start">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Original document</h3>
              <Badge variant="outline">Reference only</Badge>
            </div>
            {previewUrl && !isPdf ? (
              <img src={previewUrl} alt="Scan" className="w-full rounded-lg border max-h-[75vh] object-contain bg-muted/30" />
            ) : (
              <div className="p-10 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2" /> {file?.name}</div>
            )}
          </Card>

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
                  <select className="flex h-11 w-full rounded-xl border border-input bg-secondary/35 px-3 text-sm" value={movementType} onChange={(e) => setMovementType(e.target.value as any)}>
                    <option value="incoming">Incoming (IN)</option>
                    <option value="outgoing">Outgoing (OUT)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dam *</Label>
                  <select className="flex h-11 w-full rounded-xl border border-input bg-secondary/35 px-3 text-sm" value={damId} onChange={(e) => setDamId(e.target.value)}>
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
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {fields.raw_text && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Raw OCR text</summary>
                  <pre className="mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap">{fields.raw_text}</pre>
                </details>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-5 pt-4 border-t">
              <Button variant="outline" onClick={() => { setFields(null); setFile(null); setPreviewUrl(null); }} disabled={saving}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Check className="h-4 w-4" /> Confirm & Save</>}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
