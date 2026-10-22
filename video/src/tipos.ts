export type Tema = "halloween" | "navidad" | "neutro";

export type ReelProps = {
  id: string;
  titulo: string;
  subtitulo: string;
  precio: string;
  precioAntes?: string;
  imagenes: string[];
  puntos: string[];
  cta: string;
  tema: Tema;
};

export const fps = 30;
export const ancho = 1080;
export const alto = 1920;
export const duracion = 360;
export const dominio = "utilsla.myshopify.com";
export const temas: Tema[] = ["halloween", "navidad", "neutro"];

export const propsBase: ReelProps = {
  id: "ejemplo-aurora",
  titulo: "Proyector de aurora boreal",
  subtitulo: "Tu habitación, otro cielo",
  precio: "29,95 €",
  imagenes: [],
  puntos: ["16 colores y 4 efectos", "Recargable por USB-C", "Con mando a distancia"],
  cta: "Consíguelo en la colección Halloween",
  tema: "halloween",
};

export type EfectoTiktok = "temblor" | "zoom" | "paneo" | "punch";

export type EscenaTiktok = {
  texto: string;
  resaltar?: string;
  imagen?: string;
  segundos: number;
  efecto?: EfectoTiktok;
};

export type TiktokProps = {
  id: string;
  formato: "tiktok";
  precio: string;
  escenas: EscenaTiktok[];
  cta: string;
};

export const efectosTiktok: EfectoTiktok[] = ["temblor", "zoom", "paneo", "punch"];
export const framesTarjetaFinal = 60;
export const segundosMinimos = 0.8;
export const segundosMaximos = 3;

export const framesEscena = (segundos: number) =>
  Math.max(Math.round(segundosMinimos * fps), Math.round(Number(segundos) * fps) || 0);

export const duracionTiktok = (escenas: EscenaTiktok[]) =>
  escenas.reduce((total, e) => total + framesEscena(e.segundos), 0) + framesTarjetaFinal;

export const propsTiktokBase: TiktokProps = {
  id: "tiktok-ejemplo",
  formato: "tiktok",
  precio: "19,95 €",
  escenas: [
    { texto: "Esto cambia tu salón", resaltar: "cambia", efecto: "temblor", segundos: 1.6 },
    { texto: "Sin cables ni líos", resaltar: "cables", segundos: 1.4 },
  ],
  cta: "Enlace en el perfil",
};
