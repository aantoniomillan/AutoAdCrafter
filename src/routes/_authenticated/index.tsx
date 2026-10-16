import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countByStatus, fmtDate, listVids } from "@/lib/vids";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Panel | Publi" },
      { name: "description", content: "Resumen de tus videos programados y publicados en Publi." },
      { property: "og:title", content: "Panel | Publi" },
      { property: "og:description", content: "Resumen de tus videos programados y publicados en Publi." },
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
  const next = useQuery({ queryKey: ["next5"], queryFn: () => listVids(["pendiente"], 5, true) });

  const cards = [
    { label: "Pendientes", val: counts.data?.pend, cls: "text-warning" },
    { label: "Publicados", val: counts.data?.pub, cls: "text-success" },
    { label: "Con error", val: counts.data?.err, cls: "text-destructive" },
  ];

  return (
    <>
      <PageHead title="Panel" desc="Estado general de tus publicaciones.">
        <Button asChild>
          <Link to="/subir">Subir video</Link>
        </Button>
      </PageHead>
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-semibold tabular-nums ${c.cls}`}>{c.val ?? "-"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Proximos videos</CardTitle>
        </CardHeader>
        <CardContent>
          {next.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : !next.data?.length ? (
            <p className="text-sm text-muted-foreground">No hay videos programados.</p>
          ) : (
            <ul className="divide-y">
              {next.data.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.caption || "Sin pie de foto"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(v.scheduledAt)}</p>
                  </div>
                  <StatusBadge status={v.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
