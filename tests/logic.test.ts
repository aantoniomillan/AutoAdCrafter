import { describe, expect, it } from "vitest";
import {
  canMove,
  isStale,
  lockMs,
  phaseOf,
  pickVids,
  planQueue,
  safeHrs,
  type Phase,
  type VidRow,
} from "../supabase/functions/publicar/logic.ts";
import { lastErr, nextPub, waitSubs } from "../src/lib/pub.ts";

const now = new Date("2026-10-16T12:00:00.000Z");
const hr = 3600000;
const at = (h: number) => new Date(now.getTime() + h * hr).toISOString();

let seq = 0;
const mk = (o: Partial<VidRow> = {}): VidRow => ({
  id: `v${++seq}`,
  userId: "a",
  status: "pendiente",
  scheduledAt: at(-1),
  publishedAt: null,
  subtitleText: "",
  processed: false,
  lockedAt: null,
  createdAt: at(-48),
  ...o,
});

const ids = (vs: VidRow[]) => vs.map((v) => v.id).sort();

describe("pickVids", () => {
  it("elige un video por usuario", () => {
    const a1 = mk({ userId: "a", scheduledAt: at(-3) });
    const a2 = mk({ userId: "a", scheduledAt: at(-2) });
    const b1 = mk({ userId: "b", scheduledAt: at(-1) });
    const out = pickVids([a2, b1, a1], {}, now);
    expect(out).toHaveLength(2);
    expect(ids(out)).toEqual(ids([a1, b1]));
  });

  it("elige el mas antiguo por scheduledAt y desempata por createdAt", () => {
    const old = mk({ scheduledAt: at(-5), createdAt: at(-10) });
    const tieNew = mk({ scheduledAt: at(-6), createdAt: at(-7) });
    const tieOld = mk({ scheduledAt: at(-6), createdAt: at(-9) });
    expect(pickVids([old, tieNew, tieOld], {}, now)).toEqual([tieOld]);
  });

  it("solo elige videos cuya fecha ya paso", () => {
    const fut = mk({ scheduledAt: at(1) });
    expect(pickVids([fut], {}, now)).toEqual([]);
    const exact = mk({ scheduledAt: now.toISOString() });
    expect(pickVids([fut, exact], {}, now)).toEqual([exact]);
  });

  it("respeta intervalHours desde el ultimo publishedAt", () => {
    const pub = mk({ status: "publicado", publishedAt: at(-5) });
    const pend = mk({ scheduledAt: at(-2) });
    expect(pickVids([pub, pend], { a: 6 }, now)).toEqual([]);
    expect(pickVids([pub, pend], { a: 5 }, now)).toEqual([pend]);
    expect(pickVids([pub, pend], { a: 4 }, now)).toEqual([pend]);
  });

  it("usa el publishedAt mas reciente", () => {
    const p1 = mk({ status: "publicado", publishedAt: at(-30) });
    const p2 = mk({ status: "publicado", publishedAt: at(-2) });
    const pend = mk();
    expect(pickVids([p1, p2, pend], { a: 3 }, now)).toEqual([]);
  });

  it("salta usuarios con un video bloqueado", () => {
    const lk = mk({ userId: "a", lockedAt: at(-0.1) });
    const a2 = mk({ userId: "a" });
    const b1 = mk({ userId: "b" });
    expect(pickVids([lk, a2, b1], {}, now)).toEqual([b1]);
  });

  it("salta usuarios con un bloqueo antiguo hasta liberarlo", () => {
    const lk = mk({ lockedAt: at(-5) });
    const a2 = mk();
    expect(pickVids([lk, a2], {}, now)).toEqual([]);
  });

  it("solo elige videos procesados o sin subtitulos", () => {
    const raw = mk({ subtitleText: "hola", processed: false, scheduledAt: at(-5) });
    const blank = mk({ subtitleText: "   ", processed: false, scheduledAt: at(-4) });
    expect(pickVids([raw, blank], {}, now)).toEqual([blank]);
    const done = mk({ subtitleText: "hola", processed: true, scheduledAt: at(-6) });
    expect(pickVids([raw, blank, done], {}, now)).toEqual([done]);
    expect(pickVids([raw], {}, now)).toEqual([]);
  });

  it("ignora videos con error o publicados", () => {
    const err = mk({ status: "error", scheduledAt: at(-9) });
    const pub = mk({ status: "publicado", publishedAt: null, scheduledAt: at(-8) });
    expect(pickVids([err, pub], {}, now)).toEqual([]);
    const pend = mk({ scheduledAt: at(-1) });
    expect(pickVids([err, pub, pend], {}, now)).toEqual([pend]);
  });

  it("intervalHours invalido usa 24", () => {
    const pub = mk({ status: "publicado", publishedAt: at(-23) });
    const pend = mk();
    for (const h of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(pickVids([pub, pend], { a: h }, now)).toEqual([]);
    }
    const pub2 = mk({ status: "publicado", publishedAt: at(-24) });
    expect(pickVids([pub2, pend], { a: 0 }, now)).toEqual([pend]);
    expect(pickVids([pub2, pend], {}, now)).toEqual([pend]);
  });
});

describe("safeHrs", () => {
  it("devuelve 24 para valores invalidos", () => {
    expect(safeHrs(undefined)).toBe(24);
    expect(safeHrs(null)).toBe(24);
    expect(safeHrs(0)).toBe(24);
    expect(safeHrs(-1)).toBe(24);
    expect(safeHrs(Number.NaN)).toBe(24);
    expect(safeHrs(6)).toBe(6);
  });
});

describe("isStale", () => {
  it("detecta bloqueos caducados", () => {
    expect(isStale({ status: "pendiente", lockedAt: null }, now)).toBe(false);
    expect(isStale({ status: "pendiente", lockedAt: at(-0.1) }, now)).toBe(false);
    const lim = new Date(now.getTime() - lockMs).toISOString();
    expect(isStale({ status: "pendiente", lockedAt: lim }, now)).toBe(true);
    expect(isStale({ status: "pendiente", lockedAt: at(-2) }, now)).toBe(true);
    expect(isStale({ status: "publicado", lockedAt: at(-2) }, now)).toBe(false);
    expect(isStale({ status: "error", lockedAt: at(-2) }, now)).toBe(false);
  });
});

describe("planQueue", () => {
  it("espacia los pendientes con el intervalo", () => {
    const v1 = mk({ scheduledAt: at(-2) });
    const v2 = mk({ scheduledAt: at(-1) });
    const v3 = mk({ scheduledAt: at(1) });
    const p = planQueue([v3, v1, v2], 6, now);
    expect(p[v1.id]).toBe(now.toISOString());
    expect(p[v2.id]).toBe(at(6));
    expect(p[v3.id]).toBe(at(12));
  });

  it("respeta fechas futuras lejanas", () => {
    const v1 = mk({ scheduledAt: at(-2) });
    const v2 = mk({ scheduledAt: at(50) });
    const p = planQueue([v1, v2], 6, now);
    expect(p[v2.id]).toBe(at(50));
  });

  it("parte del ultimo publishedAt", () => {
    const pub = mk({ status: "publicado", publishedAt: at(-2) });
    const v1 = mk({ scheduledAt: at(-5) });
    const p = planQueue([pub, v1], 6, now);
    expect(p[v1.id]).toBe(at(4));
    expect(p[pub.id]).toBeUndefined();
  });

  it("un video bloqueado se publica ahora y retrasa el resto", () => {
    const lk = mk({ scheduledAt: at(-3), lockedAt: at(-0.1) });
    const v1 = mk({ scheduledAt: at(-2) });
    const p = planQueue([lk, v1], 6, now);
    expect(p[lk.id]).toBe(now.toISOString());
    expect(p[v1.id]).toBe(at(6));
  });

  it("ignora error y usa 24 con intervalo invalido", () => {
    const err = mk({ status: "error" });
    const v1 = mk({ scheduledAt: at(-2) });
    const v2 = mk({ scheduledAt: at(-1) });
    const p = planQueue([err, v1, v2], 0, now);
    expect(p[err.id]).toBeUndefined();
    expect(p[v2.id]).toBe(at(24));
  });
});

describe("phaseOf", () => {
  it("deriva publicando de lockedAt", () => {
    expect(phaseOf({ status: "pendiente", lockedAt: null })).toBe("pendiente");
    expect(phaseOf({ status: "pendiente", lockedAt: at(-1) })).toBe("publicando");
    expect(phaseOf({ status: "publicado", lockedAt: at(-1) })).toBe("publicado");
    expect(phaseOf({ status: "error", lockedAt: null })).toBe("error");
  });
});

describe("canMove", () => {
  const all: Phase[] = ["pendiente", "publicando", "publicado", "error"];

  it("publicado es final", () => {
    for (const to of all) expect(canMove("publicado", to)).toBe(false);
  });

  it("error solo vuelve a pendiente", () => {
    for (const to of all) expect(canMove("error", to)).toBe(to === "pendiente");
  });

  it("pendiente no salta a publicado", () => {
    expect(canMove("pendiente", "publicando")).toBe(true);
    expect(canMove("pendiente", "error")).toBe(true);
    expect(canMove("pendiente", "publicado")).toBe(false);
    expect(canMove("pendiente", "pendiente")).toBe(false);
  });

  it("publicando termina en publicado, error o se libera", () => {
    expect(canMove("publicando", "publicado")).toBe(true);
    expect(canMove("publicando", "error")).toBe(true);
    expect(canMove("publicando", "pendiente")).toBe(true);
    expect(canMove("publicando", "publicando")).toBe(false);
  });
});

describe("helpers de la app", () => {
  it("nextPub devuelve la fecha mas cercana o null", () => {
    expect(nextPub([], 24, now).next).toBeNull();
    const v1 = mk({ scheduledAt: at(5) });
    const v2 = mk({ scheduledAt: at(-1) });
    const r = nextPub([v1, v2], 2, now);
    expect(r.next).toBe(now.toISOString());
    expect(r.order.map((v) => v.id)).toEqual([v2.id, v1.id]);
  });

  it("waitSubs marca pendientes con subtitulos sin procesar", () => {
    expect(waitSubs(mk({ subtitleText: "hola" }))).toBe(true);
    expect(waitSubs(mk({ subtitleText: "hola", processed: true }))).toBe(false);
    expect(waitSubs(mk({ subtitleText: "" }))).toBe(false);
    expect(waitSubs(mk({ subtitleText: "hola", status: "error" }))).toBe(false);
  });

  it("lastErr devuelve el error mas reciente", () => {
    const e1 = { ...mk({ status: "error", scheduledAt: at(-5) }), error: "viejo" };
    const e2 = { ...mk({ status: "error", scheduledAt: at(-1) }), error: "nuevo" };
    const ok = { ...mk(), error: null };
    expect(lastErr([e1, ok, e2])?.error).toBe("nuevo");
    expect(lastErr([ok])).toBeNull();
  });
});
