import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes | Publi" },
      { name: "description", content: "Preferencias de publicacion." },
      { property: "og:title", content: "Ajustes | Publi" },
      { property: "og:description", content: "Preferencias de publicacion." },
    ],
  }),
  component: Ajustes,
});

function Ajustes() {
  const { user } = Route.useRouteContext();
  const [hrs, setHrs] = useState(24);

  useEffect(() => {
    supabase
      .from("settings")
      .select("intervalHours")
      .maybeSingle()
      .then(({ data }) => data && setHrs(data.intervalHours));
  }, []);

  const save = async () => {
    const { error } = await supabase.from("settings").upsert({ userId: user.id, intervalHours: hrs });
    if (error) {
      console.error("settings save failed", error.message);
      return void toast.error("No se pudo guardar");
    }
    toast.success("Ajustes guardados");
  };

  return (
    <>
      <PageHead title="Ajustes" desc="Configuracion general." />
      <Card className="max-w-md">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="hrs">Intervalo entre publicaciones (horas)</Label>
            <Input id="hrs" type="number" min={1} value={hrs} onChange={(e) => setHrs(Number(e.target.value))} />
          </div>
          <Button onClick={save}>Guardar</Button>
        </CardContent>
      </Card>
    </>
  );
}
