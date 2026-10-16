import { createClient } from "npm:@supabase/supabase-js@2";
import { isAuthCode, isStale, pickVids, pubWindow, scrub, subsOk, type VidRow } from "./logic.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const num = (k: string, d: number) => {
  const n = Number(env(k));
  return Number.isFinite(n) && n > 0 ? n : d;
};

const graphVer = env("GRAPH_VER") || "v24.0";
const graphBase = `https://graph.facebook.com/${graphVer}`;
const pollMs = num("POLL_MS", 10000);
const pollMax = num("POLL_MAX", 12);
const fetchMs = num("FETCH_MS", 20000);
const timeMax = num("TIME_MAX", 140000);
const needMs = pollMs * pollMax + 20000;
const vidCols =
  "id,userId,status,scheduledAt,publishedAt,subtitleText,processed,lockedAt,createdAt";

type Res = { id: string; userId: string; result: string; error?: string };
type Vid = VidRow & { publicUrl: string; caption: string };
type Acc = { id: string; externalId: string };
type GRes = {
  id?: string;
  status_code?: string;
  status?: string;
  error?: { message?: string; code?: number };
};

class GErr extends Error {
  auth: boolean;
  constructor(msg: string, auth = false) {
    super(msg);
    this.auth = auth;
  }
}

const enc = new TextEncoder();

async function safeEq(a: string, b: string) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gFetch(path: string, token: string, step: string, form?: Record<string, string>) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), fetchMs);
  let res: Response;
  try {
    if (form) {
      const body = new URLSearchParams({ ...form, access_token: token });
      res = await fetch(`${graphBase}/${path}`, { method: "POST", body, signal: ctrl.signal });
    } else {
      const sep = path.includes("?") ? "&" : "?";
      res = await fetch(`${graphBase}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
        signal: ctrl.signal,
      });
    }
  } catch (e) {
    clearTimeout(t);
    const msg = ctrl.signal.aborted ? "tiempo de espera agotado" : "error de red";
    console.error("Fallo de red en", step, scrub(String((e as Error)?.name ?? ""), token));
    throw new GErr(`${step}: ${msg}`);
  }
  let data: GRes | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  } finally {
    clearTimeout(t);
  }
  if (!res.ok || data?.error) {
    const ge = data?.error ?? {};
    const detail = ge.message ? scrub(String(ge.message), token) : `HTTP ${res.status}`;
    throw new GErr(`${step}: ${detail}`, isAuthCode(ge.code) || res.status === 401);
  }
  return data;
}

async function waitReady(cId: string, token: string, deadline: number) {
  for (let i = 0; i < pollMax; i++) {
    if (Date.now() + pollMs > deadline) break;
    await sleep(pollMs);
    const d = await gFetch(
      `${cId}?fields=status_code,status`,
      token,
      "Error al consultar el contenedor",
    );
    const code = String(d?.status_code ?? "");
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      const st = d?.status ? scrub(String(d.status), token) : code;
      throw new GErr(`Instagram no pudo procesar el video: ${st}`);
    }
  }
  throw new GErr("El video no termino de procesarse");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Metodo no permitido" }, 405);
  const secret = env("CRON_SECRET");
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret) console.error("Falta CRON_SECRET");
  if (!secret || !(await safeEq(given, secret))) return json({ error: "No autorizado" }, 401);

  let body: { dryRun?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const asked = body?.dryRun === true;
  const dryRun = env("DRY_RUN") !== "false" || asked;
  if (dryRun && !asked) {
    console.log("DRY_RUN activo, llamada sin dryRun explicito ignorada");
    return json({ dryRun, results: [], skipped: true });
  }
  const start = Date.now();
  const deadline = start + timeMax;
  const results: Res[] = [];
  console.log("Inicio de publicacion, dryRun:", dryRun);

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fail = async (v: Res, msg: string) => {
    const { error } = await db
      .from("videos")
      .update({ status: "error", error: msg, lockedAt: null })
      .eq("id", v.id);
    if (error) console.error("No se pudo marcar el error del video", v.id, error.message);
    results.push({ ...v, result: "error", error: msg });
    console.log("Video con error", v.id, msg);
  };

  const accErr = async (accId: string, msg: string) => {
    const { error } = await db
      .from("accounts")
      .update({ status: "error", lastError: msg, checkedAt: new Date().toISOString() })
      .eq("id", accId);
    if (error) console.error("No se pudo marcar el error de la cuenta", accId, error.message);
  };

  try {
    const now = new Date();
    const locked = await db
      .from("videos")
      .select(vidCols)
      .eq("status", "pendiente")
      .not("lockedAt", "is", null);
    if (locked.error) throw new Error(`Error leyendo bloqueos: ${locked.error.message}`);
    const stale = (locked.data as unknown as VidRow[]).filter((v) => isStale(v, now));
    for (const v of stale) {
      const { error } = await db
        .from("videos")
        .update({ status: "error", error: "Tiempo de publicacion agotado", lockedAt: null })
        .eq("id", v.id)
        .eq("status", "pendiente")
        .eq("lockedAt", v.lockedAt as string);
      if (error) console.error("No se pudo liberar el bloqueo", v.id, error.message);
      else
        results.push({
          id: v.id,
          userId: v.userId,
          result: "caducado",
          error: "Tiempo de publicacion agotado",
        });
    }

    const pend: Vid[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await db
        .from("videos")
        .select(`${vidCols},publicUrl,caption`)
        .eq("status", "pendiente")
        .order("id")
        .range(from, from + 999);
      if (r.error) throw new Error(`Error leyendo videos: ${r.error.message}`);
      pend.push(...(r.data as unknown as Vid[]));
      if (r.data.length < 1000) break;
    }
    const userIds = [...new Set(pend.map((v) => v.userId))];
    console.log("Videos pendientes:", pend.length, "usuarios:", userIds.length);
    if (!userIds.length) return json({ dryRun, results });

    const hrsByUser: Record<string, number> = {};
    const pubs: VidRow[] = [];
    for (let i = 0; i < userIds.length; i += 200) {
      const ids = userIds.slice(i, i + 200);
      const s = await db.from("settings").select("userId,intervalHours").in("userId", ids);
      if (s.error) throw new Error(`Error leyendo ajustes: ${s.error.message}`);
      for (const row of s.data as { userId: string; intervalHours: number }[])
        hrsByUser[row.userId] = row.intervalHours;
    }
    const since = new Date(now.getTime() - pubWindow(hrsByUser, userIds)).toISOString();
    for (let i = 0; i < userIds.length; i += 200) {
      const ids = userIds.slice(i, i + 200);
      const p = await db
        .from("videos")
        .select(vidCols)
        .eq("status", "publicado")
        .in("userId", ids)
        .gte("publishedAt", since);
      if (p.error) throw new Error(`Error leyendo publicados: ${p.error.message}`);
      pubs.push(...(p.data as unknown as VidRow[]));
    }

    const byId = new Map(pend.map((v) => [v.id, v]));
    const picked = pickVids([...pend, ...pubs], hrsByUser, now);
    console.log("Videos seleccionados:", picked.length);

    for (const pv of picked) {
      const base: Res = { id: pv.id, userId: pv.userId, result: "" };
      if (deadline - Date.now() < needMs) {
        results.push({ ...base, result: "aplazado" });
        continue;
      }
      const lockAt = new Date().toISOString();
      const lk = await db
        .from("videos")
        .update({ lockedAt: lockAt })
        .eq("id", pv.id)
        .eq("status", "pendiente")
        .is("lockedAt", null)
        .select("publicUrl,caption,subtitleText,processed");
      if (lk.error) {
        console.error("No se pudo bloquear el video", pv.id, lk.error.message);
        results.push({ ...base, result: "omitido" });
        continue;
      }
      if (!lk.data?.length) {
        results.push({ ...base, result: "omitido" });
        continue;
      }
      const cur = { ...byId.get(pv.id)!, ...(lk.data[0] as Partial<Vid>) } as Vid;
      if (!subsOk(cur)) {
        await db.from("videos").update({ lockedAt: null }).eq("id", pv.id);
        results.push({ ...base, result: "omitido" });
        continue;
      }
      console.log("Procesando video", pv.id);

      const ac = await db
        .from("accounts")
        .select("id,externalId")
        .eq("userId", pv.userId)
        .eq("platform", "instagram")
        .order("createdAt")
        .limit(1);
      const acc = (ac.data?.[0] ?? null) as Acc | null;
      if (ac.error || !acc) {
        await fail(base, "Sin cuenta de Instagram");
        continue;
      }
      const tk = await db.rpc("getIgToken", { accId: acc.id });
      const token = typeof tk.data === "string" && tk.data ? tk.data : "";
      if (tk.error || !token) {
        await fail(base, "Sin token");
        await accErr(acc.id, "Sin token");
        continue;
      }

      try {
        const me = await gFetch(
          `${encodeURIComponent(acc.externalId)}?fields=id,username`,
          token,
          "Error al verificar la cuenta",
        );
        if (!me?.id) throw new GErr("Error al verificar la cuenta: respuesta sin id", true);
        const ct = await gFetch(
          `${encodeURIComponent(acc.externalId)}/media`,
          token,
          "Error al crear el contenedor",
          {
            media_type: "REELS",
            video_url: cur.publicUrl,
            caption: cur.caption ?? "",
            share_to_feed: "true",
          },
        );
        const cId = String(ct?.id ?? "");
        if (!cId) throw new GErr("Error al crear el contenedor: respuesta sin id");
        await waitReady(cId, token, deadline);

        const okAcc = { status: "conectada", lastError: null, checkedAt: new Date().toISOString() };
        if (dryRun) {
          const { error } = await db.from("videos").update({ lockedAt: null }).eq("id", pv.id);
          if (error) console.error("No se pudo liberar el video", pv.id, error.message);
          await db.from("accounts").update(okAcc).eq("id", acc.id);
          results.push({ ...base, result: "simulado" });
          console.log("Simulacion completada sin publicar", pv.id);
          continue;
        }

        await gFetch(
          `${encodeURIComponent(acc.externalId)}/media_publish`,
          token,
          "Error al publicar",
          {
            creation_id: cId,
          },
        );
        const { error } = await db
          .from("videos")
          .update({
            status: "publicado",
            publishedAt: new Date().toISOString(),
            error: null,
            lockedAt: null,
          })
          .eq("id", pv.id);
        if (error)
          console.error("Publicado pero no se pudo actualizar el video", pv.id, error.message);
        await db.from("accounts").update(okAcc).eq("id", acc.id);
        results.push({ ...base, result: "publicado" });
        console.log("Video publicado", pv.id);
      } catch (e) {
        const msg = scrub(e instanceof Error ? e.message : "Error desconocido", token);
        await fail(base, msg);
        if (e instanceof GErr && e.auth) await accErr(acc.id, msg);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("Fallo general", msg);
    return json({ dryRun, results, error: msg }, 500);
  }

  console.log(
    "Fin de publicacion, resultados:",
    results.length,
    "segundos:",
    Math.round((Date.now() - start) / 1000),
  );
  return json({ dryRun, results });
});
