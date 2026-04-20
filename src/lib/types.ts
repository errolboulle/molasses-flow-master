import { type Tables } from "@/integrations/supabase/types";

export type Dam = Tables<"dams">;
export type Movement = Tables<"movements">;
export type DamAdjustment = Tables<"dam_adjustments">;
export type Profile = Tables<"profiles">;
export type Settings = Tables<"settings">;

export const tonsToLitres = (tons: number, density: number) =>
  density > 0 ? (tons * 1000) / density : 0;
export const litresToTons = (litres: number, density: number) =>
  (litres * density) / 1000;

export const fmtTons = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 })} t`;
export const fmtLitres = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(Number(n)).toLocaleString()} L`;
export const fmtNum = (n: number | null | undefined, digits = 3) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });
export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString() : "—";
export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString() : "—";
