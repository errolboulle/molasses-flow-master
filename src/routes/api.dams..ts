import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, requireApiAuth } from "@/lib/api-auth";

const damPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  capacity_tons: z.number().positive().nullable().optional(),
  capacity_liters: z.number().positive().nullable().optional(),
  location: z.string().trim().max(255).nullable().optional(),
  status: z.enum(["active", "maintenance"]).optional(),
  deleted_at: z.string().datetime().nullable().optional(),
});

export const Route = createFileRoute("/api/dams/")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await requireApiAuth(request, ["admin", "operator", "supervisor"]);
        if (auth.error) return auth.error;
        const client = getAuthedClient(auth.token);
        const { data, error } = await client.from("dams").select("*").eq("id", params.id).is("deleted_at", null).single();
        if (error) return jsonError(error.message, 404);
        return Response.json({ data });
      },
      PATCH: async ({ request, params }) => {
        const auth = await requireApiAuth(request, ["admin"]);
        if (auth.error) return auth.error;
        const parsed = damPatchSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid dam update", 400);
        const client = getAuthedClient(auth.token);
        const { data, error } = await client.from("dams").update(parsed.data).eq("id", params.id).select("*").single();
        if (error) return jsonError(error.message, 400);
        return Response.json({ data });
      },
    },
  },
});
