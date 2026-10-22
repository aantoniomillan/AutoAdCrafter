import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { familia } from "./fuentes";
import { useImagenes } from "./imagenes";
import { dominio, framesEscena, framesTarjetaFinal } from "./tipos";
import type { EfectoTiktok, EscenaTiktok, TiktokProps } from "./tipos";

const naranja = "#FF7A1A";
const rebote = { damping: 9, stiffness: 240, mass: 0.7 };

const limitar = (v: number) => Math.min(1, Math.max(0, v));

const normalizar = (p: string) =>
  p
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const marcarResaltadas = (palabras: string[], resaltar?: string) => {
  const marcas = palabras.map(() => false);
  const objetivo = (resaltar ?? "")
    .split(/\s+/)
    .map(normalizar)
    .filter(Boolean);
  if (objetivo.length === 0) return marcas;
  const limpias = palabras.map(normalizar);
  for (let i = 0; i + objetivo.length <= limpias.length; i++) {
    if (objetivo.every((o, k) => limpias[i + k] === o)) {
      for (let k = 0; k < objetivo.length; k++) marcas[i + k] = true;
      break;
    }
  }
  return marcas;
};

const tamanoTexto = (texto: string, conImagen: boolean) => {
  const n = texto.length;
  const base = n <= 14 ? 150 : n <= 28 ? 126 : n <= 44 ? 110 : 92;
  return conImagen ? Math.round(base * 0.9) : base;
};

const Palabra: React.FC<{
  texto: string;
  resaltada: boolean;
  tam: number;
  retraso: number;
}> = ({ texto, resaltada, tam, retraso }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - retraso, fps, config: rebote });
  const visible = frame >= retraso;
  const color = resaltada ? naranja : "#ffffff";
  const comun: React.CSSProperties = {
    gridArea: "1 / 1",
    fontFamily: familia,
    fontWeight: 700,
    fontSize: tam,
    lineHeight: 1.08,
    whiteSpace: "nowrap",
  };
  return (
    <span
      style={{
        display: "inline-grid",
        margin: `0 ${tam * 0.17}px`,
        opacity: visible ? 1 : 0,
        transform: `translateY(${(1 - p) * 40}px) scale(${0.45 + 0.55 * p})`,
        transformOrigin: "50% 70%",
      }}
    >
      <span
        style={{
          ...comun,
          color: "#000",
          WebkitTextStroke: `${tam * 0.2}px #000`,
          strokeLinejoin: "round",
        }}
      >
        {texto}
      </span>
      <span
        style={{
          ...comun,
          color,
          WebkitTextStroke: `${tam * 0.035}px ${color}`,
        }}
      >
        {texto}
      </span>
    </span>
  );
};

const Subtitulo: React.FC<{ escena: EscenaTiktok; conImagen: boolean }> = ({
  escena,
  conImagen,
}) => {
  const palabras = escena.texto.split(/\s+/).filter(Boolean);
  const marcas = marcarResaltadas(palabras, escena.resaltar);
  const tam = tamanoTexto(escena.texto, conImagen);
  const paso = Math.min(4, Math.max(2, Math.floor(16 / palabras.length)));
  return (
    <div
      style={{
        textAlign: "center",
        filter: "drop-shadow(0 12px 10px rgba(0,0,0,0.75))",
        width: "100%",
      }}
    >
      {palabras.map((p, i) => (
        <Palabra key={i} texto={p} resaltada={marcas[i] ?? false} tam={tam} retraso={2 + i * paso} />
      ))}
    </div>
  );
};

const temblor = (frame: number, fuerza: number) => ({
  x: (Math.sin(frame * 2.9) * 9 + Math.sin(frame * 7.1) * 5) * fuerza,
  y: (Math.cos(frame * 3.3) * 9 + Math.cos(frame * 6.3) * 5) * fuerza,
  giro: Math.sin(frame * 2.1) * 0.7 * fuerza,
});

const movimiento = (
  efecto: EfectoTiktok | "reposo",
  frame: number,
  total: number,
  indice: number,
) => {
  const p = limitar(frame / Math.max(1, total));
  const golpe = Math.exp(-frame / 3.2) * 0.1;
  if (efecto === "zoom") {
    const entra = indice % 2 === 0;
    const escala = entra ? 1.06 + p * 0.2 : 1.26 - p * 0.2;
    return { escala: escala + golpe, x: 0, y: 0, giro: 0 };
  }
  if (efecto === "paneo") {
    const sentido = indice % 2 === 0 ? 1 : -1;
    const e = Easing.inOut(Easing.quad)(p);
    return {
      escala: 1.24 + golpe * 0.6,
      x: sentido * (-5 + 10 * e),
      y: sentido * (2 - 4 * e),
      giro: 0,
    };
  }
  if (efecto === "punch") {
    const impacto = Math.exp(-frame / 3.4);
    return {
      escala: 1.12 + p * 0.1 + impacto * 0.3,
      x: 0,
      y: 0,
      giro: -impacto * 2.2,
    };
  }
  if (efecto === "temblor") {
    const t = temblor(frame, 1);
    return {
      escala: 1.14 + p * 0.1 + golpe,
      x: (t.x / 1080) * 100,
      y: (t.y / 1920) * 100,
      giro: t.giro,
    };
  }
  return { escala: 1.04 + p * 0.1 + golpe, x: 0, y: 0, giro: 0 };
};

const FondoTexto: React.FC = () => {
  const frame = useCurrentFrame();
  const brillo = 0.5 + 0.5 * Math.sin(frame / 7);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 75% 55% at 50% 45%, rgba(${34 + brillo * 10},${28 + brillo * 6},${24},1) 0%, #050505 60%, #000 100%)`,
      }}
    />
  );
};

const Vineta: React.FC<{ fuerza: number }> = ({ fuerza }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 85% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${fuerza}) 100%)`,
    }}
  />
);

const Escena: React.FC<{
  escena: EscenaTiktok;
  indice: number;
  total: number;
  url?: string;
  alFallar: (url: string) => void;
}> = ({ escena, indice, total, url, alFallar }) => {
  const frame = useCurrentFrame();
  const conImagen = Boolean(url);
  const efectoBase: EfectoTiktok | "reposo" =
    escena.efecto ?? (conImagen ? (indice % 2 === 0 ? "zoom" : "paneo") : "reposo");

  if (!conImagen) {
    const respira = 1 + 0.05 * limitar(frame / total) + Math.exp(-frame / 3.2) * 0.08;
    const t = escena.efecto === "temblor" ? temblor(frame, 0.7) : { x: 0, y: 0, giro: 0 };
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
        <FondoTexto />
        <Vineta fuerza={0.85} />
        <AbsoluteFill
          style={{
            top: 330,
            height: 1100,
            bottom: "auto",
            left: 60,
            right: 60,
            width: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `translate(${t.x}px, ${t.y}px) rotate(${t.giro}deg) scale(${respira})`,
          }}
        >
          <Subtitulo escena={escena} conImagen={false} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const m = movimiento(efectoBase, frame, total, indice);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${m.x}%, ${m.y}%) rotate(${m.giro}deg) scale(${m.escala})`,
          transformOrigin: "50% 50%",
        }}
      >
        <Img
          src={url as string}
          onError={() => alFallar(url as string)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.45) 100%)",
        }}
      />
      <Vineta fuerza={0.45} />
      <AbsoluteFill
        style={{
          top: 1000,
          height: 560,
          bottom: "auto",
          left: 60,
          right: 60,
          width: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${1 + Math.exp(-frame / 3) * 0.06})`,
        }}
      >
        <Subtitulo escena={escena} conImagen />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TarjetaFinal: React.FC<{ precio: string; cta: string }> = ({ precio, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pPrecio = spring({ frame: frame - 3, fps, config: rebote });
  const pCta = spring({ frame: frame - 14, fps, config: rebote });
  const pDom = spring({ frame: frame - 22, fps, config: rebote });
  const latido = 1 + 0.035 * Math.sin(frame / 3.2);
  const tamPrecio = Math.min(300, Math.floor(900 / Math.max(3, precio.length * 0.54)));
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: `radial-gradient(ellipse 90% 60% at 50% 42%, #FF9A4A 0%, ${naranja} 45%, #E8590A 100%)`,
      }}
    >
      <Vineta fuerza={0.35} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          transform: `scale(${1 + 0.04 * limitar(frame / framesTarjetaFinal)})`,
        }}
      >
        <div
          style={{
            display: "inline-grid",
            opacity: limitar(pPrecio * 2),
            transform: `scale(${(0.4 + 0.6 * pPrecio) * latido})`,
            filter: "drop-shadow(0 16px 0 rgba(0,0,0,0.35))",
          }}
        >
          <span
            style={{
              gridArea: "1 / 1",
              fontFamily: familia,
              fontWeight: 700,
              fontSize: tamPrecio,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: "#000",
              WebkitTextStroke: `${tamPrecio * 0.18}px #000`,
              strokeLinejoin: "round",
            }}
          >
            {precio}
          </span>
          <span
            style={{
              gridArea: "1 / 1",
              fontFamily: familia,
              fontWeight: 700,
              fontSize: tamPrecio,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: "#fff",
              WebkitTextStroke: `${tamPrecio * 0.03}px #fff`,
            }}
          >
            {precio}
          </span>
        </div>
        <div
          style={{
            marginTop: 90,
            padding: "32px 70px",
            borderRadius: 999,
            backgroundColor: "#000",
            color: "#fff",
            fontFamily: familia,
            fontWeight: 700,
            fontSize: 74,
            whiteSpace: "nowrap",
            opacity: limitar(pCta * 2),
            transform: `translateY(${(1 - pCta) * 50}px) scale(${0.7 + 0.3 * pCta})`,
          }}
        >
          {cta}
        </div>
        <div
          style={{
            marginTop: 46,
            color: "#000",
            fontFamily: familia,
            fontWeight: 700,
            fontSize: 58,
            whiteSpace: "nowrap",
            opacity: limitar(pDom * 2),
            transform: `translateY(${(1 - pDom) * 40}px)`,
          }}
        >
          {dominio}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Transiciones: React.FC<{ cortes: number[] }> = ({ cortes }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {cortes.map((corte, i) => {
        const t = frame - corte;
        if (t < -4 || t > 7) return null;
        if (i % 2 === 0) {
          const o = interpolate(t, [-2, 0, 6], [0, 0.9, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <AbsoluteFill key={corte} style={{ backgroundColor: "#fff", opacity: o }} />
          );
        }
        const x = interpolate(t, [-4, 6], [-1250, 1250], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.quad),
        });
        return (
          <AbsoluteFill key={corte} style={{ overflow: "hidden" }}>
            <div
              style={{
                position: "absolute",
                top: -200,
                bottom: -200,
                left: "50%",
                width: 700,
                marginLeft: -350,
                transform: `translateX(${x}px) skewX(-16deg)`,
                background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, ${naranja} 30%, #ffffff 50%, ${naranja} 70%, rgba(255,255,255,0) 100%)`,
              }}
            />
          </AbsoluteFill>
        );
      })}
    </>
  );
};

const Progreso: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = limitar((frame + 1) / durationInFrames);
  return (
    <div
      style={{
        position: "absolute",
        top: 34,
        left: 44,
        right: 44,
        height: 8,
        borderRadius: 4,
        backgroundColor: "rgba(255,255,255,0.3)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${p * 100}%`,
          height: "100%",
          backgroundColor: "#fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
        }}
      />
    </div>
  );
};

export const Tiktok: React.FC<TiktokProps> = ({ escenas, precio, cta }) => {
  const urls = useMemo(
    () => escenas.map((e) => e.imagen ?? "").filter((u) => u.length > 0),
    [escenas],
  );
  const { imagenes, marcarFallo } = useImagenes(urls);

  const tramos = useMemo(() => {
    let inicio = 0;
    return escenas.map((e) => {
      const frames = framesEscena(e.segundos);
      const tramo = { inicio, frames };
      inicio += frames;
      return tramo;
    });
  }, [escenas]);

  const inicioFinal = tramos.length
    ? (tramos[tramos.length - 1]?.inicio ?? 0) + (tramos[tramos.length - 1]?.frames ?? 0)
    : 0;
  const cortes = [...tramos.slice(1).map((t) => t.inicio), inicioFinal];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {escenas.map((escena, i) => {
        const tramo = tramos[i];
        if (!tramo) return null;
        const url = escena.imagen && imagenes.includes(escena.imagen) ? escena.imagen : undefined;
        return (
          <Sequence key={i} from={tramo.inicio} durationInFrames={tramo.frames} premountFor={15}>
            <Escena
              escena={escena}
              indice={i}
              total={tramo.frames}
              url={url}
              alFallar={marcarFallo}
            />
          </Sequence>
        );
      })}
      <Sequence from={inicioFinal} durationInFrames={framesTarjetaFinal}>
        <TarjetaFinal precio={precio} cta={cta || "Enlace en el perfil"} />
      </Sequence>
      <Transiciones cortes={cortes} />
      <Progreso />
    </AbsoluteFill>
  );
};
