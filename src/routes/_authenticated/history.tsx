import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/components/banking/AccountCard";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { ReceiptDialog } from "@/components/banking/Receipt";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Transactions — NexTim" }] }),
  component: History,
});

interface Tx {
  id: string; type: string; amount: number; balance_after: number;
  description: string | null; reference: string | null; created_at: string; account_id: string;
}

function History() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", from, to],
    queryFn: async (): Promise<Tx[]> => {
      let q = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", to + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) {
      const d = t.created_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(t.amount));
    }
    return Array.from(map, ([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
  }, [txs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Transaction history</h1>
        <p className="text-muted-foreground">Filter by date and review every entry.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily volume</CardTitle>
          <CardDescription>Sum of transaction amounts per day.</CardDescription>
        </CardHeader>
        <CardContent style={{ height: 240 }}>
          {chart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <XAxis dataKey="date" fontSize={12} stroke="currentColor" opacity={0.5} />
                <YAxis fontSize={12} stroke="currentColor" opacity={0.5} />
                <Tooltip formatter={(v: number) => formatNaira(v)} />
                <Bar dataKey="total" fill="oklch(0.55 0.13 160)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <div className="flex flex-wrap gap-3 pt-2">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                  <tr><th className="py-2">Date</th><th>Type</th><th>Description</th><th>Reference</th><th className="text-right">Amount</th><th className="text-right">Balance</th></tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id} onClick={() => setReceiptId(t.id)} className="border-b last:border-0 hover:bg-secondary/40 cursor-pointer">
                      <td className="py-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                      <td><Badge variant={t.type.includes("out") || t.type === "withdrawal" || t.type === "loan_repayment" ? "destructive" : "secondary"}>{t.type.replace("_", " ")}</Badge></td>
                      <td className="text-muted-foreground">{t.description}</td>
                      <td className="font-mono text-xs text-muted-foreground">{t.reference}</td>
                      <td className="text-right tabular-nums font-medium">{formatNaira(Number(t.amount))}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{formatNaira(Number(t.balance_after))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <ReceiptDialog open={!!receiptId} onOpenChange={(v) => !v && setReceiptId(null)} txId={receiptId} variant="detailed" />
    </div>
  );
}