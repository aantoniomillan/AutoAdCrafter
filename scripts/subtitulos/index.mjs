import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  burnPatch,
  condBurn,
  condErr,
  condRestore,
  errTxt,
  newPath,
  objUrl,
  parseBatch,
  plan,
  restorePatch,
  selBurn,
  selRestore,
  trimBase,
  authHeaders,
} from "./logic.mjs";
import { burn, hasTools, probe } from "./burn.mjs";

const base = trimBase(process.env.SUPABASE_URL);
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const authHdr = authHeaders(key);
const dry =
  String(process.env.DRY_RUN ?? "")
    .trim()
    .toLowerCase() === "true";
const batch = parseBatch(process.env.BATCH);
const stats = { quemados: 0, restaurados: 0, omitidos: 0, errores: 0 };

async function req(url, { what, ms = 60000, headers, ...opts } = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...authHdr, ...headers },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `${what} respondio ${res.status} ${txt.replace(/\s+/g, " ").slice(0, 150)}`.trim(),
    );
  }
  return res;
}

const getRows = async (q) =>
  (await req(`${base}/rest/v1/videos?${q}`, { what: "lectura de videos" })).json();

async function patchRow(cond, patch) {
  const res = await req(`${base}/rest/v1/videos?${cond}`, {
    what: "actualizacion de video",
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  return res.json();
}

async function download(path, file) {
  const res = await req(objUrl(base, path), { what: "descarga", ms: 10 * 60000 });
  if (!res.body) throw new Error("descarga vacia");
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}

async function upload(path, file) {
  await req(objUrl(base, path), {
    what: "subida",
    ms: 10 * 60000,
    method: "POST",
    headers: { "Content-Type": "video/mp4", "x-upsert": "false", "cache-control": "3600" },
    body: await readFile(file),
  });
}

async function delObj(path) {
  try {
    await req(objUrl(base, path), { what: "borrado", method: "DELETE" });
    console.log(`  Borrado ${path}`);
  } catch (e) {
    console.log(`  Aviso: no se pudo borrar ${path}: ${e.message}`);
  }
}

async function markErr(row, e) {
  stats.errores++;
  const msg = errTxt(e);
  console.log(`  Error en ${row.id}: ${msg}`);
  if (dry) return;
  try {
    await patchRow(condErr(row), { status: "error", error: msg });
  } catch (e2) {
    console.log(`  Aviso: no se pudo marcar el error de ${row.id}: ${e2.message}`);
  }
}

async function doRestore(row) {
  const { patch, old } = restorePatch(row, base);
  console.log(`Video ${row.id}: sin subtitulos, restaurar original ${patch.path}`);
  if (dry) {
    console.log(`  Prueba: actualizaria path a ${patch.path}${old ? ` y borraria ${old}` : ""}`);
    stats.restaurados++;
    return;
  }
  const done = await patchRow(condRestore(row), patch);
  if (!done.length) {
    console.log("  Omitido: la fila cambio durante el proceso");
    stats.omitidos++;
    return;
  }
  if (old) await delObj(old);
  stats.restaurados++;
}

async function doBurn(row, src) {
  console.log(`Video ${row.id}: quemando subtitulos desde ${src}`);
  const dir = await mkdtemp(join(tmpdir(), "subs-"));
  const inp = join(dir, "in.mp4");
  const out = join(dir, "out.mp4");
  try {
    await download(src, inp);
    const info = await burn(inp, out, row.subtitleText, dir);
    const res = await probe(out);
    console.log(
      `  Origen ${info.w}x${info.h} ${info.dur.toFixed(1)}s, salida ${res.w}x${res.h} ${res.dur.toFixed(1)}s`,
    );
    const path = newPath(row.userId, randomUUID());
    const { patch, old } = burnPatch(row, path, base);
    if (dry) {
      console.log(
        `  Prueba: subiria ${path}, actualizaria la fila con srcPath ${patch.srcPath}${old ? ` y borraria ${old}` : ""}`,
      );
      stats.quemados++;
      return;
    }
    await upload(path, out);
    let done;
    try {
      done = await patchRow(condBurn(row), patch);
    } catch (e) {
      await delObj(path);
      throw e;
    }
    if (!done.length) {
      console.log("  Omitido: la fila cambio durante el proceso");
      await delObj(path);
      stats.omitidos++;
      return;
    }
    console.log(`  Subido ${path}`);
    if (old) await delObj(old);
    stats.quemados++;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  const miss = [!base && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (miss.length) {
    console.error(`Faltan variables de entorno: ${miss.join(", ")}`);
    process.exit(1);
  }
  if (!(await hasTools())) {
    console.error("No se encuentra ffmpeg o ffprobe en el sistema");
    process.exit(1);
  }
  console.log(`Inicio de subtitulos, lote ${batch}${dry ? ", modo prueba sin cambios" : ""}`);
  let toRestore;
  let toBurn;
  try {
    toRestore = await getRows(selRestore(batch));
    toBurn = await getRows(selBurn(batch));
  } catch (e) {
    console.error(`No se pudo leer la tabla videos: ${e.message}`);
    process.exit(1);
  }
  console.log(`Encontrados ${toBurn.length} para quemar y ${toRestore.length} para restaurar`);
  for (const row of [...toRestore, ...toBurn]) {
    const p = plan(row);
    try {
      if (p.act === "restore") await doRestore(row);
      else if (p.act === "burn") await doBurn(row, p.src);
      else {
        console.log(`Video ${row.id}: omitido`);
        stats.omitidos++;
      }
    } catch (e) {
      await markErr(row, e);
    }
  }
  console.log(
    `Resumen: ${stats.quemados} quemados, ${stats.restaurados} restaurados, ${stats.omitidos} omitidos, ${stats.errores} con error`,
  );
}

await main();
