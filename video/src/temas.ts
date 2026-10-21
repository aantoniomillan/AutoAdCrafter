import type { Tema } from "./tipos";

export type Paleta = {
  fondoA: string;
  fondoB: string;
  fondoC: string;
  luzA: string;
  luzB: string;
  acento: string;
  acento2: string;
  texto: string;
  suave: string;
  tinta: string;
  niebla: string;
  particula: string;
  modo: "brasas" | "nieve" | "polvo";
  extra: "luna" | "estrellas" | "ninguno";
};

export const paletas: Record<Tema, Paleta> = {
  halloween: {
    fondoA: "#09090b",
    fondoB: "#15101b",
    fondoC: "#24113a",
    luzA: "rgba(255, 106, 0, 0.5)",
    luzB: "rgba(124, 58, 237, 0.45)",
    acento: "#ff7a1a",
    acento2: "#a45cf0",
    texto: "#fff6ec",
    suave: "#e0d2f0",
    tinta: "#1b0d02",
    niebla: "rgba(176, 130, 255, 0.2)",
    particula: "#ffa94d",
    modo: "brasas",
    extra: "luna",
  },
  navidad: {
    fondoA: "#03120d",
    fondoB: "#07271b",
    fondoC: "#0d3d2a",
    luzA: "rgba(245, 196, 81, 0.38)",
    luzB: "rgba(28, 130, 88, 0.5)",
    acento: "#f5c451",
    acento2: "#df4a3f",
    texto: "#fffaf0",
    suave: "#d3ebdc",
    tinta: "#2b1b00",
    niebla: "rgba(255, 255, 255, 0.11)",
    particula: "#ffffff",
    modo: "nieve",
    extra: "estrellas",
  },
  neutro: {
    fondoA: "#0a0f1f",
    fondoB: "#111b36",
    fondoC: "#172a55",
    luzA: "rgba(56, 189, 248, 0.38)",
    luzB: "rgba(99, 102, 241, 0.4)",
    acento: "#38bdf8",
    acento2: "#818cf8",
    texto: "#f4f8ff",
    suave: "#c7d3ee",
    tinta: "#04202e",
    niebla: "rgba(130, 170, 255, 0.13)",
    particula: "#c4e6ff",
    modo: "polvo",
    extra: "ninguno",
  },
};
