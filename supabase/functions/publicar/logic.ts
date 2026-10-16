export type VidStatus = "pendiente" | "publicado" | "error";

export type VidRow = {
  id: string;
  userId: string;
  status: VidStatus;
  scheduledAt: string;
  publishedAt: string | null;
  subtitleText: string;
  processed: boolean;
  lockedAt: string | null;
  createdAt: string;
};

export const hourMs = 3600000;
export const defHrs = 24;
export const lockMs = 30 * 60000;

export const safeHrs = (h: number | null | undefined) =>
  typeof h === "number" && Number.isFinite(h) && h > 0 ? h : defHrs;

export const subsOk = (v: Pick<VidRow, "subtitleText" | "processed">) =>
  v.processed || !v.subtitleText.trim();

export const isLocked = (v: Pick<VidRow, "status" | "lockedAt">) =>
  v.status === "pendiente" && !!v.lockedAt;

export const isStale = (v: Pick<VidRow, "status" | "lockedAt">, now: Date) =>
  isLocked(v) && now.getTime() - Date.parse(v.lockedAt as string) >= lockMs;

export const isReady = (v: VidRow, now: Date) =>
  v.status === "pendiente" &&
  !v.lockedAt &&
  Date.parse(v.scheduledAt) <= now.getTime() &&
  subsOk(v);

export const byAge = (a: VidRow, b: VidRow) =>
  Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
  Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
  a.id.localeCompare(b.id);

export const lastPub = (vids: VidRow[]) => {
  let last: number | null = null;
  for (const v of vids) {
    if (v.status !== "publicado" || !v.publishedAt) continue;
    const t = Date.parse(v.publishedAt);
    if (last === null || t > last) last = t;
  }
  return last;
};

export const canPost = (last: number | null, hrs: number, now: Date) =>
  last === null || now.getTime() - last >= safeHrs(hrs) * hourMs;

export const groupBy = (vids: VidRow[]) => {
  const out = new Map<string, VidRow[]>();
  for (const v of vids) {
    const list = out.get(v.userId);
    if (list) list.push(v);
    else out.set(v.userId, [v]);
  }
  return out;
};

export function pickVids(vids: VidRow[], hrsByUser: Record<string, number>, now: Date): VidRow[] {
  const out: VidRow[] = [];
  for (const [userId, list] of groupBy(vids)) {
    if (list.some(isLocked)) continue;
    if (!canPost(lastPub(list), safeHrs(hrsByUser[userId]), now)) continue;
    const next = list.filter((v) => isReady(v, now)).sort(byAge)[0];
    if (next) out.push(next);
  }
  return out;
}

export function planQueue(vids: VidRow[], hrs: number, now: Date): Record<string, string> {
  const step = safeHrs(hrs) * hourMs;
  const last = lastPub(vids);
  const busy = vids.some(isLocked);
  let t = Math.max(now.getTime(), busy ? now.getTime() + step : last === null ? 0 : last + step);
  const out: Record<string, string> = {};
  for (const v of vids.filter((x) => x.status === "pendiente").sort(byAge)) {
    if (isLocked(v)) {
      out[v.id] = now.toISOString();
      continue;
    }
    const at = Math.max(t, Date.parse(v.scheduledAt));
    out[v.id] = new Date(at).toISOString();
    t = at + step;
  }
  return out;
}

export type Phase = "pendiente" | "publicando" | "publicado" | "error";

export const phaseOf = (v: Pick<VidRow, "status" | "lockedAt">): Phase =>
  isLocked(v) ? "publicando" : v.status;

const moves: Record<Phase, Phase[]> = {
  pendiente: ["publicando", "error"],
  publicando: ["publicado", "error", "pendiente"],
  publicado: [],
  error: ["pendiente"],
};

export const canMove = (from: Phase, to: Phase) => moves[from].includes(to);

export const isAuthCode = (code: number | null | undefined) =>
  typeof code === "number" &&
  (code === 190 || code === 102 || code === 10 || (code >= 200 && code < 300));

export const scrub = (msg: string, token?: string | null) => {
  let out = msg.replace(/access_token=[^&\s"']+/gi, "access_token=***");
  if (token) out = out.split(token).join("***");
  return out;
};

export const pubWindow = (hrsByUser: Record<string, number>, userIds: string[]) =>
  Math.max(defHrs, ...userIds.map((u) => safeHrs(hrsByUser[u]))) * hourMs;
