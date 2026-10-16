import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { burn, hasTools, run } from "./burn.mjs";

const ok = await hasTools();

const streams = async (file) => {
  const { out } = await run("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    file,
  ]);
  return JSON.parse(out).streams;
};

const mkVid = (file, { audio, fps }) =>
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc=size=1280x720:rate=${fps}:duration=3`,
    ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440:duration=3"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    ...(audio ? ["-c:a", "aac"] : []),
    "-shortest",
    file,
  ]);

for (const audio of [true, false]) {
  test(`quemado real ${audio ? "con" : "sin"} audio`, { skip: !ok && "sin ffmpeg" }, async () => {
    const dir = await mkdtemp(join(tmpdir(), "subs-test-"));
    try {
      const inp = join(dir, "in.mp4");
      const out = join(dir, "out.mp4");
      await mkVid(inp, { audio, fps: audio ? 60 : 25 });
      await burn(
        inp,
        out,
        "Prueba de subtítulos con eñes, {llaves} y \\barras. Segunda frase aquí.",
        dir,
      );
      const sts = await streams(out);
      const v = sts.find((s) => s.codec_type === "video");
      const a = sts.find((s) => s.codec_type === "audio");
      assert.equal(v.codec_name, "h264");
      assert.equal(v.width, 1080);
      assert.equal(v.height, 1920);
      assert.equal(v.pix_fmt, "yuv420p");
      assert.equal(v.profile, "High");
      const [n, d] = v.avg_frame_rate.split("/").map(Number);
      assert.ok(n / d <= 30.01);
      assert.equal(a.codec_name, "aac");
      assert.equal(a.sample_rate, "44100");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}
