import {
  isLocked,
  phaseOf,
  planQueue,
  safeHrs,
  subsOk,
  type Phase,
  type VidRow,
} from "../../supabase/functions/publicar/logic.ts";

export { isLocked, phaseOf, safeHrs, type Phase };

export const phaseLabel: Record<Phase, string> = {
  pendiente: "Pendiente",
  publicando: "Publicando",
  publicado: "Publicado",
  error: "Error",
};

export const phaseTone: Record<Phase, string> = {
  pendiente: "bg-warning/15 text-warning",
  publicando: "bg-primary/15 text-primary",
  publicado: "bg-success/15 text-success",
  error: "bg-destructive/15 text-destructive",
};

export const waitSubs = (v: Pick<VidRow, "status" | "subtitleText" | "processed">) =>
  v.status === "pendiente" && !subsOk(v);

export function nextPub<T extends VidRow>(vids: T[], hrs: number, now = new Date()) {
  const plan = planQueue(vids, hrs, now);
  const order = vids
    .filter((v) => plan[v.id])
    .sort((a, b) => Date.parse(plan[a.id] as string) - Date.parse(plan[b.id] as string));
  const first = order[0];
  return { plan, order, next: first ? (plan[first.id] as string) : null };
}

export function lastErr<T extends VidRow & { error: string | null }>(vids: T[]) {
  return (
    vids
      .filter((v) => v.status === "error")
      .sort(
        (a, b) =>
          Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt) ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt),
      )[0] ?? null
  );
}

export const accLabel: Record<string, string> = {
  pendiente: "Pendiente de verificar",
  conectada: "Conectada",
  error: "Error",
};

export const accTone: Record<string, string> = {
  pendiente: "bg-warning/15 text-warning",
  conectada: "bg-success/15 text-success",
  error: "bg-destructive/15 text-destructive",
};

export const igIdOk = (s: string) => /^\d{1,32}$/.test(s.trim());
