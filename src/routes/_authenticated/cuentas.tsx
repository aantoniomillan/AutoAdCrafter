import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHead } from "@/components/PageHead";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/vids";

export const Route = createFileRoute("/_authenticated/cuentas")({
  head: () => ({
    meta: [
      { title: "Cuentas | Publi" },
      { name: "description", content: "Cuentas de redes sociales conectadas." },
      { property: "og:title", content: "Cuentas | Publi" },
      { property: "og:description", content: "Cuentas de redes sociales conectadas." },
    ],
  }),
  component: Cuentas,
});

function Cuentas() {
  const accs = useQuery({
    queryKey: ["accs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("createdAt");
      if (error) throw error;
      return data;
    },
  });
  return (
    <>
      <PageHead title="Cuentas" desc="Redes sociales vinculadas a Publi." />
      <Card>
        <CardContent className="pt-6">
          {!accs.data?.length ? (
            <p className="text-sm text-muted-foreground">No hay cuentas conectadas todavia.</p>
          ) : (
            <ul className="divide-y">
              {accs.data.map((a) => (
                <li key={a.id} className="flex justify-between py-3 text-sm">
                  <span className="font-medium capitalize">{a.platform}</span>
                  <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
