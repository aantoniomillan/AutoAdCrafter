import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Reel } from "./Reel";
import { Tiktok } from "./Tiktok";
import { alto, ancho, duracion, duracionTiktok, fps, propsBase, propsTiktokBase } from "./tipos";
import type { TiktokProps } from "./tipos";

const metadatosTiktok: CalculateMetadataFunction<TiktokProps> = ({ props }) => ({
  durationInFrames: duracionTiktok(props.escenas),
});

export const Raiz: React.FC = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={duracion}
      fps={fps}
      width={ancho}
      height={alto}
      defaultProps={propsBase}
    />
    <Composition
      id="Tiktok"
      component={Tiktok}
      durationInFrames={duracionTiktok(propsTiktokBase.escenas)}
      fps={fps}
      width={ancho}
      height={alto}
      defaultProps={propsTiktokBase}
      calculateMetadata={metadatosTiktok}
    />
  </>
);
