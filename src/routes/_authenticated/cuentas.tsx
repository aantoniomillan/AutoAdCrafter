import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHead } from "@/components/PageHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { accLabel, accTone, igIdOk } from "@/lib/pub";
import { cn } from "@/lib/utils";
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
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const acc = useQuery({
    queryKey: ["accs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("platform", "instagram")
        .order("createdAt")
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });
  const accId = acc.data?.id;
  const tok = useQuery({
    queryKey: ["igTok", accId],
    enabled: !!accId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("igTokenSet", { accId: accId as string });
      if (error) throw error;
      return data;
    },
  });
  const [extId, setExtId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExtId(acc.data?.externalId ?? "");
  }, [acc.data?.externalId]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const id = extId.trim();
    if (!igIdOk(id)) return void toast.error("El ID de Instagram solo puede tener digitos");
    setBusy(true);
    const { error } = acc.data
      ? await supabase.from("accounts").update({ externalId: id }).eq("id", acc.data.id)
      : await supabase
          .from("accounts")
          .insert({ userId: user.id, platform: "instagram", externalId: id });
    setBusy(false);
    if (error) {
      console.error("account save failed", error.message);
      return void toast.error("No se pudo guardar la cuenta");
    }
    toast.success("Cuenta guardada");
    qc.invalidateQueries({ queryKey: ["accs"] });
    qc.invalidateQueries({ queryKey: ["igTok"] });
  };

  const remove = async () => {
    if (!acc.data || !confirm("Eliminar esta cuenta?")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", acc.data.id);
    if (error) {
      console.error("account delete failed", error.message);
      return void toast.error("No se pudo eliminar la cuenta");
    }
    toast.success("Cuenta eliminada");
    qc.invalidateQueries({ queryKey: ["accs"] });
  };

  const a = acc.data;

  return (
    <>
      <PageHead title="Cuentas" desc="Redes sociales vinculadas a Publi." />
      <div className="grid max-w-2xl gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instagram</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="extId">ID de la cuenta de Instagram</Label>
                <Input
                  id="extId"
                  inputMode="numeric"
                  placeholder="17841400000000000"
                  value={extId}
                  onChange={(e) => setExtId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Identificador numerico de la cuenta profesional de Instagram.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy || acc.isLoading}>
                  {a ? "Guardar cambios" : "Registrar cuenta"}
                </Button>
                {a && (
                  <Button type="button" variant="outline" onClick={remove}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                    Eliminar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de conexion</CardTitle>
          </CardHeader>
          <CardContent>
            {acc.isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : !a ? (
              <p className="text-sm text-muted-foreground">No hay cuentas conectadas todavia.</p>
            ) : (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        accTone[a.status] ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {accLabel[a.status] ?? a.status}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Ultima comprobacion</dt>
                  <dd>{fmtDate(a.checkedAt)}</dd>
                </div>
                {a.lastError && (
                  <div className="space-y-1">
                    <dt className="text-muted-foreground">Ultimo error</dt>
                    <dd className="break-words text-destructive">{a.lastError}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Token configurado</dt>
                  <dd className="font-medium">
                    {tok.isLoading ? "..." : tok.isError ? "-" : tok.data ? "Si" : "No"}
                  </dd>
                </div>
                <dd className="text-xs text-muted-foreground">
                  El token de acceso no se introduce en la app: lo configura el administrador en el
                  servidor siguiendo los pasos del README.
                </dd>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
