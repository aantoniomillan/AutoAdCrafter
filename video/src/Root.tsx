import React from "react";
import { Composition } from "remotion";
import { Reel } from "./Reel";
import { alto, ancho, duracion, fps, propsBase } from "./tipos";

export const Raiz: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={duracion}
    fps={fps}
    width={ancho}
    height={alto}
    defaultProps={propsBase}
  />
);
