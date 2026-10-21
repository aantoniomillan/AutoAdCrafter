import { continueRender, delayRender, staticFile } from "remotion";

export const familia = "Poppins, 'Helvetica Neue', Arial, sans-serif";

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("Cargando fuentes", { timeoutInMilliseconds: 20000 });
  const lista = [
    new FontFace("Poppins", `url(${staticFile("fonts/Poppins-Medium.ttf")})`, { weight: "500" }),
    new FontFace("Poppins", `url(${staticFile("fonts/Poppins-Bold.ttf")})`, { weight: "700" }),
  ];
  Promise.all(lista.map((f) => f.load()))
    .then((cargadas) => {
      cargadas.forEach((f) => document.fonts.add(f));
    })
    .catch(() => undefined)
    .finally(() => continueRender(handle));
}
