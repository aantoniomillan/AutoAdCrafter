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
