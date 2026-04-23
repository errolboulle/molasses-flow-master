import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { FileText, Loader2, Plus, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProtectedLayout } from "@/components/protected-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/types";

export const Route = createFileRoute("/reports")({
  component: () => <ProtectedLayout><ReportsPage /></ProtectedLayout>,
});

type ReportRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  current_version?: ReportVersion | null;
};

type ReportVersion = {
  id: string;
  version_number: number;
  file_type: "pdf" | "xlsx" | "docx";
  file_size: number;
  created_at: string;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const uploadSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(1000).optional(),
  file: z.instanceof(File).refine((file) => allowedMimeTypes.includes(file.type), "Only PDF, XLSX, and DOCX files are allowed").refine((file) => file.size > 0 && file.size <= MAX_FILE_SIZE, "File must be 25 MB or smaller"),
});

function ReportsPage() {
  const { session } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${session?.access_token ?? ""}` }), [session?.access_token]);

  const loadReports = async (includeDeleted = showDeleted) => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/reports?showDeleted=${includeDeleted}`, { headers: authHeaders });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load reports");
      setReports(body.data ?? []);
    } catch (error: any) {
      toast.error(error.message ?? "Could not load reports");
    } finally {
      setLoading(false);
    }
  };

  useState(() => { void loadReports(false); });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = uploadSchema.safeParse({ title, description, file });
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message ?? "Invalid report"); return; }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("title", parsed.data.title);
      form.set("description", parsed.data.description ?? "");
      form.set("file", parsed.data.file);
      const response = await fetch("/api/reports", { method: "POST", headers: authHeaders, body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create report");
      toast.success("Report saved with version 1");
      setTitle("");
      setDescription("");
      setFile(null);
      await loadReports(showDeleted);
    } catch (error: any) {
      toast.error(error.message ?? "Could not create report");
    } finally {
      setSaving(false);
    }
  };

  const toggleDeleted = (checked: boolean) => {
    setShowDeleted(checked);
    void loadReports(checked);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Private report vault</p>
          <h1 className="mt-1 text-3xl font-black lg:text-4xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every file is versioned, private, and retained.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
          <Switch checked={showDeleted} onCheckedChange={toggleDeleted} id="show-deleted" />
          <Label htmlFor="show-deleted" className="text-sm">Show deleted</Label>
        </div>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Monthly molasses reconciliation" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional report notes" />
          </div>
          <div className="space-y-2">
            <Label>PDF / XLSX / DOCX</Label>
            <Input type="file" accept=".pdf,.xlsx,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="animate-spin" /> : <Upload />} Save report
            </Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading reports…</Card>
      ) : reports.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No reports found.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <FileText className="mt-1 text-primary" />
                <Badge variant={report.is_deleted ? "destructive" : "outline"}>{report.is_deleted ? "Deleted" : report.status}</Badge>
              </div>
              <h2 className="mt-4 text-lg font-bold">{report.title}</h2>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{report.description || "No description"}</p>
              <div className="mt-4 text-xs text-muted-foreground">
                <p>Current version: {report.current_version ? `v${report.current_version.version_number} ${report.current_version.file_type.toUpperCase()}` : "None"}</p>
                <p>Updated: {fmtDateTime(report.updated_at)}</p>
              </div>
              <Button asChild className="mt-4 w-full" variant="outline">
                <Link to="/reports/$id" params={{ id: report.id }}>Open report</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
