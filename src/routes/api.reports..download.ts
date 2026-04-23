import { createFileRoute } from "@tanstack/react-router";
import { getAuthedClient, jsonError, logAndJsonError, requireApiAuth } from "@/lib/api-auth";

export const Route = createFileRoute("/api/reports/download")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireApiAuth(request);
        if (auth.error) return auth.error;
        const url = new URL(request.url);
        const versionId = url.searchParams.get("versionId");
        const client = getAuthedClient(auth.token);
        let query = (client as any).from("report_versions").select("*").eq("report_id", params.id);
        if (versionId) query = query.eq("id", versionId);
        else query = query.order("version_number", { ascending: false }).limit(1);
        const { data: version, error } = await query.single();
        if (error || !version) return jsonError("Report version not found", 404);
        const { data, error: signedError } = await (client as any).storage.from("reports").createSignedUrl(version.file_path, 60);
        if (signedError) return logAndJsonError("api/reports/$id/download signed", signedError, "Could not create secure download link");
        await (client as any).from("report_audit_log").insert({ report_id: params.id, user_id: auth.userId, action: "downloaded", metadata: { version_id: version.id, version_number: version.version_number } });
        return Response.json({ url: data.signedUrl, expiresIn: 60 });
      },
    },
  },
});
