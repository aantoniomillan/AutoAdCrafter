import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/subir")({
  head: () => ({
    meta: [
      { title: "Subir video | Publi" },
      { name: "description", content: "Sube un video corto y programa su publicacion." },
      { property: "og:title", content: "Subir video | Publi" },
      { property: "og:description", content: "Sube un video corto y programa su publicacion." },
    ],
  }),
  component: Subir,
});

function Subir() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [subText, setSubText] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !when) return void toast.error("Elige un archivo y una fecha");
    if (file.type !== "video/mp4") return void toast.error("El archivo debe ser mp4");
    setBusy(true);
    const path = `${user.id}/${crypto.randomUUID()}.mp4`;
    const up = await supabase.storage.from("videos").upload(path, file, { contentType: "video/mp4" });
    if (up.error) {
      console.error("upload failed", up.error.message);
      setBusy(false);
      return void toast.error("No se pudo subir el archivo");
    }
    const { data } = supabase.storage.from("videos").getPublicUrl(path);
    const ins = await supabase.from("videos").insert({
      userId: user.id,
      path,
      publicUrl: data.publicUrl,
      caption,
      subtitleText: subText,
      scheduledAt: new Date(when).toISOString(),
    });
    setBusy(false);
    if (ins.error) {
      console.error("insert failed", ins.error.message);
      return void toast.error("No se pudo guardar el video");
    }
    qc.invalidateQueries();
    toast.success("Video programado");
    nav({ to: "/cola" });
  };

  return (
    <>
      <PageHead title="Subir video" desc="Archivo mp4, textos y fecha de publicacion." />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="file">Archivo mp4</Label>
              <Input id="file" type="file" accept="video/mp4" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Pie de foto</Label>
              <Textarea id="caption" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subs">Texto de subtitulos</Label>
              <Textarea id="subs" rows={5} value={subText} onChange={(e) => setSubText(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="when">Fecha de publicacion</Label>
              <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Subiendo..." : "Programar video"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
