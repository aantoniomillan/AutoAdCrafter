import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PageHead } from "@/components/PageHead";
import { VidBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { lastErr, nextPub } from "@/lib/pub";
import { cn } from "@/lib/utils";
import { countByStatus, fmtDate, listVids, loadHrs } from "@/lib/vids";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Panel | Publi" },
      { name: "description", content: "Resumen de tus videos programados y publicados en Publi." },
      { property: "og:title", content: "Panel | Publi" },
      {
        property: "og:description",
        content: "Resumen de tus videos programados y publicados en Publi.",
      },
    ],
  }),
  component: Panel,
});

function Panel() {
  const counts = useQuery({
    queryKey: ["counts"],
    queryFn: async () => ({
      pend: await countByStatus("pendiente"),
      pub: await countByStatus("publicado"),
      err: await countByStatus("error"),
    }),
  });
  const vids = useQuery({ queryKey: ["vids"], queryFn: () => listVids() });
  const hrs = useQuery({ queryKey: ["hrs"], queryFn: loadHrs });
  const q = useMemo(() => nextPub(vids.data ?? [], hrs.data ?? 24), [vids.data, hrs.data]);
  const err = useMemo(() => lastErr(vids.data ?? []), [vids.data]);
  const up = q.order.slice(0, 5);

  const cards = [
    { label: "Pendientes", val: counts.data?.pend, cls: "text-3xl text-warning" },
    { label: "Publicados", val: counts.data?.pub, cls: "text-3xl text-success" },
    { label: "Con error", val: counts.data?.err, cls: "text-3xl text-destructive" },
    {
      label: "Proxima publicacion",
      val: vids.data ? fmtDate(q.next) : undefined,
      cls: "text-lg pt-2",
    },
  ];

  return (
    <>
      <PageHead title="Panel" desc="Estado general de tus publicaciones.">
        <Button asChild>
          <Link to="/subir">Subir video</Link>
        </Button>
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn("font-semibold tabular-nums", c.cls)}>{c.val ?? "-"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {err && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Ultimo error: {err.caption || "Sin pie de foto"}</AlertTitle>
          <AlertDescription className="break-words">
            {err.error || "Error desconocido"}
          </AlertDescription>
        </Alert>
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Proximos videos</CardTitle>
        </CardHeader>
        <CardContent>
          {vids.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : !up.length ? (
            <p className="text-sm text-muted-foreground">No hay videos programados.</p>
          ) : (
            <ul className="divide-y">
              {up.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.caption || "Sin pie de foto"}</p>
                    <p className="text-xs text-muted-foreground">
                      Programado {fmtDate(v.scheduledAt)} - Estimada {fmtDate(q.plan[v.id] ?? null)}
                    </p>
                  </div>
                  <VidBadge vid={v} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
