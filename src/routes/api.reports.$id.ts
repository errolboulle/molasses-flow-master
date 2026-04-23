import { createFileRoute } from "@tanstack/react-router";
import { getAuthedClient, jsonError, logAndJsonError, requireApiAuth } from "@/lib/api-auth";

export const Route = createFileRoute("/api/reports/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireApiAuth(request);
        if (auth.error) return auth.error;
        const client = getAuthedClient(auth.token);
        const { data: report, error } = await (client as any)
          .from("reports")
          .select("*, current_version:current_version_id(*)")
          .eq("id", params.id)
          .single();
        if (error) return logAndJsonError("api/reports/$id GET", error, "Could not load report", 404);
        const [{ data: versions, error: versionsError }, { data: audit, error: auditError }] = await Promise.all([
          (client as any).from("report_versions").select("*").eq("report_id", params.id).order("version_number", { ascending: false }),
          (client as any).from("report_audit_log").select("*").eq("report_id", params.id).order("created_at", { ascending: false }),
        ]);
        if (versionsError || auditError) return logAndJsonError("api/reports/$id related", versionsError || auditError, "Could not load report history");
        return Response.json({ data: { report, versions, audit } });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireApiAuth(request);
        if (auth.error) return auth.error;
        const body = await request.json().catch(() => null);
        const action = body?.action;
        const client = getAuthedClient(auth.token);

        if (action === "delete" || action === "restore") {
          const isDeleted = action === "delete";
          const { data, error } = await (client as any)
            .from("reports")
            .update({ is_deleted: isDeleted })
            .eq("id", params.id)
            .select("*")
            .single();
          if (error) return logAndJsonError("api/reports/$id soft state", error, "Could not update report");
          await (client as any).from("report_audit_log").insert({ report_id: params.id, user_id: auth.userId, action: isDeleted ? "deleted" : "restored", metadata: {} });
          return Response.json({ data });
        }

        if (action === "restoreVersion") {
          const versionId = String(body?.versionId ?? "");
          if (!versionId) return jsonError("Version is required", 400);
          const { data: version, error: versionError } = await (client as any)
            .from("report_versions")
            .select("*")
            .eq("id", versionId)
            .eq("report_id", params.id)
            .single();
          if (versionError) return logAndJsonError("api/reports/$id restore version lookup", versionError, "Version not found", 404);
          const { data, error } = await (client as any)
            .from("reports")
            .update({ current_version_id: version.id, is_deleted: false })
            .eq("id", params.id)
            .select("*")
            .single();
          if (error) return logAndJsonError("api/reports/$id restore version", error, "Could not restore version");
          await (client as any).from("report_audit_log").insert({ report_id: params.id, user_id: auth.userId, action: "updated", metadata: { restored_version_id: version.id, version_number: version.version_number } });
          return Response.json({ data });
        }

        return jsonError("Unsupported report action", 400);
      },
    },
  },
});
