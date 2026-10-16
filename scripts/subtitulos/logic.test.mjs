import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assEsc,
  authHeaders,
  buildAss,
  burnPatch,
  chunkWords,
  condBurn,
  errTxt,
  ffArgs,
  fmtT,
  newPath,
  objUrl,
  parseBatch,
  parseFps,
  parseProbe,
  plan,
  pubUrl,
  restorePatch,
  selBurn,
  selRestore,
  splitSents,
  timeBlocks,
  toBlocks,
  toLines,
  vFilter,
} from "./logic.mjs";

const base = "https://abc.supabase.co/";
const uid = "11111111-1111-1111-1111-111111111111";
const row = (o = {}) => ({
  id: "v1",
  userId: uid,
  path: `${uid}/a.mp4`,
  srcPath: null,
  subtitleText: "Hola mundo",
  status: "pendiente",
  processed: false,
  lockedAt: null,
  ...o,
});

test("splitSents separa por frases y saltos de linea", () => {
  assert.deepEqual(splitSents("Hola.  Que tal?\nBien  bien!  Fin"), [
    "Hola.",
    "Que tal?",
    "Bien bien!",
    "Fin",
  ]);
  assert.deepEqual(splitSents("   \n  "), []);
  assert.deepEqual(splitSents(null), []);
});

test("chunkWords reparte equilibrado y respeta limites", () => {
  const ws = "uno dos tres cuatro cinco seis siete ocho".split(" ");
  const out = chunkWords(ws, 7, 100);
  assert.deepEqual(
    out.map((c) => c.length),
    [4, 4],
  );
  for (const c of chunkWords(ws, 7, 15)) assert.ok(c.join(" ").length <= 15 || c.length === 1);
  assert.deepEqual(chunkWords([], 7, 30), []);
});

test("toLines parte en dos lineas equilibradas", () => {
  assert.deepEqual(toLines(["corto"], 18), ["corto"]);
  assert.deepEqual(toLines("esto es una frase bastante larga".split(" "), 18), [
    "esto es una frase",
    "bastante larga",
  ]);
  assert.ok(toLines("a b c d e f g".split(" "), 3).length <= 2);
});

test("toBlocks genera bloques de maximo dos lineas", () => {
  const txt =
    "Descubre nuestra nueva coleccion de verano con descuentos increibles. Solo esta semana en tienda y online!";
  const bl = toBlocks(txt);
  assert.ok(bl.length >= 3);
  for (const b of bl) {
    assert.ok(b.length >= 1 && b.length <= 2);
    assert.ok(b.join(" ").split(" ").length <= 7);
  }
  assert.equal(bl.flat().join(" "), txt);
});

test("timeBlocks reparte uniforme hasta la duracion", () => {
  const t = timeBlocks(4, 6);
  assert.equal(t.length, 4);
  assert.equal(t[0].st, 0);
  assert.equal(t[1].st, 1.5);
  assert.equal(t[3].en, 6);
  assert.deepEqual(timeBlocks(0, 5), []);
  assert.deepEqual(timeBlocks(3, 0), []);
});

test("fmtT formatea tiempos ASS", () => {
  assert.equal(fmtT(0), "0:00:00.00");
  assert.equal(fmtT(1.5), "0:00:01.50");
  assert.equal(fmtT(3725.257), "1:02:05.26");
  assert.equal(fmtT(-1), "0:00:00.00");
});

test("assEsc escapa llaves, barras y saltos y mantiene acentos", () => {
  assert.equal(assEsc("a{b}c"), "a\\{b\\}c");
  assert.equal(assEsc("x\\Ny"), "x\\​Ny");
  assert.equal(assEsc("uno\ndos\r\ntres"), "uno dos tres");
  assert.equal(assEsc("Año, camión, pingüino ¿qué?"), "Año, camión, pingüino ¿qué?");
  assert.ok(!/\{[^\\]/.test(assEsc("{\\b1}hola").replace(/\\\{/g, "")));
});

test("buildAss produce cabecera y eventos correctos", () => {
  const ass = buildAss("Hola mundo. Esto es una prueba con eñes y {llaves}", 6);
  assert.match(ass, /PlayResX: 1080/);
  assert.match(ass, /PlayResY: 1920/);
  assert.match(ass, /WrapStyle: 0/);
  const style = ass.split("\n").find((l) => l.startsWith("Style: "));
  const f = style.slice(7).split(",");
  assert.equal(f[1], "DejaVu Sans");
  assert.ok(+f[2] >= 64 && +f[2] <= 80);
  assert.equal(f[7], "-1");
  assert.ok(+f[16] >= 4 && +f[16] <= 6);
  assert.equal(f[18], "2");
  assert.ok(+f[21] / 1920 >= 0.18 && +f[21] / 1920 <= 0.22);
  const evs = ass.split("\n").filter((l) => l.startsWith("Dialogue:"));
  assert.equal(evs.length, 3);
  assert.match(evs[0], /^Dialogue: 0,0:00:00\.00,0:00:02\.00,Default,,0,0,0,,Hola mundo\.$/);
  assert.equal(evs[1], "Dialogue: 0,0:00:02.00,0:00:04.00,Default,,0,0,0,,Esto es una prueba");
  assert.match(evs[2], /\\N/);
  assert.match(evs[2], /^Dialogue: 0,0:00:04\.00,0:00:06\.00,/);
  assert.match(evs[2], /eñes/);
  assert.match(evs[2], /\\\{llaves\\\}/);
});

test("parseFps y parseProbe", () => {
  assert.equal(parseFps("30/1"), 30);
  assert.ok(Math.abs(parseFps("30000/1001") - 29.97) < 0.01);
  assert.equal(parseFps("0/0"), 0);
  assert.equal(parseFps(undefined), 0);
  const p = parseProbe({
    streams: [
      { codec_type: "video", width: 1280, height: 720, avg_frame_rate: "60/1", duration: "6.0" },
      { codec_type: "audio" },
    ],
    format: { duration: "6.05" },
  });
  assert.deepEqual(p, { hasVid: true, hasAudio: true, dur: 6, fps: 60, w: 1280, h: 720 });
  const q = parseProbe({
    streams: [{ codec_type: "video", r_frame_rate: "25/1" }],
    format: { duration: "3.5" },
  });
  assert.equal(q.dur, 3.5);
  assert.equal(q.fps, 25);
  assert.equal(q.hasAudio, false);
});

test("vFilter limita fps y encaja en 9:16", () => {
  assert.equal(
    vFilter("s.ass", 25),
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,ass=s.ass",
  );
  assert.match(vFilter("s.ass", 60), /setsar=1,fps=30,ass=s\.ass$/);
  assert.match(vFilter("s.ass", 0), /fps=30/);
  assert.doesNotMatch(vFilter("s.ass", 30), /fps=/);
});

test("ffArgs con audio y sin audio", () => {
  const a = ffArgs({
    inp: "/t/in.mp4",
    out: "/t/out.mp4",
    assName: "subs.ass",
    fps: 30,
    hasAudio: true,
  });
  const s = a.join(" ");
  for (const x of [
    "-c:v libx264",
    "-pix_fmt yuv420p",
    "-profile:v high",
    "-preset veryfast",
    "-crf 20",
    "-c:a aac",
    "-b:a 128k",
    "-ar 44100",
    "-movflags +faststart",
    "-map 0:a:0",
  ])
    assert.ok(s.includes(x), x);
  assert.ok(!a.includes("-shortest"));
  assert.equal(a.at(-1), "/t/out.mp4");
  const b = ffArgs({
    inp: "/t/in.mp4",
    out: "/t/out.mp4",
    assName: "subs.ass",
    fps: 30,
    hasAudio: false,
  });
  assert.ok(b.includes("anullsrc=channel_layout=stereo:sample_rate=44100"));
  assert.ok(b.includes("-shortest"));
  assert.ok(b.join(" ").includes("-map 1:a:0"));
  assert.throws(() => ffArgs({ inp: "a", out: "b", assName: "x:y.ass", fps: 30, hasAudio: true }));
});

test("URLs de storage", () => {
  assert.equal(
    pubUrl(base, `${uid}/a.mp4`),
    `https://abc.supabase.co/storage/v1/object/public/videos/${uid}/a.mp4`,
  );
  assert.equal(
    objUrl(base, `${uid}/a b.mp4`),
    `https://abc.supabase.co/storage/v1/object/videos/${uid}/a%20b.mp4`,
  );
  assert.equal(newPath(uid, "n"), `${uid}/n.mp4`);
});

test("plan decide la accion", () => {
  assert.deepEqual(plan(row()), { act: "burn", src: `${uid}/a.mp4` });
  assert.deepEqual(plan(row({ srcPath: `${uid}/o.mp4` })), { act: "burn", src: `${uid}/o.mp4` });
  assert.deepEqual(plan(row({ subtitleText: "  ", srcPath: `${uid}/o.mp4` })), { act: "restore" });
  assert.deepEqual(plan(row({ subtitleText: "" })), { act: "skip" });
  assert.deepEqual(plan(row({ lockedAt: "2026-01-01T00:00:00Z" })), { act: "skip" });
  assert.deepEqual(plan(row({ processed: true })), { act: "skip" });
  assert.deepEqual(plan(row({ status: "error" })), { act: "skip" });
});

test("burnPatch primera vez guarda el original y no borra nada", () => {
  const r = burnPatch(row(), `${uid}/n.mp4`, base);
  assert.deepEqual(r.patch, {
    path: `${uid}/n.mp4`,
    publicUrl: `https://abc.supabase.co/storage/v1/object/public/videos/${uid}/n.mp4`,
    processed: true,
    srcPath: `${uid}/a.mp4`,
  });
  assert.equal(r.old, null);
});

test("burnPatch con quemado previo borra el anterior y nunca el original", () => {
  const r = burnPatch(row({ path: `${uid}/q.mp4`, srcPath: `${uid}/o.mp4` }), `${uid}/n.mp4`, base);
  assert.equal(r.patch.srcPath, `${uid}/o.mp4`);
  assert.equal(r.old, `${uid}/q.mp4`);
  const s = burnPatch(row({ path: `${uid}/o.mp4`, srcPath: `${uid}/o.mp4` }), `${uid}/n.mp4`, base);
  assert.equal(s.old, null);
});

test("restorePatch vuelve al original y borra el quemado", () => {
  const r = restorePatch(
    row({ subtitleText: "", path: `${uid}/q.mp4`, srcPath: `${uid}/o.mp4` }),
    base,
  );
  assert.deepEqual(r.patch, {
    path: `${uid}/o.mp4`,
    publicUrl: `https://abc.supabase.co/storage/v1/object/public/videos/${uid}/o.mp4`,
    srcPath: null,
  });
  assert.equal(r.old, `${uid}/q.mp4`);
  assert.equal(
    restorePatch(row({ path: `${uid}/o.mp4`, srcPath: `${uid}/o.mp4` }), base).old,
    null,
  );
});

test("consultas PostgREST", () => {
  const b = selBurn(5);
  for (const x of [
    "status=eq.pendiente",
    "processed=eq.false",
    "lockedAt=is.null",
    "subtitleText=match.",
    "order=scheduledAt.asc",
    "limit=5",
  ])
    assert.ok(b.includes(x), x);
  const r = selRestore(3);
  for (const x of ["srcPath=not.is.null", "subtitleText=not.match.", "lockedAt=is.null", "limit=3"])
    assert.ok(r.includes(x), x);
  const c = condBurn(row({ subtitleText: "Hola & adiós?" }));
  assert.ok(c.includes("id=eq.v1&lockedAt=is.null&processed=eq.false"));
  assert.ok(c.includes(`subtitleText=eq.${encodeURIComponent("Hola & adiós?")}`));
});

test("errTxt y parseBatch", () => {
  assert.equal(errTxt(new Error("ffmpeg fallo: algo\nmas")), "Subtitulos: ffmpeg fallo: algo");
  assert.ok(errTxt(new Error("x".repeat(1000))).length <= 300);
  assert.equal(errTxt(undefined), "Subtitulos: error desconocido");
  assert.equal(parseBatch(undefined), 5);
  assert.equal(parseBatch(""), 5);
  assert.equal(parseBatch("3"), 3);
  assert.equal(parseBatch("0"), 5);
  assert.equal(parseBatch("abc"), 5);
  assert.equal(parseBatch("500"), 50);
});

test("authHeaders solo envia Bearer con claves JWT antiguas", () => {
  assert.deepEqual(authHeaders("sb_secret_abc"), { apikey: "sb_secret_abc" });
  assert.deepEqual(authHeaders("eyJabc"), { apikey: "eyJabc", Authorization: "Bearer eyJabc" });
});
