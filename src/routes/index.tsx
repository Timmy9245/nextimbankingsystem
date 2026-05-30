import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Shield, Banknote, ArrowRightLeft, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veritas Microfinance Bank — Secure Campus Banking" },
      { name: "description", content: "Modern banking for students and staff. Open an account, transfer funds, take a loan — all in one place." },
      { property: "og:title", content: "Veritas Microfinance Bank" },
      { property: "og:description", content: "Secure web banking built for the university community." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
              <Banknote className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight">Veritas Microfinance</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth">Open account</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <span className="inline-block rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          For the university community
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
          Banking that fits campus life.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Open a savings or current account in seconds. Send money, take a microloan, and track every kobo — all from one polished dashboard.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="shadow-lg">
            <Link to="/auth">Get started — it's free</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">I have an account</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: ArrowRightLeft, title: "Instant transfers", body: "Move funds between your accounts or pay other Veritas customers in one tap." },
          { icon: Shield, title: "Bank-grade security", body: "Every transaction is atomic, audited, and protected by row-level access rules." },
          { icon: TrendingUp, title: "Microloans & analytics", body: "Apply for a loan, repay flexibly, and watch your spending trends update live." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Veritas Microfinance Bank · CSC 302 Project
      </footer>
    </div>
  );
}
