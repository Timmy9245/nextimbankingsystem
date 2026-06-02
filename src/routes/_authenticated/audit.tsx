import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit & Alerts — NexTim" }] }),
  component: AuditPage,
});

interface AuditRow { id: string; table_name: string; action: string; record_id: string | null; new_data: unknown; old_data: unknown; created_at: string }
interface Alert { id: string; reason: string; details: unknown; created_at: string }

function AuditPage() {
  const { data: alerts = [] } = useQuery({
    queryKey: ["fraud_alerts"],
    queryFn: async (): Promise<Alert[]> => {
      const { data, error } = await supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error; return (data ?? []) as Alert[];
    },
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error; return (data ?? []) as AuditRow[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit & alerts</h1>
        <p className="text-muted-foreground">Every account and transaction change is logged. Fraud alerts surface above.</p>
      </div>

      <Card className={alerts.length ? "border-destructive/40" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Fraud alerts</CardTitle>
          <CardDescription>Triggered when you make more than 3 large transfers (≥ ₦50,000) within 10 minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">No alerts. You're all clear.</p> : (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="font-medium">{a.reason}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                  <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(a.details, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Audit log</CardTitle><CardDescription>Recent changes to your accounts and transactions.</CardDescription></CardHeader>
        <CardContent>
          {logs.length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                  <tr><th className="py-2">When</th><th>Table</th><th>Action</th><th>Record</th></tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      <td><Badge variant="outline">{l.table_name}</Badge></td>
                      <td><Badge variant={l.action.startsWith("FAILED") ? "destructive" : "secondary"}>{l.action}</Badge></td>
                      <td className="font-mono text-xs text-muted-foreground">{l.record_id ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}