import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, requireApiAuth } from "@/lib/api-auth";

const truckPatchSchema = z.object({
  registration_number: z.string().trim().min(1).max(40).optional(),
  driver_name: z.string().trim().min(1).max(120).optional(),
  transporter_company: z.string().trim().min(1).max(160).optional(),
  status: z.enum(["idle", "en_route", "waiting", "offloading"]).optional(),
  deleted_at: z.string().datetime().nullable().optional(),
});

export const Route = createFileRoute("/api/trucks/")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const auth = await requireApiAuth(request, ["admin", "operator"]);
        if (auth.error) return auth.error;
        const parsed = truckPatchSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid truck update", 400);
        if (!auth.roles.includes("admin") && Object.keys(parsed.data).some((key) => key !== "status")) return jsonError("Operators can only update truck status", 403);
        const client = getAuthedClient(auth.token);
        const { data, error } = await client.from("trucks").update(parsed.data).eq("id", params.id).select("*").single();
        if (error) return jsonError(error.message, 400);
        return Response.json({ data });
      },
    },
  },
});
