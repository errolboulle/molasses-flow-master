import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, logAndJsonError, paginationFromUrl, requireApiAuth } from "@/lib/api-auth";

const damCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  capacity_tons: z.number().positive().optional(),
  capacity_liters: z.number().positive().optional(),
  current_volume_tons: z.number().min(0).default(0),
  current_volume_liters: z.number().min(0).default(0),
  location: z.string().trim().max(255).optional(),
  status: z.enum(["active", "maintenance"]).default("active"),
});

export const Route = createFileRoute("/api/dams")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin", "operator", "supervisor"]);
        if (auth.error) return auth.error;
        const { from, to } = paginationFromUrl(request);
        const client = getAuthedClient(auth.token);
        const { data, error, count } = await client.from("dams").select("*", { count: "exact" }).is("deleted_at", null).order("name").range(from, to);
        if (error) return logAndJsonError("api/dams GET", error, "Could not load dams");
        return Response.json({ data, count });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin"]);
        if (auth.error) return auth.error;
        const parsed = damCreateSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid dam details", 400);
        const client = getAuthedClient(auth.token);
        const { data, error } = await client.from("dams").insert(parsed.data).select("*").single();
        if (error) return logAndJsonError("api/dams POST", error, "Could not create dam");
        return Response.json({ data }, { status: 201 });
      },
    },
  },
});
