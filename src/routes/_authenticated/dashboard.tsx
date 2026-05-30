import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountRepository, TransferService, type Account, type AccountType } from "@/lib/banking/models";
import { AccountCard, formatNaira } from "@/components/banking/AccountCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowDown, ArrowUp, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Veritas Microfinance" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => AccountRepository.listForUser(),
  });
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!selectedId && accounts.length) setSelectedId(accounts[0].id);
  }, [accounts, selectedId]);

  const selected = accounts.find((a) => a.id === selectedId);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  function refresh() { qc.invalidateQueries({ queryKey: ["accounts"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Total balance</p>
          <h1 className="text-4xl font-semibold tabular-nums">{formatNaira(totalBalance)}</h1>
        </div>
        <OpenAccountButton onOpened={refresh} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <Card className="text-center p-10">
          <CardTitle>Open your first account</CardTitle>
          <CardDescription className="mt-2">Choose savings or current to start banking.</CardDescription>
          <div className="mt-6"><OpenAccountButton onOpened={refresh} /></div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <AccountCard key={a.id} account={a} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)} />
            ))}
          </div>

          {selected && <Actions account={selected} accounts={accounts} onDone={refresh} />}
        </>
      )}
    </div>
  );
}

function OpenAccountButton({ onOpened }: { onOpened: () => void }) {
  const [type, setType] = useState<AccountType>("savings");
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      await AccountRepository.open(type);
      toast.success(`${type === "savings" ? "Savings" : "Current"} account opened`);
      onOpened();
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <div className="flex items-center gap-2">
      <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="savings">Savings</SelectItem>
          <SelectItem value="current">Current</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={open} disabled={loading}><Plus className="h-4 w-4 mr-1" />Open account</Button>
    </div>
  );
}

function Actions({ account, accounts, onDone }: { account: Account; accounts: Account[]; onDone: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Move money</CardTitle>
        <CardDescription>
          Acting on <span className="font-mono">{account.accountNumber}</span> · balance {formatNaira(account.balance)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="deposit"><ArrowDown className="h-4 w-4 mr-1" />Deposit</TabsTrigger>
            <TabsTrigger value="withdraw"><ArrowUp className="h-4 w-4 mr-1" />Withdraw</TabsTrigger>
            <TabsTrigger value="transfer"><ArrowRightLeft className="h-4 w-4 mr-1" />Transfer</TabsTrigger>
          </TabsList>
          <TabsContent value="deposit"><AmountForm label="Deposit" onSubmit={async (amt, desc) => {
            await TransferService.deposit(account.id, amt, desc); toast.success("Deposit successful"); onDone();
          }} /></TabsContent>
          <TabsContent value="withdraw"><AmountForm label="Withdraw" onSubmit={async (amt, desc) => {
            await TransferService.withdraw(account.id, amt, desc); toast.success("Withdrawal successful"); onDone();
          }} /></TabsContent>
          <TabsContent value="transfer"><TransferForm account={account} accounts={accounts} onDone={onDone} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function AmountForm({ label, onSubmit }: { label: string; onSubmit: (amount: number, desc: string) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  async function action(form: FormData): Promise<void> {
    const amount = Number(form.get("amount"));
    const desc = String(form.get("description") ?? "");
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try { await onSubmit(amount, desc); } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }
  return (
    <form action={action} className="space-y-4 pt-4 max-w-md">
      <div className="space-y-2"><Label>Amount (₦)</Label><Input name="amount" type="number" step="0.01" min="0.01" required /></div>
      <div className="space-y-2"><Label>Description (optional)</Label><Input name="description" maxLength={140} /></div>
      <Button type="submit" disabled={loading}>{loading ? "Processing…" : label}</Button>
    </form>
  );
}

function TransferForm({ account, accounts, onDone }: { account: Account; accounts: Account[]; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  async function action(form: FormData): Promise<void> {
    const to = String(form.get("to") ?? "").trim();
    const amount = Number(form.get("amount"));
    const desc = String(form.get("description") ?? "");
    if (!to) { toast.error("Enter destination account number"); return; }
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      await TransferService.transfer(account.id, to, amount, desc);
      toast.success("Transfer complete");
      onDone();
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }
  const others = accounts.filter((a) => a.id !== account.id);
  return (
    <form action={action} className="space-y-4 pt-4 max-w-md">
      <div className="space-y-2">
        <Label>Destination account number</Label>
        <Input name="to" placeholder="VMB0000000001" required />
        {others.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Your other accounts: {others.map((o) => <button key={o.id} type="button"
              onClick={(e) => { (e.currentTarget.closest("form")!.elements.namedItem("to") as HTMLInputElement).value = o.accountNumber; }}
              className="font-mono underline mr-2">{o.accountNumber}</button>)}
          </p>
        )}
      </div>
      <div className="space-y-2"><Label>Amount (₦)</Label><Input name="amount" type="number" step="0.01" min="0.01" required /></div>
      <div className="space-y-2"><Label>Description</Label><Input name="description" maxLength={140} /></div>
      <Button type="submit" disabled={loading}>{loading ? "Sending…" : "Send transfer"}</Button>
    </form>
  );
}