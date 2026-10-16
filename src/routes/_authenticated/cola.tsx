import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { VidBadge } from "@/components/StatusBadge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isLocked, nextPub } from "@/lib/pub";
import { fmtDate, listVids, loadHrs, toLocalInput, type Video } from "@/lib/vids";

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
  const hrs = useQuery({ queryKey: ["hrs"], queryFn: loadHrs });
  const plan = useMemo(() => nextPub(vids.data ?? [], hrs.data ?? 24).plan, [vids.data, hrs.data]);
  const [mode, setMode] = useState<Mode>(null);
  const [when, setWhen] = useState("");
  const [caption, setCaption] = useState("");
  const [subText, setSubText] = useState("");

  const open = (vid: Video, kind: "date" | "text") => {
    if (isLocked(vid)) return void toast.error("El video se esta publicando");
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
    const { data, error } = await supabase
      .from("videos")
      .update(patch)
      .eq("id", mode.vid.id)
      .is("lockedAt", null)
      .select("id");
    if (error) {
      console.error("update failed", error.message);
      return void toast.error("No se pudo guardar");
    }
    if (!data.length) {
      qc.invalidateQueries();
      return void toast.error("El video se esta publicando");
    }
    toast.success("Cambios guardados");
    setMode(null);
    qc.invalidateQueries();
  };

  const remove = async (vid: Video) => {
    if (isLocked(vid)) return void toast.error("El video se esta publicando");
    if (!confirm("Eliminar este video?")) return;
    const { data, error } = await supabase
      .from("videos")
      .delete()
      .eq("id", vid.id)
      .is("lockedAt", null)
      .select("id");
    if (error) {
      console.error("delete failed", error.message);
      return void toast.error("No se pudo eliminar");
    }
    if (!data.length) {
      qc.invalidateQueries();
      return void toast.error("El video se esta publicando");
    }
    const files = [vid.path, vid.srcPath].filter((f): f is string => !!f);
    const rm = await supabase.storage.from("videos").remove(files);
    if (rm.error) console.error("storage remove failed", rm.error.message);
    toast.success("Video eliminado");
    qc.invalidateQueries();
  };

  const retry = async (vid: Video) => {
    const { error } = await supabase
      .from("videos")
      .update({ status: "pendiente", error: null })
      .eq("id", vid.id)
      .eq("status", "error");
    if (error) {
      console.error("retry failed", error.message);
      return void toast.error("No se pudo reintentar");
    }
    toast.success("Video de nuevo en cola");
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
              <TableHead className="hidden lg:table-cell">Estimada</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vids.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : !vids.data?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  No hay videos en la cola.
                </TableCell>
              </TableRow>
            ) : (
              vids.data.map((v) => {
                const busy = isLocked(v);
                const est = plan[v.id];
                return (
                  <TableRow key={v.id}>
                    <TableCell className="max-w-[16rem]">
                      <p className="truncate font-medium">{v.caption || "Sin pie de foto"}</p>
                      {v.status === "error" && (
                        <p className="truncate text-xs text-destructive" title={v.error ?? ""}>
                          {v.error || "Error desconocido"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground md:hidden">
                        {fmtDate(v.scheduledAt)}
                      </p>
                      {est && (
                        <p className="text-xs text-muted-foreground lg:hidden">
                          Estimada: {fmtDate(est)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      {fmtDate(v.scheduledAt)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap lg:table-cell">
                      {est ? fmtDate(est) : "-"}
                    </TableCell>
                    <TableCell>
                      <VidBadge vid={v} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {v.status === "error" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Reintentar"
                          title="Reintentar"
                          onClick={() => retry(v)}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar fecha"
                        disabled={busy}
                        onClick={() => open(v, "date")}
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar texto"
                        disabled={busy}
                        onClick={() => open(v, "text")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar"
                        disabled={busy}
                        onClick={() => remove(v)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
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
              <Input
                id="edWhen"
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edCap">Pie de foto</Label>
                <Textarea
                  id="edCap"
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edSub">Texto de subtitulos</Label>
                <Textarea
                  id="edSub"
                  rows={5}
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancelar
            </Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
