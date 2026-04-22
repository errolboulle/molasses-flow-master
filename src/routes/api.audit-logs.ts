import { createFileRoute } from "@tanstack/react-router";
import { getAuthedClient, jsonError, paginationFromUrl, requireApiAuth } from "@/lib/api-auth";

export const Route = createFileRoute("/api/audit-logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin", "supervisor"]);
        if (auth.error) return auth.error;
        const { url, from, to } = paginationFromUrl(request);
        const client = getAuthedClient(auth.token);
        let query = client.from("audit_logs").select("*", { count: "exact" }).order("timestamp", { ascending: false });
        const action = url.searchParams.get("action");
        const entityType = url.searchParams.get("entity_type");
        const fromDate = url.searchParams.get("from");
        const toDate = url.searchParams.get("to");
        if (action) query = query.eq("action", action);
        if (entityType) query = query.eq("entity_type", entityType);
        if (fromDate) query = query.gte("timestamp", fromDate);
        if (toDate) query = query.lte("timestamp", toDate);
        const { data, error, count } = await query.range(from, to);
        if (error) return jsonError(error.message, 400);
        return Response.json({ data, count });
      },
    },
  },
});
