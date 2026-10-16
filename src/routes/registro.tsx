import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/components/AuthCard";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Crear cuenta | Publi" },
      { name: "description", content: "Crea tu cuenta en Publi y programa videos cortos." },
      { property: "og:title", content: "Crear cuenta | Publi" },
      { property: "og:description", content: "Crea tu cuenta en Publi y programa videos cortos." },
    ],
  }),
  component: () => <AuthCard mode="signup" />,
});
