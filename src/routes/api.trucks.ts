import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, paginationFromUrl, requireApiAuth } from "@/lib/api-auth";

const truckCreateSchema = z.object({
  registration_number: z.string().trim().min(1).max(40),
  driver_name: z.string().trim().min(1).max(120),
  transporter_company: z.string().trim().min(1).max(160),
  status: z.enum(["idle", "en_route", "waiting", "offloading"]).default("idle"),
});

export const Route = createFileRoute("/api/trucks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin", "operator", "supervisor"]);
        if (auth.error) return auth.error;
        const { from, to } = paginationFromUrl(request);
        const client = getAuthedClient(auth.token);
        const { data, error, count } = await client.from("trucks").select("*", { count: "exact" }).is("deleted_at", null).order("registration_number").range(from, to);
        if (error) return jsonError(error.message, 400);
        return Response.json({ data, count });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin"]);
        if (auth.error) return auth.error;
        const parsed = truckCreateSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid truck details", 400);
        const client = getAuthedClient(auth.token);
        const { data, error } = await client.from("trucks").insert(parsed.data).select("*").single();
        if (error) return jsonError(error.message, 400);
        return Response.json({ data }, { status: 201 });
      },
    },
  },
});
