import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, logAndJsonError, requireApiAuth } from "@/lib/api-auth";

const MAX_REPORT_FILE_SIZE = 25 * 1024 * 1024;
const allowedFiles = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().default(""),
});

function parseReportFile(file: File) {
  const fileType = allowedFiles[file.type as keyof typeof allowedFiles];
  if (!fileType) return { ok: false, error: "Only PDF, XLSX, and DOCX reports are allowed" } as const;
  if (file.size <= 0 || file.size > MAX_REPORT_FILE_SIZE) return { ok: false, error: "Report file must be between 1 byte and 25 MB" } as const;
  return { ok: true, fileType } as const;
}

export const Route = createFileRoute("/api/reports")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request);
        if (auth.error) return auth.error;
        const url = new URL(request.url);
        const showDeleted = url.searchParams.get("showDeleted") === "true";
        const client = getAuthedClient(auth.token);
        let query = (client as any)
          .from("reports")
          .select("*, current_version:current_version_id(*)")
          .order("created_at", { ascending: false });
        if (!showDeleted) query = query.eq("is_deleted", false);
        const { data, error } = await query;
        if (error) return logAndJsonError("api/reports GET", error, "Could not load reports");
        return Response.json({ data });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request);
        if (auth.error) return auth.error;
        const formData = await request.formData();
        const parsed = metadataSchema.safeParse({
          title: formData.get("title"),
          description: formData.get("description") ?? "",
        });
        if (!parsed.success) return jsonError("Invalid report details", 400);
        const file = formData.get("file");
        if (!(file instanceof File)) return jsonError("Report file is required", 400);
        const checked = parseReportFile(file);
        if (!checked.ok) return jsonError(checked.error, 400);

        const client = getAuthedClient(auth.token);
        const { data: report, error: reportError } = await (client as any)
          .from("reports")
          .insert({ user_id: auth.userId, title: parsed.data.title, description: parsed.data.description, status: "active", is_deleted: false })
          .select("*")
          .single();
        if (reportError) return logAndJsonError("api/reports POST report", reportError, "Could not create report");

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
        const filePath = `${auth.userId}/${report.id}/v1-${Date.now()}-${safeName}`;
        const { error: uploadError } = await (client as any).storage.from("reports").upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) return logAndJsonError("api/reports POST upload", uploadError, "Could not store report file");

        const { data: version, error: versionError } = await (client as any)
          .from("report_versions")
          .insert({ report_id: report.id, version_number: 1, file_path: filePath, file_type: checked.fileType, file_size: file.size, created_by: auth.userId })
          .select("*")
          .single();
        if (versionError) return logAndJsonError("api/reports POST version", versionError, "Could not create report version");

        const { error: updateError } = await (client as any).from("reports").update({ current_version_id: version.id }).eq("id", report.id);
        if (updateError) return logAndJsonError("api/reports POST current", updateError, "Could not set current version");

        await (client as any).from("report_audit_log").insert({ report_id: report.id, user_id: auth.userId, action: "created", metadata: { version_id: version.id, file_path: filePath } });
        return Response.json({ data: { ...report, current_version_id: version.id, current_version: version } }, { status: 201 });
      },
    },
  },
});
