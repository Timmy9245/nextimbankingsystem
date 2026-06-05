import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AccountRepository, LoanService } from "@/lib/banking/models";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/components/banking/AccountCard";
import { toast } from "sonner";
import { ReceiptDialog } from "@/components/banking/Receipt";
import { PinDialog } from "@/components/banking/PinDialog";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "Loans — NexTim" }] }),
  component: Loans,
});

interface Loan {
  id: string; principal: number; interest_rate: number; outstanding: number;
  status: string; purpose: string | null; created_at: string; account_id: string;
}

function Loans() {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: () => AccountRepository.listForUser() });
  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    queryFn: async (): Promise<Loan[]> => {
      const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Loan[];
    },
  });

  const [acctId, setAcctId] = useState("");
  const [loading, setLoading] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pending, setPending] = useState<{ principal: number; purpose: string } | null>(null);

  async function apply(form: FormData): Promise<void> {
    const principal = Number(form.get("principal"));
    const purpose = String(form.get("purpose") ?? "");
    if (!acctId) { toast.error("Pick an account to receive the funds"); return; }
    if (!principal || principal <= 0) { toast.error("Enter a valid amount"); return; }
    setPending({ principal, purpose });
    setPinOpen(true);
  }

  async function confirmApply(pin: string) {
    if (!pending) return;
    setLoading(true);
    try {
      const id = await LoanService.apply(acctId, pending.principal, pending.purpose, pin);
      toast.success("Loan approved and disbursed");
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      if (id) setReceiptId(id);
      setPending(null);
    } catch (e) { toast.error((e as Error).message); throw e; } finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Loans</h1>
        <p className="text-muted-foreground">Apply for a microloan and repay flexibly. Flat 10% interest.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Apply for a loan</CardTitle><CardDescription>Funds are credited to your chosen account instantly.</CardDescription></CardHeader>
        <CardContent>
          <form action={apply} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label>Deposit to account</Label>
              <Select value={acctId} onValueChange={setAcctId}>
                <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountNumber} · {a.type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Principal (₦)</Label><Input name="principal" type="number" step="0.01" min="1" required /></div>
            <div className="sm:col-span-2 space-y-2"><Label>Purpose</Label><Input name="purpose" maxLength={200} placeholder="e.g. textbooks for the semester" /></div>
            <Button type="submit" disabled={loading} className="sm:col-span-2 justify-self-start">{loading ? "Processing…" : "Apply"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your loans</CardTitle></CardHeader>
        <CardContent>
          {loans.length === 0 ? <p className="text-sm text-muted-foreground">No loans yet.</p> : (
            <div className="space-y-3">
              {loans.map((l) => <LoanRow key={l.id} loan={l} accounts={accounts.map(a => ({ id: a.id, label: a.accountNumber }))} onRepaid={(id) => { qc.invalidateQueries({ queryKey: ["loans"] }); qc.invalidateQueries({ queryKey: ["accounts"] }); if (id) setReceiptId(id); }} />)}
            </div>
          )}
        </CardContent>
      </Card>
      <ReceiptDialog open={!!receiptId} onOpenChange={(v) => !v && setReceiptId(null)} txId={receiptId} variant="compact" />
      <PinDialog open={pinOpen} onOpenChange={setPinOpen} onSubmit={confirmApply}
        title="Confirm loan application"
        description={pending ? `Borrow ${formatNaira(pending.principal)} — repayable at 10% interest.` : ""} />
    </div>
  );
}

function LoanRow({ loan, accounts, onRepaid }: { loan: Loan; accounts: { id: string; label: string }[]; onRepaid: (txId?: string) => void }) {
  const [acctId, setAcctId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  function startRepay() {
    const amt = Number(amount);
    if (!acctId || !amt || amt <= 0) { toast.error("Pick account and valid amount"); return; }
    setPinOpen(true);
  }

  async function confirmRepay(pin: string) {
    const amt = Number(amount);
    setLoading(true);
    try {
      const id = await LoanService.repay(loan.id, acctId, amt, pin);
      toast.success("Repayment posted");
      setAmount("");
      onRepaid(id);
    } catch (e) { toast.error((e as Error).message); throw e; } finally { setLoading(false); }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{loan.purpose ?? "Loan"}</p>
          <p className="text-xs text-muted-foreground">Issued {new Date(loan.created_at).toLocaleDateString()}</p>
        </div>
        <Badge variant={loan.status === "repaid" ? "secondary" : "default"}>{loan.status}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Principal</p><p className="font-medium tabular-nums">{formatNaira(Number(loan.principal))}</p></div>
        <div><p className="text-xs text-muted-foreground">Interest</p><p className="font-medium tabular-nums">{loan.interest_rate}%</p></div>
        <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="font-medium tabular-nums">{formatNaira(Number(loan.outstanding))}</p></div>
      </div>
      {loan.status === "active" && (
        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">From account</Label>
            <Select value={acctId} onValueChange={setAcctId}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Amount (₦)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-[160px]" /></div>
          <Button onClick={startRepay} disabled={loading}>{loading ? "Posting…" : "Repay"}</Button>
          <PinDialog open={pinOpen} onOpenChange={setPinOpen} onSubmit={confirmRepay}
            title="Confirm loan repayment"
            description={amount ? `Repay ${formatNaira(Number(amount))} from selected account.` : ""} />
        </div>
      )}
    </div>
  );
}