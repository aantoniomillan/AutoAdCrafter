import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migDir = resolve(__dirname, "../supabase/migrations");
const lvDir = resolve(__dirname, "../drizzle/migrations");
const sql = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(resolve(migDir, f), "utf8"))
  .join("\n");

const norm = (s: string) => s.replace(/\s+/g, " ");
const all = norm(sql);
const tbls = [...all.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.("?)(\w+)\1/gi)].map(
  (m) => m[2] as string,
);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const own = /auth\.uid\(\) = "userId"/;

describe("migraciones: seguridad por filas", () => {
  it("encuentra las tablas publicas", () => {
    expect(tbls).toEqual(expect.arrayContaining(["videos", "accounts", "settings"]));
  });

  for (const t of ["videos", "accounts", "settings"]) {
    it(`${t} tiene RLS activado`, () => {
      expect(all).toMatch(
        new RegExp(`ALTER TABLE public\\."?${esc(t)}"? ENABLE ROW LEVEL SECURITY`, "i"),
      );
    });

    it(`${t} limita USING y WITH CHECK a auth.uid() = "userId"`, () => {
      const pols = [
        ...all.matchAll(
          new RegExp(`CREATE POLICY "[^"]+" ON public\\."?${esc(t)}"? ([^;]+);`, "gi"),
        ),
      ].map((m) => m[1] as string);
      expect(pols.length).toBeGreaterThan(0);
      for (const p of pols) {
        const use = p.match(/USING \((.+?)\)(?: WITH CHECK|$)/i)?.[1] ?? "";
        const chk = p.match(/WITH CHECK \((.+)\)$/i)?.[1];
        if (/FOR (ALL|SELECT|UPDATE|DELETE)/i.test(p)) expect(use).toMatch(own);
        if (/FOR (ALL|INSERT|UPDATE)/i.test(p)) expect(chk ?? use).toMatch(own);
        expect(p).toMatch(/TO authenticated/i);
      }
    });
  }

  it("todas las tablas publicas creadas tienen RLS", () => {
    for (const t of tbls) {
      expect(all).toMatch(
        new RegExp(`ALTER TABLE public\\."?${esc(t)}"? ENABLE ROW LEVEL SECURITY`, "i"),
      );
    }
  });

  it("no concede permisos a anon sobre las tablas", () => {
    expect(all).not.toMatch(/GRANT [^;]+ ON (TABLE )?public\.\w+ TO [^;]*\banon\b/i);
  });
});

describe("migraciones: independencia de Lovable", () => {
  it("la base de supabase/migrations coincide con la de drizzle ya aplicada en Lovable", () => {
    const lv = readFileSync(resolve(lvDir, "0000_publi_base.sql"), "utf8");
    const sb = readdirSync(migDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()[0] as string;
    expect(readFileSync(resolve(migDir, sb), "utf8")).toBe(lv);
  });

  it("no hacen referencia a Lovable ni a proyectos concretos", () => {
    expect(all).not.toMatch(/lovable|[a-z]{20}\.supabase\.co/i);
  });

  it("no contienen comentarios", () => {
    expect(sql).not.toMatch(/--|\/\*/);
  });
});
