import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDams() {
  return useQuery({
    queryKey: ["dams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dams").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useMovements(filters?: {
  damId?: string;
  type?: "incoming" | "outgoing";
  from?: string;
  to?: string;
}) {
  return useQuery({
    queryKey: ["movements", filters],
    queryFn: async () => {
      let q = supabase.from("movements").select("*").order("occurred_at", { ascending: false });
      if (filters?.damId) q = q.eq("dam_id", filters.damId);
      if (filters?.type) q = q.eq("movement_type", filters.type);
      if (filters?.from) q = q.gte("occurred_at", filters.from);
      if (filters?.to) q = q.lte("occurred_at", filters.to);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useMovementAutocompleteOptions() {
  return useQuery({
    queryKey: ["movement-autocomplete-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("src_vehicle_registration, fgc_vehicle_registration, src_haulier, fgc_haulier, src_mill")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const unique = (...values: Array<string | null>) => Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])).slice(0, 80);
      return {
        vehicleRegistrations: unique(...(data ?? []).flatMap((row) => [row.src_vehicle_registration, row.fgc_vehicle_registration])),
        hauliers: unique(...(data ?? []).flatMap((row) => [row.src_haulier, row.fgc_haulier])),
        mills: unique(...(data ?? []).map((row) => row.src_mill)),
      };
    },
  });
}

export function useAdjustments(damId?: string) {
  return useQuery({
    queryKey: ["adjustments", damId],
    queryFn: async () => {
      let q = supabase.from("dam_adjustments").select("*, dams(name), profiles:user_id(email, full_name)").order("created_at", { ascending: false });
      if (damId) q = q.eq("dam_id", damId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUsersAdmin() {
  return useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));
    },
  });
}
