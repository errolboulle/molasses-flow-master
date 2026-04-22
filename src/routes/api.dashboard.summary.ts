import { createFileRoute } from "@tanstack/react-router";
import { getAuthedClient, jsonError, requireApiAuth } from "@/lib/api-auth";

export const Route = createFileRoute("/api/dashboard/summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiAuth(request, ["admin", "operator", "supervisor"]);
        if (auth.error) return auth.error;
        const client = getAuthedClient(auth.token);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const [{ data: dams, error: damsError }, { data: loads, error: loadsError }] = await Promise.all([
          client.from("dams").select("id,name,capacity_tons,capacity_liters,current_volume_tons,current_volume_liters,status").is("deleted_at", null).order("name"),
          client.from("loads").select("dam_id,type,weight_tons,volume_liters,status,timestamp").is("deleted_at", null).eq("status", "completed").gte("timestamp", monthStart.toISOString()),
        ]);
        if (damsError) return jsonError(damsError.message, 400);
        if (loadsError) return jsonError(loadsError.message, 400);

        const monthlyIncoming = (loads ?? []).filter((load: any) => load.type === "incoming").reduce((sum: number, load: any) => sum + Number(load.weight_tons), 0);
        const monthlyOutgoing = (loads ?? []).filter((load: any) => load.type === "outgoing").reduce((sum: number, load: any) => sum + Number(load.weight_tons), 0);
        const totalStock = (dams ?? []).reduce((sum: number, dam: any) => sum + Number(dam.current_volume_tons), 0);
        const perDamStats = (dams ?? []).map((dam: any) => {
          const damLoads = (loads ?? []).filter((load: any) => load.dam_id === dam.id);
          return {
            ...dam,
            monthly_incoming_tons: damLoads.filter((load: any) => load.type === "incoming").reduce((sum: number, load: any) => sum + Number(load.weight_tons), 0),
            monthly_outgoing_tons: damLoads.filter((load: any) => load.type === "outgoing").reduce((sum: number, load: any) => sum + Number(load.weight_tons), 0),
          };
        });

        return Response.json({ total_stock_tons: totalStock, monthly_incoming_tons: monthlyIncoming, monthly_outgoing_tons: monthlyOutgoing, per_dam_stats: perDamStats });
      },
    },
  },
});
