import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Fondo } from "./Fondo";
import { familia } from "./fuentes";
import { useImagenes } from "./imagenes";
import { paletas } from "./temas";
import type { Paleta } from "./temas";
import { ancho, dominio, duracion } from "./tipos";
import type { ReelProps } from "./tipos";

const finProducto = 300;
const inicioCierre = 290;
const solape = 20;

const rebote = { damping: 12, stiffness: 130, mass: 0.8 };
const suave = { damping: 22, stiffness: 110, mass: 0.9 };

const limitar = (v: number) => Math.min(1, Math.max(0, v));

const usarSpring = (retraso: number, config: Record<string, number> = suave) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - retraso, fps, config });
};

const Palabras: React.FC<{
  texto: string;
  retraso: number;
  tam: number;
  color: string;
  sombra?: string;
}> = ({ texto, retraso, tam, color, sombra }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        fontFamily: familia,
        fontWeight: 700,
        fontSize: tam,
        lineHeight: 1.06,
        textAlign: "center",
        color,
        textShadow: sombra,
      }}
    >
      {texto.split(" ").map((palabra, i) => {
        const p = spring({ frame: frame - retraso - i * 4, fps, config: rebote });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              opacity: limitar(p * 1.4),
              transform: `translateY(${(1 - p) * 70}px) scale(${0.88 + 0.12 * p})`,
            }}
          >
            {palabra}
          </span>
        );
      })}
    </div>
  );
};

const Marca: React.FC<{ paleta: Paleta }> = ({ paleta }) => {
  const p = usarSpring(2);
  return (
    <div
      style={{
        position: "absolute",
        top: 104,
        left: 0,
        width: ancho,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        opacity: limitar(p),
        transform: `translateY(${(1 - p) * -30}px)`,
        fontFamily: familia,
        fontWeight: 700,
        fontSize: 34,
        letterSpacing: "0.38em",
        color: paleta.acento,
      }}
    >
      <span style={{ width: 54, height: 3, background: paleta.acento, opacity: 0.7 }} />
      UTILSLA
      <span style={{ width: 54, height: 3, background: paleta.acento, opacity: 0.7 }} />
    </div>
  );
};

const Cabecera: React.FC<{ titulo: string; subtitulo: string; paleta: Paleta }> = ({
  titulo,
  subtitulo,
  paleta,
}) => {
  const tam = titulo.length > 38 ? 70 : titulo.length > 24 ? 86 : 102;
  const barra = usarSpring(16);
  const sub = usarSpring(20);
  return (
    <div
      style={{
        position: "absolute",
        top: 180,
        left: 70,
        width: ancho - 140,
        height: 500,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
      }}
    >
      <Palabras
        texto={titulo}
        retraso={6}
        tam={tam}
        color={paleta.texto}
        sombra="0 6px 30px rgba(0,0,0,0.55)"
      />
      <div
        style={{
          width: 180 * barra,
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(90deg, ${paleta.acento}, ${paleta.acento2})`,
        }}
      />
      {subtitulo ? (
        <div
          style={{
            fontFamily: familia,
            fontWeight: 500,
            fontSize: subtitulo.length > 34 ? 42 : 50,
            lineHeight: 1.15,
            textAlign: "center",
            color: paleta.suave,
            opacity: limitar(sub),
            transform: `translateY(${(1 - sub) * 40}px)`,
          }}
        >
          {subtitulo}
        </div>
      ) : null}
    </div>
  );
};

const Capa: React.FC<{
  url: string;
  i: number;
  n: number;
  paso: number;
  paleta: Paleta;
  alFallar: (url: string) => void;
}> = ({ url, i, n, paso, paleta, alFallar }) => {
  const frame = useCurrentFrame();
  const inicio = i * paso;
  const ultima = i === n - 1;
  const fin = ultima ? duracion : (i + 1) * paso + solape + 1;
  if (frame < inicio || frame > fin) return null;
  const local = frame - inicio;
  const dur = ultima ? finProducto + 24 - inicio : paso + solape;
  const e = Easing.inOut(Easing.sin)(limitar(local / dur));
  const dir = i % 2 === 0 ? 1 : -1;
  const escala = dir === 1 ? 1 + 0.17 * e : 1.17 - 0.15 * e;
  const tx = dir * (-26 + 52 * e);
  const ty = dir * (14 - 28 * e);
  const t = i === 0 ? 1 : Easing.out(Easing.cubic)(limitar(local / solape));
  const barrido = interpolate(local, [i === 0 ? 24 : 2, i === 0 ? 52 : 28], [-120, 120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: t,
        transform: `translateX(${(1 - t) * 110}px) scale(${0.96 + 0.04 * t})`,
      }}
    >
      <Img
        src={url}
        onError={() => alFallar(url)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(38px)",
          transform: "scale(1.3)",
        }}
      />
      <Img
        src={url}
        onError={() => alFallar(url)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `translate(${tx}px, ${ty}px) scale(${escala})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(105deg, rgba(255,255,255,0) 38%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0) 62%)",
          transform: `translateX(${barrido}%)`,
          opacity: 0.55,
        }}
      />
    </AbsoluteFill>
  );
};

const Tarjeta: React.FC<{
  imagenes: string[];
  paleta: Paleta;
  alFallar: (url: string) => void;
}> = ({ imagenes, paleta, alFallar }) => {
  const frame = useCurrentFrame();
  const p = usarSpring(8);
  const flota = Math.sin(frame / 26) * 8;
  const paso = imagenes.length > 0 ? finProducto / imagenes.length : finProducto;
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        top: 700,
        width: 920,
        height: 640,
        borderRadius: 60,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${paleta.fondoC}, ${paleta.fondoB})`,
        opacity: limitar(p * 1.3),
        transform: `translateY(${(1 - p) * 120 + flota}px) scale(${0.88 + 0.12 * p})`,
        boxShadow: `0 40px 110px rgba(0,0,0,0.6), 0 0 0 4px ${paleta.acento}55, 0 0 90px ${paleta.acento}33`,
      }}
    >
      {imagenes.map((url, i) => (
        <Capa
          key={url}
          url={url}
          i={i}
          n={imagenes.length}
          paso={paso}
          paleta={paleta}
          alFallar={alFallar}
        />
      ))}
    </div>
  );
};

const Insignia: React.FC<{ precio: string; antes?: string; paleta: Paleta }> = ({
  precio,
  antes,
  paleta,
}) => {
  const frame = useCurrentFrame();
  const p = usarSpring(46, { damping: 9, stiffness: 150, mass: 0.7 });
  const pulso = 1 + Math.sin(Math.max(0, frame - 80) / 8) * 0.03;
  return (
    <div
      style={{
        position: "absolute",
        right: 52,
        top: antes ? 1186 : 1214,
        padding: "22px 46px 24px",
        borderRadius: 44,
        background: `linear-gradient(135deg, ${paleta.acento}, ${paleta.acento}e6 55%, ${paleta.acento2})`,
        border: "5px solid rgba(255,255,255,0.7)",
        boxShadow: `0 22px 60px rgba(0,0,0,0.55), 0 0 70px ${paleta.acento}66`,
        color: paleta.tinta,
        fontFamily: familia,
        textAlign: "center",
        opacity: limitar(p * 1.5),
        transform: `rotate(${-6 - (1 - p) * 28}deg) scale(${Math.max(0, p) * pulso})`,
      }}
    >
      {antes ? (
        <div
          style={{
            fontWeight: 500,
            fontSize: 38,
            lineHeight: 1.1,
            textDecoration: "line-through",
            opacity: 0.72,
          }}
        >
          {antes}
        </div>
      ) : null}
      <div
        style={{
          fontWeight: 700,
          fontSize: precio.length > 9 ? 72 : 94,
          lineHeight: 1.05,
          whiteSpace: "nowrap",
        }}
      >
        {precio}
      </div>
    </div>
  );
};

const Punto: React.FC<{ texto: string; i: number; paleta: Paleta }> = ({ texto, i, paleta }) => {
  const p = usarSpring(74 + i * 14);
  return (
    <div
      style={{
        width: 780,
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "13px 34px 13px 16px",
        borderRadius: 70,
        background: "rgba(255,255,255,0.1)",
        border: `2px solid ${paleta.acento}66`,
        boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
        opacity: limitar(p * 1.4),
        transform: `translateX(${(1 - p) * -180}px)`,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          flexShrink: 0,
          borderRadius: "50%",
          background: paleta.acento,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24">
          <path
            d="M5 12.5 L10 17.5 L19 7"
            fill="none"
            stroke={paleta.tinta}
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div
        style={{
          fontFamily: familia,
          fontWeight: 500,
          fontSize: texto.length > 30 ? 36 : 43,
          lineHeight: 1.12,
          color: paleta.texto,
        }}
      >
        {texto}
      </div>
    </div>
  );
};

const Producto: React.FC<{
  props: ReelProps;
  imagenes: string[];
  paleta: Paleta;
  alFallar: (url: string) => void;
}> = ({ props, imagenes, paleta, alFallar }) => {
  const frame = useCurrentFrame();
  const salida = interpolate(frame, [inicioCierre - 8, inicioCierre + 12], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        opacity: salida,
        transform: `translateY(${(1 - salida) * -50}px) scale(${0.97 + 0.03 * salida})`,
      }}
    >
      <Cabecera titulo={props.titulo} subtitulo={props.subtitulo} paleta={paleta} />
      <Tarjeta imagenes={imagenes} paleta={paleta} alFallar={alFallar} />
      <Insignia precio={props.precio} antes={props.precioAntes} paleta={paleta} />
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 1426,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {props.puntos.slice(0, 3).map((texto, i) => (
          <Punto key={i} texto={texto} i={i} paleta={paleta} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Cierre: React.FC<{ props: ReelProps; imagen?: string; paleta: Paleta }> = ({
  props,
  imagen,
  paleta,
}) => {
  const frame = useCurrentFrame();
  const velo = limitar((frame - inicioCierre) / 18);
  const foto = usarSpring(inicioCierre + 6, rebote);
  const precio = usarSpring(inicioCierre + 26);
  const boton = usarSpring(inicioCierre + 34, rebote);
  const pulso = 1 + Math.sin(Math.max(0, frame - inicioCierre - 40) / 6) * 0.028;
  const zoom = 1 + (frame - inicioCierre) * 0.0016;
  if (frame < inicioCierre - 2) return null;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(0,0,0,${0.5 * velo})` }} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 54,
          paddingBottom: 60,
        }}
      >
        {imagen ? (
          <div
            style={{
              position: "relative",
              width: 400,
              height: 400,
              borderRadius: 64,
              overflow: "hidden",
              opacity: limitar(foto * 1.4),
              transform: `scale(${0.6 + 0.4 * foto}) rotate(${(1 - foto) * -10}deg)`,
              boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 0 5px ${paleta.acento}, 0 0 100px ${paleta.acento}55`,
              background: paleta.fondoB,
            }}
          >
            <Img
              src={imagen}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(30px)",
                transform: "scale(1.3)",
              }}
            />
            <Img
              src={imagen}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transform: `scale(${zoom})`,
              }}
            />
          </div>
        ) : null}
        <div style={{ width: 900 }}>
          <Palabras
            texto={props.cta}
            retraso={inicioCierre + 12}
            tam={props.cta.length > 40 ? 68 : 82}
            color={paleta.texto}
            sombra="0 6px 30px rgba(0,0,0,0.6)"
          />
        </div>
        <div
          style={{
            fontFamily: familia,
            fontWeight: 700,
            fontSize: 74,
            color: paleta.acento,
            opacity: limitar(precio * 1.4),
            transform: `translateY(${(1 - precio) * 50}px)`,
            display: "flex",
            alignItems: "baseline",
            gap: 24,
          }}
        >
          {props.precioAntes ? (
            <span
              style={{
                fontSize: 44,
                fontWeight: 500,
                textDecoration: "line-through",
                color: paleta.suave,
                opacity: 0.8,
              }}
            >
              {props.precioAntes}
            </span>
          ) : null}
          {props.precio}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "26px 54px",
            borderRadius: 100,
            background: `linear-gradient(135deg, ${paleta.acento}, ${paleta.acento2})`,
            color: paleta.tinta,
            fontFamily: familia,
            fontWeight: 700,
            fontSize: 50,
            boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 ${60 * pulso}px ${paleta.acento}88`,
            opacity: limitar(boton * 1.4),
            transform: `scale(${Math.max(0, boton) * pulso})`,
          }}
        >
          {dominio}
          <svg width="46" height="46" viewBox="0 0 24 24">
            <path
              d="M4 12 H19 M13 6 L19 12 L13 18"
              fill="none"
              stroke={paleta.tinta}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = (props) => {
  const paleta = paletas[props.tema] ?? paletas.neutro;
  const { imagenes, marcarFallo } = useImagenes(props.imagenes);
  return (
    <AbsoluteFill style={{ background: paleta.fondoA }}>
      <Fondo paleta={paleta} />
      <Marca paleta={paleta} />
      <Producto props={props} imagenes={imagenes} paleta={paleta} alFallar={marcarFallo} />
      <Cierre props={props} imagen={imagenes[0]} paleta={paleta} />
    </AbsoluteFill>
  );
};
