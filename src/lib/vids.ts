import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Video = Database["public"]["Tables"]["videos"]["Row"];
export type VidStatus = Database["public"]["Enums"]["video_status"];

export const statusLabel: Record<VidStatus, string> = {
  pendiente: "Pendiente",
  publicado: "Publicado",
  error: "Error",
};

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "-";

export const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export async function countByStatus(status: VidStatus) {
  const { count, error } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

export async function listVids(statuses?: VidStatus[], limit?: number, upcoming = false) {
  let q = supabase.from("videos").select("*").order("scheduledAt", { ascending: true });
  if (statuses) q = q.in("status", statuses);
  if (upcoming) q = q.gte("scheduledAt", new Date().toISOString());
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
