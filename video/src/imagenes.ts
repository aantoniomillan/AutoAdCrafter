import { useCallback, useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

const espera = 25000;

const comprobar = (url: string) =>
  new Promise<boolean>((resolve) => {
    const img = new window.Image();
    const limite = setTimeout(() => resolve(false), espera);
    img.onload = () => {
      clearTimeout(limite);
      resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => {
      clearTimeout(limite);
      resolve(false);
    };
    img.src = url;
  });

export const useImagenes = (urls: string[]) => {
  const [handle] = useState(() =>
    delayRender("Comprobando imagenes", { timeoutInMilliseconds: espera + 20000 }),
  );
  const [validas, setValidas] = useState<string[]>([]);
  const [fallos, setFallos] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    Promise.all(urls.map(comprobar))
      .then((res) => {
        if (vivo) setValidas(urls.filter((_, i) => res[i]));
      })
      .catch(() => {
        if (vivo) setValidas([]);
      })
      .finally(() => {
        continueRender(handle);
      });
    return () => {
      vivo = false;
    };
  }, [handle, urls]);

  const marcarFallo = useCallback((url: string) => {
    setFallos((prev) => (prev.includes(url) ? prev : [...prev, url]));
  }, []);

  return { imagenes: validas.filter((u) => !fallos.includes(u)), marcarFallo };
};
