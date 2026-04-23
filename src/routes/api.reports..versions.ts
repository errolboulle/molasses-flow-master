import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, logAndJsonError, requireApiAuth } from "@/lib/api-auth";

const MAX_REPORT_FILE_SIZE = 25 * 1024 * 1024;
const allowedFiles = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

const schema = z.object({ title: z.string().trim().min(1).max(160).optional(), description: z.string().trim().max(1000).optional() });

export const Route = createFileRoute("/api/reports/versions")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = await requireApiAuth(request);
        if (auth.error) return auth.error;
        const formData = await request.formData();
        const parsed = schema.safeParse({ title: formData.get("title") || undefined, description: formData.get("description") || undefined });
        if (!parsed.success) return jsonError("Invalid report details", 400);
        const file = formData.get("file");
        if (!(file instanceof File)) return jsonError("Report file is required", 400);
        const fileType = allowedFiles[file.type as keyof typeof allowedFiles];
        if (!fileType) return jsonError("Only PDF, XLSX, and DOCX reports are allowed", 400);
        if (file.size <= 0 || file.size > MAX_REPORT_FILE_SIZE) return jsonError("Report file must be between 1 byte and 25 MB", 400);

        const client = getAuthedClient(auth.token);
        const { data: latest, error: latestError } = await (client as any)
          .from("report_versions")
          .select("version_number")
          .eq("report_id", params.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestError) return logAndJsonError("api/reports/$id/versions latest", latestError, "Could not read latest version");
        const nextVersion = Number(latest?.version_number ?? 0) + 1;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
        const filePath = `${auth.userId}/${params.id}/v${nextVersion}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await (client as any).storage.from("reports").upload(filePath, file, { contentType: file.type, upsert: false });
        if (uploadError) return logAndJsonError("api/reports/$id/versions upload", uploadError, "Could not store report file");

        const { data: version, error: versionError } = await (client as any)
          .from("report_versions")
          .insert({ report_id: params.id, version_number: nextVersion, file_path: filePath, file_type: fileType, file_size: file.size, created_by: auth.userId })
          .select("*")
          .single();
        if (versionError) return logAndJsonError("api/reports/$id/versions insert", versionError, "Could not create report version");

        const updatePayload = { current_version_id: version.id, is_deleted: false, ...parsed.data };
        const { error: updateError } = await (client as any).from("reports").update(updatePayload).eq("id", params.id);
        if (updateError) return logAndJsonError("api/reports/$id/versions current", updateError, "Could not update current version");
        await (client as any).from("report_audit_log").insert({ report_id: params.id, user_id: auth.userId, action: "updated", metadata: { version_id: version.id, version_number: nextVersion, file_path: filePath } });
        return Response.json({ data: version }, { status: 201 });
      },
    },
  },
});
