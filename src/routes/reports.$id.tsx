import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Download, FileText, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProtectedLayout } from "@/components/protected-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/types";
import { RouteError } from "@/components/route-error";

export const Route = createFileRoute("/reports/$id")({
  component: () => <ProtectedLayout><ReportDetailPage /></ProtectedLayout>,
  errorComponent: RouteError,
});

type ReportVersion = {
  id: string;
  version_number: number;
  file_path: string;
  file_type: "pdf" | "xlsx" | "docx";
  file_size: number;
  created_at: string;
};

type Report = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  is_deleted: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  current_version?: ReportVersion | null;
};

type AuditEntry = {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const versionSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  file: z.instanceof(File).refine((file) => allowedMimeTypes.includes(file.type), "Only PDF, XLSX, and DOCX files are allowed").refine((file) => file.size > 0 && file.size <= MAX_FILE_SIZE, "File must be 25 MB or smaller"),
});

function ReportDetailPage() {
  const { id } = Route.useParams();
  const { session, isSupervisorOnly } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${session?.access_token ?? ""}` }), [session?.access_token]);

  const loadReport = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/reports/${id}`, { headers: authHeaders });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load report");
      setReport(body.data.report);
      setVersions(body.data.versions ?? []);
      setAudit(body.data.audit ?? []);
      setTitle(body.data.report.title);
      setDescription(body.data.report.description ?? "");
    } catch (error: any) {
      toast.error(error.message ?? "Could not load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadReport(); }, [id, session?.access_token]);

  const downloadVersion = async (versionId?: string) => {
    setWorking(true);
    try {
      const query = versionId ? `?versionId=${versionId}` : "";
      const response = await fetch(`/api/reports/${id}/download${query}`, { headers: authHeaders });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create download link");
      window.open(body.url, "_blank", "noopener,noreferrer");
      await loadReport();
    } catch (error: any) {
      toast.error(error.message ?? "Could not download report");
    } finally {
      setWorking(false);
    }
  };

  const runAction = async (action: "delete" | "restore", versionId?: string) => {
    if (isSupervisorOnly) return;
    setWorking(true);
    try {
      const response = await fetch(`/api/reports/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(versionId ? { action: "restoreVersion", versionId } : { action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not update report");
      toast.success(versionId ? "Version restored" : action === "delete" ? "Report soft-deleted" : "Report restored");
      await loadReport();
    } catch (error: any) {
      toast.error(error.message ?? "Could not update report");
    } finally {
      setWorking(false);
    }
  };

  const uploadVersion = async (event: React.FormEvent) => {
    if (isSupervisorOnly) { event.preventDefault(); return; }
    event.preventDefault();
    const parsed = versionSchema.safeParse({ title, description, file });
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message ?? "Invalid report version"); return; }
    setWorking(true);
    try {
      const form = new FormData();
      form.set("title", parsed.data.title ?? report?.title ?? "Untitled report");
      form.set("description", parsed.data.description ?? "");
      form.set("file", parsed.data.file);
      const response = await fetch(`/api/reports/${id}/versions`, { method: "POST", headers: authHeaders, body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not upload version");
      toast.success("New version saved");
      setFile(null);
      await loadReport();
    } catch (error: any) {
      toast.error(error.message ?? "Could not upload version");
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading report…</div>;
  if (!report) return <Card className="p-8 text-center"><p className="text-sm text-muted-foreground">Report not found.</p><Button asChild className="mt-4"><Link to="/reports">Back to reports</Link></Button></Card>;

  const currentVersion = versions.find((version) => version.id === report.current_version_id) ?? report.current_version ?? versions[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="link" className="px-0"><Link to="/reports">Back to reports</Link></Button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black lg:text-4xl">{report.title}</h1>
            <Badge variant={report.is_deleted ? "destructive" : "outline"}>{report.is_deleted ? "Deleted" : report.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{report.description || "No description"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadVersion(currentVersion?.id)} disabled={working || !currentVersion}><Download /> Download</Button>
          {report.is_deleted ? (
            <Button variant="outline" onClick={() => runAction("restore")} disabled={working || isSupervisorOnly}><RotateCcw /> Restore</Button>
          ) : (
            <Button variant="destructive" onClick={() => runAction("delete")} disabled={working || isSupervisorOnly}><Trash2 /> Soft delete</Button>
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3">
          <FileText className="text-primary" />
          <div>
            <h2 className="font-semibold">Current version preview</h2>
            <p className="text-sm text-muted-foreground">{currentVersion ? `Version ${currentVersion.version_number} • ${currentVersion.file_type.toUpperCase()} • ${formatBytes(currentVersion.file_size)}` : "No version available"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <form onSubmit={uploadVersion} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <fieldset disabled={isSupervisorOnly} className="contents">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className="space-y-2"><Label>New file version</Label><Input type="file" accept=".pdf,.xlsx,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button type="submit" className="w-full" disabled={working}>{working ? <Loader2 className="animate-spin" /> : <Upload />} Save version</Button></div>
          </fieldset>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <h2 className="font-semibold">Version history</h2>
          <div className="mt-4 space-y-3">
            {versions.map((version) => (
              <div key={version.id} className="flex flex-col gap-3 rounded-md border border-input p-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-semibold">Version {version.version_number} {version.id === report.current_version_id && <Badge variant="secondary">Current</Badge>}</p><p className="text-xs text-muted-foreground">{version.file_type.toUpperCase()} • {formatBytes(version.file_size)} • {fmtDateTime(version.created_at)}</p></div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => downloadVersion(version.id)} disabled={working}>Download</Button><Button size="sm" variant="outline" onClick={() => runAction("restore", version.id)} disabled={working || isSupervisorOnly}>Restore version</Button></div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Audit log</h2>
          <div className="mt-4 space-y-3">
            {audit.map((entry) => <div key={entry.id} className="border-b border-input pb-3 last:border-0"><Badge variant="outline">{entry.action}</Badge><p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(entry.created_at)}</p></div>)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
