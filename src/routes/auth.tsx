import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — NexTim" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});
const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/dashboard", replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/dashboard", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSignup(form: FormData): Promise<void> {
    const parsed = signupSchema.safeParse({
      fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"),
    });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome to NexTim!");
  }

  async function handleLogin(form: FormData): Promise<void> {
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 text-primary-foreground"
           style={{ background: "var(--gradient-primary)" }}>
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Banknote className="h-5 w-5" /> NexTim
        </Link>
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">Banking, simplified for campus.</h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Atomic transfers, real-time balances, audited every step of the way.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">Secured by row-level access policies.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-6 flex items-center gap-2 font-semibold">
            <Banknote className="h-5 w-5 text-primary" /> NexTim
          </Link>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form action={handleLogin} className="space-y-4 pt-4">
                <div className="space-y-2"><Label htmlFor="le">Email</Label><Input id="le" name="email" type="email" required /></div>
                <div className="space-y-2"><Label htmlFor="lp">Password</Label><Input id="lp" name="password" type="password" required /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Signing in…" : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form action={handleSignup} className="space-y-4 pt-4">
                <div className="space-y-2"><Label htmlFor="sn">Full name</Label><Input id="sn" name="fullName" required /></div>
                <div className="space-y-2"><Label htmlFor="se">Email</Label><Input id="se" name="email" type="email" required /></div>
                <div className="space-y-2"><Label htmlFor="sp">Password</Label><Input id="sp" name="password" type="password" required minLength={8} /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Creating…" : "Create account"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}