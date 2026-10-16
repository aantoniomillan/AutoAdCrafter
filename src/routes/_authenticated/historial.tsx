import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHead } from "@/components/PageHead";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate, listVids } from "@/lib/vids";

export const Route = createFileRoute("/_authenticated/historial")({
  head: () => ({
    meta: [
      { title: "Historial | Publi" },
      { name: "description", content: "Videos publicados y con error." },
      { property: "og:title", content: "Historial | Publi" },
      { property: "og:description", content: "Videos publicados y con error." },
    ],
  }),
  component: Historial,
});

function Historial() {
  const vids = useQuery({ queryKey: ["hist"], queryFn: () => listVids(["publicado", "error"]) });
  return (
    <>
      <PageHead title="Historial" desc="Publicaciones realizadas y fallidas." />
      <Card>
        <CardContent className="pt-6">
          {!vids.data?.length ? (
            <p className="text-sm text-muted-foreground">Aun no hay publicaciones.</p>
          ) : (
            <ul className="divide-y">
              {vids.data.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.caption || "Sin pie de foto"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.status === "error" ? v.error || "Error desconocido" : fmtDate(v.publishedAt)}
                    </p>
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
