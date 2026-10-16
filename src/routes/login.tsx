import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesion | Publi" },
      { name: "description", content: "Accede a Publi para programar tus videos cortos." },
      { property: "og:title", content: "Iniciar sesion | Publi" },
      { property: "og:description", content: "Accede a Publi para programar tus videos cortos." },
    ],
  }),
  component: () => <AuthCard mode="login" />,
});
