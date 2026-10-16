import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migDir = resolve(__dirname, "../supabase/migrations");
const migs = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ f, sql: readFileSync(resolve(migDir, f), "utf8") }));

const uA = "00000000-0000-4000-8000-00000000000a";
const uB = "00000000-0000-4000-8000-00000000000b";
const vA = "10000000-0000-4000-8000-00000000000a";
const vB = "10000000-0000-4000-8000-00000000000b";
const aA = "20000000-0000-4000-8000-00000000000a";
const aB = "20000000-0000-4000-8000-00000000000b";

const boot = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;
create schema extensions;
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text, n text) returns uuid language sql as $$
  insert into vault.secrets (name, secret) values (n, s) returning id
$$;
create function vault.update_secret(i uuid, s text) returns void language sql as $$
  update vault.secrets set secret = s where id = i
$$;
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid
$$;
create function cron.unschedule(i bigint) returns boolean language sql as $$
  delete from cron.job where jobid = i returning true
$$;
create schema net;
create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int)
  returns bigint language sql as $$ select 1::bigint $$;
`;

const noExt = (sql: string) => sql.replace(/^CREATE EXTENSION[^;]*;$/gim, "");

let db: PGlite;

const asUser = async <T>(uid: string | null, fn: () => Promise<T>) => {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.exec(uid ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
};

const rows = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows;
const fails = async (sql: string, args: unknown[] = []) => {
  try {
    await db.query(sql, args);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(boot);
  for (const m of migs) await db.exec(noExt(m.sql));
  await db.query(
    `insert into public.videos (id, "userId", path, "publicUrl", caption, "scheduledAt", status)
     values ($1, $2, 'a/1.mp4', 'u', 'capA', now(), 'error'), ($3, $4, 'b/1.mp4', 'u', 'capB', now(), 'pendiente')`,
    [vA, uA, vB, uB],
  );
  await db.query(
    `insert into public.accounts (id, "userId", platform, "externalId")
     values ($1, $2, 'instagram', '111'), ($3, $4, 'instagram', '222')`,
    [aA, uA, aB, uB],
  );
  await db.query(
    `insert into public.settings ("userId", "intervalHours") values ($1, 6), ($2, 12)`,
    [uA, uB],
  );
  await db.query(
    `insert into storage.objects (bucket_id, name) values ('videos', $1), ('videos', $2)`,
    [`${uA}/1.mp4`, `${uB}/1.mp4`],
  );
}, 60000);

afterAll(async () => {
  await db?.close();
});

describe("aislamiento por filas", () => {
  it("A solo ve sus filas en videos, accounts, settings y storage", async () => {
    await asUser(uA, async () => {
      expect(await rows(`select "userId" from public.videos`)).toEqual([{ userId: uA }]);
      expect(await rows(`select "userId" from public.accounts`)).toEqual([{ userId: uA }]);
      expect(await rows(`select "userId" from public.settings`)).toEqual([{ userId: uA }]);
      expect(await rows(`select name from storage.objects`)).toEqual([{ name: `${uA}/1.mp4` }]);
    });
  });

  it("A no actualiza filas de B", async () => {
    await asUser(uA, async () => {
      expect(
        await rows(`update public.videos set caption = 'x' where id = $1 returning id`, [vB]),
      ).toEqual([]);
      expect(
        await rows(`update public.accounts set "externalId" = '9' where id = $1 returning id`, [
          aB,
        ]),
      ).toEqual([]);
      expect(
        await rows(
          `update public.settings set "intervalHours" = 1 where "userId" = $1 returning "userId"`,
          [uB],
        ),
      ).toEqual([]);
    });
    expect(await rows(`select caption from public.videos where id = $1`, [vB])).toEqual([
      { caption: "capB" },
    ]);
    expect(await rows(`select "externalId" from public.accounts where id = $1`, [aB])).toEqual([
      { externalId: "222" },
    ]);
    expect(
      await rows(`select "intervalHours" from public.settings where "userId" = $1`, [uB]),
    ).toEqual([{ intervalHours: 12 }]);
  });

  it("A no borra filas de B", async () => {
    await asUser(uA, async () => {
      expect(await rows(`delete from public.videos where id = $1 returning id`, [vB])).toEqual([]);
      expect(await rows(`delete from public.accounts where id = $1 returning id`, [aB])).toEqual(
        [],
      );
      expect(
        await rows(`delete from public.settings where "userId" = $1 returning "userId"`, [uB]),
      ).toEqual([]);
      expect(
        await rows(`delete from storage.objects where name = $1 returning name`, [`${uB}/1.mp4`]),
      ).toEqual([]);
    });
    expect(await rows(`select count(*)::int as n from public.videos`)).toEqual([{ n: 2 }]);
    expect(await rows(`select count(*)::int as n from public.accounts`)).toEqual([{ n: 2 }]);
    expect(await rows(`select count(*)::int as n from public.settings`)).toEqual([{ n: 2 }]);
    expect(await rows(`select count(*)::int as n from storage.objects`)).toEqual([{ n: 2 }]);
  });

  it("A no inserta filas con el userId de B", async () => {
    await asUser(uA, async () => {
      expect(
        await fails(
          `insert into public.videos ("userId", path, "publicUrl", "scheduledAt") values ($1, 'p', 'u', now())`,
          [uB],
        ),
      ).toMatch(/row-level security/);
      expect(
        await fails(
          `insert into public.accounts ("userId", platform, "externalId") values ($1, 'instagram', '1')`,
          [uB],
        ),
      ).toMatch(/row-level security/);
      expect(
        await fails(`insert into public.settings ("userId", "intervalHours") values ($1, 2)`, [
          "00000000-0000-4000-8000-0000000000cc",
        ]),
      ).toMatch(/row-level security/);
      expect(
        await fails(
          `insert into public.settings ("userId", "intervalHours") values ($1, 2) on conflict ("userId") do update set "intervalHours" = 2`,
          [uB],
        ),
      ).toMatch(/row-level security/);
      expect(
        await fails(`insert into storage.objects (bucket_id, name) values ('videos', $1)`, [
          `${uB}/2.mp4`,
        ]),
      ).toMatch(/row-level security/);
    });
  });

  it("A puede insertar y editar lo suyo", async () => {
    await asUser(uA, async () => {
      const ins = await rows(
        `insert into public.videos ("userId", path, "publicUrl", caption, "scheduledAt") values ($1, 'p', 'u', 'nuevo', now()) returning id`,
        [uA],
      );
      expect(ins).toHaveLength(1);
      expect(
        await rows(`update public.videos set caption = 'ok' where id = $1 returning caption`, [vA]),
      ).toEqual([{ caption: "ok" }]);
      expect(
        await rows(`delete from public.videos where id = $1 returning id`, [
          (ins[0] as { id: string }).id,
        ]),
      ).toHaveLength(1);
    });
  });

  it("anon no accede a ninguna tabla", async () => {
    await asUser(null, async () => {
      for (const t of ["videos", "accounts", "settings"]) {
        expect(await fails(`select * from public.${t}`)).toMatch(/permission denied/);
      }
    });
  });
});

describe("columnas protegidas", () => {
  it("A no escribe accounts.status, lastError ni checkedAt", async () => {
    await asUser(uA, async () => {
      for (const c of [`"status" = 'conectada'`, `"lastError" = 'x'`, `"checkedAt" = now()`]) {
        expect(await fails(`update public.accounts set ${c} where id = $1`, [aA])).toMatch(
          /permission denied/,
        );
      }
      expect(
        await fails(
          `insert into public.accounts ("userId", platform, "externalId", "status") values ($1, 'instagram', '5', 'conectada')`,
          [uA],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("A no escribe videos.processed, lockedAt, publishedAt ni srcPath", async () => {
    await asUser(uA, async () => {
      for (const c of [
        `"processed" = true`,
        `"lockedAt" = now()`,
        `"publishedAt" = now()`,
        `"srcPath" = 'x'`,
        `"userId" = '${uB}'`,
        `path = 'otro'`,
      ]) {
        expect(await fails(`update public.videos set ${c} where id = $1`, [vA])).toMatch(
          /permission denied/,
        );
      }
      expect(
        await fails(
          `insert into public.videos ("userId", path, "publicUrl", "scheduledAt", processed) values ($1, 'p', 'u', now(), true)`,
          [uA],
        ),
      ).toMatch(/permission denied/);
      expect(
        await fails(
          `insert into public.videos ("userId", path, "publicUrl", "scheduledAt", status) values ($1, 'p', 'u', now(), 'publicado')`,
          [uA],
        ),
      ).toMatch(/permission denied/);
    });
  });

  it("A solo puede pasar de error a pendiente", async () => {
    await db.query(`update public.videos set status = 'error' where id = $1`, [vA]);
    await asUser(uA, async () => {
      expect(
        await fails(`update public.videos set status = 'publicado' where id = $1`, [vA]),
      ).toMatch(/no permitido/);
      expect(
        await rows(
          `update public.videos set status = 'pendiente', error = null where id = $1 returning status`,
          [vA],
        ),
      ).toEqual([{ status: "pendiente" }]);
      expect(await fails(`update public.videos set status = 'error' where id = $1`, [vA])).toMatch(
        /no permitido/,
      );
    });
  });

  it("A no edita ni borra un video en publicacion", async () => {
    await db.query(`update public.videos set "lockedAt" = now() where id = $1`, [vA]);
    await asUser(uA, async () => {
      expect(await fails(`update public.videos set caption = 'x' where id = $1`, [vA])).toMatch(
        /en publicacion/,
      );
      expect(await fails(`delete from public.videos where id = $1`, [vA])).toMatch(
        /en publicacion/,
      );
    });
    await db.query(`update public.videos set "lockedAt" = null where id = $1`, [vA]);
  });

  it("editar subtitulos reinicia processed", async () => {
    await db.query(`update public.videos set processed = true where id = $1`, [vA]);
    await asUser(uA, async () => {
      await db.query(`update public.videos set "subtitleText" = 'nuevo' where id = $1`, [vA]);
    });
    expect(await rows(`select processed from public.videos where id = $1`, [vA])).toEqual([
      { processed: false },
    ]);
  });

  it("cambiar externalId resetea el estado de la cuenta", async () => {
    await db.query(
      `update public.accounts set "status" = 'conectada', "lastError" = 'x' where id = $1`,
      [aA],
    );
    await asUser(uA, async () => {
      await db.query(`update public.accounts set "externalId" = '333' where id = $1`, [aA]);
    });
    expect(
      await rows(`select "status", "lastError" from public.accounts where id = $1`, [aA]),
    ).toEqual([{ status: "pendiente", lastError: null }]);
  });

  it("igTokenSet no revela tokens ajenos ni el valor del token", async () => {
    await db.query(`select public."setIgToken"($1, 'tokA')`, [aA]);
    await db.query(`select public."setIgToken"($1, 'tokB')`, [aB]);
    await asUser(uA, async () => {
      expect(await rows(`select public."igTokenSet"($1) as ok`, [aA])).toEqual([{ ok: true }]);
      expect(await rows(`select public."igTokenSet"($1) as ok`, [aB])).toEqual([{ ok: false }]);
      expect(await fails(`select public."getIgToken"($1)`, [aA])).toMatch(/permission denied/);
      expect(await fails(`select public."setIgToken"($1, 'x')`, [aB])).toMatch(/permission denied/);
      expect(await fails(`select * from vault.secrets`)).toMatch(/permission denied/);
      expect(await fails(`select public."callPublicar"()`)).toMatch(/permission denied/);
    });
    await asUser(null, async () => {
      expect(await fails(`select public."igTokenSet"($1)`, [aA])).toMatch(/permission denied/);
    });
  });

  it.skip("vault, pg_cron y pg_net reales no existen en PGlite: se usan stubs minimos", () => {});
});

describe("migraciones sobre base vacia", () => {
  it("se aplican en orden por marca de tiempo", () => {
    const names = migs.map((m) => m.f);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(names.every((f) => /^\d{14}_\w+\.sql$/.test(f))).toBe(true);
    expect(new Set(names.map((f) => f.slice(0, 14))).size).toBe(names.length);
  });

  it("crean el bucket publico videos solo para mp4", async () => {
    expect(
      await rows(`select public, allowed_mime_types from storage.buckets where id = 'videos'`),
    ).toEqual([{ public: true, allowed_mime_types: ["video/mp4"] }]);
  });

  it("programan el job publicar en pg_cron", async () => {
    expect(await rows(`select schedule from cron.job where jobname = 'publicar'`)).toEqual([
      { schedule: "*/10 * * * *" },
    ]);
  });

  it("son idempotentes si se reaplica la del bucket", async () => {
    const bkt = migs.find((m) => m.f.endsWith("_bucket.sql"));
    expect(bkt).toBeDefined();
    await db.exec(bkt!.sql);
    expect(await rows(`select count(*)::int as n from storage.buckets`)).toEqual([{ n: 1 }]);
  });
});
