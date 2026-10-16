import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, listVids, toLocalInput, type Video } from "@/lib/vids";

export const Route = createFileRoute("/_authenticated/cola")({
  head: () => ({
    meta: [
      { title: "Cola | Publi" },
      { name: "description", content: "Gestiona la cola de videos programados." },
      { property: "og:title", content: "Cola | Publi" },
      { property: "og:description", content: "Gestiona la cola de videos programados." },
    ],
  }),
  component: Cola,
});

type Mode = { vid: Video; kind: "date" | "text" } | null;

function Cola() {
  const qc = useQueryClient();
  const vids = useQuery({ queryKey: ["vids"], queryFn: () => listVids() });
  const [mode, setMode] = useState<Mode>(null);
  const [when, setWhen] = useState("");
  const [caption, setCaption] = useState("");
  const [subText, setSubText] = useState("");

  const open = (vid: Video, kind: "date" | "text") => {
    setWhen(toLocalInput(vid.scheduledAt));
    setCaption(vid.caption);
    setSubText(vid.subtitleText);
    setMode({ vid, kind });
  };

  const save = async () => {
    if (!mode) return;
    const patch =
      mode.kind === "date"
        ? { scheduledAt: new Date(when).toISOString() }
        : { caption, subtitleText: subText };
    const { error } = await supabase.from("videos").update(patch).eq("id", mode.vid.id);
    if (error) {
      console.error("update failed", error.message);
      return void toast.error("No se pudo guardar");
    }
    toast.success("Cambios guardados");
    setMode(null);
    qc.invalidateQueries();
  };

  const remove = async (vid: Video) => {
    if (!confirm("Eliminar este video?")) return;
    await supabase.storage.from("videos").remove([vid.path]);
    const { error } = await supabase.from("videos").delete().eq("id", vid.id);
    if (error) {
      console.error("delete failed", error.message);
      return void toast.error("No se pudo eliminar");
    }
    toast.success("Video eliminado");
    qc.invalidateQueries();
  };

  return (
    <>
      <PageHead title="Cola" desc="Todos tus videos y su estado." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pie de foto</TableHead>
              <TableHead className="hidden md:table-cell">Programado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vids.isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : !vids.data?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">No hay videos en la cola.</TableCell>
              </TableRow>
            ) : (
              vids.data.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="max-w-[16rem]">
                    <p className="truncate font-medium">{v.caption || "Sin pie de foto"}</p>
                    <p className="text-xs text-muted-foreground md:hidden">{fmtDate(v.scheduledAt)}</p>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{fmtDate(v.scheduledAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={v.status} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" aria-label="Editar fecha" onClick={() => open(v, "date")}>
                      <CalendarClock className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Editar texto" onClick={() => open(v, "text")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => remove(v)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode?.kind === "date" ? "Editar fecha" : "Editar texto"}</DialogTitle>
          </DialogHeader>
          {mode?.kind === "date" ? (
            <div className="space-y-2">
              <Label htmlFor="edWhen">Fecha de publicacion</Label>
              <Input id="edWhen" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edCap">Pie de foto</Label>
                <Textarea id="edCap" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edSub">Texto de subtitulos</Label>
                <Textarea id="edSub" rows={5} value={subText} onChange={(e) => setSubText(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
