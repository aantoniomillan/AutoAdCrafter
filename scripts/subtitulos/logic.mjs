export const outW = 1080;
export const outH = 1920;
export const maxFps = 30;
export const bucket = "videos";

export const cfg = {
  font: "DejaVu Sans",
  size: 76,
  outline: 5,
  shadow: 2,
  marginH: 70,
  marginV: 400,
  maxWords: 7,
  maxChars: 32,
  lineChars: 18,
};

export const normTxt = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();

export const hasTxt = (s) => normTxt(s).length > 0;

export const splitSents = (s) =>
  String(s ?? "")
    .split(/\r?\n|\r|(?<=[.!?…;])\s+/)
    .map(normTxt)
    .filter(Boolean);

export function chunkWords(words, maxW = cfg.maxWords, maxC = cfg.maxChars) {
  if (!words.length) return [];
  const n = Math.ceil(words.length / maxW);
  const per = Math.ceil(words.length / n);
  const out = [];
  for (let i = 0; i < words.length; i += per) {
    let cur = [];
    for (const w of words.slice(i, i + per)) {
      if (cur.length && [...cur, w].join(" ").length > maxC) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
  }
  return out;
}

export function toLines(words, lineC = cfg.lineChars) {
  const full = words.join(" ");
  if (words.length < 2 || full.length <= lineC) return [full];
  let best = 1;
  let bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const len = Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length);
    if (len < bestLen) {
      bestLen = len;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

export const toBlocks = (text, o = cfg) =>
  splitSents(text).flatMap((s) =>
    chunkWords(s.split(" "), o.maxWords, o.maxChars).map((c) => toLines(c, o.lineChars)),
  );

export function timeBlocks(n, dur) {
  if (!(n > 0) || !(dur > 0)) return [];
  const step = dur / n;
  return Array.from({ length: n }, (_, i) => ({
    st: i * step,
    en: i === n - 1 ? dur : (i + 1) * step,
  }));
}

const pad2 = (v) => String(v).padStart(2, "0");

export function fmtT(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs % 100)}`;
}

export const assEsc = (s) =>
  normTxt(s).replace(/\\/g, "\\​").replace(/\{/g, "\\{").replace(/\}/g, "\\}");

export function buildAss(text, dur, o = cfg) {
  const blocks = toBlocks(text, o);
  const times = timeBlocks(blocks.length, dur);
  const head = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${outW}`,
    `PlayResY: ${outH}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${o.font},${o.size},&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,${o.outline},${o.shadow},2,${o.marginH},${o.marginH},${o.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const evs = blocks.map(
    (lines, i) =>
      `Dialogue: 0,${fmtT(times[i].st)},${fmtT(times[i].en)},Default,,0,0,0,,${lines.map(assEsc).join("\\N")}`,
  );
  return [...head, ...evs, ""].join("\n");
}

export function parseFps(r) {
  const [a, b] = String(r ?? "")
    .split("/")
    .map(Number);
  const v = b ? a / b : a;
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function parseProbe(info) {
  const sts = info?.streams ?? [];
  const vid = sts.find((s) => s.codec_type === "video");
  const dur = Number(vid?.duration) || Number(info?.format?.duration) || 0;
  return {
    hasVid: !!vid,
    hasAudio: sts.some((s) => s.codec_type === "audio"),
    dur,
    fps: parseFps(vid?.avg_frame_rate) || parseFps(vid?.r_frame_rate),
    w: Number(vid?.width) || 0,
    h: Number(vid?.height) || 0,
  };
}

export function vFilter(assName, fps) {
  const parts = [
    `scale=${outW}:${outH}:force_original_aspect_ratio=decrease`,
    `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1",
  ];
  if (!(fps > 0) || fps > maxFps + 0.01) parts.push(`fps=${maxFps}`);
  parts.push(`ass=${assName}`);
  return parts.join(",");
}

export function ffArgs({ inp, out, assName, fps, hasAudio }) {
  if (!/^[\w.-]+$/.test(assName)) throw new Error("nombre de ass no valido");
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    inp,
    ...(hasAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]),
    "-vf",
    vFilter(assName, fps),
    "-map",
    "0:v:0",
    "-map",
    hasAudio ? "0:a:0" : "1:a:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-ac",
    "2",
    ...(hasAudio ? [] : ["-shortest"]),
    "-movflags",
    "+faststart",
    out,
  ];
}

export const trimBase = (b) =>
  String(b ?? "")
    .trim()
    .replace(/\/+$/, "");

export const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

export const pubUrl = (base, path) =>
  `${trimBase(base)}/storage/v1/object/public/${bucket}/${path}`;

export const objUrl = (base, path) =>
  `${trimBase(base)}/storage/v1/object/${bucket}/${encPath(path)}`;

export const newPath = (userId, id) => `${userId}/${id}.mp4`;

export function plan(row) {
  if (!row || row.lockedAt || row.status !== "pendiente" || row.processed) return { act: "skip" };
  if (hasTxt(row.subtitleText)) return { act: "burn", src: row.srcPath || row.path };
  if (row.srcPath) return { act: "restore" };
  return { act: "skip" };
}

export function burnPatch(row, path, base) {
  const src = row.srcPath || row.path;
  const old = row.srcPath && row.path !== row.srcPath && row.path !== path ? row.path : null;
  return { patch: { path, publicUrl: pubUrl(base, path), processed: true, srcPath: src }, old };
}

export function restorePatch(row, base) {
  const old = row.path && row.path !== row.srcPath ? row.path : null;
  return { patch: { path: row.srcPath, publicUrl: pubUrl(base, row.srcPath), srcPath: null }, old };
}

const cols = "id,userId,path,publicUrl,subtitleText,status,processed,srcPath,lockedAt,scheduledAt";
const nonBlank = encodeURIComponent("[^[:space:]]");

export const selBurn = (n) =>
  `select=${cols}&status=eq.pendiente&processed=eq.false&lockedAt=is.null&subtitleText=match.${nonBlank}&order=scheduledAt.asc&limit=${n}`;

export const selRestore = (n) =>
  `select=${cols}&status=eq.pendiente&processed=eq.false&lockedAt=is.null&srcPath=not.is.null&subtitleText=not.match.${nonBlank}&order=scheduledAt.asc&limit=${n}`;

const eqV = (v) => `eq.${encodeURIComponent(v)}`;

export const condBurn = (row) =>
  `id=${eqV(row.id)}&lockedAt=is.null&processed=eq.false&status=eq.pendiente&path=${eqV(row.path)}&subtitleText=${eqV(row.subtitleText)}`;

export const condRestore = (row) =>
  `id=${eqV(row.id)}&lockedAt=is.null&processed=eq.false&status=eq.pendiente&path=${eqV(row.path)}&srcPath=${eqV(row.srcPath)}`;

export const condErr = (row) => `id=${eqV(row.id)}&lockedAt=is.null&status=eq.pendiente`;

export function errTxt(e) {
  const msg =
    normTxt(String(e?.message ?? e ?? "error desconocido").split("\n")[0]) || "error desconocido";
  return `Subtitulos: ${msg}`.slice(0, 300);
}

export function parseBatch(v, def = 5) {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : def;
}

export const authHeaders = (key) =>
  key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
