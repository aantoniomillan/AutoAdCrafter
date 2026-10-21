import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { alto, ancho } from "./tipos";
import type { Paleta } from "./temas";

const total = 54;
const nieblas = 5;
const estrellas = 9;

const particulas = Array.from({ length: total }, (_, i) => ({
  x: random(`x${i}`) * ancho,
  fase: random(`f${i}`) * Math.PI * 2,
  tam: 0.35 + random(`t${i}`) * 0.65,
  vel: 0.5 + random(`v${i}`) * 1.3,
  desp: random(`d${i}`) * (alto + 160),
  amp: 14 + random(`a${i}`) * 46,
}));

const Particulas: React.FC<{ paleta: Paleta }> = ({ paleta }) => {
  const frame = useCurrentFrame();
  const nieve = paleta.modo === "nieve";
  const brasas = paleta.modo === "brasas";
  const recorrido = alto + 160;
  return (
    <AbsoluteFill>
      {particulas.map((p, i) => {
        const base = nieve ? 2.6 : brasas ? 2.9 : 0.9;
        const avance = (frame * base * p.vel + p.desp) % recorrido;
        const y = nieve ? avance - 80 : alto + 80 - avance;
        const x = p.x + Math.sin(frame / 34 + p.fase) * p.amp;
        const tam = (nieve ? 10 + p.tam * 26 : brasas ? 5 + p.tam * 13 : 4 + p.tam * 10);
        const parpadeo = 0.55 + 0.45 * Math.sin(frame / 7 + p.fase * 3);
        const opacidad = nieve ? 0.55 + p.tam * 0.4 : parpadeo * (0.45 + p.tam * 0.55);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: tam,
              height: tam,
              borderRadius: "50%",
              background: nieve
                ? `radial-gradient(circle, ${paleta.particula} 0%, rgba(255,255,255,0.7) 55%, rgba(255,255,255,0) 100%)`
                : paleta.particula,
              opacity: opacidad,
              filter: nieve && p.tam > 0.7 ? "blur(2.5px)" : undefined,
              boxShadow: nieve ? undefined : `0 0 ${tam * 3}px ${tam}px ${paleta.particula}66`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Niebla: React.FC<{ paleta: Paleta }> = ({ paleta }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {Array.from({ length: nieblas }, (_, i) => {
        const fase = random(`nb${i}`) * Math.PI * 2;
        const vel = 0.012 + random(`nv${i}`) * 0.012;
        const x = -380 + Math.sin(frame * vel + fase) * 260 + (i % 2) * 120;
        const y = 180 + i * 330 + Math.cos(frame * vel * 0.8 + fase) * 40;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 1500,
              height: 520,
              borderRadius: "50%",
              background: `radial-gradient(ellipse at center, ${paleta.niebla} 0%, rgba(0,0,0,0) 68%)`,
              opacity: 0.8,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Luna: React.FC<{ paleta: Paleta }> = ({ paleta }) => {
  const frame = useCurrentFrame();
  const pulso = 1 + Math.sin(frame / 40) * 0.03;
  return (
    <div
      style={{
        position: "absolute",
        right: -90,
        top: 70,
        width: 420,
        height: 420,
        borderRadius: "50%",
        background: `radial-gradient(circle at 36% 34%, #fff1d6 0%, #ffcf8a 42%, ${paleta.acento} 100%)`,
        opacity: 0.2,
        transform: `scale(${pulso})`,
        boxShadow: `0 0 160px 60px ${paleta.acento}40`,
      }}
    />
  );
};

const Estrellas: React.FC<{ paleta: Paleta }> = ({ paleta }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: estrellas }, (_, i) => {
        const x = random(`ex${i}`) * ancho;
        const y = random(`ey${i}`) * alto * 0.85;
        const tam = 34 + random(`et${i}`) * 44;
        const brillo = 0.35 + 0.65 * Math.abs(Math.sin(frame / 18 + i * 1.7));
        return (
          <svg
            key={i}
            width={tam}
            height={tam}
            viewBox="0 0 24 24"
            style={{
              position: "absolute",
              left: x,
              top: y,
              opacity: brillo * 0.8,
              transform: `scale(${0.7 + brillo * 0.5}) rotate(${i * 9}deg)`,
              filter: `drop-shadow(0 0 8px ${paleta.acento})`,
            }}
          >
            <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" fill={paleta.acento} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

export const Fondo: React.FC<{ paleta: Paleta }> = ({ paleta }) => {
  const frame = useCurrentFrame();
  const ax = 20 + Math.sin(frame / 55) * 14;
  const ay = 88 + Math.cos(frame / 70) * 6;
  const bx = 82 + Math.cos(frame / 62) * 12;
  const by = 14 + Math.sin(frame / 48) * 7;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${paleta.fondoA} 0%, ${paleta.fondoB} 52%, ${paleta.fondoC} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${ax}% ${ay}%, ${paleta.luzA} 0%, rgba(0,0,0,0) 52%), radial-gradient(circle at ${bx}% ${by}%, ${paleta.luzB} 0%, rgba(0,0,0,0) 50%)`,
        }}
      />
      {paleta.extra === "luna" ? <Luna paleta={paleta} /> : null}
      {paleta.extra === "estrellas" ? <Estrellas paleta={paleta} /> : null}
      <Niebla paleta={paleta} />
      <Particulas paleta={paleta} />
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
