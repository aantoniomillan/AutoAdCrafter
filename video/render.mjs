import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const raiz = path.dirname(fileURLToPath(import.meta.url));
const dirCola = path.join(raiz, "cola");
const dirSalida = path.join(raiz, "salida");
const dirOut = path.join(raiz, "out");
const etiqueta = "reels";
const temas = ["halloween", "navidad", "neutro"];
const patronId = /^[a-z0-9][a-z0-9_-]{0,80}$/;

const args = process.argv.slice(2);
const local = args.includes("--local");
const solo = args.filter((a) => !a.startsWith("--"));
const navegador = process.env.BROWSER_EXECUTABLE || undefined;

const texto = (v) => (typeof v === "string" ? v.trim() : "");

const urlValida = (u) => {
  try {
    const url = new URL(u);
    if (url.protocol === "https:") return true;
    return local && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
};

const leerTrabajo = (id) => {
  const crudo = JSON.parse(readFileSync(path.join(dirCola, `${id}.json`), "utf8"));
  const props = {
    id,
    titulo: texto(crudo.titulo),
    subtitulo: texto(crudo.subtitulo),
    precio: texto(crudo.precio),
    imagenes: Array.isArray(crudo.imagenes) ? crudo.imagenes.filter(urlValida) : [],
    puntos: Array.isArray(crudo.puntos) ? crudo.puntos.map(texto).filter(Boolean).slice(0, 3) : [],
    cta: texto(crudo.cta),
    tema: temas.includes(crudo.tema) ? crudo.tema : "neutro",
  };
  const antes = texto(crudo.precioAntes);
  if (antes) props.precioAntes = antes;
  if (!patronId.test(id)) throw new Error("el id solo admite minusculas, numeros, guion y guion bajo");
  if (!props.titulo) throw new Error("falta el titulo");
  if (!props.precio) throw new Error("falta el precio");
  if (!props.cta) throw new Error("falta la cta");
  if (props.imagenes.length === 0) throw new Error("no hay imagenes https validas");
  return props;
};

const imagenAccesible = async (url) => {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 25000);
  try {
    const res = await fetch(url, { signal: control.signal });
    const tipo = res.headers.get("content-type") || "";
    await res.body?.cancel();
    return res.ok && !/text|json|xml/i.test(tipo);
  } catch {
    return false;
  } finally {
    clearTimeout(limite);
  }
};

const filtrarImagenes = async (props) => {
  const res = await Promise.all(props.imagenes.map(imagenAccesible));
  props.imagenes.forEach((u, i) => {
    if (!res[i]) console.log(`${props.id}: se omite la imagen ${u}`);
  });
  const imagenes = props.imagenes.filter((_, i) => res[i]);
  if (imagenes.length === 0) throw new Error("ninguna imagen se pudo descargar");
  return { ...props, imagenes };
};

const gh = (argsGh) => execFileSync("gh", argsGh, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const repositorio = () => {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim();
};

const asegurarRelease = (repo) => {
  try {
    gh(["release", "view", etiqueta, "--repo", repo]);
  } catch {
    try {
      gh([
        "release",
        "create",
        etiqueta,
        "--repo",
        repo,
        "--title",
        "Reels",
        "--notes",
        "Reels de producto generados automaticamente.",
        "--latest=false",
      ]);
      console.log(`release ${etiqueta} creada`);
    } catch (e) {
      gh(["release", "view", etiqueta, "--repo", repo]);
    }
  }
};

const subir = (repo, id, archivo) => {
  asegurarRelease(repo);
  gh(["release", "upload", etiqueta, archivo, "--repo", repo, "--clobber"]);
  return `https://github.com/${repo}/releases/download/${etiqueta}/${id}.mp4`;
};

const ids = readdirSync(dirCola)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .filter((id) => solo.length === 0 || solo.includes(id))
  .sort();

const pendientes = ids.filter((id) => local || !existsSync(path.join(dirSalida, `${id}.json`)));
console.log(`cola: ${ids.length} trabajos, ${pendientes.length} pendientes`);

if (pendientes.length === 0) process.exit(0);

mkdirSync(dirSalida, { recursive: true });
mkdirSync(dirOut, { recursive: true });

const repo = local ? "" : repositorio();
const serveUrl = await bundle({
  entryPoint: path.join(raiz, "src", "index.ts"),
  publicDir: path.join(raiz, "public"),
});
let fallos = 0;

for (const id of pendientes) {
  try {
    const props = await filtrarImagenes(leerTrabajo(id));
    const composition = await selectComposition({
      serveUrl,
      id: "Reel",
      inputProps: props,
      browserExecutable: navegador,
    });
    const archivo = path.join(dirOut, `${id}.mp4`);
    const inicio = Date.now();
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: archivo,
      inputProps: props,
      muted: true,
      imageFormat: "png",
      crf: 20,
      pixelFormat: "yuv420p",
      browserExecutable: navegador,
      timeoutInMilliseconds: 180000,
    });
    console.log(`${id}: renderizado en ${Math.round((Date.now() - inicio) / 1000)} s`);
    if (local) {
      console.log(`${id}: ${archivo}`);
      continue;
    }
    const url = subir(repo, id, archivo);
    const salida = {
      id,
      url,
      fecha: new Date().toISOString(),
      segundos: composition.durationInFrames / composition.fps,
    };
    writeFileSync(path.join(dirSalida, `${id}.json`), `${JSON.stringify(salida, null, 2)}\n`);
    console.log(`${id}: subido a ${url}`);
  } catch (e) {
    fallos += 1;
    console.error(`${id}: fallo, ${e instanceof Error ? e.message : e}`);
  }
}

process.exit(fallos > 0 ? 1 : 0);
