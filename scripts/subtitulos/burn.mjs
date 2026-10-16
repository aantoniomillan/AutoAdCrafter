import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAss, ffArgs, parseProbe } from "./logic.mjs";

export function run(cmd, args, { cwd, ms = 15 * 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const tmr = setTimeout(() => p.kill("SIGKILL"), ms);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    p.on("error", (e) => {
      clearTimeout(tmr);
      reject(new Error(`${cmd} no disponible: ${e.message}`));
    });
    p.on("close", (code, sig) => {
      clearTimeout(tmr);
      if (code === 0) return resolve({ out, err });
      const last = err.trim().split("\n").pop() || (sig ? `senal ${sig}` : `codigo ${code}`);
      reject(new Error(`${cmd} fallo: ${last}`));
    });
  });
}

export async function hasTools() {
  try {
    await run("ffmpeg", ["-hide_banner", "-version"], { ms: 20000 });
    await run("ffprobe", ["-hide_banner", "-version"], { ms: 20000 });
    return true;
  } catch {
    return false;
  }
}

export async function probe(file) {
  const { out } = await run(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    {
      ms: 60000,
    },
  );
  return parseProbe(JSON.parse(out));
}

export async function burn(inp, out, text, dir) {
  const info = await probe(inp);
  if (!info.hasVid) throw new Error("el archivo no tiene pista de video");
  if (!(info.dur > 0)) throw new Error("no se pudo obtener la duracion");
  await writeFile(join(dir, "subs.ass"), buildAss(text, info.dur), "utf8");
  await run(
    "ffmpeg",
    ffArgs({ inp, out, assName: "subs.ass", fps: info.fps, hasAudio: info.hasAudio }),
    { cwd: dir },
  );
  return info;
}
