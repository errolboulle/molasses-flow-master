import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAuthedClient, jsonError, paginationFromUrl, requireApiAuth } from "@/lib/api-auth";

const loadCreateSchema = z.object({
  truck_id: z.string().uuid(),
  dam_id: z.string().uuid(),
  type: z.enum(["incoming", "outgoing"]),
  weight_tons: z.number().positive(),
  volume_liters: z.number().positive(),
  timestamp: z.string().datetime().optional(),
  status: z.enum(["pending", "completed", "cancelled"]).default("completed"),
});

export const Route = createFileRoute("/api/loads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin", "operator", "supervisor"]);
        if (auth.error) return auth.error;
        const { url, from, to } = paginationFromUrl(request);
        const client = getAuthedClient(auth.token);
        let query = client.from("loads").select("*, trucks(registration_number, driver_name, transporter_company), dams(name)", { count: "exact" }).is("deleted_at", null).order("timestamp", { ascending: false });
        const damId = url.searchParams.get("dam_id");
        const type = url.searchParams.get("type");
        const fromDate = url.searchParams.get("from");
        const toDate = url.searchParams.get("to");
        if (damId) query = query.eq("dam_id", damId);
        if (type) query = query.eq("type", type);
        if (fromDate) query = query.gte("timestamp", fromDate);
        if (toDate) query = query.lte("timestamp", toDate);
        const { data, error, count } = await query.range(from, to);
        if (error) return jsonError(error.message, 400);
        return Response.json({ data, count });
      },
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin", "operator"]);
        if (auth.error) return auth.error;
        const parsed = loadCreateSchema.safeParse(await request.json());
        if (!parsed.success) return jsonError("Invalid load details", 400);
        const client = getAuthedClient(auth.token);
        const { data, error } = await client.rpc("create_load_transaction", {
          _truck_id: parsed.data.truck_id,
          _dam_id: parsed.data.dam_id,
          _type: parsed.data.type,
          _weight_tons: parsed.data.weight_tons,
          _volume_liters: parsed.data.volume_liters,
          _timestamp: parsed.data.timestamp ?? new Date().toISOString(),
          _status: parsed.data.status,
        });
        if (error) return jsonError(error.message, 400);
        return Response.json({ data }, { status: 201 });
      },
    },
  },
});
