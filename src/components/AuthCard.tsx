import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function AuthCard({ mode }: { mode: "login" | "signup" }) {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
      setBusy(false);
      if (error) return void toast.error("Email o contrasena incorrectos");
      nav({ to: "/" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pwd,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) return void toast.error(error.message);
      if (data.session) return nav({ to: "/" });
      toast.success("Revisa tu email para confirmar la cuenta");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary font-bold text-primary-foreground">P</div>
          <span className="text-lg font-semibold tracking-tight">Publi</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{isLogin ? "Iniciar sesion" : "Crear cuenta"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Programa y publica tus videos cortos.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd">Contrasena</Label>
            <Input id="pwd" type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Un momento..." : isLogin ? "Entrar" : "Registrarme"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          {isLogin ? "No tienes cuenta? " : "Ya tienes cuenta? "}
          <Link to={isLogin ? "/registro" : "/login"} className="font-medium text-primary hover:underline">
            {isLogin ? "Registrate" : "Inicia sesion"}
          </Link>
        </p>
      </div>
    </div>
  );
}
